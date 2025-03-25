# Deploying to Vercel with Figma Authentication

This document provides instructions for deploying the application to Vercel with proper Figma authentication.

## Prerequisites

1. A Figma account with API access
2. A Vercel account
3. Git repository with the code

## Setting Up Figma API Access

1. Go to [Figma's Developer Console](https://www.figma.com/developers/apps)
2. Click "Create a new app"
3. Fill in the app details:
   - Name: Coterate UI
   - Description: Your description
   - Website URL: Your Vercel deployment URL (e.g., https://your-app.vercel.app)
   - Redirect URLs: Add your callback URL (e.g., https://your-app.vercel.app/auth/figma/callback)
4. After creating the app, note down the Client ID and Client Secret

## Setting Up Vercel Environment Variables

1. Create a new project in Vercel and link it to your repository
2. In the project settings, go to the "Environment Variables" section
3. Add the following environment variables:
   - `REACT_APP_FIGMA_CLIENT_ID`: Your Figma Client ID
   - `REACT_APP_FIGMA_CLIENT_SECRET`: Your Figma Client Secret
   - `REACT_APP_FIGMA_REDIRECT_URI`: The full URL of your callback endpoint (e.g., https://your-app.vercel.app/auth/figma/callback)

Alternatively, you can use Vercel's CLI to add environment variables:

```bash
vercel secrets add figma_client_id "your-client-id"
vercel secrets add figma_client_secret "your-client-secret"
vercel secrets add figma_redirect_uri "https://your-app.vercel.app/auth/figma/callback"
```

## Deploying

1. Push your code to your Git repository
2. Connect your repository to Vercel
3. Vercel will automatically detect the configuration from vercel.json
4. During the build process, it will use your environment variables for the Figma authentication

## Testing the Deployment

1. Visit your deployed application
2. Click on "Import with Figma" in the sidebar
3. You should be redirected to Figma's authorization page
4. After authorizing, you'll be redirected back to your application
5. If everything is set up correctly, you should see your Figma files and be able to import them

## Troubleshooting

If you encounter any issues with the Figma authentication:

1. Check your browser console for any error messages
2. Verify that the environment variables are correctly set in Vercel
3. Make sure the redirect URI exactly matches what you've configured in your Figma app
4. Check Vercel's function logs for any server-side errors

## Local Development

For local development, create a `.env.local` file with the following variables:

```
REACT_APP_FIGMA_CLIENT_ID=your_figma_client_id
REACT_APP_FIGMA_CLIENT_SECRET=your_figma_client_secret
REACT_APP_FIGMA_REDIRECT_URI=http://localhost:3000/auth/figma/callback
```

This will allow you to test the Figma authentication locally before deploying. 