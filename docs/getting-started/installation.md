---
title: Installation
description: Install the engine once per server and switch it on per site, with an update check before every install run.
---

The engine goes in once per server; a site is switched on with a second small file. Every install
run tests the configuration with `nginx -t` and puts the previous files back if the test fails, so a
broken change never reaches the running nginx.

## Requirements

- A GridPane server with WordPress sites on the **FastCGI** or **Redis** page cache. Sites without a
  page cache are skipped with the reason.
- A root shell on that server.
- `git`, to clone the repository. The tests also need `python3`.

## Install

On the GridPane server, as root:

```bash
git clone https://github.com/SHIFT64/gridpane-nginx-marketing-params.git /root/gridpane-nginx-marketing-params
```

```bash
cd /root/gridpane-nginx-marketing-params && ./test.sh && ./install.sh yoursite.com
```

`./install.sh` without a site name installs or updates the server-wide engine only. The full set of
modes is covered on the install command page, once that page lands.

## What the script does

1. **Once per server:** installs the engine and the list in `/etc/nginx/marketing-params/`, plus a
   one-line stub in `/etc/nginx/conf.d/`. An existing list is never overwritten.
2. **Per site:** adds two small files in `/var/www/<site>/nginx/`: the switch and a flag for the
   site's cache type (FastCGI or Redis, detected from the vhost). Both carry the site's name; either
   file alone, or a pair of two different sites, does nothing. Every `./install.sh [sites]` /
   `--full` run also rewrites the files of all sites that already have them for the current version
   (they stay on or off as they were).
3. **Checks and reloads:** runs `nginx -t`. If it passes, nginx is reloaded. If it fails, the
   previous files are restored.

Sites that the installer refuses are listed under [skipped sites](#sites-that-are-skipped).

## Updating

```bash
cd /root/gridpane-nginx-marketing-params && git pull && ./test.sh && ./install.sh
```

`./install.sh` on its own updates the engine and rewrites every site's switch files for the new
version; sites stay on or off as they were. Running it after `git pull` is all an update needs.

## The update check

Every install command (`./install.sh [sites]`, `--full`, `--woo-purge`) first asks GitHub for the
newest [release](https://github.com/SHIFT64/gridpane-nginx-marketing-params/releases) tag, `vX.Y.Z`
(`git ls-remote`: refs only, nothing is downloaded). Commits on `main` that are not released yet
never count as an update.

- If the newest release is not in this checkout yet, the script stops before changing anything,
  fast-forwards to that release, prints the new commits, runs the tests (`./test.sh`: sandbox +
  installer) and, only if they pass, starts again with the same arguments.
- It does not update when the checkout has local changes (it stops and says so), when the checkout
  already contains the release (for example after you pulled `main`), or when GitHub is unreachable
  (it warns and continues with the local copy).
- `--status`, `--disable`, `--apply-list` and `--uninstall` never check.
- `GP_MKT_NO_UPDATE_CHECK=1 ./install.sh yoursite.com` skips the check (offline server, or testing a
  local change).

## Versions

Versions follow [semantic versioning](https://semver.org): one version for the whole repository, the
WooCommerce add-on's `Version:` header included. While it is `0.x`, a minor bump (`0.2.0`) may change
behaviour; patch releases (`0.1.1`) only fix things or change documentation.

## Sites that are skipped

Each of these is skipped, with the reason printed:

- sites without page cache;
- sites behind GridPane's ModSecurity proxy (proxy-Redis has no PHP-location hook);
- a customised cache key (GeoIP);
- GridPane's Lua feature;
- GridPane's add-on-domain overlays (a template that includes another site's files);
- a template or another `*-php-context.conf` of the site (or a file it includes) that sets the cache
  key or `REQUEST_URI` again after the switch.

If you change a site's cache type in GridPane, run `./install.sh <site>` again.
