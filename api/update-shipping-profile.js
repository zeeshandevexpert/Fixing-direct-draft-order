import crypto from "crypto";
import fetch from "node-fetch";

export default async function handler(req, res) {
  // Shopify sends only POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verify webhook signature
  const hmac = req.headers["x-shopify-hmac-sha256"];
  const body = JSON.stringify(req.body);
  const digest = crypto
    .createHmac("sha256", process.env.SHOPIFY_API_SECRET) // from app setup
    .update(body, "utf8")
    .digest("base64");

  if (digest !== hmac) {
    return res.status(401).json({ error: "Unauthorized webhook" });
  }

  try {
    const product = req.body;

    console.log("Webhook received → Product:", product.id, product.title);

    // Step 1: check tags
    const hasWarehouseB = product.tags && product.tags.includes("warehouse_b");
    if (!hasWarehouseB) {
      return res.status(200).json({
        success: false,
        message: "No warehouse_b tag, skipping",
      });
    }

    // Step 2: assign to Nantwich Branch profile
    // Replace with the real Nantwich profile ID you got earlier
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
      console.error("Shipping profile assignment failed:", data);
      return res.status(500).json({
        success: false,
        error: data.errors || data.data.deliveryProfileAssignProduct.userErrors,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Product ${product.title} assigned to Nantwich Branch`,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
}
