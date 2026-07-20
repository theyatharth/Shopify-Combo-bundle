
import { useState, useEffect } from "react";
import { json } from "@remix-run/node";
import { useSubmit, useActionData, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  InlineStack,
  Thumbnail,
  Divider,
  Banner
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

// 1. LOADER: Authenticates the page load
export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

// 2. ACTION: Handles the form submission and GraphQL Metafield update
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const mainProductId = formData.get("mainProductId");
  const comboProductIds = JSON.parse(formData.get("comboProductIds"));

  // The GraphQL mutation to save the list of combo products to the main product
  const response = await admin.graphql(
    `#graphql
    mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          value
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        metafields: [
          {
            ownerId: mainProductId,
            namespace: "custom",
            key: "combo_products",
            type: "list.product_reference", // Required type for product arrays
            value: JSON.stringify(comboProductIds),
          },
        ],
      },
    }
  );

  const responseJson = await response.json();
  const errors = responseJson.data?.metafieldsSet?.userErrors || [];

  if (errors.length > 0) {
    return json({ success: false, errors });
  }

  return json({ success: true });
};

// 3. UI COMPONENT
export default function Index() {
  const [mainProduct, setMainProduct] = useState(null);
  const [comboProducts, setComboProducts] = useState([]);

  const submit = useSubmit();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  // Clear the UI state after a successful save
  useEffect(() => {
    if (actionData?.success) {
      setMainProduct(null);
      setComboProducts([]);
    }
  }, [actionData]);

  const selectMainProduct = async () => {
    const selection = await window.shopify.resourcePicker({
      type: 'product',
      action: 'select',
      multiple: false,
    });
    if (selection && selection.length > 0) {
      setMainProduct(selection[0]);
    }
  };

  const selectComboProducts = async () => {
    const selection = await window.shopify.resourcePicker({
      type: 'product',
      action: 'select',
      multiple: true,
    });
    if (selection) {
      setComboProducts(selection);
    }
  };

  // Triggers the Remix action function above
  const handleSave = () => {
    const comboIds = comboProducts.map(prod => prod.id);
    submit(
      {
        mainProductId: mainProduct.id,
        comboProductIds: JSON.stringify(comboIds),
      },
      { method: "post" }
    );
  };

  return (
    <Page title="Combo Bundle Manager">
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">

            {/* Success Banner */}
            {actionData?.success && (
              <Banner title="Combo mapped successfully!" tone="success">
                <p>The complementary products have been saved to the main product's metafields.</p>
              </Banner>
            )}

            {/* Error Banner */}
            {actionData?.success === false && (
              <Banner title="Failed to save mapping" tone="critical">
                <p>{actionData.errors.map(err => err.message).join(", ")}</p>
              </Banner>
            )}

            <Card>
              <BlockStack gap="500">

                {/* Step 1: Main Product */}
                <BlockStack gap="200">
                  <Text as="h2" variant="headingLg">1. Select Main Product</Text>
                  <Text as="p" color="subdued">Choose the product that will trigger the combo offer.</Text>
                  {mainProduct ? (
                    <InlineStack align="start" blockAlign="center" gap="400">
                      <Thumbnail source={mainProduct.images[0]?.originalSrc || ''} alt={mainProduct.title} />
                      <Text as="h3" variant="headingMd">{mainProduct.title}</Text>
                      <Button onClick={selectMainProduct}>Change</Button>
                    </InlineStack>
                  ) : (
                    <InlineStack><Button onClick={selectMainProduct}>Select Main Product</Button></InlineStack>
                  )}
                </BlockStack>

                <Divider />

                {/* Step 2: Combo Products */}
                <BlockStack gap="200">
                  <Text as="h2" variant="headingLg">2. Select Combo Items</Text>
                  <Text as="p" color="subdued">Choose the complementary products to bundle with the main product.</Text>

                  {comboProducts.length > 0 && (
                    <BlockStack gap="300">
                      {comboProducts.map((prod) => (
                        <InlineStack key={prod.id} align="start" blockAlign="center" gap="400">
                          <Thumbnail source={prod.images[0]?.originalSrc || ''} alt={prod.title} size="small" />
                          <Text as="p" fontWeight="medium">{prod.title}</Text>
                        </InlineStack>
                      ))}
                    </BlockStack>
                  )}
                  <InlineStack>
                    <Button onClick={selectComboProducts}>
                      {comboProducts.length > 0 ? "Change Combo Products" : "Select Combo Products"}
                    </Button>
                  </InlineStack>
                </BlockStack>

                <Divider />

                {/* Step 3: Save Action */}
                <InlineStack align="end">
                  <Button
                    variant="primary"
                    tone="success"
                    disabled={!mainProduct || comboProducts.length === 0}
                    loading={isSaving}
                    onClick={handleSave}
                  >
                    Save Combo Mapping
                  </Button>
                </InlineStack>

              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        {/* Sidebar Info */}
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingMd">How to use</Text>
              <Text as="p">
                Map your primary items to their complementary accessories.
              </Text>
              <Text as="p">
                When you click Save, this app will securely write these relationships to your store's backend, making them instantly available to your storefront widget.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}


// import { json } from "@remix-run/node";
// import { useActionData, useSubmit } from "@remix-run/react";
// import { authenticate } from "../shopify.server";
// import { Page, Layout, Card, Button, Text, BlockStack } from "@shopify/polaris";

// export async function action({ request }) {
//   const { admin } = await authenticate.admin(request);

//   // 1. Fetch the deployed Function ID from your store
//   const functionQuery = await admin.graphql(`
//     query {
//       shopifyFunctions(first: 10) {
//         nodes {
//           id
//           title
//         }
//       }
//     }
//   `);
//   const functionData = await functionQuery.json();

//   // Find the custom-bundle-discount function we deployed earlier
//   const bundleFunction = functionData.data.shopifyFunctions.nodes.find(
//     (f) => f.title === "custom-bundle-discount"
//   );

//   if (!bundleFunction) {
//     return json({ error: "Function not found. Did you run npm run deploy?" });
//   }

//   // 2. Create the Active Automatic Discount using that Function
//   const createMutation = await admin.graphql(`
//     mutation discountAutomaticAppCreate($automaticAppDiscount: DiscountAutomaticAppInput!) {
//       discountAutomaticAppCreate(automaticAppDiscount: $automaticAppDiscount) {
//         automaticAppDiscount {
//           discountId
//           title
//         }
//         userErrors {
//           field
//           message
//         }
//       }
//     }
//   `, {
//     variables: {
//       automaticAppDiscount: {
//         title: "Mix & Match Bundle Savings",
//         functionId: bundleFunction.id,
//         startsAt: new Date().toISOString(),
//         // Add the required discount class here
//         discountClasses: ["PRODUCT"]
//       }
//     }
//   });

//   const result = await createMutation.json();
//   return json({ result });
// }

// export default function Index() {
//   const submit = useSubmit();
//   const actionData = useActionData();

//   const activateDiscount = () => submit({}, { method: "post" });

//   return (
//     <Page>
//       <Layout>
//         <Layout.Section>
//           <Card>
//             <BlockStack gap="400">
//               <Text as="h2" variant="headingMd">Bundle Discount Activation</Text>
//               <Text as="p">
//                 Click the button below to turn on the custom bundle math.
//                 This tells Shopify (and Razorpay) to start applying your 10%, 15%, and 20% tiers at checkout.
//               </Text>
//               <Button onClick={activateDiscount} variant="primary">
//                 Activate Bundle Discount
//               </Button>

//               {actionData && (
//                 <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f4f6f8' }}>
//                   <Text as="p"><strong>API Response:</strong></Text>
//                   <pre>{JSON.stringify(actionData, null, 2)}</pre>
//                 </div>
//               )}
//             </BlockStack>
//           </Card>
//         </Layout.Section>
//       </Layout>
//     </Page>
//   );
// }