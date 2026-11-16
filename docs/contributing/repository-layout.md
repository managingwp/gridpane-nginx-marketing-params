---
title: Repository layout
description: Every path in the repository, what installs it, and which files are generated.
---

```text
install.sh                      install / enable / disable / apply list / status / uninstall / add-on
test.sh                         tests: sandbox + installer (default), `install`, `live <site> [/path/] [--fresh]` or `woo <site>`
build-engine.py                 engine.conf generator
server/marketing-params/        → /etc/nginx/marketing-params/  (php-context.conf, php-context-fcgi.conf, php-context-redis.conf, params.list)
server/stubs/                   → /etc/nginx/conf.d/marketing-params.conf
site/                           → /var/www/<site>/nginx/  (switch + flag; FastCGI or Redis variant)
extras/woo-purge/               → /var/www/<site>/htdocs/wp-content/mu-plugins/gp-woo-purge.php
extras/cache-log/               optional exact Redis cache log: install.sh, s64-cachelog.conf → /etc/nginx/conf.d/ (+ one file per site)
extras/perf-digest/             optional nightly Discord digest: install.sh, s64-nginx-perf.sh + s64-slow-catch.sh → /usr/local/bin/
tests/                          sandbox_test.py, install_test.py, live_test.py, fake_php.py (PHP-FPM stand-in), woo_purge_test.php
docs/                           this manual; the source pages of the documentation site
website/                        the Docusaurus site (config, sidebar, generators, theme)
scripts/                        check-docs-site.sh, the gate the site build runs
```

## Notes

- `server/`, `site/` and `extras/*/` mirror the paths they are installed to. `install.sh` is the only
  thing that writes into `/etc/nginx` and `/var/www`.
- `build-engine.py` is generated output's source: `engine.conf` is never edited by hand.
- `tests/` holds the throw-away nginx harness; nothing there is installed on a server.
- `website/` is a build input only: no server loads it, and `install.sh` never copies it.
