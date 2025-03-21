/**
 * RecraftService.ts
 * Service for interacting with the Recraft API to vectorize images
 */

import axios from 'axios';

// API constants
// According to Recraft docs, the correct vectorize endpoint is:
const RECRAFT_API_URL = 'https://external.api.recraft.ai/v1/images/vectorize';

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
    const apiKey = getApiKey();
    console.log('API Key exists:', !!apiKey); // Log if key exists, not the actual key

    // Extract the base64 part if it's a data URL
    let base64Data = imageData;
    if (imageData.startsWith('data:')) {
      base64Data = imageData.split(',')[1];
    }

    // Create a proper FormData object for file upload
    const formData = new FormData();
    
    // Convert base64 to Blob
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/png' });
    
    // Append the blob as a file
    formData.append('file', blob, 'image.png');
    formData.append('response_format', 'b64_json');

    // Following Recraft's documentation - they use Bearer token authentication
    const response = await axios.post(
      RECRAFT_API_URL,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          // Content-Type is automatically set when using FormData
        }
      }
    );

    // According to Recraft docs, the response contains the SVG
    if (response.data && response.data.image && response.data.image.b64_json) {
      // Convert the base64 back to SVG string
      return atob(response.data.image.b64_json);
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