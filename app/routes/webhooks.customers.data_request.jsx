import { authenticate } from "../shopify.server";

// Mandatory GDPR webhook: a customer requested a copy of their data.
// This app does not store customer data, so there is nothing to compile or send.
export const action = async ({ request }) => {
  const { topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  return new Response();
};
