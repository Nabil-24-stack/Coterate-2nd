// This file contains mock API implementations for situations where a real backend would be required
// In a production environment, these functions should be implemented on a secure server

/**
 * Mock implementation of Figma OAuth token exchange
 * In a real-world application, this should be implemented server-side to protect your client secret
 */
export const exchangeFigmaAuthCode = async (code: string): Promise<{
  access_token: string;
  refresh_token: string;
  user: { id: string; email: string; handle: string; img_url: string; };
}> => {
  // This is a mock implementation - in a real application, you would send this to your backend
  console.log('Mock API: Exchanging auth code for token', code);
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Mock successful response
  // In a real app, your server would exchange the code for a token using Figma's API
  return {
    access_token: 'mock_figma_access_token_' + Math.random().toString(36).substring(2, 15),
    refresh_token: 'mock_figma_refresh_token_' + Math.random().toString(36).substring(2, 15),
    user: {
      id: 'user_' + Math.random().toString(36).substring(2, 10),
      email: 'user@example.com',
      handle: 'figma_user',
      img_url: 'https://via.placeholder.com/150'
    }
  };
};

// Export other mock API functions as needed
export default {
  exchangeFigmaAuthCode
}; 