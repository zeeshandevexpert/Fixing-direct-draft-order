import fetch from 'node-fetch';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://ukfixingsdirect.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'POST') {
        const { productId } = req.body;

        if (!productId) {
            return res.status(400).json({ error: 'Product ID is required' });
        }

        try {
            // Step 1: Fetch product details to check for warehouse_b tag
            const productResponse = await fetch(
                `https://fixings-direct-limited.myshopify.com/admin/api/2025-07/products/${productId}.json`,
                {
                    headers: {
                        'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!productResponse.ok) {
                const errorBody = await productResponse.json();
                console.error('Shopify Product API Error Response:', errorBody);
                throw new Error(`Failed to fetch product: ${productResponse.statusText}`);
            }

            const productData = await productResponse.json();
            const product = productData.product;

            // Step 2: Check if product has warehouse_b tag
            const hasWarehouseBTag = product.tags && product.tags.includes('warehouse_b');

            if (!hasWarehouseBTag) {
                return res.status(200).json({
                    success: false,
                    message: 'Product does not have warehouse_b tag',
                    productId: productId,
                    tags: product.tags
                });
            }

            // Step 3: Update product to assign shipping profile 2
            const updateResponse = await fetch(
                `https://fixings-direct-limited.myshopify.com/admin/api/2025-07/products/${productId}.json`,
                {
                    method: 'PUT',
                    headers: {
                        'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        product: {
                            id: productId,
                            shipping_profile_id: 2
                        }
                    })
                }
            );

            if (!updateResponse.ok) {
                const errorBody = await updateResponse.json();
                console.error('Shopify Update API Error Response:', errorBody);
                throw new Error(`Failed to update shipping profile: ${updateResponse.statusText}`);
            }

            const updatedProductData = await updateResponse.json();

            return res.status(200).json({
                success: true,
                message: 'Product successfully assigned to shipping profile 2',
                productId: productId,
                productTitle: product.title,
                shippingProfileId: 2,
                tags: product.tags,
                updatedProduct: updatedProductData.product
            });

        } catch (error) {
            console.error('Error updating shipping profile:', error);
            return res.status(500).json({
                error: 'Error updating shipping profile',
                message: error.message
            });
        }
    } else {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
}
