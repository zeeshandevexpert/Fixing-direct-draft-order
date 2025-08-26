import fetch from "node-fetch";

export default async function handler(req, res) {
  // 🔹 Add CORS headers
  res.setHeader("Access-Control-Allow-Origin", "https://ukfixingsdirect.com");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: "Draft order ID is required" });
    }

    try {
      const response = await fetch(
        `https://fixings-direct-limited.myshopify.com/admin/api/2025-07/draft_orders/${id}.json`,
        {
          headers: {
            "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorBody = await response.json();
        console.error("Shopify API Error Response:", errorBody);
        throw new Error(`Shopify API error: ${response.statusText}`);
      }

      const data = await response.json();
      return res.status(200).json(data);
    } catch (error) {
      console.error("Error fetching draft order:", error);
      return res
        .status(500)
        .json({ error: "Error fetching draft order", message: error.message });
    }
  } else {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
}
