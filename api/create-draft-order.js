import fetch from 'node-fetch';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://ukfixingsdirect.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'POST') {
        const { products, firstName, lastName } = req.body;

            if (!products || !firstName) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Create a lean, guest-style draft order without customer or email
        const cartDetails = {
            line_items: products,
            note: `Order Placed by ${firstName} ${lastName || ''}`
        };

        try {
            const response = await fetch('https://fixings-direct-limited.myshopify.com/admin/api/2025-07/draft_orders.json', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN
                },
                body: JSON.stringify({ draft_order: cartDetails })
            });

            if (!response.ok) {
                const errorBody = await response.json();
                console.error('Shopify API Error Response:', errorBody);
                throw new Error(`Shopify API error: ${response.statusText}`);
            }

            const orderData = await response.json();
            return res.status(200).json(orderData);

        } catch (error) {
            console.error('Error creating draft order:', error);
            return res.status(500).json({ error: 'Error creating draft order', message: error.message });
        }
    } else {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
}
