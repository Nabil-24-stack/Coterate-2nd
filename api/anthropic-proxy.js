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

  // For tracking request processing time
  const requestStartTime = Date.now();

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
    
    // Check for and optimize any image content
    let enhancedRequestBody = { ...requestBody };
    let hasImageContent = false;
    let imageSize = 0;
    
    try {
      if (requestBody.messages && 
          requestBody.messages[0] && 
          requestBody.messages[0].content && 
          Array.isArray(requestBody.messages[0].content)) {
        
        // Process the message content array
        const processedContent = [];
        
        // First gather text parts to maintain original order
        for (const contentItem of requestBody.messages[0].content) {
          if (contentItem.type === 'text') {
            // Keep text content as is
            processedContent.push(contentItem);
          } else if (contentItem.type === 'image') {
            hasImageContent = true;
            
            // Check image source type
            if (contentItem.source.type === 'base64' && contentItem.source.data) {
              // Process base64 image
              imageSize = contentItem.source.data.length;
              console.log(`Processing base64 image, size: approximately ${Math.round(imageSize / 1024)}KB`);
              
              // If it's extremely large, we might need to trim it
              // Claude has a 4MB limit for images
              const maxBase64Size = 3.5 * 1024 * 1024; // 3.5MB limit (to be safe)
              
              if (imageSize > maxBase64Size) {
                console.log(`Image exceeds recommended size limit (${Math.round(imageSize/1024/1024)}MB), truncating to ${Math.round(maxBase64Size/1024/1024)}MB`);
                // Trim the base64 data to fit within limits
                // This is not ideal but better than failing
                contentItem.source.data = contentItem.source.data.substring(0, maxBase64Size);
              }
              
              processedContent.push(contentItem);
            } else if (contentItem.source.type === 'url') {
              // For URL images, we pass them through as-is
              console.log('Processing image URL:', contentItem.source.url.substring(0, 50) + '...');
              processedContent.push(contentItem);
            }
          }
        }
        
        // Replace the content array with our processed version
        enhancedRequestBody.messages[0].content = processedContent;
      }
    } catch (processingError) {
      console.error('Error processing request content:', processingError);
      // Continue with original request body if processing fails
      enhancedRequestBody = requestBody;
    }
    
    console.log(`Prepared request ${hasImageContent ? 'with image content' : 'without images'}`);
    
    // Apply different timeouts based on content type
    const timeoutOptions = {
      initialTimeout: hasImageContent ? 55000 : 30000,  // Initial timeout: 55s for images, 30s for text
      retryTimeout: 10000,                              // Additional time for retry: 10s
      maxRetries: 1                                     // Maximum number of retries
    };
    
    // Create a fetch controller to implement timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutOptions.initialTimeout);
    
    // Function to make the actual API call with retry logic
    const callAnthropicAPI = async (attemptNumber = 1) => {
      try {
        const anthropicUrl = 'https://api.anthropic.com/v1/messages';
        
        // Update logs with attempt information
        console.log(`Anthropic API call attempt ${attemptNumber} started at ${new Date().toISOString()}`);
        
        const response = await fetch(anthropicUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify(enhancedRequestBody),
          signal: controller.signal
        });
        
        const responseTime = Date.now() - requestStartTime;
        console.log(`Anthropic API response received in ${responseTime}ms with status: ${response.status}`);
        
        // Handle error responses that might benefit from retry
        if (!response.ok) {
          const errorStatus = response.status;
          
          // Check if we should retry based on status and attempt number
          if (
            (errorStatus === 429 || errorStatus === 500 || errorStatus === 503) && 
            attemptNumber <= timeoutOptions.maxRetries
          ) {
            // For these specific errors, we'll retry once
            console.log(`Received error ${errorStatus}, will retry (attempt ${attemptNumber}/${timeoutOptions.maxRetries})`);
            
            // Clear the current timeout
            clearTimeout(timeoutId);
            
            // Wait briefly before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Set a new timeout for the retry
            const newTimeoutId = setTimeout(() => controller.abort(), timeoutOptions.retryTimeout);
            
            try {
              // Recursive call to retry
              return await callAnthropicAPI(attemptNumber + 1);
            } finally {
              clearTimeout(newTimeoutId);
            }
          }
          
          // If we reach here, we either shouldn't retry or have exhausted retries
          const errorText = await response.text();
          return { 
            ok: false, 
            status: response.status, 
            data: errorText 
          };
        }
        
        // Success path - parse the JSON response
        const jsonData = await response.json();
        return { 
          ok: true, 
          status: response.status, 
          data: jsonData 
        };
      } catch (fetchError) {
        // Check if this was a timeout
        if (fetchError.name === 'AbortError') {
          console.error('API request aborted/timed out');
          return { 
            ok: false, 
            status: 504, 
            data: {
              error: {
                type: 'timeout_error',
                message: 'Request to Anthropic API timed out. The processing may be too complex or the API is experiencing high load.'
              }
            }
          };
        }
        
        // For other fetch errors
        console.error('Fetch error during API call:', fetchError);
        return { 
          ok: false, 
          status: 500, 
          data: { 
            error: { 
              type: 'api_connection_error',
              message: `API connection error: ${fetchError.message}`
            }
          }
        };
      }
    };
    
    try {
      // Make the API call with our retry logic
      const result = await callAnthropicAPI();
      
      // Clean up the timeout
      clearTimeout(timeoutId);
      
      // Return the appropriate response to the client
      if (!result.ok) {
        // If it's a string error response, try to parse it as JSON first
        let errorData = result.data;
        if (typeof errorData === 'string') {
          try {
            errorData = JSON.parse(errorData);
          } catch (e) {
            // Keep as string if parsing fails
          }
        }
        
        console.error('API returned error:', result.status, typeof errorData === 'string' ? errorData.substring(0, 200) : JSON.stringify(errorData).substring(0, 200));
        return res.status(result.status).json(errorData);
      }
      
      // Success case - return the data
      return res.status(result.status).json(result.data);
    } catch (apiCallError) {
      // Clean up timeout
      clearTimeout(timeoutId);
      throw apiCallError;
    }
  } catch (error) {
    console.error('Server error during Anthropic API call:', error);
    return res.status(500).json({ 
      message: 'Server error during API call', 
      error: error.message
    });
  }
}; 