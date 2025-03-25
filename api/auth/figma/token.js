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
    // For Vercel, these are set in the project settings
    const clientId = process.env.REACT_APP_FIGMA_CLIENT_ID;
    const clientSecret = process.env.REACT_APP_FIGMA_CLIENT_SECRET;
    const redirectUri = process.env.REACT_APP_FIGMA_REDIRECT_URI || 'https://coterate-2nd.vercel.app/auth/figma/callback';

    console.log('Using credentials:', { clientIdExists: !!clientId, clientSecretExists: !!clientSecret, redirectUri });

    if (!clientId || !clientSecret) {
      return res.status(500).json({ message: 'Figma credentials not configured' });
    }

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
    
    if (!tokenResponse.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch (e) {
        errorData = { raw: responseText };
      }
      
      console.error('Figma token exchange error:', errorData);
      return res.status(tokenResponse.status).json({ 
        message: 'Failed to exchange auth code with Figma',
        details: errorData
      });
    }

    const tokenData = JSON.parse(responseText);

    // Get user info with the access token
    const userResponse = await fetch('https://api.figma.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });

    if (!userResponse.ok) {
      console.error('Failed to fetch user info:', await userResponse.text());
      return res.status(userResponse.status).json({ message: 'Failed to fetch user info' });
    }

    const userData = await userResponse.json();

    // Return the combined response
    return res.status(200).json({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      user: {
        id: userData.id,
        email: userData.email,
        handle: userData.handle,
        img_url: userData.img_url
      }
    });
  } catch (error) {
    console.error('Server error during Figma auth:', error);
    return res.status(500).json({ message: 'Server error during authentication', error: error.message });
  }
} 