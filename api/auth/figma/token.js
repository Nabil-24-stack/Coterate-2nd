// Serverless function to exchange Figma auth code for access token
// This now forwards to Supabase for authentication
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Redirect the user to Supabase's callback URL
    return res.status(200).json({ 
      redirectTo: 'https://tsqfwommnuhtbeupuwwm.supabase.co/auth/v1/callback',
      message: 'Please use Supabase authentication flow'
    });
  } catch (error) {
    console.error('Server error during auth redirect:', error);
    return res.status(500).json({ 
      message: 'Server error during authentication redirect', 
      error: error.message
    });
  }
} 