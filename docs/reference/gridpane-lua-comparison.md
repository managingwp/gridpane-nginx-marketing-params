---
title: GridPane Lua query-param cache
description: What GridPane's hidden Lua query-parameter cache does, what we measured on a live WooCommerce site, and how it compares with this repository.
---

GridPane announced the feature in **Platform & Scripts v1.2.1514** (2026-09-29) as "Query Parameter Caching (nginx + lua) gp-cli … Documentation coming soon". As of this writing there is no KB article and no CLI help. Everything below comes from two sources:

- **The gp-cli source code.** `/usr/local/bin/lib/{stack,site,nginx}.sh`, gp-cli **1.2.1518**, configs 1.2.90, GridPane nginx 1.30.4.
- **A live A/B test on one WordPress + WooCommerce site with FastCGI caching** (2026-10-06). The same scripted matrix ran three times, one mode after another: stock GridPane, GridPane Lua, and [this repo](../index.md).

GridPane may change the feature at any time, so treat this as a snapshot of that version.

## TL;DR

- The feature does what the changelog says: marketing-tagged URLs are served from the clean URL's cache entry, without a redirect, and anything unknown falls back to BYPASS.
- **Main issue: it normalises only the cache key.** On the cache MISS that fills the shared entry, PHP still receives the visitor's tracking parameters. Whatever the page renders from them is cached and served to everyone, including `Set-Cookie`, because GridPane caches that header. Live evidence:
  - the WooCommerce home page was cached with the first visitor's token **34 times**;
  - a cookie built from `gclid` was **replayed to later visitors**.
- Only use it on pages that provably don't render query parameters into HTML or cookies, or use this repo, which gives PHP the clean URL on cacheable requests.

## How it works (from the source)

**Commands**

```bash
gp stack nginx -lua query-param-cache ensure-ready      # enable lua module + package path + deploy engine (transactional)
gp site <site> -lua-query-param-cache on                 # per site; also: off | status | regenerate [-force-rewrite]
gp stack nginx -lua query-param-cache regen              # after editing the list
gp stack nginx -lua query-param-cache show               # read-mostly report
gp stack nginx -lua disable                              # refused while any site is on
```

**Requirements.** The `query-param-cache` commands hard-require GridPane nginx **1.28.x or 1.30.x**. The Lua module, LuaJIT and lua-resty-core all ship in the `gridpane-nginx` package, so nothing is installed with apt. Enabling the module reloads nginx. It does a **full restart only if libluajit is not already loaded** in the nginx master. On our server ModSecurity had already loaded it, so it was a reload and the master PID stayed the same.

**Supported caches.** FastCGI, Redis (`wp-redis`) and proxy-Redis. Sites with php-only or no cache are refused.

**Mechanism**
- `on` writes per-site overlays to `/etc/nginx/common/_custom/` (`<site>-wpfc.conf`, `<site>-fcgi-cache-var.conf`, plus dormant Redis/proxy variants).
- In the overlay, `set_by_lua_block $cache_uri { … }` computes the key. The stock `if ($query_string != "") { skip }` is replaced by `if ($cache_uri ~ "[?]") { skip, -query_param }`.
- `fastcgi_cache_key` uses `$cache_uri`.
- The feature **never lowers `$skip_cache`** for GridPane's other rules (POST, URIs, cookies) or for custom skip rules.
- `$args`, `REQUEST_URI` and the upstream request are **left untouched**.

**Param list.** `/etc/nginx/gridpane/cache-key-query-params.list` uses a strict grammar: `exact <name>` / `prefix <name>`, `[A-Za-z0-9_]+`. Apply changes with `regen` (LuaJIT probe, `nginx -t`, confirmed reload, rollback on failure). GridPane never overwrites a list that has already been seeded.
- Default: prefixes `utm_`, `gad_`, `hsa_`, `tw_` plus 32 exact names (gclid, gclsrc, gbraid, wbraid, _ga, _gl, _gtrk, msclkid, fbclid, fb_ad_id, fb_action_*, fb_source, __hstc/__hssc/__hsfp, _kx, njclid, njesid, cq_*, aaa_*, gtm_debug).
- Deliberately no generic names and no `fb_` prefix.
- Some names ship commented out as "Tier 2": dclid, srsltid, gad, _hsenc, _hsmi, hsCtaTracking, _ke, fbadid, mibextid.

**Matching rules**
- A request is cacheable only if **every** non-empty parameter is on the list. Anything unknown means BYPASS.
- Limits: **64** parameters / **4096** bytes.
- These always BYPASS (fail-closed):
  - an encoded name (`%` in the name),
  - a malformed `%` anywhere,
  - any raw `;`,
  - an empty name (`=x`).
- Matching is **case-sensitive**. A bare `?` shares the path's entry.

## Main issue: cached output built from the first visitor's parameters

GridPane's FastCGI config caches responses together with `Set-Cookie` (`fastcgi_ignore_headers Cache-Control Expires Set-Cookie;` in `conf.d/fastcgi.conf`, and no `fastcgi_hide_header Set-Cookie`). Stock GridPane never caches a response rendered from a visitor's query string, because any query means BYPASS. The Lua feature changes that. The MISS for `/?gclid=A` renders with `gclid=A` visible to PHP, and that response becomes the entry for `/`.

### Evidence (live, same site, Lua mode)

| Step | Request | Result |
|---|---|---|
| 1 | `GET /?gclid=TOKEN&utm_source=TOKEN` (WooCommerce home) | `X-Grid-Cache: MISS`, `X-Grid-Cache-Skip: ignored_query_string`. The HTML contains TOKEN **34×** (TOKEN was used as both values) |
| 2 | `GET /` (a clean, later visitor) | `X-Grid-Cache: HIT`. The HTML still contains TOKEN **34×** |
| 3 | `GET /zz-cmp-cookie.php?gclid=cmplua23188E` (test script: `setcookie()` from `$_GET['gclid']`) | `MISS`, `Set-Cookie: cmp_gclid=cmplua23188E; path=/` |
| 4 | `GET /zz-cmp-cookie.php` (clean, later visitor) | `HIT`, **`Set-Cookie: cmp_gclid=cmplua23188E; path=/`**, the first visitor's value |
| 5 | `GET /zz-cmp-echo.php?gclid=…&utm_source=…` (test script printing what PHP sees) | `MISS`. PHP saw `REQUEST_URI=/zz-cmp-echo.php?gclid=…`, `QUERY_STRING=gclid=…`, `$_GET` with gclid. A later clean visitor got that output from cache |

For comparison, on the same requests:
- **stock GridPane:** steps 1, 3 and 5 are BYPASS, and a clean visitor gets 0 occurrences and no cookie;
- **this repo:** PHP saw the clean URL, so 0 occurrences and no cookie.

Steps 3–5 used one-line test scripts. Steps 1–2 are real WooCommerce output.

### Reproduce it

Run this on any FastCGI site with the feature on. Replace `SITE` and create the file as the site's user.

```bash
echo '<?php if (isset($_GET["gclid"])) { setcookie("qpc_test", $_GET["gclid"], 0, "/"); } echo microtime(true);' > /var/www/SITE/htdocs/qpc-cookie-test.php
curl -s "https://SITE/purge/qpc-cookie-test.php" > /dev/null
curl -s -D - -o /dev/null "https://SITE/qpc-cookie-test.php?gclid=VISITOR_A" | grep -iE 'x-grid-cache|set-cookie'
curl -s -D - -o /dev/null "https://SITE/qpc-cookie-test.php?gclid=VISITOR_B" | grep -iE 'x-grid-cache|set-cookie'
rm /var/www/SITE/htdocs/qpc-cookie-test.php
```

The second request (visitor B) is a `HIT` and receives `qpc_test=VISITOR_A`.

To check your own pages for HTML echoes:
1. Purge the page.
2. Request it with a unique `gclid`.
3. Request it clean.
4. Search the HTML for the value.

### Impact

- **Corrupted attribution.** One visitor's gclid/utm values end up in links, forms and cookies served to other visitors (pagination links, `add_query_arg()`, plugins that store UTMs).
- **Privacy.** Any plugin that keeps a visitor-specific ID in a cookie would have that cookie handed to everyone who opens the cached URL.

### Suggested fixes

1. For requests the feature makes cacheable, pass PHP the **clean** URL: an empty `QUERY_STRING` and `REQUEST_URI` = path. Re-append the original parameters to same-host 3xx `Location` headers so WordPress redirects keep them. This is what this repo does; see [`server/marketing-params/php-context.conf`](https://github.com/managingwp/gridpane-nginx-marketing-params/blob/main/server/marketing-params/php-context.conf).
2. At minimum, don't store a response that carries `Set-Cookie` when `skip_reason = ignored_query_string`. That stops cookie replay, but not HTML echoes.
3. Document the rule: only parameters that are read in **JavaScript** belong on the list.

## Other findings

- **Default list gaps.** These BYPASS by default: dclid, srsltid, fbadid, ttclid, twclid, li_fat_id, sccid, rdt_cid, epik, yclid, _ke, _hsenc, _hsmi, `mtm_*`, `pk_*`, igshid, mkt_tok. Some of them are commented "Tier 2" entries.
- **Case-sensitive matching.** `UTM_SOURCE` and `Gclid` are BYPASS. `utm_Source` is cacheable, because only the prefix is compared.
- **Labels.**
  - `X-Grid-Cache-Skip: ignored_query_string` appears on every cacheable request with a query, including HITs.
  - It overwrites `-POST` on POST requests. This is only the label; the request is still not cached.
  - A custom skip rule without a reason is BYPASS, but it is labelled `ignored_query_string`.
- **Template snapshot.** In the tested version, `on` copies the site's cache template into `common/_custom/`. Later GridPane template fixes reach that site only after `on` or `regenerate -force-rewrite` is run again. GridPane may change this.
- **Revert leaves files behind.**
  - `off` re-renders the site from the current templates, and `disable` unloads the module.
  - Left behind: `/etc/nginx/lua/`, `/etc/nginx/gridpane/`, `/etc/nginx/common/lua-qp-cache.conf`, and env keys in `/root/gridenv/nginx.env` and the site env. They have no effect.
  - **Purge the cache after `off`.** Entries cached under the clean key keep being served until they are purged or expire.
- **Runtime notes.**
  - About +2 MB RSS per nginx process (single snapshot).
  - An `[error]`-level `query_cache: init OK` line is logged on every start or reload.
  - `init_by_lua` validates the policy on reload, but not under `nginx -t`.
  - The engine, policy and list files are owned by www-data and loaded by the root master.
- **Performance.** HIT throughput for marketing URLs was the same in all three setups, about 830 req/s (the ab test over TLS was TLS-bound). Stock GridPane served the same URL at 12 req/s, as a BYPASS to PHP.

## Our test procedure

```bash
# enable (master PID unchanged = reload)
gp stack nginx -lua query-param-cache ensure-ready
gp site <site> -lua-query-param-cache on
# ... run the matrix ...
# revert
gp site <site> -lua-query-param-cache off
gp stack nginx -lua disable
rm -rf /etc/nginx/lua /etc/nginx/gridpane && rm -f /etc/nginx/common/lua-qp-cache.conf   # optional, inert leftovers
# purge the site's cache afterwards
```

Limits of the test:
- one site, three modes run in sequence, each mode once;
- the cookie and redirect cases used small test PHP scripts;
- performance and memory figures come from a single session.

## Side by side with this repo

| | GridPane Lua (hidden) | This repo |
|---|---|---|
| Setup | `gp stack nginx -lua query-param-cache ensure-ready`, then `gp site <site> -lua-query-param-cache on`. Needs GridPane nginx 1.28.x/1.30.x. nginx reloads; it restarts fully only if LuaJIT is not loaded yet (on the test server it already was, so it reloaded). | `./install.sh <site>` (`nginx -t`, reload, rollback) |
| Docs / maintenance | Only a changelog entry (v1.2.1514, "documentation coming soon"); maintained by GridPane | This site plus tests; maintained by you |
| Page-cache types | FastCGI, Redis, proxy-Redis | FastCGI, Redis |
| No redirect, shared entry, unknown parameter → bypass, purge | ✅ | ✅ |
| What PHP sees when the page is cached (MISS) | **The original URL.** Whatever the page renders from the first visitor's parameters is cached for everyone. Live: the WooCommerce home page was cached with the first visitor's tracking value 34× and served to later clean visitors. A cookie that PHP built from gclid was replayed from the cache. | **The clean URL** (0 echoes, no cookie). Trade-off: listed parameters never reach PHP on cacheable pages (see [the golden rule](./parameters.md#the-golden-rule)). |
| WordPress redirects (trailing slash, www → apex) | ✅ keep parameters | ✅ keep parameters |
| Same-host redirect that drops the query | Parameters lost (as in stock) | Parameters re-appended |
| Custom skip rules | Any rule wins (it never lowers `$skip_cache`) | Rules must set a `$skip_reason`, otherwise overridden |
| Default list | 4 prefixes + 32 names. Misses e.g. dclid, srsltid, ttclid, twclid, li_fat_id, yclid, `mtm_*`, `pk_*`, _hsenc, fbadid (some ship commented out) | 4 prefixes + 72 names, covering those. Misses GridPane's `tw_*`, njclid, `cq_*`, `aaa_*`, gtm_debug. Includes campaignid/adgroupid, which GridPane deliberately leaves out |
| Matching | Case-sensitive. Any `;` or malformed `%` → bypass | Case-insensitive. `;` / malformed `%` inside values accepted |
| Limits | 64 params / 4096 bytes | 24 / 2048 by default (configurable up to 48 / 8192) |
| Editing the list | Strict `exact/prefix` grammar, then `gp … query-param-cache regen` (probe, `nginx -t`, rollback) | nginx map syntax, then `./install.sh --apply-list` (`nginx -t`, last good list restored on error) |
| Lifecycle | GridPane-managed: clones, migrations, staging, aliases. In the tested version `on` snapshots the site's cache template, so later GridPane template fixes need `on` / `regenerate -force-rewrite` again (this may change) | Never edits GridPane templates, but forces the stock cache key and relies on the `-query_string` reason. Re-run `./test.sh` after GridPane updates |
| Observability | `X-Grid-Cache-Skip: ignored_query_string` on every request with a query (also on hits and POST); bypass reason `-query_param` | `X-Grid-Cache-Mkt: ignored`; GridPane's reasons untouched otherwise |
| Performance (HIT) | ≈ 830–840 req/s. Plus ≈ 2 MB RSS per nginx process (single snapshot) | ≈ 820–830 req/s. Stock for reference: 849 req/s clean hit, but **12 req/s** for a marketing URL (bypass → PHP) |
| Revert | `off` + `gp stack nginx -lua disable`. Leaves inert files behind. Purge afterwards | `./install.sh --disable` / `--uninstall` |

**When to choose which**

- **GridPane Lua** is the better fit for proxy-Redis (ModSecurity) caching, or when you want everything
  vendor-managed. Use it only if your pages provably do not render query parameters into HTML or
  cookies. To check, request a page with a unique `gclid`, then the clean URL, and search the HTML and
  `Set-Cookie`. (srcache never stores `Set-Cookie`, so on Redis only HTML echoes are a risk;
  WordPress core's comment form is one.)
- **This repo** is the better fit for FastCGI and Redis sites whose theme or plugins echo parameters
  (WooCommerce and WordPress's comment form did), or when you want the broader default list. In
  exchange you accept: PHP never sees listed parameters, custom skip rules need a reason, and you
  maintain it yourself.

**Never run both on the same site.**
