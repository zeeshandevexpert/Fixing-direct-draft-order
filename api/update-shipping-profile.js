import fetch from "node-fetch";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://ukfixingsdirect.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { product } = req.body; // Shopify webhooks send { product: {...} }

    if (!product || !product.id) {
      return res.status(400).json({ error: "Invalid product payload" });
    }

    const productId = product.id;
    const hasWarehouseBTag =
      product.tags && product.tags.includes("warehouse_b");

    if (!hasWarehouseBTag) {
      return res.status(200).json({
        success: false,
        message: "Product does not have warehouse_b tag",
        productId,
        tags: product.tags,
      });
    }

    if (!process.env.SHOPIFY_ACCESS_TOKEN) {
      return res.status(500).json({
        error: "SHOPIFY_ACCESS_TOKEN is not set",
      });
    }

    const shopifyFetch = async (query, variables = {}) => {
      const response = await fetch(
        "https://fixings-direct-limited.myshopify.com/admin/api/2024-10/graphql.json",
        {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query, variables }),
        }
      );
      const data = await response.json();
      if (data.errors) throw new Error(JSON.stringify(data.errors));
      return data;
    };

    // Step 1: Find Nantwich Branch profile
    const profilesQuery = `
      query {
        deliveryProfiles(first: 10) {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    `;
    const profiles = await shopifyFetch(profilesQuery);

    const nantwichProfileId = profiles.data.deliveryProfiles.edges.find(
      (p) => p.node.name === "Nantwich Branch"
    )?.node.id;

    if (!nantwichProfileId) {
      return res.status(404).json({
        error: "Nantwich Branch profile not found",
      });
    }

    // Step 2: Assign product to Nantwich Branch
    const assignMutation = `
      mutation assignProduct($profileId: ID!, $productId: ID!) {
        deliveryProfileAssignProduct(
          id: $profileId,
          productIds: [$productId]
        ) {
          deliveryProfile {
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

    const variables = {
      profileId: nantwichProfileId,
      productId: `gid://shopify/Product/${productId}`,
    };

    const result = await shopifyFetch(assignMutation, variables);

    return res.status(200).json({
      success: true,
      productId,
      productTitle: product.title,
      assignedProfile: result.data.deliveryProfileAssignProduct.deliveryProfile,
      errors: result.data.deliveryProfileAssignProduct.userErrors,
    });
  } catch (error) {
    console.error("Error in handler:", error);
    return res.status(500).json({
      error: "Error processing request",
      message: error.message,
    });
  }
}
