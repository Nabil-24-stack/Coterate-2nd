// This is a placeholder API endpoint to prevent Vercel build errors
module.exports = (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'API is working properly',
    timestamp: new Date().toISOString()
  });
}; 