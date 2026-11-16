---
title: WooCommerce purge add-on
description: The mu-plugin that purges the URLs GridPane's Nginx Helper never hears about when a price or stock level changes, and trims the purges it does send.
---

`extras/woo-purge/gp-woo-purge.php` is installed as
`wp-content/mu-plugins/gp-woo-purge.php`. It is independent of the nginx part: it fixes stock
GridPane purging and also works on sites without the switch.

It matters more once marketing URLs are served from the cache: before that, ad traffic always got a
fresh page (a bypass); now it gets the cached one, so a stale cached page reaches more visitors.

Install it with `./install.sh --full site.com`, `--woo-purge site.com` or `--remove-woo-purge site.com`
on the [install command page](../commands/install.md).

## The problem

GridPane's Nginx Helper (audited: 9.9.10) purges on `transition_post_status`, i.e. when WordPress
updates the post. WooCommerce saves a change that touches only prices or stock straight to the
database, without `wp_update_post()`, so Nginx Helper never hears about it. This covers the stock
change after an order, REST API / ERP updates, imports, bulk edit, variation saves and scheduled
sales.

The cached product page keeps the old price or "in stock" until it expires: GridPane's FastCGI default
is 1 hour, its **Redis default is 30 days**, so on Redis the add-on (or a much shorter cache TTL for
the shop) matters even more. Nginx Helper has no WooCommerce-specific code.

On a live shop (WooCommerce 11.1, HPOS off, 5 days of logs): 53 products and 22 variations changed,
and **not one** product or category URL was purged. At the same time, every order status change and
order note purged the home page, `/author/admin/` and the feeds: about 190 home-page purges a day, on
the page most ads land on.

## What it does

| Event | Purged |
|---|---|
| price, regular/sale price, sale dates, or **stock status** (in stock ↔ out of stock ↔ backorder) changes, by any code path | home page, shop page, the product, every public archive it is in (categories **including parent categories**, tags, brands, attributes with archives), each with its `/page/N/` URLs (up to 5) |
| `_stock_status` or `_price` **post meta** changes without a WooCommerce save (code calling `update_post_meta()` directly: stock-sync workers, ERP imports, checkout stock checks) | the same as above. WordPress fires `added_post_meta` / `updated_post_meta` only when the stored value really changes, so rewriting the same value purges nothing. Filter: `gp_woo_purge_meta_keys` |
| stock **quantity** changes but the status stays the same | nothing (a deliberate choice: "12 left" → "11 left" is not worth a purge) |
| variation changes | its parent product (and the parent's archives) |
| order, refund or coupon saved / status changed / note added | nothing any more (excluded from Nginx Helper's triggers) |
| any term edited or deleted (categories, tags, brands, menus…) | **one** home-page purge per request, instead of Nginx Helper's home page + 3 feeds per term (an hourly import of 176 categories made 704 requests); nothing when the home page is switched off |

## Never-cached pages

Since 0.4.0 the cart, checkout and account pages send `Do-Not-Cache: 1` whatever their slug, see
[never cached pages](../reference/never-cached-pages.md). `./test.sh woo <site>` checks the decision
for the three pages and an ordinary page (on any cache type).

## It also trims Nginx Helper's own purges

This happens in memory, for every request; nothing is saved.

- **No feed purges.** GridPane's templates never cache `/feed/` (it is in the `$skip_cache` rule), but
  Nginx Helper purges `feed/`, `feed/atom/` and `feed/rdf/` next to every URL: 3 of every 4 purge
  requests could never clear anything. Filter: `gp_woo_purge_disable_feed_purges`.
- **No AMP fetches.** GridPane's fork "purges" the AMP version by **requesting the page** `…/amp/`
  instead of `/purge/…/amp/`: a full PHP render of a 404 for every purged URL whenever the purge runs
  during a page view. Seen on a live shop: about 70 a day each of `/amp/`, `/author/admin/amp/` and
  `/?post_type=shop_order&p=…/amp/`. Switched off unless an AMP plugin is active (filter
  `gp_woo_purge_disable_amp_purges`).
- **Never saved.** Nginx Helper saves its whole in-memory settings when
  [Preload Cache](../guides/nginx-helper-preload.md) runs or a post is scheduled; the add-on puts the
  stored (or default) `purge_feeds` / `purge_amp_urls` back into such a save, so removing the add-on
  brings Nginx Helper's own settings back. Changes made on the settings page or with wp-cli are saved
  as usual.
- **After the response.** Every purge is a blocking HTTPS request from the server to itself (about
  16 ms each, measured). The add-on calls `fastcgi_finish_request()` first, so a checkout, a payment
  callback or an admin save no longer waits for 10–30 loopback requests. WP-CLI runs are unchanged.

## Home page setting

By default the home page is purged with every product change and once per request for term edits. A
shop whose home page shows no prices or stock (say, a B2B catalogue with its own navigation cache) can
switch that off:

```bash
gp wp yourshop.com option update gp_woo_purge_home no      # back on: option delete gp_woo_purge_home
```

- Every URL is purged once per request, at `shutdown`. A checkout that changes ten products purges the
  home and shop pages once.
- It calls Nginx Helper's own purger, so it uses the site's purge method and appears in Nginx Helper's
  log. Without Nginx Helper, or with purging switched off, it does nothing.
- On Redis page-cache sites it works the same way: each purge is then a `DEL` in the site's own Redis
  database instead of an HTTP request.
- Purging the clean URL also clears its gclid/utm variants, because they share its cache entry.
- Only published products. Drafts and private products have no cached page.
- `/page/N/` URLs are estimated from the product count and `loop_shop_per_page`. A page that does not
  exist costs one purge request that finds nothing; archives with more than 5 pages keep pages 6+ until
  they expire.
- Filters: `gp_woo_purge_home`, `gp_woo_purge_disable_feed_purges`, `gp_woo_purge_disable_amp_purges`,
  `gp_woo_purge_trigger_props`, `gp_woo_purge_excluded_post_types`, `gp_woo_purge_max_pages`,
  `gp_woo_purge_urls` (see the file header).
- The trimming relies on internals of GridPane's Nginx Helper fork (`$nginx_helper_admin->options`,
  `$nginx_purger`), checked with guards; `./test.sh woo` tells you if a new Nginx Helper version breaks
  it.

## Not handled yet

- **Bulk syncs (ERP, feeds, imports).** A sync that changes hundreds of prices or stock statuses in one
  request purges every affected product page and archive page once (the first product costs about 20
  purge requests on a typical shop, each further one its own page plus any archives not purged yet).
  These are cheap local GETs, so a few hundred are fine. For shops whose sync changes most of the
  catalogue at once, a "purge everything above N products" threshold would be better. Check how the
  shop's sync behaves before installing.
- **Editing a term does not purge its archive** (say `/kategoria/x/` after a rename), as in stock Nginx
  Helper; only the home page, once per request. Purging archives per edited term would turn an import
  that rewrites unchanged categories into hundreds of empty purges, so it waits for a queued design
  (for example Action Scheduler, one run after the import). Fix such imports at the source: write only
  real changes.
- Moving an order to the trash still purges the home page (Nginx Helper's trash hook has no post-type
  filter).
- Multilingual sites (WPML, Polylang): only the URLs WordPress returns for the current language are
  purged.
- GridPane's scripts were audited for the nginx files, not for `mu-plugins/`. Check
  `./install.sh --status` after a restore or clone, as for the switch files.
