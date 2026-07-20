import { json } from "@remix-run/node";
import { useActionData, useSubmit } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { Page, Layout, Card, Button, Text, BlockStack } from "@shopify/polaris";

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);

  const functionQuery = await admin.graphql(`
    query {
      shopifyFunctions(first: 10) {
        nodes {
          id
          title
        }
      }
    }
  `);
  const functionData = await functionQuery.json();

  const bundleFunction = functionData.data.shopifyFunctions.nodes.find(
    (f) => f.title === "custom-bundle-discount"
  );

  if (!bundleFunction) {
    return json({ error: "Function not found. Did you run npm run deploy?" });
  }

  const createMutation = await admin.graphql(`
    mutation discountAutomaticAppCreate($automaticAppDiscount: DiscountAutomaticAppInput!) {
      discountAutomaticAppCreate(automaticAppDiscount: $automaticAppDiscount) {
        automaticAppDiscount {
          discountId
          title
        }
        userErrors {
          field
          message
        }
      }
    }
  `, {
    variables: {
      automaticAppDiscount: {
        title: "Mix & Match Bundle Savings",
        functionId: bundleFunction.id,
        startsAt: new Date().toISOString(),
        discountClasses: ["PRODUCT"]
      }
    }
  });

  const result = await createMutation.json();
  return json({ result });
}

export default function ActivateDiscount() {
  const submit = useSubmit();
  const actionData = useActionData();

  const activateDiscount = () => submit({}, { method: "post" });

  return (
    <Page>
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Live Bundle Discount Activation</Text>
              <Text as="p">Click below to activate the custom bundle math on Ecofynd.</Text>
              <Button onClick={activateDiscount} variant="primary">Activate Bundle Discount</Button>
              {actionData && (
                <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f4f6f8' }}>
                  <pre>{JSON.stringify(actionData, null, 2)}</pre>
                </div>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
