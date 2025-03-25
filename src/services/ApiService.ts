/**
 * This file contains functions to communicate with our backend APIs
 */

// Types
import { FigmaUser } from './FigmaService';

interface FigmaAuthResponse {
  access_token: string;
  refresh_token: string;
  user: FigmaUser;
}

/**
 * Exchange Figma auth code for access token
 * This function calls our backend API, which securely stores the client secret
 */
export const exchangeFigmaAuthCode = async (code: string): Promise<FigmaAuthResponse> => {
  try {
    console.log('Exchanging auth code with backend API');
    
    // For Vercel deployment, this will call our API route
    const response = await fetch('/api/auth/figma/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });

    const responseText = await response.text();
    console.log('Received response from API:', { 
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get('content-type')
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch (e) {
        errorData = { raw: responseText };
      }
      
      console.error('API error response:', errorData);
      throw new Error(errorData.message || 'Failed to exchange auth code');
    }

    // Parse JSON response
    let jsonData;
    try {
      jsonData = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse JSON response:', responseText);
      throw new Error('Invalid response format from API');
    }

    return jsonData;
  } catch (error) {
    console.error('Error exchanging Figma auth code:', error);
    throw error;
  }
};

// Create a named export object
const apiService = {
  exchangeFigmaAuthCode,
};

export default apiService; 