// API endpoint to help debug Vercel deployment
module.exports = (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Return diagnostics information
  res.status(200).json({
    status: 'ok',
    message: 'API is working properly',
    timestamp: new Date().toISOString(),
    requestMethod: req.method,
    requestUrl: req.url,
    requestHeaders: req.headers,
    nodeVersion: process.version,
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      hasReactAppKey: !!process.env.REACT_APP_ANTHROPIC_API_KEY,
      hasRegularKey: !!process.env.ANTHROPIC_API_KEY,
      hasVercelKey: !!process.env.VERCEL_ANTHROPIC_API_KEY,
    }
  });
}; 