# Coterate UI Simplified

A UI design analysis and iteration tool that uses Figma API and GPT-4o to identify UI components and provide improvement suggestions.

## Features

- **Page Management**: Create, rename, and delete pages to organize your UI designs
- **Figma Design Import**: Paste a "Copy link to selection" URL from Figma to analyze UI designs
- **Authentication**: Login with Figma to access your designs directly
- **Canvas Manipulation**: Pan and zoom the canvas for better viewing and manipulation of designs
- **Component Identification**: Automatically identifies UI components like buttons, text fields, and more
- **Design Analysis**: Uses GPT-4o to analyze components and suggest improvements
- **Data Persistence**: Save your designs in Supabase database

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Supabase account
- Figma developer account
- OpenAI API key (for GPT-4o access)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/coterate-ui-simplified.git
   cd coterate-ui-simplified
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables:
   - Create a `.env` file based on `.env.example`
   - Add your Supabase URL and anon key
   - Add your Figma access token
   - Add OpenAI API key for GPT-4o

4. Start the development server:
   ```
   npm start
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Application Flow

1. **Input & Design Import**
   - User pastes a Figma URL or image into Coterate
   - Figma API fetches structured design data

2. **Preprocessing & Component Identification**
   - Process imported data to identify UI components
   - Map components to internal data model

3. **Generating Improvement Instructions with GPT-4o**
   - GPT-4o analyzes the design and suggests improvements
   - Generates a detailed "improvement blueprint"

## Usage

### Authentication

- Click "Sign In with Figma" in the sidebar to authenticate with Figma
- This enables direct access to your Figma designs via the API

### Adding Pages

Click the "+ New Page" button in the sidebar to create a new page.

### Renaming Pages

Click the "•••" menu on any page and select "Rename Page".

### Deleting Pages

Click the "•••" menu on any page and select "Delete Page".

### Importing Figma Designs

1. Copy a "Copy link to selection" URL from Figma
2. Click the "Analyze Design" button in Coterate
3. Paste the Figma URL and click "Import"
4. Wait for the design to be processed and analyzed

### Canvas Navigation

- **Pan**: Click and drag the canvas
- **Zoom**: Use the mouse wheel to zoom in and out
- **Reset View**: Click the "Reset View" button in the top-right corner

## Supabase Setup

1. Create a Supabase project
2. Set up Figma OAuth provider in Supabase Authentication settings
3. Use this callback URL: `https://tsqfwommnuhtbeupuwwm.supabase.co/auth/v1/callback`
4. Create a 'pages' table with the following schema:
   - id (uuid, primary key)
   - name (text)
   - user_id (uuid, foreign key to auth.users)
   - baseImage (text)
   - figmaUrl (text)
   - figmaFileId (text)
   - figmaNodeId (text)
   - uiComponents (jsonb)
   - uiAnalysis (jsonb)
   - created_at (timestamp)
   - updated_at (timestamp)

## Project Structure

- `src/components/`: UI components
- `src/contexts/`: React context providers
- `src/services/`: API services including Figma, Supabase and GPT-4o integrations
- `src/types/`: TypeScript type definitions

## Deployment with Vercel

This project is configured for easy deployment with Vercel:

1. Push your code to a GitHub repository
2. Import the project in Vercel
3. Set up the environment variables in the Vercel dashboard
4. Deploy!

## Environment Variables

The application supports both React-style and Next.js/Vercel-style environment variables:

### React-style (for local development)
```
# Supabase configuration
REACT_APP_SUPABASE_URL=your_supabase_url_here
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Figma API Key
REACT_APP_FIGMA_ACCESS_TOKEN=your_figma_access_token_here

# OpenAI API Key
REACT_APP_OPENAI_API_KEY=your_openai_api_key_here
```

### Next.js/Vercel-style
```
# Supabase configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Figma API Key
NEXT_PUBLIC_FIGMA_ACCESS_TOKEN=your_figma_access_token_here
FIGMA_ACCESS_TOKEN=your_figma_access_token_here

# OpenAI API Key
NEXT_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

If you're deploying to Vercel, Vercel automatically adds environment variables for Supabase integration when you connect your Supabase project.

## Next Steps for Implementation

1. **Add UI Iteration via AI-Powered Generation**
   - Implement image generation using stable diffusion models
   - Ensure generated UIs preserve original structure and components

2. **Implement Post-Processing & Quality Assurance**
   - Validate generated UIs against original component map
   - Add refinement loop for correcting issues

3. **Enhance UI Reassembly & Display**
   - Show both original and iterated UI side by side
   - Add interactive features for further iteration

## Built With

- [React](https://reactjs.org/) - UI framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Styled Components](https://styled-components.com/) - Styling
- [React Router](https://reactrouter.com/) - Routing
- [Supabase](https://supabase.io/) - Authentication and database
- [Figma API](https://www.figma.com/developers) - Design import
- [OpenAI GPT-4o](https://openai.com/) - AI analysis