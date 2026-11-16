---
title: Redis page cache
description: How the switch works on GridPane's Redis page cache — the key formula, per-site isolation, what is never stored, and the measured numbers.
---

The same switch works on sites with GridPane's Redis page cache (srcache + redis2,
`/etc/nginx/common/<site>-wp-redis.conf`). `./install.sh <site>` detects the cache type and installs
the Redis switch and flag. What is different from FastCGI:

## The key

GridPane computes `set $key "dbN:$scheme$request_method$host$request_uri";` and `$escaped_key` in the
PHP location, before the site's `*-php-context.conf` files. The Redis switch recomputes both after the
decision: the clean URL's stock key, with the site's own `dbN:` prefix.

The prefix is read from GridPane's `$key` at runtime, never written into a file, because clones and
staging copies get a different database but copy `/var/www/<site>/nginx/` verbatim.

## Fail-safe

If `$key` does not have exactly the stock formula (a GeoIP variant, a customised key), nothing is
un-skipped and GridPane's key is left untouched. As for FastCGI, the flag and the switch must carry
the same site name (see [how it works](../reference/how-it-works.md)), and `install.sh` refuses the
templates and site files listed under
[installation](../getting-started/installation.md#sites-that-are-skipped), plus the ModSecurity proxy
front (no PHP-location hook).

## Isolation stays

Entries stay in the site's own database with the site's own prefix, so the per-site purges described
in [issue #1](https://github.com/SHIFT64/gridpane-nginx-marketing-params/issues/1) keep working.
Verified on a live site with Nginx Helper's per-URL purge (a post save), "purge all"
(`wp nginx-helper purge-all`, the neighbour site's entries survived with their TTL still counting
down) and the GridPane panel (`gp fix cache <site>`). Each of them also cleared entries first created
by a gclid/utm request.

## What srcache never stores

`Set-Cookie` (unlike FastCGI), 404s, HEAD responses, and redirects (the current template stores status
200 only; the legacy one also stores 301/302/307/308, which works the same way because the `Location`
fix is applied per response). The headers this repo adds (`X-Grid-Cache-Mkt`, the `Location` fix) are
not stored either; they are added again on every response.

## Headers

`X-Grid-SRCache-Fetch: HIT` plus `X-Grid-Cache-Mkt: ignored`; `X-Grid-SRCache-Skip` disappears when
nothing is skipped (as for a clean URL).

## Measured on a live site

WordPress 7.1, `ab -k -c 8`: `/hello-world/?gclid=…&utm_source=…` went from about 64 req/s (bypass to
PHP) to about 6,300 req/s (hit; clean URL about 7,000). With WooCommerce, `/shop/` and a product page
with gclid share the clean entry; `?add-to-cart=13&utm_source=x&gclid=…` stays a bypass and the
product lands in the cart.

## Why PHP must see the clean URL here too

On that site WordPress core's comment form echoes the query string into `/hello-world/` (the "cancel
reply" link), and a WooCommerce product page echoed the gclid once. Without the clean URL the first
visitor's gclid would be cached for everyone. With it: 0 occurrences
(`./test.sh live <site> /hello-world/ --fresh`).

## Legacy template

Servers without the `redis-page` instance (prefix `nginx-cache:`, one shared database) work the same
way, but there is no per-site isolation to keep.

## Not behind GridPane's HTTP auth / IP allowlist

GridPane's `common/acl.conf` uses `satisfy any`: nginx leaves the access phase as soon as the
allowlist or the password check passes, and srcache's cache lookup always runs last in that phase, so
it is skipped. A protected site (typically a staging copy) reports `X-Grid-SRCache-Fetch: BYPASS` with
an empty `X-Grid-SRCache-Skip` on every request and always runs PHP; each nginx worker still writes a
page once after a start or reload, but nothing is ever read. This is GridPane/nginx behaviour, not
this repo's, and FastCGI is not affected.

The parameter handling still works there (verified live: entries under the clean key, nothing rendered
from the query), but you cannot see cache hits: test on an unprotected site, or protect the site with
a per-site `allow …; deny all;` (`*-main-context.conf`, without `satisfy any`) instead of GridPane's
HTTP auth. `--status` and `./test.sh live` point this out.

The same `satisfy any` lets a cached direct `*.php` URL (one that GridPane's skip rule does not
exclude, i.e. not `index.php` or `wp-*.php`) be served to a visitor who passed neither check; on
WordPress that is practically nothing, but keep it in mind for custom PHP endpoints.
