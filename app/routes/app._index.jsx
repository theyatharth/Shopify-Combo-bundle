import { Page, Layout, Card, Text, BlockStack } from "@shopify/polaris";

export default function Index() {
  return (
    <Page title="Combo Bundle Manager">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingLg">Hello Ecofynd!</Text>
              <Text as="p">If you can see this, the layout and CSS are finally working.</Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}