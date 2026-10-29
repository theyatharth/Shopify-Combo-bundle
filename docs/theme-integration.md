# Reading Combo Bundles settings from your own theme code

Discount tiers and brand colors are configured once, from the app's **Settings**
page, and stored in a single shop metafield:

- Namespace: `combo_bundles`
- Key: `settings`
- Type: `json`

The app grants this metafield definition Storefront API / Liquid read access, so
any Liquid template in the theme — not just the app's own "Build Your Own
Bundle" section — can read the same values directly. This is useful if your
theme has its own hardcoded copy (for example a cart page banner like "You're
getting 12% off — add 1 more product to get 15% off!") that should instead
reflect the merchant's configured tiers.

## Value shape

```json
{
  "tiers": [
    { "min": 2, "pct": 5 },
    { "min": 3, "pct": 8 },
    { "min": 4, "pct": 10 },
    { "min": 5, "pct": 12 },
    { "min": 6, "pct": 15 }
  ],
  "colors": {
    "accent": "#1B5E20",
    "accentLight": "#E8F5E9",
    "background": "#FFFFFF"
  }
}
```

`tiers` is a list of `{ min, pct }` pairs — `pct`% off once a cart has at least
`min` distinct products in the bundle. `colors` holds brand hex colors used by
the storefront widget.

## Reading it in Liquid

```liquid
{% liquid
  assign combo_settings = shop.metafields.combo_bundles.settings.value
  assign current_pct = 0
  if combo_settings
    for tier in combo_settings.tiers
      if cart.item_count >= tier.min
        assign current_pct = tier.pct
      endif
    endfor
  endif
%}

{% if current_pct > 0 %}
  <p>You're getting {{ current_pct }}% off!</p>
{% endif %}
```

Always guard against the metafield being blank (a fresh install that hasn't
opened Settings yet) by falling back to a literal default, the same way
`extensions/combo-bundle-widget/blocks/bundle-progress.liquid` does.

## What this app will not do for you

This app does not scan or edit arbitrary theme files. If a banner, section, or
snippet elsewhere in the theme hardcodes its own discount copy, a developer
with access to that theme needs to update it to read from
`shop.metafields.combo_bundles.settings.value` as shown above.
