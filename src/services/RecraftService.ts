/**
 * RecraftService.ts
 * Service for interacting with the Recraft API to vectorize images
 */

import axios from 'axios';

// API constants
const RECRAFT_API_URL = 'https://api.recraft.ai/vectorize-image';

// This should be stored in environment variables for security
// For development, you can use process.env.REACT_APP_RECRAFT_API_KEY
// In production with Vercel, set this in the Vercel environment variables
const getApiKey = () => {
  return process.env.REACT_APP_RECRAFT_API_KEY || '';
};

/**
 * Vectorizes an image using the Recraft API
 * @param imageData - Base64 encoded image data
 * @returns Promise with the vectorized SVG data
 */
export const vectorizeImage = async (imageData: string): Promise<string> => {
  try {
    // Make sure image data is in the correct format
    // If it's already a data URL, use it as is
    // Otherwise, ensure it's properly formatted
    const formattedImageData = imageData.startsWith('data:') 
      ? imageData 
      : `data:image/png;base64,${imageData}`;

    const apiKey = getApiKey();
    console.log('API Key exists:', !!apiKey); // Log if key exists, not the actual key

    const response = await axios.post(
      RECRAFT_API_URL,
      { image: formattedImageData },
      {
        headers: {
          'x-api-key': apiKey, // Try using x-api-key header instead of Authorization
          'Content-Type': 'application/json'
        }
      }
    );

    // Check if the response contains the vectorized SVG
    if (response.data && response.data.svg) {
      return response.data.svg;
    } else {
      throw new Error('Invalid response format from Recraft API');
    }
  } catch (error) {
    console.error('Error vectorizing image:', error);
    throw error;
  }
};

/**
 * Check if the Recraft API key is configured
 * @returns boolean indicating if the API key is available
 */
export const isRecraftConfigured = (): boolean => {
  return !!getApiKey();
}; 