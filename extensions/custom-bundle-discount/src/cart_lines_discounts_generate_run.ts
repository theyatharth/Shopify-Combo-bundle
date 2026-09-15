import {
  ProductDiscountSelectionStrategy,
  CartInput,
  CartLinesDiscountsGenerateRunResult,
} from '../generated/api';

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

  // 2. Determine the discount percentage based on your tiers
  let discountPercentage = 0;
  let message = "";

  if (uniqueCount >= 6) {
    discountPercentage = 15;
    message = "15% Off Bundle Savings";
  } else if (uniqueCount === 5) {
    discountPercentage = 12;
    message = "12% Off Bundle Savings";
  } else if (uniqueCount === 4) {
    discountPercentage = 10;
    message = "10% Off Bundle Savings";
  } else if (uniqueCount === 3) {
    discountPercentage = 8;
    message = "8% Off Bundle Savings";
  } else if (uniqueCount === 2) {
    discountPercentage = 5;
    message = "5% Off Bundle Savings";
  }

  // 3. If they don't have enough items for a discount, return empty operations
  if (discountPercentage === 0) {
    return { operations: [] };
  }

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
                  value: discountPercentage.toString(),
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