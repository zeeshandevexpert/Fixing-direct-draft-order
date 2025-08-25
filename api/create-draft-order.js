import fetch from 'node-fetch';

// Define the serverless function
export default async function handler(req, res) {
    // Enable CORS by setting the appropriate headers
    res.setHeader('Access-Control-Allow-Origin', 'https://ukfixingsdirect.com'); // Allow your domain
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); // Allow POST and OPTIONS methods
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); // Allow content-type header

    // Handle OPTIONS request (pre-flight check)
    if (req.method === 'OPTIONS') {
        return res.status(200).end(); // Respond successfully to the OPTIONS request
    }

    // Proceed with handling POST request
    if (req.method === 'POST') {
        const { products, email, firstName, lastName } = req.body;

        // Validate that the required fields are present
        if (!products || !email || !firstName || !lastName) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Build the cart details for the Shopify draft order
        const cartDetails = {
            email: email,
            // shipping_address: {
            //     first_name: firstName,
            //     last_name: lastName,
            //     address1: "123 Main St", // Customize or collect dynamically
            //     city: "Huntington Beach",
            //     province: "California",
            //     country: "US",
            //     zip: "92648"
            // },
            line_items: products,
            customer: {
                first_name: firstName,
                last_name: lastName,
                email: email
            },
            financial_status: "pending", // Default to pending status, can be "paid", "authorized", etc.
            fulfillment_status: "unfulfilled", // Order status can be "fulfilled", "unfulfilled", or "partially_fulfilled"
            notes: "Order created via lead generator form"
        };

        try {
            // Send the request to Shopify's API to create a draft order
            const response = await fetch('https://fixings-direct-limited.myshopify.com/admin/api/2025-01/orders.json', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN // Use environment variable for access token
                },
                body: JSON.stringify({ order: cartDetails })
            });

            // Log the full response for debugging if there's an error
            if (!response.ok) {
                const errorBody = await response.json(); // Get the response body for more details
                console.error('Shopify API Error Response:', errorBody);
                throw new Error(`Shopify API error: ${response.statusText}`);
            }

            const orderData = await response.json();
            return res.status(200).json(orderData);

        } catch (error) {
            // Handle errors in making the request
            console.error('Error creating order:', error);
            return res.status(500).json({ error: 'Error creating order', message: error.message });
        }

    } else {
        // Handle unsupported HTTP methods (only POST is allowed)
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
}
