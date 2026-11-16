---
title: Changing and removing
description: Switch a site off, remove everything, follow a cache-type change, or handle a clone or staging copy without leaving anything half-installed.
---

Every command below runs `nginx -t` before the reload and puts the previous files back if it fails,
so a failed change never reaches the running nginx. All of it is covered by `./test.sh install` (an
`install.sh` run in each of these modes in a throw-away root, with the server's real templates and
the real `nginx -t`).

## Switch off one site

```bash
./install.sh --disable site.com
```

Removes the site's switch and flag (both cache types). It takes effect with the reload; a request
already being handled by an old nginx worker can still get the old behaviour for about a second.

**No purge needed:** everything cached while it was on is an ordinary entry of the clean URL,
rendered exactly as for a visitor without parameters.

## Remove everything

```bash
./install.sh --uninstall
```

Removes every site's switch and flag, the conf.d stub, the engine directory and the add-on copies.
Your list is saved to `/root/marketing-params.list.bak`. No purge needed either.

## Change a site's cache type in GridPane

FastCGI ↔ Redis, or page cache off — run the installer afterwards:

```bash
./install.sh site.com
```

GridPane keeps the custom files, but each flag is only included by its own template, so the site
falls back to stock behaviour until you re-run the installer. It writes the switch and flag for the
new type and removes the old flag.

Verified live in both directions with the GridPane panel (it runs `gp site <site> -fastcgi-caching`,
and `-cache-off` then `-redis-caching` on the way back): both files stayed in place, the site kept its
Redis database, `nginx -t` passed, the site behaved exactly like stock until the installer was
re-run, and the live test passed afterwards. `--status` reports such sites as a problem (the site
expects the feature and does not get it).

A leftover switch never changes the other cache type's key (only the FastCGI switch sets
`fastcgi_cache_key`). A Redis switch on a non-Redis site makes nginx raise an "uninitialized
variable" warning per PHP request, which GridPane's default `error` log level does not write.

## A site the installer cannot handle

No page cache, a customised key, GridPane's Lua feature, an add-on-domain overlay, or another file
changing the key or `REQUEST_URI`: run the installer and the site is skipped with the reason.

If the site had a switch from before (say, GridPane changed its template since), those files are
removed, so nothing half-working stays on.

## Clone or staging copy

GridPane copies the site's `nginx/` directory, so the copy is on straight away and works. On Redis it
uses its own database: the key prefix is read from GridPane's key at runtime.

Its files still carry the original site's name, so `--status` asks you to run the installer, which
writes the copy's own name (every `./install.sh [sites]` / `--full` run does this for every site).
Until then the copy is not protected if it is later attached as an add-on domain of the original.

## Update after `git pull`

```bash
./install.sh
```

Updates the engine and rewrites every site's switch files for the new version; sites stay on or off
as they were. An engine and site files from before the Redis support are updated in place. Until
then, with the new engine, such old site files are inert and `--status` says so.

## After a GridPane update

```bash
./install.sh --status
./test.sh
```

`--status` checks checksums, the running config, the template hooks of every enabled site, and
`nginx -t`. `./test.sh` re-runs the sandbox and installer suites against the server's current
templates.

## WooCommerce shops

```bash
./install.sh --full yourshop.com          # engine + switch + add-on, no questions
./install.sh --woo-purge yourshop.com     # only the add-on
./install.sh --remove-woo-purge yourshop.com
```

A plain `./install.sh yourshop.com` run from a terminal asks about the add-on for each WooCommerce
site. `./install.sh` without sites (the update after `git pull`) refreshes every installed copy. What
the add-on purges, and what it leaves alone, is on the [WooCommerce purge
guide](./woocommerce-purge.md).
