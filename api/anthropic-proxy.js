// Server-side proxy for Anthropic API to avoid CORS issues and secure API key
module.exports = async (req, res) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Get the API key from environment variables
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      console.error('Anthropic API key not configured');
      return res.status(500).json({ message: 'Server configuration error: API key not found' });
    }

    // Forward the request to Anthropic API
    const anthropicUrl = 'https://api.anthropic.com/v1/messages';
    
    // Get request body from the client
    const requestBody = req.body;
    
    // Validate request body
    if (!requestBody || !requestBody.model || !requestBody.messages) {
      return res.status(400).json({ message: 'Invalid request body' });
    }
    
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