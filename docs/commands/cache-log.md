---
title: cache-log command
description: The exact Redis page-cache log installer — enable, status, disable, uninstall — and the files it writes.
---

`extras/cache-log/install.sh` adds a second access log per Redis page-cache site.

```bash
./extras/cache-log/install.sh site1.com site2.com   # enable (Redis page-cache sites only)
./extras/cache-log/install.sh --status              # what is installed, is it current, nginx -t
./extras/cache-log/install.sh --disable site1.com   # stop logging for a site (old log files are kept)
./extras/cache-log/install.sh --uninstall           # every site off + the log_format removed
```

Sites on another cache type are skipped with the reason. Every run does `nginx -t` first; if it
fails, the previous files are put back and nginx is not reloaded. Re-running it is safe: files that
are already current are left alone.

## Files

- `/etc/nginx/conf.d/s64-cachelog.conf` — one `log_format s64cache`.
- `/var/www/<site>/nginx/s64-cachelog-main-context.conf` — one `access_log` line, next to GridPane's
  own `access_log` in the `server` block.

No GridPane-managed file is edited. GridPane's logrotate (`/var/log/nginx/*log`) rotates
`/var/log/nginx/<site>.cache.log` together with the main log.

See [the exact cache log guide](../guides/exact-cache-log.md) for the log line and how to read it.
