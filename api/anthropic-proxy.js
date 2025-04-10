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
    
    // Check if client supports streaming
    const useStreaming = requestBody.stream === true || 
                        (requestBody.messages?.[0]?.content?.some(c => c.type === 'image') === false &&
                        requestBody.max_tokens > 1000);
    
    // Optimize the request for better throughput
    const optimizedRequest = optimizeRequest(requestBody);
    
    // Remove the stream property if we added it
    if (optimizedRequest.stream && requestBody.stream !== true) {
      delete optimizedRequest.stream;
    }
    
    // Check if this is a design conversion request (longer timeout)
    const isDesignConversion = 
      optimizedRequest.system?.includes('convert a Figma design into precise HTML and CSS code') || 
      optimizedRequest.messages?.[0]?.content?.some(c => 
        c.type === 'text' && 
        (c.text?.includes('convert this Figma design into precise HTML') ||
         c.text?.includes('Please convert this Figma design into HTML and CSS'))
      );
    
    // Set longer timeout for design conversions
    const timeoutDuration = isDesignConversion ? 240000 : 120000; // 4 minutes for design conversions, 2 minutes for others
    
    if (isDesignConversion) {
      console.log('Design conversion request detected, using extended timeout:', timeoutDuration);
    }
    
    // Log request info for debugging
    console.log('API request:', {
      model: optimizedRequest.model,
      maxTokens: optimizedRequest.max_tokens,
      hasImage: optimizedRequest.messages?.[0]?.content?.some(c => c.type === 'image'),
      isDesignConversion,
      useStreaming,
      requestSize: JSON.stringify(optimizedRequest).length
    });
    
    // Configure the API endpoint
    const anthropicUrl = 'https://api.anthropic.com/v1/messages';
    
    try {
      // Send request to Anthropic API
      const fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(optimizedRequest)
      };
      
      // Create AbortController for timeout handling
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, timeoutDuration);
      
      fetchOptions.signal = controller.signal;
      
      // Make the fetch request
      const response = await fetch(anthropicUrl, fetchOptions);
      
      // Clear the timeout
      clearTimeout(timeout);
      
      // Handle Anthropic API error responses
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
      
      // For large responses or design conversions, break up the response to avoid timeouts
      if (isDesignConversion && optimizedRequest.max_tokens > 2000) {
        // Parse the response in chunks to avoid timeouts
        const responseData = await response.json();
        
        // Add a short delay to ensure the client has time to process the response
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return res.status(200).json(responseData);
      } else {
        // For normal responses, just pass through the JSON
        const responseData = await response.json();
        return res.status(200).json(responseData);
      }
    } catch (error) {
      // Clear timeout if it exists
      if (timeout) clearTimeout(timeout);
      
      // Handle timeout errors
      if (error.name === 'AbortError') {
        console.error('Request to Anthropic API timed out');
        return res.status(504).json({
          error: {
            type: 'timeout_error',
            code: '504',
            message: 'Request to Anthropic API timed out. The Figma design may be too complex. Try dividing the task into smaller parts.'
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
  
  // Set higher token limit for design conversions
  if (optimized.system?.includes('convert a Figma design into precise HTML and CSS code')) {
    optimized.max_tokens = Math.max(optimized.max_tokens || 4000, 4000);
  }
  
  // Remove the problematic chunked parameter - we'll handle large responses differently
  if (optimized.chunked) {
    delete optimized.chunked;
  }
  
  // Check if this is a design conversion with a large payload
  const isLargeDesignConversion = 
    optimized.system?.includes('convert a Figma design') &&
    JSON.stringify(optimized).length > 300000;
  
  // For very large design conversions, simplify the payload
  if (isLargeDesignConversion) {
    console.log('Simplifying large design conversion payload');
    
    // Process messages to remove redundant text and compress image data if needed
    if (optimized.messages && optimized.messages.length > 0) {
      optimized.messages.forEach(message => {
        if (message.content && Array.isArray(message.content)) {
          // Identify and keep only essential content
          const imageItems = message.content.filter(item => item.type === 'image');
          const textItems = message.content.filter(item => item.type === 'text');
          
          // If we have both text and images, keep only the most important
          if (imageItems.length > 0 && textItems.length > 1) {
            // Find the main text prompt (likely the longest or most descriptive)
            const mainTextItem = textItems.reduce((longest, current) => 
              (current.text && current.text.length > (longest.text?.length || 0)) ? current : longest, 
              { type: 'text', text: '' }
            );
            
            // Keep only images and the main text prompt
            message.content = [...imageItems, mainTextItem];
          }
        }
      });
    }
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
            
            // Ensure the media type is correct for base64 images
            // PNG is more reliable for design screenshots
            if (contentItem.source.media_type === 'image/jpeg') {
              contentItem.source.media_type = 'image/png';
            }
            
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
  
  // Remove potentially problematic beta headers
  if (optimized.anthropic_beta && optimized.anthropic_beta.includes('max-tokens-boost-enabled')) {
    delete optimized.anthropic_beta;
  }

  // Make sure no other custom properties are added
  const validAnthropicParams = [
    'model', 'max_tokens', 'metadata', 'stop_sequences',
    'stream', 'system', 'temperature', 'top_k', 'top_p', 'messages'
  ];
  
  // Remove any properties that aren't in the validAnthropicParams list
  Object.keys(optimized).forEach(key => {
    if (!validAnthropicParams.includes(key)) {
      console.log(`Removing unsupported Anthropic API parameter: ${key}`);
      delete optimized[key];
    }
  });
  
  return optimized;
} 