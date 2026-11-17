---
title: test command
description: Every mode of test.sh — sandbox, installer, cache type, site, live and WooCommerce — and its exit codes.
---

```bash
./test.sh                                # sandbox + installer
./test.sh --cache fcgi|redis|redis-legacy|all   # sandbox only
./test.sh --site example.com             # sandbox with that site's rendered template
./test.sh install                        # installer only
./test.sh live example.com [/path/] [--fresh]   # smoke test of an installed site
./test.sh woo example.com                # WooCommerce add-on test, inside WordPress
```

| Mode | Runs | Touches |
|---|---|---|
| *(no argument)* | Sandbox, then installer | Nothing live |
| `--cache …` | Sandbox test only, for one cache type or all | A throw-away nginx on a random local port |
| `--site` | Sandbox test with that site's rendered GridPane template | A throw-away nginx on a random local port |
| `install` | `install.sh` in every mode, in a throw-away root under `/tmp` | Nothing live; needs root |
| `live` | Read requests against the local nginx for an installed site | The site's cache: creates at most one entry |
| `woo` | The add-on's decisions, inside the site's WordPress via `gp wp` | Nothing: purges and saves are short-circuited |

`live` sends GET requests to `127.0.0.1` with the real `Host` header, so a proxy or CDN in front of
the site is not involved. `--fresh` purges the one page first, which is the only way the "no parameter
value is stored" check proves anything. Give it a page with a trailing `/` so the redirect check runs.

What each mode covers, and what `--fresh` is for, is on [testing](../guides/testing.md).

## Exit codes

- `0` — all checks passed.
- `1` — at least one check failed. `live` also returns `1` when the site is not switched on.
- `2` — a setup error: a missing template, a missing `redis-server`, or a GridPane template the test
  cannot render.
