---
title: Nginx Helper Preload Cache
description: What Nginx Helper's Preload Cache checkbox actually does on a live Redis site, and why leaving it off is the recommendation.
---

Nginx Helper (GridPane's fork, unchanged from upstream) has a "Preload Cache" checkbox. Checked on a
live Redis site (2026-10-20):

- **It runs once, not after purges.** After the setting is saved, the next request that reaches
  wp-admin (any admin page, the heartbeat, even an anonymous `admin-ajax.php?action=…`) fetches every
  URL listed in WordPress's core sitemaps. It does not run after "purge all", a post save or a
  single-URL purge, so it does not re-warm anything that was purged, and it does nothing for the
  cross-site FastCGI purge from
  [issue #1](https://github.com/SHIFT64/gridpane-nginx-marketing-params/issues/1).
- **It works for FastCGI and Redis** (plain GET requests through nginx, via `/etc/hosts` where the
  domain is listed there). The entries it warms are clean URLs, so gclid/utm variants hit them right
  away.
- **Caveats.** It requests nothing when core sitemaps are off (Yoast, Rank Math, `blog_public=0`). The
  URLs are fetched one after another inside that one request, so a large site can keep it busy for
  minutes, and a page slower than 1 s is probably not stored. It also renders `/cart/`, `/checkout/`
  and `/my-account/`, which are never cached. Saving the setting writes Nginx Helper's whole effective
  options array to the database, including the Redis password that otherwise only lives in
  `wp-config.php`. And if a sitemap answers with something other than XML (Basic Auth, a WAF
  challenge), the triggering request fails with a PHP error.

**Recommendation:** leave it off. At most, use it once as a warm-up after a migration, then switch it
off again.
