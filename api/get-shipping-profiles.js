import fetch from 'node-fetch';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://ukfixingsdirect.com');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        // Validate environment variables
        if (!process.env.SHOPIFY_ACCESS_TOKEN) {
            return res.status(500).json({ 
                error: 'Server configuration error',
                message: 'SHOPIFY_ACCESS_TOKEN environment variable is not set'
            });
        }

        try {
            // Fetch available shipping profiles
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
                const errorBody = await profilesResponse.text();
                console.error('Shopify Shipping Profiles API Error:', errorBody);
                return res.status(profilesResponse.status).json({
                    error: 'Failed to fetch shipping profiles',
                    status: profilesResponse.status,
                    message: profilesResponse.statusText,
                    details: errorBody
                });
            }

            const profilesData = await profilesResponse.json();

            return res.status(200).json({
                success: true,
                message: 'Successfully fetched shipping profiles',
                profiles: profilesData.shipping_profiles?.map(profile => ({
                    id: profile.id,
                    name: profile.name,
                    products_count: profile.products_count,
                    default: profile.default
                })) || [],
                totalCount: profilesData.shipping_profiles?.length || 0
            });

        } catch (error) {
            console.error('Error fetching shipping profiles:', error);
            return res.status(500).json({
                error: 'Error fetching shipping profiles',
                message: error.message
            });
        }
    } else {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
}