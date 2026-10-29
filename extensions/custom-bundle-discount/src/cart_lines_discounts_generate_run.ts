import {
  ProductDiscountSelectionStrategy,
  CartInput,
  CartLinesDiscountsGenerateRunResult,
} from '../generated/api';

// Mirrors the shape written by app/models/comboBundleSettings.server.js to
// the combo_bundles.settings shop metafield (see Phase 1/2). Only the
// tiers are needed here; colors are the storefront widget's concern.
type Tier = { min: number; pct: number };

// Matches comboBundleSettings.server.js's DEFAULT_SETTINGS.tiers exactly,
// so a shop that hasn't saved settings yet (or whose metafield value is
// missing or malformed) sees unchanged checkout behavior.
const DEFAULT_TIERS: Tier[] = [
  { min: 2, pct: 5 },
  { min: 3, pct: 8 },
  { min: 4, pct: 10 },
  { min: 5, pct: 12 },
  { min: 6, pct: 15 },
];

function isValidTier(value: unknown): value is Tier {
  const tier = value as Tier;
  return (
    !!tier &&
    typeof tier === 'object' &&
    Number.isFinite(tier.min) &&
    Number.isFinite(tier.pct) &&
    tier.pct >= 0 &&
    tier.pct <= 100
  );
}

// This sits on the checkout path, so it must never throw: any shape we
// don't recognize falls back to DEFAULT_TIERS rather than failing the
// whole discount calculation.
function resolveTiers(input: CartInput): Tier[] {
  try {
    const config = input.shop.metafield?.jsonValue as { tiers?: unknown[] } | undefined;
    const tiers = config?.tiers;
    if (!Array.isArray(tiers) || tiers.length === 0 || !tiers.every(isValidTier)) {
      return DEFAULT_TIERS;
    }
    return (tiers as Tier[]).slice().sort((a, b) => a.min - b.min);
  } catch {
    return DEFAULT_TIERS;
  }
}

export function cartLinesDiscountsGenerateRun(
  input: CartInput,
): CartLinesDiscountsGenerateRunResult {
  const cartLines = input.cart.lines;

  // 1. Calculate the number of distinct products in the cart (not total
  // quantity — buying multiple units of the same product shouldn't climb
  // the tiers). Lines whose merchandise isn't a ProductVariant (e.g. a
  // CustomProduct) don't carry a product id and are excluded.
  const uniqueProductIds = new Set(
    cartLines
      .map((line) => ('product' in line.merchandise ? line.merchandise.product.id : null))
      .filter((productId): productId is string => productId !== null),
  );
  const uniqueCount = uniqueProductIds.size;

  // 2. Resolve the merchant's configured tiers (or the defaults) and find
  // the highest one the cart qualifies for.
  const tiers = resolveTiers(input);
  let matchedTier: Tier | undefined;
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (uniqueCount >= tiers[i].min) {
      matchedTier = tiers[i];
      break;
    }
  }

  // 3. If they don't have enough items for a discount, return empty operations
  if (!matchedTier || matchedTier.pct <= 0) {
    return { operations: [] };
  }

  const message = `${matchedTier.pct}% Off Bundle Savings`;

  // 4. Create the targets (apply discount to all lines contributing to the bundle)
  // We map over cartLines to target every individual line item
  const targets = cartLines.map((line) => {
    return {
      cartLine: {
        id: line.id,
      },
    };
  });

  // 5. Return the applied product discount operation back to Shopify
  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates: [
            {
              message,
              targets,
              value: {
                percentage: {
                  value: matchedTier.pct.toString(),
                },
              },
            },
          ],
          selectionStrategy: ProductDiscountSelectionStrategy.Maximum,
        },
      },
    ],
  };
}
