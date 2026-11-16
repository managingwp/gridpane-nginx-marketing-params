---
title: Never cached pages
description: Why the REST API and WooCommerce's cart, checkout and account pages are never cached, whatever GridPane's templates say.
---

GridPane's skip rule (FastCGI and Redis templates) knows only `/cart`, `/checkout`, `/my-account`
and leaves `/wp-json/` cacheable. On a shop with other slugs, or for the Store API, a guest's cart
page or `/wp-json/wc/store/v1/cart` (with its nonce) was stored and served to every next guest
without cookies. Found live on a Redis site whose cart is `/koszyk/` (stored in Redis) and on one
whose REST responses were cached.

## REST API, in the engine

On an enabled site every request whose raw path starts with `/wp-json` (also `/WP-JSON`,
`/wp%2Djson`, `//wp-json`) is skipped with the reason `-rest_api` (`X-Grid-SRCache-Skip` /
`X-Grid-Cache-Skip`), and marketing parameters are never ignored there:
`/wp-json/…?gclid=1` stays a BYPASS and PHP sees the original query.

- `?rest_route=…` already bypasses as a real query parameter, and `/index.php/…` is in GridPane's own
  rule.
- A site that moved the REST prefix (`rest_url_prefix` filter) is not covered.
- Sites without the switch keep stock behaviour.

## WooCommerce pages, in the add-on (0.4.0+)

Only WordPress knows which page is the cart, whatever its slug or language. On `template_redirect`
the add-on sends `Do-Not-Cache: 1` when `is_cart()`, `is_checkout()` (including order received),
`is_account_page()` or any plugin defined `DONOTCACHEPAGE` (WooCommerce does on these pages).

GridPane's FastCGI (`fastcgi_no_cache`) and Redis (`srcache_store_skip`) templates both honour
`$upstream_http_do_not_cache`, so the page is never stored. Filter: `gp_woo_never_cache_page`. The
add-on does not depend on the nginx switch; see the [WooCommerce purge
guide](../guides/woocommerce-purge.md).

## Existing entries are not removed

After installing, purge the cart, checkout and account URLs once (or the whole site's cache). The
entries created before the change keep being served until they expire or are purged.
