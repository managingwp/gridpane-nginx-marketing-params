---
title: GridPane marketing params
description: Serve marketing-tagged URLs from the clean page's cache entry on GridPane's FastCGI and Redis page cache, without a redirect.
slug: /
---

This gives you WP Rocket's "ignored parameters" behaviour in GridPane's nginx, for both
page-cache types GridPane offers for WordPress: **FastCGI** and **Redis**.

```text
example.com/about-us/?gclid=something
example.com/about-us/?gclid=somethingelse&utm_source=fb
// both are served from the cache entry of:
example.com/about-us/
```

:::warning[Several sites on one GridPane server? Use the Redis page cache.]
GridPane's FastCGI cache is a single zone for the whole server: a "purge all" on any site
(Nginx Helper's button, a theme switch, "purge on update", a plugin calling `purge_all`) empties
**every** site's cache. The Redis page cache keeps each site in its own database and every purge
stays within the site. The evidence and the list of `purge_all` triggers are in
[issue #1](https://github.com/SHIFT64/gridpane-nginx-marketing-params/issues/1). This repository
works with both cache types.
:::

- **No redirect.** The parameters stay in the browser URL, so GA4, Google Ads (gclid/gbraid/wbraid),
  Meta Pixel (fbclid → `_fbc`), Microsoft Ads and the rest keep working. A 301 that drops the
  parameters breaks attribution.
- **One cache entry.** A request whose query contains only marketing parameters is served from the
  clean URL's entry, with the header `X-Grid-Cache-Mkt: ignored`.
- **Every other parameter behaves as in stock GridPane.** `/?s=foo&gclid=1` and
  `/x/?page=2&utm_source=x` bypass the cache, and PHP gets the original URL.
- **No cache poisoning.** On a request that is going to be cached, PHP sees the clean URL, so the
  first visitor's `gclid` never ends up in links, pagination, hidden fields or cookies of the stored
  response.
- **WordPress redirects keep the parameters.** Missing trailing slashes, www → apex, canonical
  redirects and 404 URL guessing re-append them to a `Location` on the same host.
- **Pure nginx** (`map` + PCRE). No Lua or njs, and no GridPane-managed file is edited.

The REST API (`/wp-json/…`) and WooCommerce's cart, checkout and account pages are never cached,
whatever GridPane's templates say.

## Start here

- [Install it on a GridPane server](./getting-started/installation.md) — one engine per server, one
  switch per site.
- [How it works](./reference/how-it-works.md) — the decision point, the files it touches, and what
  survives a GridPane update.
- [The parameter list](./reference/parameters.md) — the grammar, and which parameters belong on it.
