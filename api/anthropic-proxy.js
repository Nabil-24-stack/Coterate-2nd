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
    
    // Determine if we should use streaming based on request characteristics
    const hasImages = requestBody.messages?.[0]?.content?.some(c => c.type === 'image');
    const isLargeRequest = requestBody.max_tokens > 1000;
    const clientRequestsStreaming = requestBody.stream === true;
    
    // Enable streaming if client requests it, or if it's a large request without images
    // Note: Image requests need special handling and may not always work with streaming
    const useStreaming = clientRequestsStreaming || 
                        (!hasImages && isLargeRequest);
    
    // Optimize the request for better throughput
    const optimizedRequest = optimizeRequest(requestBody);
    
    // Set the stream property based on our decision
    optimizedRequest.stream = useStreaming;
    
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
      hasImage: hasImages,
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
      
      // Handle streaming responses differently
      if (useStreaming) {
        // Set appropriate headers for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        console.log('Streaming response to client');
        
        // Create a readable stream from the response body
        const reader = response.body.getReader();
        const textDecoder = new TextDecoder();
        
        // Keep track of accumulated events for design conversions
        let accumulatedEvents = [];
        let accumulatedContent = '';
        let streamComplete = false;
        
        try {
          // Read chunks from the stream as they arrive
          while (!streamComplete) {
            const { done, value } = await reader.read();
            
            if (done) {
              streamComplete = true;
              console.log('Stream complete');
              
              // For design conversions, we want to process the complete response
              if (isDesignConversion && accumulatedEvents.length > 0) {
                // Construct a complete response from accumulated events
                const completeEvent = {
                  type: 'message_complete',
                  message: {
                    id: accumulatedEvents[0]?.message?.id || 'msg_unknown',
                    content: accumulatedContent.length > 0 ? [{ type: 'text', text: accumulatedContent }] : [],
                    model: optimizedRequest.model,
                    role: 'assistant',
                    usage: accumulatedEvents[accumulatedEvents.length - 1]?.message?.usage || {}
                  }
                };
                
                // Send the complete event
                res.write(`data: ${JSON.stringify(completeEvent)}\n\n`);
              }
              
              res.write('data: [DONE]\n\n');
              res.end();
              break;
            }
            
            // Decode the chunk
            const chunk = textDecoder.decode(value, { stream: true });
            
            // Split the chunk by lines and process each line
            const lines = chunk.split('\n');
            for (const line of lines) {
              // Skip empty lines
              if (!line.trim()) continue;
              
              // Check if line starts with "data: "
              if (line.startsWith('data: ')) {
                const eventData = line.slice(6); // Remove "data: " prefix
                
                // Skip [DONE] marker, we'll add our own at the end
                if (eventData === '[DONE]') continue;
                
                try {
                  // Try to parse the event data as JSON
                  const event = JSON.parse(eventData);
                  
                  // For design conversions, we want to accumulate the content
                  if (isDesignConversion && event.type === 'content_block_delta') {
                    // Accumulate content for design conversions
                    accumulatedContent += event.delta?.text || '';
                    accumulatedEvents.push(event);
                    
                    // For large design conversions, don't stream every event to avoid overwhelming the client
                    if (accumulatedEvents.length % 5 === 0) {
                      res.write(`data: ${eventData}\n\n`);
                    }
                  } else {
                    // For regular requests, stream each event as it arrives
                    res.write(`data: ${eventData}\n\n`);
                  }
                } catch (e) {
                  console.error('Error parsing SSE event:', e, 'Raw event:', eventData);
                  
                  // Send unparseable events as-is
                  res.write(`data: ${eventData}\n\n`);
                }
              } else if (line.trim()) {
                // If line doesn't start with "data: " but isn't empty, log it
                console.warn('Received unexpected line in SSE stream:', line);
              }
            }
          }
        } catch (streamError) {
          console.error('Error processing stream:', streamError);
          
          // If we encounter an error during streaming, send an error event
          const errorEvent = {
            type: 'error',
            error: {
              message: `Streaming error: ${streamError.message}`
            }
          };
          
          res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        }
      } else {
        // For non-streaming responses, process normally
        const responseData = await response.json();
        return res.status(200).json(responseData);
      }
    } catch (error) {
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