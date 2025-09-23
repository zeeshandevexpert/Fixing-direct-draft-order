import fetch from 'node-fetch';
import crypto from 'crypto';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://ukfixingsdirect.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Shopify-Hmac-Sha256');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Verify Shopify webhook HMAC
    const hmac = req.headers['x-shopify-hmac-sha256'];
    const body = JSON.stringify(req.body);
    const digest = crypto
        .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET)
        .update(body, 'utf8')
        .digest('base64');

    if (hmac !== digest) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.method === 'POST') {
        const product = req.body;

        try {
            // ✅ Only move if product has tag "warehouse_b"
            if (product.tags && product.tags.includes('warehouse_b')) {
                console.log(`📦 Product ${product.id} tagged warehouse_b → moving to Profile 2`);

                await moveProductToProfile2(product.id);
            }

            return res.status(200).json({ success: true });
        } catch (error) {
            console.error('Error handling webhook:', error);
            return res.status(500).json({ error: 'Webhook handling failed', message: error.message });
        }
    } else {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
}

// 👉 Helper function to move product to Profile 2
async function moveProductToProfile2(productId) {
    const profileId = process.env.SHOPIFY_PROFILE_2_ID; // Store Profile 2 ID in env

    const response = await fetch(
        `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2025-07/delivery_profiles/${profileId}/move.json`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN
            },
            body: JSON.stringify({
                product_ids: [productId]
            })
        }
    );

    const data = await response.json();

    if (!response.ok) {
        console.error('❌ Error moving product:', data);
        throw new Error(`Shopify API error: ${response.statusText}`);
    }

    console.log(`✅ Product ${productId} moved to Profile 2`);
    return data;
}
