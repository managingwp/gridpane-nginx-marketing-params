---
title: Testing
description: The sandbox, installer, live and WooCommerce tests — what each one covers, and why none of them touches the live nginx.
---

```bash
./test.sh
```

Runs the sandbox test and the installer test below (`./test.sh --cache all` = sandbox only,
`./test.sh install` = installer only).

## Sandbox

Starts a throw-away nginx on a random `127.0.0.1` port. It uses the server's own binary, **GridPane's
real templates from this server** (`/etc/nginx/common/wpfc.conf` and `/etc/nginx/common/wp-redis.conf`),
the files from this repo, and a fake PHP backend (`tests/fake_php.py`). For Redis it also starts a
throw-away `redis-server` on a unix socket inside its temp directory (one database per test vhost, as
GridPane does).

It runs 129 FastCGI and 144 Redis checks (144 more for GridPane's legacy Redis template) and then
cleans up. Covered, for both cache types:

- cache sharing and no poisoning;
- bypass for other parameters;
- limits, and an absolute-form request line with an empty path (`GET https://host?gclid=1`);
- POST, cookies, excluded URIs, your own skip rules and your own rewrites taking precedence;
- redirects, including foreign hosts, relative URLs and nginx's own `return 301`;
- purge;
- a site without the switch, and a vhost without the cache-type flag;
- `nginx -t` after a clone to a server without the engine, without `params.list`, and on a site
  without page cache;
- a clean error log;
- FastCGI only: the switch of one site with the flag of another, switch files of an older version, and
  the site's FastCGI flag with its Redis switch, stay stock;
- Redis only: the entry is stored under the clean URL's stock key (`dbN:httpGET<host>/path/`) with
  GridPane's TTL; encoded paths; HEAD; no key ever contains a marketing parameter; every key keeps its
  own database's `dbN:` prefix; a customised key formula, a FastCGI switch left on a Redis vhost, a
  Redis switch without its flag, and the switch of one site with the flag of another stay stock.

## Installer

`./test.sh install` copies this repo into a throw-away root under `/tmp` (with `install.sh`'s
`/etc/nginx`, `/var/www` and `/root` moved into it), renders GridPane's real templates from this server
for a few fake sites, and runs `install.sh` with the server's real `nginx -t` on that copy (`systemctl`
only records the call; nginx's own messages go to the throw-away root, not to the server's error log).

133 checks: install and re-install (byte-identical); FastCGI, Redis, legacy-Redis and no-cache sites;
site names containing "lua"; fourteen kinds of template or site file the installer must refuse (ten on
Redis, four on FastCGI), including GridPane's add-on-domain overlay for both cache types (skipped, old
switch removed, nothing else touched); a site file added later (reported as unsafe); a trailing `/` and
an invalid site argument; cache-type changes in both directions and to no cache; a clone (reported,
rewritten by the next install run); a staging push that leaves the other cache type's flag behind; a
flag/switch pair of two sites; an `nginx -t` failure (every file restored, no reload); `--apply-list`
(broken and valid); `--disable`; `--uninstall`; and `--status` / `--disable` / update / `--uninstall`
with an engine and site files from before the Redis support. Needs root; never touches the live
config. Without GridPane's Redis template or the Redis nginx modules it is skipped with a notice.

## Choosing cache types and sites

```bash
./test.sh --cache fcgi
./test.sh --cache redis
./test.sh --cache redis-legacy
./test.sh --site yoursite.com
```

One cache type only, or the sandbox suite against that site's rendered template (FastCGI or Redis,
whichever the site uses).

When GridPane keeps its legacy Redis template next to the current one (`wp-redis-legacy.conf`), the
default run tests it too (one database and the `nginx-cache:` prefix for every site, redirects stored
as well). On a server without `redis-server` or the Redis nginx modules, the Redis part is skipped with
a notice.

**It never touches the live nginx or the sites.** Run it after every GridPane update: if GridPane
changes its template, the test catches it.

## Live test after installation

```bash
./test.sh live yoursite.com /some-page/
./test.sh live yoursite.com /some-page/ --fresh
```

It sends GET requests only, straight to the local nginx (127.0.0.1, so no proxy/CDN in front is
involved). It checks:

- a hit with gclid;
- a shared entry with the clean URL;
- a bypass for another parameter;
- that the missing-trailing-slash and www → apex redirects keep the parameters;
- FastCGI: that **purge requests reach nginx the way WordPress sends them**:
  `GET https://<site>/purge/<probe>/` through normal DNS (often the server's public IP, not
  127.0.0.1) must answer 412/200. A 401/403 means Basic Auth or an IP allowlist blocks the server's
  own requests, so Nginx Helper cannot purge anything (seen for 23 hours after a domain swap). The
  probe URL is never cached, so nothing is purged;
- Redis: in the site's own database (read with the credentials nginx uses; nothing is printed), that
  the page is stored under its clean stock key and that no key contains the test's token.

`--fresh` purges that one page first, so the first marketing request is rendered by PHP and the test
really checks that no parameter value ends up in the stored HTML. Without it, the page may already be
cached and that check proves nothing.

Give it a page with a trailing `/` so the redirect test runs too.

## WooCommerce add-on test

```bash
./test.sh woo yourshop.com
```

FastCGI sites only: on Redis, Nginx Helper deletes keys directly and the test could not keep them.
Runs inside the site's WordPress (`gp wp … eval-file`). It fires the hook the WooCommerce data store
fires after a save, for a real product and variation, and checks which URLs reach Nginx Helper's
purger. Every outgoing HTTP request is short-circuited and the unlink method is pointed at a missing
file, so **nothing is purged and nothing is saved**.

Covered: quantity-only change → no purge; stock status / price / scheduled sale → purge;
variation → parent; parent categories; one purge per URL per request; drafts; order and order-note
exclusions; direct `_stock_status` / `_price` meta writes (and `_stock` alone → no purge); the
home-page setting (both values); Nginx Helper trimmed (no feeds, no AMP fetch: one `purge_url()` = one
request; `edit_term`/`delete_term` handler replaced; 176 term edits → one home-page purge); the
trimming is never saved (the filters of Preload Cache's save run on a copy) while a real settings
change is.

Not covered (needs a real web request): purging after the response.

## Exit codes

- `0` — all pass.
- `1` — at least one failure. The live test also returns `1` when the site is not switched on.
- `2` — a setup error (for example, GridPane changed its template).
