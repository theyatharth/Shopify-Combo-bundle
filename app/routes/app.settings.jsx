import { useEffect, useState } from "react";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  TextField,
  BlockStack,
  InlineStack,
  Divider,
  Banner,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import {
  ensureSettingsMetafieldDefinition,
  getComboBundleSettings,
  saveComboBundleSettings,
} from "../models/comboBundleSettings.server";

const DISCOUNT_TITLE = "Mix & Match Bundle Savings";
const TIER_MINS = [2, 3, 4, 5, 6];

// Looks up the ID of the discount function this app ships, so we can match
// *any* existing automatic discount that runs it, regardless of what it's
// titled (merchants and earlier versions of this app have created discounts
// under different titles, e.g. "Combo bundle discount").
async function getBundleFunctionId(admin) {
  const response = await admin.graphql(
    `#graphql
    query ComboBundleFunction {
      shopifyFunctions(first: 25) {
        nodes { id apiType title }
      }
    }`,
  );
  const { data } = await response.json();
  const bundleFunction = data?.shopifyFunctions?.nodes?.find(
    (fn) => fn.title === "custom-bundle-discount",
  );
  return bundleFunction?.id ?? null;
}

// Looks up whether an automatic app discount running this app's function
// already exists, so re-opening this page (or clicking Activate twice)
// can't create duplicate discounts the way the old app.activate.jsx debug
// page could. Matches by function, not title, since the discount may have
// been created (by this app or by hand) under a title other than
// DISCOUNT_TITLE.
async function findExistingDiscount(admin, functionId) {
  if (!functionId) return null;

  const response = await admin.graphql(
    `#graphql
    query FindComboBundleDiscount {
      discountNodes(first: 50) {
        nodes {
          id
          discount {
            __typename
            ... on DiscountAutomaticApp {
              title
              status
              appDiscountType { functionId }
            }
          }
        }
      }
    }`,
  );
  const { data } = await response.json();
  const nodes = data?.discountNodes?.nodes ?? [];
  const node = nodes.find(
    (candidate) =>
      candidate.discount?.__typename === "DiscountAutomaticApp" &&
      candidate.discount.appDiscountType?.functionId === functionId,
  );
  if (!node) return null;
  return { id: node.id, title: node.discount.title, status: node.discount.status };
}

async function activateComboBundleDiscount(admin) {
  const bundleFunctionId = await getBundleFunctionId(admin);
  if (!bundleFunctionId) {
    throw new Error(
      "Discount function not found. Run `npm run deploy` to deploy extensions first.",
    );
  }

  const existing = await findExistingDiscount(admin, bundleFunctionId);
  if (existing) {
    return { alreadyActive: true, discount: existing };
  }

  const response = await admin.graphql(
    `#graphql
    mutation ActivateComboBundleDiscount($automaticAppDiscount: DiscountAutomaticAppInput!) {
      discountAutomaticAppCreate(automaticAppDiscount: $automaticAppDiscount) {
        automaticAppDiscount { discountId title status }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        automaticAppDiscount: {
          title: DISCOUNT_TITLE,
          functionId: bundleFunctionId,
          startsAt: new Date().toISOString(),
          discountClasses: ["PRODUCT"],
        },
      },
    },
  );

  const { data, errors } = await response.json();
  if (errors) {
    throw new Error("GraphQL error activating the bundle discount.");
  }
  const userErrors = data?.discountAutomaticAppCreate?.userErrors ?? [];
  if (userErrors.length > 0) {
    throw new Error(userErrors.map((error) => error.message).join(", "));
  }

  return { alreadyActive: false, discount: data.discountAutomaticAppCreate.automaticAppDiscount };
}

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const [settings, bundleFunctionId] = await Promise.all([
    getComboBundleSettings(admin),
    getBundleFunctionId(admin),
    // Repairs storefront read access on the settings metafield definition
    // for shops that installed before it was added at creation time. Runs
    // alongside the other loader queries so it adds no serial latency, and
    // is a no-op once access is already correct.
    ensureSettingsMetafieldDefinition(admin).catch((error) => {
      console.error(
        "Combo Bundles: failed to verify settings metafield storefront access",
        error,
      );
    }),
  ]);
  const discount = await findExistingDiscount(admin, bundleFunctionId);
  return json({ settings, discount });
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "activate-discount") {
    try {
      const result = await activateComboBundleDiscount(admin);
      return json({ intent, ok: true, ...result });
    } catch (error) {
      return json({ intent, ok: false, error: error.message });
    }
  }

  if (intent === "save-settings") {
    const tiers = TIER_MINS.map((min) => ({
      min,
      pct: Number(formData.get(`tier_${min}`)),
    }));
    const colors = {
      accent: String(formData.get("accent") || ""),
      accentLight: String(formData.get("accentLight") || ""),
      background: String(formData.get("background") || ""),
    };

    try {
      const saved = await saveComboBundleSettings(admin, { tiers, colors });
      return json({ intent, ok: true, settings: saved });
    } catch (error) {
      return json({ intent, ok: false, error: error.message });
    }
  }

  return json({ intent, ok: false, error: "Unknown action." }, { status: 400 });
};

// Pairs a native color swatch (easy to pick from) with a Polaris TextField
// holding the real hex value (precise, and the one that's actually submitted).
function ColorField({ label, name, value, onChange }) {
  const swatchValue = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
  return (
    <InlineStack gap="200" blockAlign="end" wrap={false}>
      <div style={{ flexGrow: 1 }}>
        <TextField
          label={label}
          name={name}
          value={value}
          onChange={onChange}
          autoComplete="off"
          helpText="Hex color, e.g. #1B5E20"
        />
      </div>
      <input
        type="color"
        aria-label={`${label} picker`}
        value={swatchValue}
        onChange={(event) => onChange(event.target.value)}
        style={{
          width: 36,
          height: 36,
          padding: 0,
          border: "1px solid #E2E8F0",
          borderRadius: 6,
          cursor: "pointer",
        }}
      />
    </InlineStack>
  );
}

export default function Settings() {
  const { settings, discount } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();

  const [tiers, setTiers] = useState(settings.tiers);
  const [colors, setColors] = useState(settings.colors);

  useEffect(() => {
    if (actionData?.intent === "save-settings" && actionData.ok) {
      setTiers(actionData.settings.tiers);
      setColors(actionData.settings.colors);
    }
  }, [actionData]);

  const isActivating =
    navigation.state !== "idle" &&
    navigation.formData?.get("intent") === "activate-discount";
  const isSaving =
    navigation.state !== "idle" &&
    navigation.formData?.get("intent") === "save-settings";

  const isActive = discount?.status === "ACTIVE";

  const updateTierPct = (min, value) => {
    setTiers((current) =>
      current.map((tier) => (tier.min === min ? { ...tier, pct: value } : tier)),
    );
  };

  const highestTier = tiers[tiers.length - 1];

  return (
    <Page title="Bundle Settings">
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Bundle discount</Text>
                {isActive ? (
                  <Banner tone="success" title="Bundle discount is active">
                    <p>
                      Checkout automatically applies the tiers below once a
                      customer's bundle qualifies.
                    </p>
                  </Banner>
                ) : (
                  <>
                    <Text as="p">
                      Activate the automatic discount so the tiers below apply
                      at checkout.
                    </Text>
                    <Form method="post">
                      <input type="hidden" name="intent" value="activate-discount" />
                      <InlineStack>
                        <Button submit variant="primary" loading={isActivating}>
                          Activate bundle discount
                        </Button>
                      </InlineStack>
                    </Form>
                  </>
                )}
                {actionData?.intent === "activate-discount" && !actionData.ok && (
                  <Banner tone="critical" title="Couldn't activate the discount">
                    <p>{actionData.error}</p>
                  </Banner>
                )}
              </BlockStack>
            </Card>

            <Card>
              <Form method="post">
                <input type="hidden" name="intent" value="save-settings" />
                <BlockStack gap="400">
                  <BlockStack gap="200">
                    <Text as="h2" variant="headingMd">Discount tiers</Text>
                    <Text as="p" tone="subdued">
                      Percentage off applied once a customer's bundle reaches
                      each distinct product count. Each tier must be at least
                      as generous as the one before it.
                    </Text>
                  </BlockStack>

                  {tiers.map((tier) => (
                    <TextField
                      key={tier.min}
                      label={`${tier.min} items`}
                      type="number"
                      min={0}
                      max={100}
                      suffix="%"
                      name={`tier_${tier.min}`}
                      value={String(tier.pct)}
                      onChange={(value) => updateTierPct(tier.min, value)}
                      autoComplete="off"
                    />
                  ))}

                  <Divider />

                  <BlockStack gap="200">
                    <Text as="h2" variant="headingMd">Brand colors</Text>
                    <Text as="p" tone="subdued">
                      Applied to the Build Your Own Bundle widget on your
                      storefront.
                    </Text>
                  </BlockStack>

                  <ColorField
                    label="Accent color"
                    name="accent"
                    value={colors.accent}
                    onChange={(value) => setColors((c) => ({ ...c, accent: value }))}
                  />
                  <ColorField
                    label="Accent color (light)"
                    name="accentLight"
                    value={colors.accentLight}
                    onChange={(value) => setColors((c) => ({ ...c, accentLight: value }))}
                  />
                  <ColorField
                    label="Background"
                    name="background"
                    value={colors.background}
                    onChange={(value) => setColors((c) => ({ ...c, background: value }))}
                  />

                  {actionData?.intent === "save-settings" && !actionData.ok && (
                    <Banner tone="critical" title="Couldn't save settings">
                      <p>{actionData.error}</p>
                    </Banner>
                  )}
                  {actionData?.intent === "save-settings" && actionData.ok && (
                    <Banner tone="success" title="Settings saved" />
                  )}

                  <InlineStack align="end">
                    <Button submit variant="primary" loading={isSaving}>
                      Save settings
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Form>
            </Card>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingMd">Preview</Text>
              <div
                style={{
                  background: colors.background,
                  border: "1px solid #E2E8F0",
                  borderRadius: 8,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    display: "inline-block",
                    background: colors.accentLight,
                    color: colors.accent,
                    fontWeight: 700,
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 999,
                    marginBottom: 10,
                  }}
                >
                  {highestTier.pct}% OFF
                </div>
                <Text as="p" variant="bodySm">
                  Add {highestTier.min}+ products to unlock {highestTier.pct}% off
                </Text>
                <div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    disabled
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 6,
                      border: "none",
                      background: colors.accent,
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "default",
                    }}
                  >
                    Add to Bundle
                  </button>
                </div>
              </div>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
