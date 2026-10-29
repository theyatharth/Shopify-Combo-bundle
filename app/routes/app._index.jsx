import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  InlineStack,
  List,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

// LOADER: Authenticates the page load
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  return json({ shop: session.shop });
};

// UI COMPONENT
export default function Index() {
  const { shop } = useLoaderData();

  return (
    <Page title="Combo Bundles">
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Activate the bundle widget on your storefront</Text>
                <Text as="p">
                  This app adds a "Build Your Own Bundle" section to your theme. To show it to customers:
                </Text>
                <List type="number">
                  <List.Item>Click the button below to open your theme editor.</List.Item>
                  <List.Item>Shopify will add the "Build Your Own Bundle" section automatically.</List.Item>
                  <List.Item>Customize the collection, colors, and discount tiers in the section settings.</List.Item>
                  <List.Item>Click <strong>Save</strong> in the theme editor to publish it live.</List.Item>
                </List>
                <InlineStack>
                  <Button
                    url={`https://${shop}/admin/themes/current/editor?template=page&addAppBlockId=18e9730a-9102-fa10-867a-b98d0c513005f8034b34/bundle-progress&target=newAppsSection`}
                    target="_blank"
                  >
                    Add bundle widget to your theme
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
