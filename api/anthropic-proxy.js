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
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    console.error(`Method not allowed: ${req.method}`);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Get API key from environment variable
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY not set');
      return res.status(500).json({ 
        error: {
          type: 'server_error',
          message: 'API key not configured'
        }
      });
    }
    
    // Parse request body
    let requestBody;
    try {
      requestBody = req.body;
    } catch (e) {
      console.error('Error parsing request body:', e);
      return res.status(400).json({ 
        error: {
          type: 'invalid_request_error',
          message: 'Invalid request body'
        }
      });
    }
    
    // Optimize the request for better throughput
    const optimizedRequest = optimizeRequest(requestBody);
    
    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 90000); // 90 second timeout
    
    // Add logging for the request
    console.log('Sending request to Anthropic API:', {
      model: optimizedRequest.model,
      hasImage: optimizedRequest.messages?.[0]?.content?.some(c => c.type === 'image'),
      messageCount: optimizedRequest.messages?.length,
      systemPromptLength: optimizedRequest.system?.length
    });
    
    // Configure the API endpoint
    const anthropicUrl = 'https://api.anthropic.com/v1/messages';
    
    try {
      // Send request to Anthropic API
      const response = await fetch(anthropicUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(optimizedRequest),
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      // Handle Anthropic API response
      if (!response.ok) {
        const errorData = await response.text();
        console.error(`Anthropic API error: ${response.status}`, errorData);
        
        return res.status(response.status).json({
          error: {
            type: 'anthropic_api_error',
            code: response.status.toString(),
            message: `An error occurred with the Anthropic API: ${errorData}`
          }
        });
      }
      
      // Parse and return the response
      const responseData = await response.json();
      return res.status(200).json(responseData);
      
    } catch (error) {
      clearTimeout(timeout);
      
      // Handle timeout errors
      if (error.name === 'AbortError') {
        console.error('Request to Anthropic API timed out');
        return res.status(504).json({
          error: {
            type: 'timeout_error',
            code: '504',
            message: 'Request to Anthropic API timed out. The Figma design may be too complex.'
          }
        });
      }
      
      // Handle other fetch errors
      console.error('Error calling Anthropic API:', error);
      return res.status(500).json({
        error: {
          type: 'server_error',
          message: `Error calling Anthropic API: ${error.message}`
        }
      });
    }
  } catch (error) {
    // Handle unexpected errors
    console.error('Unexpected error in API proxy:', error);
    return res.status(500).json({
      error: {
        type: 'server_error',
        message: 'Unexpected server error'
      }
    });
  }
};

// Helper function to optimize the request for better performance
function optimizeRequest(requestBody) {
  // Clone the request to avoid modifying the original
  const optimized = JSON.parse(JSON.stringify(requestBody));
  
  // Use a more efficient model when possible
  if (!optimized.model || optimized.model === 'claude-3-opus-20240229') {
    optimized.model = 'claude-3-7-sonnet-20250219'; // Use the Sonnet model which is faster
  }
  
  // Process images if present to ensure they're not too large
  if (optimized.messages && optimized.messages.length > 0) {
    for (const message of optimized.messages) {
      if (message.content && Array.isArray(message.content)) {
        for (const contentItem of message.content) {
          // Process base64 images to ensure they're not too large
          if (contentItem.type === 'image' && 
              contentItem.source && 
              contentItem.source.type === 'base64') {
            
            // Check if the base64 data is over 1MB
            if (contentItem.source.data && contentItem.source.data.length > 1000000) {
              // Log that we're truncating a large image
              console.log('Truncating large base64 image to improve performance');
              
              // Truncate the base64 data to a reasonable size
              contentItem.source.data = contentItem.source.data.substring(0, 1000000);
            }
          }
        }
      }
    }
  }
  
  return optimized;
} 