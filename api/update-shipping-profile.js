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
    const nantwichProfileId = process.env.SHOPIFY_PROFILE_2_ID;

    // First, get product variants to assign them to the delivery profile
    const productQuery = `
      query getProduct($productId: ID!) {
        product(id: $productId) {
          id
          title
          variants(first: 250) {
            edges {
              node {
                id
              }
            }
          }
        }
      }
    `;

    // Get product variants first
    const productResponse = await fetch(
      `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2025-07/graphql.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: productQuery,
          variables: {
            productId: `gid://shopify/Product/${product.id}`,
          },
        }),
      }
    );

    const productData = await productResponse.json();
    
    if (productData.errors) {
      console.error("Failed to fetch product variants:", JSON.stringify(productData.errors, null, 2));
      return res.status(500).json({
        success: false,
        error: productData.errors,
      });
    }

    const variantIds = productData.data?.product?.variants?.edges?.map(edge => edge.node.id) || [];
    
    if (variantIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No variants found for this product",
      });
    }

    console.log(`Found ${variantIds.length} variants for product ${product.id}`);

    // Now assign variants to delivery profile
    const mutation = `
      mutation assignVariantsToDeliveryProfile($deliveryProfileId: ID!, $variantIds: [ID!]!) {
        deliveryProfileUpdate(id: $deliveryProfileId, profile: {
          variantsToAssociate: $variantIds
        }) {
          profile {
            id
            name
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
      `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2025-07/graphql.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: mutation,
          variables: {
            deliveryProfileId: nantwichProfileId,
            variantIds: variantIds,
          },
        }),
      }
    );

    const data = await response.json();

    if (data.errors || data.data?.deliveryProfileUpdate?.userErrors?.length > 0) {
      console.error("Assignment failed:", JSON.stringify(data, null, 2));
      return res.status(500).json({
        success: false,
        error: data.errors || data.data.deliveryProfileUpdate.userErrors,
      });
    }

    const updatedProfile = data.data?.deliveryProfileUpdate?.profile;
    
    return res.status(200).json({
      success: true,
      message: `✅ Product ${product.title} moved to Nantwich Branch`,
      productId: product.id,
      variantsAssigned: variantIds.length,
      deliveryProfile: updatedProfile,
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ error: err.message });
  }
}
