---
title: Exact cache log
description: A second access log per Redis site with srcache's own verdict, so a hit, a miss and a deliberate bypass are told apart.
---

GridPane's access log (`we_log`) has `$upstream_cache_status`, which the Redis page cache (srcache)
never sets. You cannot tell from it whether a page was a hit, a miss or skipped on purpose. The usual
guess, "no PHP time = hit", cannot see cookie bypasses (logged-in users, carts) and counts them as
misses.

`extras/cache-log/` adds a second access log per site with srcache's own verdict. Install it with
[`extras/cache-log/install.sh`](../commands/cache-log.md); it works without the rest of this repo too,
as long as the site is on GridPane's Redis page cache.

## The log line

One line per request (static files and anything else with `access_log off` are not logged):

```text
2026-10-26T08:32:51+01:00 127.0.0.1 GET 200 0.391 MISS BYPASS skip= dnc=1 287156 "/cart/" "0.390" "Mozilla/5.0 ..."
time                      ip        method status request_time fetch store skip=<$skip_reason> dnc=<Do-Not-Cache> bytes "uri" "php_time" "user_agent"
```

| fetch | store | skip / dnc | means |
|---|---|---|---|
| `HIT` | `BYPASS` | – | served from Redis; PHP did not run (`php_time` = `-`) |
| `MISS` | `STORE` | – | cacheable but not in Redis yet: PHP rendered it and it was stored |
| `BYPASS` | `BYPASS` | `skip=-http_cookie` / `-query_string` / `-request_uri` / `-POST` / `-rest_api` | never cached by design (GridPane's skip rule; `-rest_api` = this repo's engine) |
| `MISS` | `BYPASS` | `dnc=1` | the page sent `Do-Not-Cache` (WooCommerce cart / checkout / account, see the [add-on](../guides/woocommerce-purge.md)) |
| `MISS` | `BYPASS` | – | not a 200 response (404, redirect): srcache stores 200 only |

A marketing-parameter request (`/?gclid=…`) served from the clean URL's entry logs as a hit.

The [perf digest](../guides/perf-digest.md) reads this log for its exact hit / miss / bypass rows.

## Cost

One more `write()` of about 250 bytes per logged request, which is what GridPane already does for its
own log. That is microseconds, against 1 ms for a Redis hit and hundreds of ms for PHP. Disk: roughly
5 MB a day per 20,000 requests, before compression.

Need fewer syscalls on a very busy site? Add `buffer=64k flush=5s` to the `access_log` line. Lines then
reach the file up to 5 s late.
