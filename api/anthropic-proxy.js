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
  
  // Only allow POST requests with appropriate error response
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
    
    // In Vercel, environment variables are directly accessible without REACT_APP_ prefix
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    // Log environment info for debugging (without exposing the key)
    console.log('Environment: ', {
      hasApiKey: !!apiKey,
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV
    });
    
    if (!apiKey) {
      console.error('Anthropic API key not configured');
      return res.status(500).json({ 
        message: 'Server configuration error: API key not found. Please add ANTHROPIC_API_KEY in your Vercel project settings.',
        envInfo: {
          hasApiKey: !!apiKey,
          nodeEnv: process.env.NODE_ENV || 'not set'
        }
      });
    }

    // Get request body from the client
    const requestBody = req.body;
    
    // Validate request body
    if (!requestBody || !requestBody.model || !requestBody.messages) {
      console.error('Invalid request body');
      return res.status(400).json({ message: 'Invalid request body' });
    }
    
    // Extra validation for image data
    try {
      if (requestBody.messages && 
          requestBody.messages[0] && 
          requestBody.messages[0].content && 
          Array.isArray(requestBody.messages[0].content)) {
        
        // Look for any image content
        const imageContent = requestBody.messages[0].content.find(item => 
          item.type === 'image' && item.source && item.source.type === 'base64'
        );
        
        if (imageContent) {
          console.log('Found image content in request, validating...');
          
          // Check if data looks like a base64 string
          const data = imageContent.source.data;
          const mediaType = imageContent.source.media_type || 'image/jpeg';
          
          if (!data || typeof data !== 'string') {
            console.error('Image data is missing or not a string');
            return res.status(400).json({ 
              message: 'Invalid image data: missing or not a string',
              type: 'error',
              error: { type: 'invalid_request_error' }
            });
          }
          
          // Simple validation that it looks like base64
          if (!/^[A-Za-z0-9+/=]+$/.test(data)) {
            console.error('Image data contains invalid characters for base64');
            return res.status(400).json({ 
              message: 'Invalid image data: not a valid base64 string',
              type: 'error',
              error: { type: 'invalid_request_error' }
            });
          }
          
          console.log(`Validated image with media type ${mediaType}, data length: ${data.length}`);
        }
      }
    } catch (validationError) {
      console.error('Error validating image data:', validationError);
      // Continue anyway, let Anthropic handle the validation
    }
    
    console.log('Forwarding request to Anthropic API...');
    
    // Forward the request to Anthropic API
    const anthropicUrl = 'https://api.anthropic.com/v1/messages';
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
      error: error.message
    });
  }
}; 