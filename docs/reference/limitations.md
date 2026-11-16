---
title: Limitations
description: Behaviour worth knowing before you switch a site on — skip rules, the forced cache key, redirect hosts, limits and the variables hash.
---

- **Skip rules without a reason.** A rule that sets `$skip_cache 1` **without** setting or appending
  `$skip_reason` is overridden for marketing-only URLs. Always give a reason:
  `set $skip_reason "${skip_reason}-my_reason";`.
- **The cache key is forced to the stock formula.** On an enabled FastCGI site, the switch sets
  `fastcgi_cache_key` to `$scheme$request_method$host$request_uri` for **every** request, so
  `install.sh` refuses sites with a different key formula (on Redis the key is only rewritten when
  GridPane's own `$key` has the stock formula). The solution also relies on GridPane's literal
  `-query_string` reason, so re-run `./test.sh` after GridPane updates.
- **Redirects to other hosts.** Parameters are re-appended only to a `Location` on the same host (or
  its www/apex twin) or to a `/…` path. A PHP redirect to another domain (alias → primary, S3,
  payment gateways, an affiliate link that passes the query on) gets nothing appended, so the
  parameters are lost there. A same-host redirect that drops the query gets them back. If the target
  already has its own `utm_*`, the parameters end up duplicated. nginx's own redirects inside the PHP
  location are sent with a relative `Location` (valid HTTP).
- **Limits.** Defaults are 24 parameters (empty `&&` segments do not count), 2048 bytes of query and
  8 KB of path. Beyond that you get the stock bypass. Each parameter of the limit costs 4 nginx
  variables, and GridPane's variables hash limit (2048, set in `common/basics.conf`) is shared by the
  whole server, so do not raise it without need.
- **Matching.** Names are matched raw (undecoded) and case-insensitively. `utm%5Fsource` is a bypass
  (safe). `UTM_SOURCE` shares the cache entry, although PHP treats it as a different name.
- **Clones and staging on the same server.** GridPane copies the switch, so the copy is enabled
  straight away. Pushing staging to production re-enables the feature on a production site where it
  was disabled. `./install.sh --status` lists every site that has the switch.
- **`Set-Cookie` in the cache.** Stock GridPane caches responses together with `Set-Cookie`. PHP never
  sees the marketing values, so no cookie can be built from them.
- **Purge has to reach the local nginx** (FastCGI) with the same `$scheme` and `$host` as the cache
  key. If the site's domain points somewhere else (a proxy/CDN) and `/etc/hosts` has no `127.0.0.1`
  entry for it, Nginx Helper's purge requests never reach this server. With Redis, Nginx Helper talks
  to Redis directly, so this does not apply.
- **New variables and nginx's variables hash.** Every variable of the server shares one hash whose
  size GridPane caps (in `common/basics.conf`; GridPane strips that setting from any other file). Too
  many or too long variable names make every `nginx -t` warn "could not build optimal
  variables_hash" (harmless, but noisy). The Redis support adds 6 short names; on the test server the
  engine with a 24-parameter limit stays below the cap. Raising `MAX_PARAMS` adds 4 variables per
  parameter.
