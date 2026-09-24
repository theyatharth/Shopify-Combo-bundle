import { authenticate } from "../shopify.server";
import db from "../db.server";

// Mandatory GDPR webhook: 48 hours after a shop uninstalls the app, Shopify
// asks it to redact any shop data it still holds.
export const action = async ({ request }) => {
  const { topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  await db.session.deleteMany({ where: { shop } });

  return new Response();
};
