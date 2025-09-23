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

        // Handle both product object and productId scenarios
        let productId, productData = null;
        
        if (req.body.id) {
            // If the request contains a full product object
            productId = req.body.id;
            productData = req.body; // We already have the product data
            console.log('Received full product object, using ID:', productId);
        } else if (req.body.productId) {
            // If the request contains just productId
            productId = req.body.productId;
            console.log('Received productId:', productId);
        } else {
            return res.status(400).json({ 
                error: 'Product ID is required',
                received: req.body,
                expectedFormat: { productId: 'your-product-id' },
                alternativeFormat: 'Or send the full product object with an id field'
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
            let product;
            
            if (productData) {
                // We already have the product data from the request
                product = productData;
                console.log(`Using provided product data: ${product.title}, Tags: ${product.tags}`);
            } else {
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

                const fetchedProductData = await productResponse.json();
                product = fetchedProductData.product;

                if (!product) {
                    return res.status(404).json({
                        error: 'Product data is empty',
                        productId: productId
                    });
                }

                console.log(`Product found: ${product.title}, Tags: ${product.tags}`);
            }

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

            // Step 3: First, let's fetch available shipping profiles to verify ID 2 exists
            console.log('Fetching available shipping profiles...');
            const profilesResponse = await fetch(
                `https://fixings-direct-limited.myshopify.com/admin/api/2025-07/shipping_profiles.json`,
                {
                    headers: {
                        'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!profilesResponse.ok) {
                console.error('Failed to fetch shipping profiles:', profilesResponse.statusText);
                // Continue with the update anyway, but log the issue
            } else {
                const profilesData = await profilesResponse.json();
                console.log('Available shipping profiles:', profilesData.shipping_profiles?.map(p => ({ id: p.id, name: p.name })));
            }

            // Step 4: Update product to assign shipping profile 2
            // Note: We need to include the shipping_profile in the product update
            console.log(`Updating product ${productId} with shipping profile 2...`);
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
                            shipping_profile: {
                                id: 2
                            }
                        }
                    })
                }
            );

            if (!updateResponse.ok) {
                const errorBody = await updateResponse.text();
                console.error('Shopify Update API Error Response:', errorBody);
                
                // Try alternative approach with shipping_profile_id
                console.log('Trying alternative approach with shipping_profile_id...');
                const altUpdateResponse = await fetch(
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

                if (!altUpdateResponse.ok) {
                    const altErrorBody = await altUpdateResponse.text();
                    console.error('Alternative approach also failed:', altErrorBody);
                    
                    return res.status(500).json({
                        error: 'Failed to update shipping profile',
                        originalError: errorBody,
                        alternativeError: altErrorBody,
                        suggestion: 'Shipping profile ID 2 may not exist. Check available shipping profiles first.'
                    });
                }

                const updatedProductData = await altUpdateResponse.json();
                return res.status(200).json({
                    success: true,
                    message: 'Product successfully assigned to shipping profile 2 (using alternative method)',
                    productId: productId,
                    productTitle: product.title,
                    shippingProfileId: 2,
                    tags: product.tags,
                    updatedProduct: updatedProductData.product,
                    method: 'alternative'
                });
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
