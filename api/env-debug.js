// Debug endpoint to check if environment variables are properly set
// Only use this temporarily and remove it after debugging!
export default function handler(req, res) {
  // Return a sanitized view of the environment variables (do not include actual secrets)
  const envCheck = {
    figmaClientIdExists: !!(process.env.FIGMA_CLIENT_ID || process.env.REACT_APP_FIGMA_CLIENT_ID),
    figmaClientSecretExists: !!(process.env.FIGMA_CLIENT_SECRET || process.env.REACT_APP_FIGMA_CLIENT_SECRET),
    reactAppPrefix: {
      clientIdExists: !!process.env.REACT_APP_FIGMA_CLIENT_ID,
      clientSecretExists: !!process.env.REACT_APP_FIGMA_CLIENT_SECRET,
      redirectUri: process.env.REACT_APP_FIGMA_REDIRECT_URI || "not set"
    },
    directFormat: {
      clientIdExists: !!process.env.FIGMA_CLIENT_ID,
      clientSecretExists: !!process.env.FIGMA_CLIENT_SECRET,
      redirectUri: process.env.FIGMA_REDIRECT_URI || "not set"
    },
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    serverTimestamp: new Date().toISOString()
  };
  
  res.status(200).json(envCheck);
}
