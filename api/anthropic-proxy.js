// Server-side proxy for Anthropic API to avoid CORS issues and secure API key
module.exports = async (req, res) => {
  // Set CORS headers to allow requests from any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Debug the incoming request
  console.log(`Anthropic proxy received request with method: ${req.method}`);
  console.log('Request headers:', JSON.stringify(req.headers, null, 2));
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    console.error(`Method not allowed: ${req.method}`);
    return res.status(405).json({ 
      message: 'Method not allowed', 
      method: req.method,
      acceptedMethods: ['POST']
    });
  }

  try {
    // Log request details for debugging
    console.log(`API proxy request received: ${new Date().toISOString()}`);
    
    // Get the API key from environment variables - try multiple possible locations
    // Vercel specific environment variables start with VERCEL_ or without REACT_APP_ prefix
    const apiKey = process.env.ANTHROPIC_API_KEY || 
                   process.env.VERCEL_ANTHROPIC_API_KEY || 
                   process.env.REACT_APP_ANTHROPIC_API_KEY;
    
    // Log which API key variables are available (not the actual keys)
    const envDebug = {
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
      hasVercelAnthropicKey: !!process.env.VERCEL_ANTHROPIC_API_KEY,
      hasReactAppKey: !!process.env.REACT_APP_ANTHROPIC_API_KEY,
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV
    };
    
    console.log('Environment variable debug:', JSON.stringify(envDebug, null, 2));
    
    if (!apiKey) {
      console.error('Anthropic API key not configured');
      return res.status(500).json({ 
        message: 'Server configuration error: API key not found',
        envInfo: envDebug
      });
    }

    // Forward the request to Anthropic API
    const anthropicUrl = 'https://api.anthropic.com/v1/messages';
    
    // Get request body from the client
    const requestBody = req.body;
    
    // Validate request body
    if (!requestBody || !requestBody.model || !requestBody.messages) {
      console.error('Invalid request body');
      return res.status(400).json({ message: 'Invalid request body' });
    }
    
    console.log('Forwarding request to Anthropic API...');
    
    // Forward the request to Anthropic API
    const response = await fetch(anthropicUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log(`Anthropic API response status: ${response.status}`);
    
    // Get the response data
    const responseData = await response.json();
    
    // Return the response from Anthropic API
    return res.status(response.status).json(responseData);
  } catch (error) {
    console.error('Server error during Anthropic API call:', error);
    return res.status(500).json({ 
      message: 'Server error during API call', 
      error: error.message,
      stack: error.stack
    });
  }
}; 