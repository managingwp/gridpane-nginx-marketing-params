---
title: Nightly perf digest
description: One Discord message per site a day with response-time percentiles, the page-cache split, where PHP time went, and the slowest requests.
---

`extras/perf-digest/` reads each site's nginx access log once a day (23:59) and posts one Discord
message per site: response-time percentiles of the pages people actually see, the page-cache split,
where PHP time went, status codes, and the 5 slowest PHP requests together with what else was in
flight at the time (`s64-slow-catch.sh`). The message turns red when a day is clearly worse than the
7-day median.

Install it with [`extras/perf-digest/install.sh`](../commands/perf-digest.md). It needs `python3` and
`curl`.

## What the report shows

| row | what it is |
|---|---|
| `PAGES` | GET pages for people: no static files, `/wp-json/`, wp-admin / wp-login / ajax, bots (including link previews like `facebookexternalhit`) or uptime monitors. Times run until the last byte is sent, so slow clients and heavy HTML count. |
| `HIT` / `MISS` / `BYPASS` | page-cache split of `PAGES`. With the [exact cache log](../guides/exact-cache-log.md) enabled for the site (`Redis exact`), it is srcache's own verdict: `MISS` = cacheable, generated and stored; `BYPASS` = never cached, split into `cookie` (logged-in / cart session), `query`, `cart` (Do-Not-Cache page) and `uri`. Without that log it is inferred from GridPane's log, and cookie bypasses then count as misses. FastCGI sites use `$upstream_cache_status`. |
| `non200` | 404 pages and redirects rendered by PHP (never cached) |
| `bots` / `API` / `admin` | the traffic that is not pages |
| `PHP` (backend) | every request that ran PHP, any kind including POST, with pure PHP time (no client download); overlaps the rows above and drives the PHP p95 alert |
| PHP time spent | PHP seconds per kind of traffic (pages, 404s, API, admin, bots, monitors, POST): shows what the PHP workers spent the day on |

## Running it by hand

`--test` prints the report without posting and without touching the history. The environment
variables also work on the script directly:

```bash
S64_DRY_RUN=1 S64_DATE=2026-10-25 S64_HIST_DIR=/tmp/hist ./usr/local/bin/s64-nginx-perf.sh
```

- `S64_DRY_RUN=1` — print instead of posting.
- `S64_DATE=YYYY-MM-DD` — report on another day still in the logs.
- `S64_HIST_DIR=<dir>` — use another history directory.

The history in `/var/lib/s64-nginx-perf/<site>.csv` is the 7-day baseline; alerts start on day 4.
