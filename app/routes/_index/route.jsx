import { redirect } from "@remix-run/node";
import styles from "./styles.module.css";

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return null;
};

export default function App() {
  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Combo-Bundles</h1>
        <p className={styles.text}>
          Increase average order value with build-your-own bundles and automatic tiered discounts.
        </p>
        <p className={styles.text}>
          Install Combo-Bundles from the Shopify App Store to get started.
        </p>
      </div>
    </div>
  );
}