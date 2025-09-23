import fetch from 'node-fetch';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://ukfixingsdirect.com');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        return res.status(200).json({
            message: 'Test endpoint is working',
            timestamp: new Date().toISOString(),
            method: req.method,
            hasToken: !!process.env.SHOPIFY_ACCESS_TOKEN
        });
    }

    if (req.method === 'POST') {
        return res.status(200).json({
            message: 'POST test endpoint is working',
            timestamp: new Date().toISOString(),
            body: req.body,
            headers: req.headers,
            hasToken: !!process.env.SHOPIFY_ACCESS_TOKEN
        });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}