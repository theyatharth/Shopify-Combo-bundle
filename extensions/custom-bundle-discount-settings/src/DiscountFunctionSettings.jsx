import "@shopify/ui-extensions/preact";
import {render} from "preact";
import {useState} from "preact/hooks";

export default async () => {
  render(<App />, document.body);
};

function App() {
  const {i18n, discounts} = shopify;
  const [error, setError] = useState();

  const discountClasses = discounts?.discountClasses?.value ?? [];

  const handleToggleDiscountClass = async (discountClass) => {
    const nextDiscountClasses = discountClasses.includes(discountClass)
      ? discountClasses.filter((c) => c !== discountClass)
      : [...discountClasses, discountClass];

    const result = await discounts?.updateDiscountClasses?.(
      nextDiscountClasses,
    );

    if (!result?.success) {
      setError(i18n.translate("error"));
      return;
    }

    if (error) {
      setError(undefined);
    }
  };

  return (
    <s-function-settings>
      <s-heading>{i18n.translate("title")}</s-heading>
      <s-section>
        <s-stack gap="base">
          {error ? <s-banner tone="critical">{error}</s-banner> : null}

          <s-paragraph>{i18n.translate("tiersExplanation")}</s-paragraph>

          <s-stack gap="none">
            <s-checkbox
              checked={discountClasses.includes("product")}
              onChange={() => handleToggleDiscountClass("product")}
              label={i18n.translate("discountClasses.product")}
              disabled={
                discountClasses.length === 1 &&
                discountClasses.includes("product")
              }
            />
            <s-paragraph tone="subdued">
              {i18n.translate("discountClasses.productHelp")}
            </s-paragraph>
          </s-stack>

          <s-divider />

          <s-stack gap="none">
            <s-checkbox
              checked={discountClasses.includes("shipping")}
              onChange={() => handleToggleDiscountClass("shipping")}
              label={i18n.translate("discountClasses.shipping")}
              disabled={
                discountClasses.length === 1 &&
                discountClasses.includes("shipping")
              }
            />
            <s-paragraph tone="subdued">
              {i18n.translate("discountClasses.shippingHelp")}
            </s-paragraph>
          </s-stack>
        </s-stack>
      </s-section>
    </s-function-settings>
  );
}
