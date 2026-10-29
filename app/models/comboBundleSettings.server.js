/**
 * Single source of truth for Combo Bundles' brand/pricing configuration.
 *
 * Stored as one JSON shop metafield so three independent consumers all read
 * (and, for the admin UI, write) the exact same values:
 *   - the app's admin Settings page (Phase 2)
 *   - the cart-lines discount Function (Phase 3)
 *   - the Build Your Own Bundle theme block (Phase 4)
 *
 * Before this, discount tiers were hardcoded in the Function while the
 * theme block had its own independent (and disconnected) copies — so the
 * widget could display a different discount than checkout actually applied.
 * This module exists to make that impossible going forward.
 */

export const SETTINGS_NAMESPACE = "combo_bundles";
export const SETTINGS_KEY = "settings";

// Matches today's hardcoded values in cart_lines_discounts_generate_run.ts
// and the bundle-progress.liquid schema defaults, so nothing changes for an
// existing install until a merchant explicitly edits these from the app.
export const DEFAULT_SETTINGS = {
  tiers: [
    { min: 2, pct: 5 },
    { min: 3, pct: 8 },
    { min: 4, pct: 10 },
    { min: 5, pct: 12 },
    { min: 6, pct: 15 },
  ],
  colors: {
    accent: "#1B5E20",
    accentLight: "#E8F5E9",
    background: "#FFFFFF",
  },
};

const METAFIELD_DEFINITION = {
  name: "Combo Bundles settings",
  namespace: SETTINGS_NAMESPACE,
  key: SETTINGS_KEY,
  description:
    "Discount tiers and brand colors for the Combo Bundles app. Edited from the app's Settings page; read by the bundle discount function and the storefront widget.",
  type: "json",
  ownerType: "SHOP",
  // Liquid reads this metafield directly (bundle-progress.liquid), which
  // requires Storefront API read access on the definition. Without it the
  // widget silently falls back to its literal defaults even after a
  // merchant saves custom tiers/colors from the app.
  access: { storefront: "PUBLIC_READ" },
};

/**
 * Looks up the definition's current access settings so we can skip the
 * update mutation when storefront access is already correct (keeps the
 * settings route loader fast on every normal page view).
 */
async function fetchSettingsMetafieldDefinition(admin) {
  const response = await admin.graphql(
    `#graphql
    query ComboBundleSettingsDefinitionAccess($namespace: String!, $query: String!) {
      metafieldDefinitions(first: 1, ownerType: SHOP, namespace: $namespace, query: $query) {
        nodes {
          id
          access { storefront }
        }
      }
    }`,
    { variables: { namespace: SETTINGS_NAMESPACE, query: `key:${SETTINGS_KEY}` } },
  );

  const { data, errors } = await response.json();
  if (errors) {
    console.error(
      "Combo Bundles: GraphQL error fetching settings metafield definition access",
      errors,
    );
    return null;
  }
  return data?.metafieldDefinitions?.nodes?.[0] ?? null;
}

/**
 * Repairs storefront access on a definition that already existed before
 * `access` was added to METAFIELD_DEFINITION (metafieldDefinitionCreate
 * only sets it once, at creation). Safe to call repeatedly and never
 * throws — this backs both the OAuth hook and the settings page loader.
 */
async function ensureSettingsMetafieldStorefrontAccess(admin) {
  try {
    const definition = await fetchSettingsMetafieldDefinition(admin);
    if (!definition || definition.access?.storefront === "PUBLIC_READ") {
      return;
    }

    const response = await admin.graphql(
      `#graphql
      mutation UpdateComboBundleSettingsDefinitionAccess($definition: MetafieldDefinitionUpdateInput!) {
        metafieldDefinitionUpdate(definition: $definition) {
          updatedDefinition { id access { storefront } }
          userErrors { code field message }
        }
      }`,
      {
        variables: {
          definition: {
            name: METAFIELD_DEFINITION.name,
            namespace: SETTINGS_NAMESPACE,
            key: SETTINGS_KEY,
            ownerType: "SHOP",
            access: { storefront: "PUBLIC_READ" },
          },
        },
      },
    );

    const { data, errors } = await response.json();
    if (errors) {
      console.error(
        "Combo Bundles: GraphQL error updating settings metafield storefront access",
        errors,
      );
      return;
    }

    const userErrors = data?.metafieldDefinitionUpdate?.userErrors ?? [];
    if (userErrors.length > 0) {
      console.error(
        "Combo Bundles: failed to update settings metafield storefront access",
        userErrors,
      );
    }
  } catch (error) {
    console.error(
      "Combo Bundles: unexpected error ensuring settings metafield storefront access",
      error,
    );
  }
}

/**
 * Idempotently registers the shop-level metafield definition this app owns.
 * Safe to call on every OAuth completion (new installs and token refreshes
 * alike) and from the settings page loader — metafieldDefinitionCreate
 * returns a TAKEN userError, not a thrown error, when the definition
 * already exists, in which case we separately repair its storefront access
 * (needed for shops where the definition was created before `access` was
 * added above).
 */
export async function ensureSettingsMetafieldDefinition(admin) {
  const response = await admin.graphql(
    `#graphql
    mutation CreateComboBundleSettingsDefinition($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition { id }
        userErrors { code field message }
      }
    }`,
    { variables: { definition: METAFIELD_DEFINITION } },
  );

  const { data, errors } = await response.json();
  if (errors) {
    console.error(
      "Combo Bundles: GraphQL error creating settings metafield definition",
      errors,
    );
    return;
  }

  const userErrors = data?.metafieldDefinitionCreate?.userErrors ?? [];
  const alreadyExists = userErrors.some((error) => error.code === "TAKEN");
  if (userErrors.length > 0 && !alreadyExists) {
    console.error(
      "Combo Bundles: failed to create settings metafield definition",
      userErrors,
    );
    return;
  }

  if (alreadyExists) {
    await ensureSettingsMetafieldStorefrontAccess(admin);
  }
}

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function isValidSettingsShape(value) {
  if (!value || typeof value !== "object") return false;

  const { tiers, colors } = value;
  if (!Array.isArray(tiers) || tiers.length === 0) return false;
  const tiersValid = tiers.every(
    (tier) =>
      tier &&
      Number.isFinite(tier.min) &&
      Number.isFinite(tier.pct) &&
      tier.pct >= 0 &&
      tier.pct <= 100,
  );
  if (!tiersValid) return false;

  return (
    !!colors &&
    HEX_COLOR_PATTERN.test(colors.accent) &&
    HEX_COLOR_PATTERN.test(colors.accentLight) &&
    HEX_COLOR_PATTERN.test(colors.background)
  );
}

/**
 * Reads the shop's Combo Bundles settings, falling back to DEFAULT_SETTINGS
 * if the metafield is missing or its value doesn't parse into the expected
 * shape. Must never throw — this backs a revenue-path consumer (the
 * discount function) as well as the admin UI.
 */
export async function getComboBundleSettings(admin) {
  const response = await admin.graphql(
    `#graphql
    query ComboBundleSettings($namespace: String!, $key: String!) {
      shop {
        metafield(namespace: $namespace, key: $key) {
          value
        }
      }
    }`,
    { variables: { namespace: SETTINGS_NAMESPACE, key: SETTINGS_KEY } },
  );

  const { data } = await response.json();
  const raw = data?.shop?.metafield?.value;
  if (!raw) return DEFAULT_SETTINGS;

  try {
    const parsed = JSON.parse(raw);
    return isValidSettingsShape(parsed) ? parsed : DEFAULT_SETTINGS;
  } catch (error) {
    console.error(
      "Combo Bundles: malformed settings metafield value, using defaults",
      error,
    );
    return DEFAULT_SETTINGS;
  }
}

/**
 * Validates and persists new settings as the shop's single source of truth.
 * Throws a plain Error with a merchant-readable message on invalid input so
 * callers (the settings route's action) can surface it as a form error.
 */
export async function saveComboBundleSettings(admin, settings) {
  if (!isValidSettingsShape(settings)) {
    throw new Error(
      "Invalid settings: check that tiers and colors are complete and valid.",
    );
  }

  const sortedTiers = [...settings.tiers].sort((a, b) => a.min - b.min);
  for (let i = 1; i < sortedTiers.length; i++) {
    if (sortedTiers[i].min <= sortedTiers[i - 1].min) {
      throw new Error(
        "Discount tiers must have strictly increasing item counts.",
      );
    }
    if (sortedTiers[i].pct < sortedTiers[i - 1].pct) {
      throw new Error(
        "Discount tiers must not decrease as the item count goes up.",
      );
    }
  }

  await ensureSettingsMetafieldDefinition(admin);

  const shopResponse = await admin.graphql(
    `#graphql
    query ComboBundleShopId {
      shop { id }
    }`,
  );
  const { data: shopData } = await shopResponse.json();
  const shopId = shopData?.shop?.id;
  if (!shopId) {
    throw new Error("Unable to resolve the shop ID to save settings against.");
  }

  const value = JSON.stringify({ ...settings, tiers: sortedTiers });

  const response = await admin.graphql(
    `#graphql
    mutation SaveComboBundleSettings($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        metafields: [
          {
            ownerId: shopId,
            namespace: SETTINGS_NAMESPACE,
            key: SETTINGS_KEY,
            type: "json",
            value,
          },
        ],
      },
    },
  );

  const { data, errors } = await response.json();
  if (errors) {
    throw new Error("GraphQL error saving Combo Bundles settings.");
  }

  const userErrors = data?.metafieldsSet?.userErrors ?? [];
  if (userErrors.length > 0) {
    throw new Error(userErrors.map((error) => error.message).join(", "));
  }

  return { ...settings, tiers: sortedTiers };
}
