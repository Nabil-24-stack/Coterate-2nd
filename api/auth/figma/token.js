// Serverless function to exchange Figma auth code for access token
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ message: 'Auth code is required' });
    }

    // Get Figma credentials from environment variables
    // Check for both naming conventions (with REACT_APP_ prefix and without)
    const clientId = process.env.FIGMA_CLIENT_ID || process.env.REACT_APP_FIGMA_CLIENT_ID;
    const clientSecret = process.env.FIGMA_CLIENT_SECRET || process.env.REACT_APP_FIGMA_CLIENT_SECRET;
    const redirectUri = process.env.FIGMA_REDIRECT_URI || 
                        process.env.REACT_APP_FIGMA_REDIRECT_URI || 
                        'https://coterate-2nd.vercel.app/auth/figma/callback';

    // Log environment variables (be careful not to log the actual secret in production)
    console.log('Environment variables check:', { 
      clientIdExists: !!clientId, 
      clientIdLength: clientId ? clientId.length : 0,
      clientSecretExists: !!clientSecret,
      clientSecretLength: clientSecret ? clientSecret.length : 0,
      redirectUri,
      // Check which variable format is being used
      usingReactAppPrefix: !!(process.env.REACT_APP_FIGMA_CLIENT_ID && process.env.REACT_APP_FIGMA_CLIENT_SECRET),
      usingVercelFormat: !!(process.env.FIGMA_CLIENT_ID && process.env.FIGMA_CLIENT_SECRET)
    });

    if (!clientId || !clientSecret) {
      console.error('Missing Figma credentials:', { clientIdExists: !!clientId, clientSecretExists: !!clientSecret });
      return res.status(500).json({ 
        message: 'Figma credentials not configured',
        details: 'Check your Vercel environment variables. You may need to use FIGMA_CLIENT_ID and FIGMA_CLIENT_SECRET without the REACT_APP_ prefix.'
      });
    }

    console.log('Making request to Figma API with code:', code.substring(0, 5) + '...');
    
    // Make request to Figma API to exchange code for token
    const tokenResponse = await fetch('https://www.figma.com/api/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
        grant_type: 'authorization_code'
      })
    });

    const responseText = await tokenResponse.text();
    console.log('Figma token response status:', tokenResponse.status, tokenResponse.statusText);
    
    if (!tokenResponse.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
        console.error('Figma token exchange error (parsed):', errorData);
      } catch (e) {
        errorData = { raw: responseText };
        console.error('Figma token exchange error (raw):', responseText);
      }
      
      return res.status(tokenResponse.status).json({ 
        message: 'Failed to exchange auth code with Figma',
        details: errorData,
        status: tokenResponse.status,
        statusText: tokenResponse.statusText
      });
    }

    console.log('Successfully received token from Figma');
    
    let tokenData;
    try {
      tokenData = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse Figma token response:', e);
      return res.status(500).json({ message: 'Invalid response from Figma' });
    }

    // Get user info with the access token
    console.log('Fetching user info with token');
    const userResponse = await fetch('https://api.figma.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });

    if (!userResponse.ok) {
      const userErrorText = await userResponse.text();
      console.error('Failed to fetch user info:', userErrorText);
      return res.status(userResponse.status).json({ 
        message: 'Failed to fetch user info',
        details: userErrorText 
      });
    }

    const userData = await userResponse.json();
    console.log('Successfully fetched user info');

    // Return the combined response
    return res.status(200).json({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || '',
      user: {
        id: userData.id,
        email: userData.email,
        handle: userData.handle,
        img_url: userData.img_url
      }
    });
  } catch (error) {
    console.error('Server error during Figma auth:', error);
    return res.status(500).json({ 
      message: 'Server error during authentication', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
} 