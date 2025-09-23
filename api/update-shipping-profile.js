import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
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

    // 2. Nantwich Branch profile ID (from your GraphQL query)
    const nantwichProfileId = "gid://shopify/DeliveryProfile/126331519350";

    const mutation = `
      mutation updateProductDeliveryProfile($productId: ID!, $deliveryProfileId: ID!) {
        productUpdate(input: {
          id: $productId
          deliveryProfile: {
            id: $deliveryProfileId
          }
        }) {
          product {
            id
            title
            deliveryProfile {
              id
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    // 3. Call Shopify GraphQL
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
            productId: `gid://shopify/Product/${product.id}`,
            deliveryProfileId: nantwichProfileId,
          },
        }),
      }
    );

    const data = await response.json();

    if (data.errors || data.data?.productUpdate?.userErrors?.length > 0) {
      console.error("Assignment failed:", JSON.stringify(data, null, 2));
      return res.status(500).json({
        success: false,
        error: data.errors || data.data.productUpdate.userErrors,
      });
    }

    const updatedProduct = data.data?.productUpdate?.product;
    
    return res.status(200).json({
      success: true,
      message: `✅ Product ${product.title} moved to Nantwich Branch`,
      productId: product.id,
      deliveryProfileId: updatedProduct?.deliveryProfile?.id,
      updatedProduct: updatedProduct
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ error: err.message });
  }
}
