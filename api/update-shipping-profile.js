import crypto from "crypto";
import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Optional but recommended: verify webhook
  if (process.env.SHOPIFY_API_SECRET) {
    const hmac = req.headers["x-shopify-hmac-sha256"];
    const body = JSON.stringify(req.body);
    const digest = crypto
      .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
      .update(body, "utf8")
      .digest("base64");

    if (digest !== hmac) {
      return res.status(401).json({ error: "Unauthorized webhook" });
    }
  }

  try {
    const product = req.body;
    console.log("Webhook received:", product.id, product.title);

    // 1. Check tag
    const hasWarehouseB = product.tags && product.tags.includes("warehouse_b");
    if (!hasWarehouseB) {
      return res.status(200).json({
        success: false,
        message: "No warehouse_b tag, skipping",
      });
    }

    // 2. Nantwich profile ID (replace with yours)
    const nantwichProfileId = "gid://shopify/DeliveryProfile/126331519350";

    const mutation = `
      mutation assignProductToProfile($profileId: ID!, $productId: ID!) {
        deliveryProfileAssignProduct(productIds: [$productId], profileId: $profileId) {
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await fetch(
      "https://fixings-direct-limited.myshopify.com/admin/api/2025-07/graphql.json",
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: mutation,
          variables: {
            profileId: nantwichProfileId,
            productId: `gid://shopify/Product/${product.id}`,
          },
        }),
      }
    );

    const data = await response.json();

    if (data.errors || data.data?.deliveryProfileAssignProduct?.userErrors?.length) {
      console.error("Assignment failed:", JSON.stringify(data, null, 2));
      return res.status(500).json({
        success: false,
        error: data.errors || data.data.deliveryProfileAssignProduct.userErrors,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Product ${product.title} assigned to Nantwich Branch`,
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ error: err.message });
  }
}
