---
title: Parameter list
description: The grammar of params.list, the golden rule for what belongs on it, and the names to leave off.
---

The list lives in `/etc/nginx/marketing-params/params.list`, one line per parameter:

```nginx
gclid 1;        # exact name (case-insensitive)
~*^utm_ 1;      # regex on the name: every utm_* (~* = case-insensitive)
```

The shipped list is
[`server/marketing-params/params.list`](https://github.com/managingwp/gridpane-nginx-marketing-params/blob/main/server/marketing-params/params.list).
Installing never overwrites a list that already exists.

## After editing

```bash
./install.sh --apply-list
```

This runs `nginx -t` and reloads. If the test fails (say, a missing `;`), it restores the last good
list and keeps your edit in `params.list.rejected`, so a typo can never block nginx reloads on the
server. There is one list per server, and it applies to every site with the switch.

## The golden rule

Only list parameters that are read by **JavaScript**, not PHP. On cached pages PHP never sees them,
just like on any cache hit.

- **Off by default**, as optional entries documented in the file: `mc_cid` / `mc_eid` (Mailchimp for
  WooCommerce sets cookies from them in PHP) and `ck_subscriber_id` (Kit).
- **Never add:** `ref`, `s`, `p`, `page_id`, `lang`, `add-to-cart`, `cn-reloaded`, `age-verified`.

A parameter that PHP reads (a language switcher, a pagination id, an add-to-cart action) breaks when
it is on the list: the cached page is rendered without it, and every visitor shares that rendering.
