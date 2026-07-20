import {
  ProductDiscountSelectionStrategy,
  CartInput,
  CartLinesDiscountsGenerateRunResult,
} from '../generated/api';

export function cartLinesDiscountsGenerateRun(
  input: CartInput,
): CartLinesDiscountsGenerateRunResult {
  const cartLines = input.cart.lines;

  // 1. Calculate the total quantity of items in the cart
  const totalQuantity = cartLines.reduce((sum, line) => sum + line.quantity, 0);

  // 2. Determine the discount percentage based on your tiers
  let discountPercentage = 0;
  let message = "";

  if (totalQuantity >= 4) {
    discountPercentage = 20;
    message = "20% Off Bundle Savings";
  } else if (totalQuantity === 3) {
    discountPercentage = 15;
    message = "15% Off Bundle Savings";
  } else if (totalQuantity === 2) {
    discountPercentage = 10;
    message = "10% Off Bundle Savings";
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