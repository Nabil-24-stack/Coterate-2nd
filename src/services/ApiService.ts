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
    // In production, this would go to your Vercel API route
    const response = await fetch('/api/auth/figma/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to exchange auth code');
    }

    return await response.json();
  } catch (error) {
    console.error('Error exchanging Figma auth code:', error);
    throw error;
  }
};

export default {
  exchangeFigmaAuthCode,
}; 