---
title: Development
description: Change the engine, the parameter list or an add-on safely, run the tests before pushing, and cut a release.
---

## What you need

- `python3` — the generator, the tests, and the perf digest.
- A GridPane server to run the installer and the live tests. The sandbox and installer suites need
  root and the server's real templates; they never touch the live nginx.

## The engine

`server/marketing-params/` is installed by `install.sh`; the engine itself is generated:

```bash
python3 build-engine.py [max_params] [max_query_len] [install_dir] > engine.conf
```

- Defaults: 24 parameters, 2048 bytes, `/etc/nginx/marketing-params`.
- `max_params` must be 1–48 and `max_query_len` 64–8192; each parameter adds 4 nginx variables.
- `install.sh` runs the generator for you and keeps your limits in `limits.env`. **Never hand-edit
  `engine.conf`** — the next install run replaces it.
- The parameter list is `include`d into every lookup map, so editing `params.list` never needs a
  regeneration: `./install.sh --apply-list`.

## The rules the code keeps

- Never edit a GridPane-managed file; everything custom is new, custom-named files.
- Every change runs `nginx -t` first and restores the previous files if the test fails.
- The switch and the flag must carry the same site name and the same cache type, or the engine
  ignores them.
- A skip rule must set `$skip_reason`, or the engine overrides it for marketing-only URLs.

## Tests before you push

```bash
./test.sh          # sandbox + installer, nothing live (installer needs root)
./test.sh live yoursite.com /some-page/ --fresh
./test.sh woo yourshop.com
```

A change to the engine also means running the sandbox suite against GridPane's legacy Redis template
where the server has one (`./test.sh --cache redis-legacy`). See [testing](../guides/testing.md).

## Pull requests

- Branch from `main`; name it after the change (`feat/…`, `fix/…`, `docs/…`).
- One change per pull request, with `./test.sh` passing before you open it.
- Say in the body what changed on the server and what you ran to prove it.

## Releases

Versions follow [semantic versioning](https://semver.org) and are tag-driven: one version for the
whole repository, the WooCommerce add-on's `Version:` header included.

- While the project is `0.x`, a minor bump (`0.2.0`) may change behaviour; a patch release (`0.1.1`)
  only fixes things or changes documentation.
- The installer's update check reads release tags (`vX.Y.Z`), never the `main` branch, so an unreleased
  commit on `main` never counts as an update for servers in the field.

## Documentation

The manual lives in `docs/` and is published from `website/`; see the [docs contract](./docs.md) for
how to add a page and the gate a change must pass.
