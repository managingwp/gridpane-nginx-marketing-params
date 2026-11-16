---
title: install command
description: Every mode of install.sh — install, enable, disable, apply the list, status, uninstall and the WooCommerce add-on — and what each one changes.
---

`install.sh` is the only thing you run on the server. Every mode tests the configuration with
`nginx -t` and puts the previous files back if the test fails.

```bash
./install.sh                             # install or update the server-wide engine (your list is kept)
./install.sh site.com [site2.com ...]    # engine, then switch the given sites on
./install.sh --full site.com             # engine + switch + WooCommerce add-on, no questions
./install.sh --woo-purge site.com        # only the WooCommerce add-on (mu-plugin)
./install.sh --remove-woo-purge site.com # remove the add-on from a site
./install.sh --disable site.com          # switch it off for a site (the add-on stays)
./install.sh --apply-list                # after editing params.list
./install.sh --uninstall                 # remove everything (all sites + engine)
./install.sh --status                    # what is installed, enabled or suspicious
./install.sh -h                          # the same summary, from the script header
```

## Modes

| Mode | What happens |
|---|---|
| *(no site)* | Installs or updates the engine, the stub and the includes. A site's list is never overwritten. |
| `site.com …` | The engine plus the switch and the cache-type flag for each site. On a TTY it asks whether to add the WooCommerce add-on to WooCommerce sites. |
| `--full` | The same, plus the add-on, without asking. |
| `--woo-purge` / `--remove-woo-purge` | Only the add-on, on one site. |
| `--disable` | Removes the site's switch and flag, for both cache types. See [changing and removing](../guides/changing-and-removing.md). |
| `--apply-list` | Tests and reloads after `params.list` changed; restores the last good list on failure. |
| `--uninstall` | Removes every site's files, the stub, the engine and the add-on copies; the list is saved to `/root/marketing-params.list.bak`. |
| `--status` | Checks checksums, the running config, the template hooks of every enabled site, and `nginx -t`. |

## Limits

The defaults are kept in `/etc/nginx/marketing-params/limits.env` and reused on every update:

```bash
MAX_PARAMS=32 MAX_LEN=4096 ./install.sh
```

Raising the parameter limit costs 4 nginx variables per parameter; see
[limitations](../reference/limitations.md).

## The update check

Every install command (`[sites]`, `--full`, `--woo-purge`) first asks GitHub for the newest release
tag, `vX.Y.Z` (`git ls-remote`: refs only, nothing downloaded). If this checkout is older, the script
stops before changing anything, fast-forwards to that release, prints the new commits, runs
`./test.sh` and starts again with the same arguments only if the tests pass.

It does not update when the checkout has local changes, when it already contains the release, or when
GitHub is unreachable. `--status`, `--disable`, `--apply-list` and `--uninstall` never check.

```bash
GP_MKT_NO_UPDATE_CHECK=1 ./install.sh site.com
```

skips the check (offline server, or testing a local change).

## Sites the installer refuses

Each is skipped with the reason: no page cache, GridPane's ModSecurity proxy, a customised cache key,
GridPane's Lua feature, an add-on-domain overlay, or a site file that sets the cache key or
`REQUEST_URI` again. The full list is on
[installation](../getting-started/installation.md#sites-that-are-skipped).

Where a site had a switch from before, the old files are removed so nothing half-working stays on.
