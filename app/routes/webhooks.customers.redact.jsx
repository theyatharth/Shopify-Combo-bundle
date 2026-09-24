import { authenticate } from "../shopify.server";

// Mandatory GDPR webhook: a shop owner requested a customer's data be redacted.
// This app does not store customer data, so there is nothing to redact.
export const action = async ({ request }) => {
  const { topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  return new Response();
};
