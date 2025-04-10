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
    
    // Check for image content to determine if this will be a heavy request
    let hasImageContent = false;
    let imageSize = 0;
    try {
      if (requestBody.messages && 
          requestBody.messages[0] && 
          requestBody.messages[0].content && 
          Array.isArray(requestBody.messages[0].content)) {
        
        // Look for any image content
        const imageItem = requestBody.messages[0].content.find(item => 
          item.type === 'image' && item.source
        );
        
        if (imageItem) {
          hasImageContent = true;
          console.log('Request contains image data, this may take longer to process');
          
          // If it's base64, measure its size
          if (imageItem.source.type === 'base64' && imageItem.source.data) {
            imageSize = imageItem.source.data.length;
            console.log(`Image data size: approximately ${Math.round(imageSize / 1024)}KB`);
          } else if (imageItem.source.type === 'url') {
            console.log('Image is provided via URL:', imageItem.source.url.substring(0, 50) + '...');
          }
        }
      }
    } catch (validationError) {
      console.error('Error checking for image content:', validationError);
      // Continue anyway, let Anthropic handle the validation
    }
    
    console.log('Forwarding request to Anthropic API...');
    
    // Create a fetch controller to implement timeout
    const controller = new AbortController();
    const timeoutMs = hasImageContent ? 55000 : 30000; // 55 seconds for image requests, 30 for others
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      // Forward the request to Anthropic API with timeout
      const anthropicUrl = 'https://api.anthropic.com/v1/messages';
      const response = await fetch(anthropicUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
        // Add high timeout values
        timeout: timeoutMs - 1000, // 1 second less than our abort controller
        size: 50 * 1024 * 1024, // Allow up to 50MB response size
      });
      
      // Clear the timeout since we got a response
      clearTimeout(timeoutId);
      
      console.log(`Anthropic API response status: ${response.status}`);
      
      // Get the response data
      const responseData = await response.json();
      
      // Return the response from Anthropic API
      return res.status(response.status).json(responseData);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      // Special handling for timeout errors
      if (fetchError.name === 'AbortError') {
        console.error('Request to Anthropic API timed out');
        return res.status(504).json({
          error: {
            type: 'timeout_error',
            message: 'Request to Anthropic API timed out. The processing may be too complex or the API is experiencing high load.'
          }
        });
      }
      
      // Rethrow other errors
      throw fetchError;
    }
  } catch (error) {
    console.error('Server error during Anthropic API call:', error);
    return res.status(500).json({ 
      message: 'Server error during API call', 
      error: error.message
    });
  }
}; 