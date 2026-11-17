# GridPane page cache (FastCGI and Redis): ignore marketing query parameters

Marketing-tagged URLs (`?gclid=`, `?utm_*`, `?fbclid=`) are served from the clean page's cache entry
in GridPane's nginx, without a redirect, so ad and analytics attribution keeps working on both
GridPane page-cache types: FastCGI and Redis.

**Documentation:** https://managingwp.github.io/gridpane-nginx-marketing-params/

<!-- BEGIN docs-index -->
| Section | Link |
|---------|------|
| Overview | https://managingwp.github.io/gridpane-nginx-marketing-params/ |
| Getting started | https://managingwp.github.io/gridpane-nginx-marketing-params/getting-started/installation |
| Guides | https://managingwp.github.io/gridpane-nginx-marketing-params/guides/changing-and-removing |
| Commands | https://managingwp.github.io/gridpane-nginx-marketing-params/commands/install |
| Reference | https://managingwp.github.io/gridpane-nginx-marketing-params/reference/parameters |
| Contributing | https://managingwp.github.io/gridpane-nginx-marketing-params/contributing/repository-layout |
| History | https://managingwp.github.io/gridpane-nginx-marketing-params/history/changelog |
<!-- END docs-index -->

## What it gives you

- **No redirect.** The parameters stay in the browser URL, so GA4, Google Ads (gclid/gbraid/wbraid),
  Meta Pixel (fbclid → `_fbc`) and Microsoft Ads keep working. The 301 approach drops attribution.
- **One cache entry.** Every marketing variant is served from the clean URL's entry
  (`X-Grid-Cache-Mkt: ignored`); any other parameter stays a bypass.
- **No cache poisoning.** On a request that is going to be cached, PHP sees the clean URL, so the
  first visitor's gclid never ends up in links, hidden fields or cookies of the stored page.
- **Never cached:** the REST API, and WooCommerce's cart, checkout and account pages whatever their
  slug.
- **Pure nginx** (`map` + PCRE). No Lua, no njs, and no GridPane-managed file is edited. Every change
  runs `nginx -t` and restores the previous files if it fails.

Several sites on one GridPane server? Use the Redis page cache: FastCGI's cache is a single zone for
the whole server, so a "purge all" on any site empties every site's cache.
[Issue #1](https://github.com/SHIFT64/gridpane-nginx-marketing-params/issues/1) has the evidence and
the list of `purge_all` triggers.

## Quick start

On the GridPane server, as root:

```bash
git clone https://github.com/SHIFT64/gridpane-nginx-marketing-params.git /root/gridpane-nginx-marketing-params
```

```bash
cd /root/gridpane-nginx-marketing-params && ./test.sh && ./install.sh yoursite.com
```

`./install.sh` without a site updates an installed server after `git pull` and keeps your parameter
list. Every install run first checks GitHub for a newer release tag.

## Contributing

Branch from `main`, run `./test.sh`, open a pull request. The repository rules, the release policy
and the documentation gate are in
[Contributing](https://managingwp.github.io/gridpane-nginx-marketing-params/contributing/development).
