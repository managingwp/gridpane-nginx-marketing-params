---
title: perf-digest command
description: The nightly Discord digest installer — install, dry run, status, uninstall — and the files and history it keeps.
---

`extras/perf-digest/install.sh` installs the 23:59 report.

```bash
DISCORD_WEBHOOK_URL='https://discord.com/api/webhooks/…' ./extras/perf-digest/install.sh site1.com site2.com
./extras/perf-digest/install.sh --test               # print today's report, post nothing
./extras/perf-digest/install.sh --test 2026-10-25    # the same for a day still in the logs
./extras/perf-digest/install.sh --status             # scripts, config, webhook, cron, last report
./extras/perf-digest/install.sh                      # after git pull: update the scripts, keep the list
./extras/perf-digest/install.sh --uninstall          # scripts + cron off (config and history kept)
```

Without `DISCORD_WEBHOOK_URL` in the environment, the installer asks for the webhook (hidden input)
when none is configured yet. It never takes it as an argument, so the URL stays out of shell history.

`--test` prints the report and posts nothing; the history file is not touched.

## Files

- `/usr/local/bin/s64-nginx-perf.sh` and `/usr/local/bin/s64-slow-catch.sh`. A changed old copy is
  kept as `<name>.bak-<date>`.
- `/etc/s64-nginx-perf.conf` (mode 600): `SITES="…"` and `DISCORD_WEBHOOK_URL="…"`.
- `/etc/cron.d/s64-nginx-perf`.
- History in `/var/lib/s64-nginx-perf/<site>.csv`, used for the 7-day baseline. Alerts start on day 4.

Needs `python3` and `curl`. See [the perf digest guide](../guides/perf-digest.md) for what the report
shows.
