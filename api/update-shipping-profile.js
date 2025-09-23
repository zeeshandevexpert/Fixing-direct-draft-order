import fetch from 'node-fetch';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://ukfixingsdirect.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'POST') {
        // Debug logging
        console.log('Request body:', req.body);
        console.log('Request headers:', req.headers);
        
        // Check if body exists
        if (!req.body) {
            return res.status(400).json({ 
                error: 'Request body is missing',
                debug: 'Make sure to send JSON data with Content-Type: application/json header'
            });
        }

        const { productId } = req.body;

        if (!productId) {
            return res.status(400).json({ 
                error: 'Product ID is required',
                received: req.body,
                expectedFormat: { productId: 'your-product-id' }
            });
        }

        // Validate environment variables
        if (!process.env.SHOPIFY_ACCESS_TOKEN) {
            return res.status(500).json({ 
                error: 'Server configuration error',
                message: 'SHOPIFY_ACCESS_TOKEN environment variable is not set'
            });
        }

        try {
            // Step 1: Fetch product details to check for warehouse_b tag
            console.log(`Fetching product with ID: ${productId}`);
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
                const errorBody = await productResponse.text();
                console.error('Shopify Product API Error Response:', errorBody);
                
                if (productResponse.status === 404) {
                    return res.status(404).json({
                        error: 'Product not found',
                        productId: productId,
                        message: 'The specified product ID does not exist'
                    });
                }
                
                return res.status(productResponse.status).json({
                    error: 'Shopify API error',
                    status: productResponse.status,
                    message: productResponse.statusText,
                    details: errorBody
                });
            }

            const productData = await productResponse.json();
            const product = productData.product;

            if (!product) {
                return res.status(404).json({
                    error: 'Product data is empty',
                    productId: productId
                });
            }

            console.log(`Product found: ${product.title}, Tags: ${product.tags}`);

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
