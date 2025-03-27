# Coterate Product Requirements Document (PRD)

## 1. Product Overview

### 1.1 Product Vision
Coterate is a design iteration platform that helps product designers and UX/UI designers rapidly iterate and improve their designs using AI. By combining a Figma-like canvas with AI-powered design analysis and iteration capabilities, Coterate enables designers to get instant feedback and alternative design versions, accelerating the design process and improving the quality of the final product.

### 1.2 Target Users
- Product designers
- UX/UI designers
- Design agencies
- Product teams
- Freelance designers

### 1.3 Key Value Propositions
- **Speed Up Design Iterations**: Reduce the time needed for design iterations from hours/days to minutes
- **AI-Powered Design Analysis**: Get objective, AI-driven analysis of design strengths and weaknesses
- **Automatic Design Improvements**: Generate improved versions with better visual hierarchy, contrast, and component selection
- **Easy Collaboration**: Share iterations and feedback in a streamlined workflow
- **Code Export**: Convert finalized designs into production-ready code across multiple frameworks

## 2. Product Features and Requirements

### 2.1 User Authentication

#### 2.1.1 Figma Authentication
- Users will authenticate via Figma OAuth
- The application must securely store Figma access tokens
- Implement token refresh mechanism to maintain persistent access

#### 2.1.2 User Profiles
- Store basic user information (name, email, profile picture) from Figma
- Create a user account in the Coterate database upon first login
- Support user account management (update profile, change settings)

### 2.2 Canvas Interface

#### 2.2.1 Canvas Structure
- Implement a Figma-like canvas as the main workspace
- Canvas should support:
  - Zooming in/out (via keyboard shortcuts and UI controls)
  - Panning across the workspace
  - Grid display toggle
  - Multiple pages/artboards

#### 2.2.2 Page Management
- Allow users to create multiple pages
- Provide page renaming, reordering, and deletion capabilities
- Visualize pages in a sidebar similar to Figma

#### 2.2.3 Design Import via Anima
- Support pasting Figma design links to import designs
- Utilize Anima API to convert Figma designs directly to code (React components)
- Render the code-based design accurately on the Coterate canvas
- Maintain design fidelity through Anima's conversion including:
  - Component hierarchy
  - Visual properties (size, position, color)
  - Typography
  - Imagery
- Store designs as code rather than visual objects for consistency throughout the workflow

### 2.3 Design Iteration

#### 2.3.1 Iteration Trigger
- Implement a "+" button next to each imported design
- Button should be visually prominent but not intrusive
- Provide visual feedback on hover and click

#### 2.3.2 AI Analysis of Code-Based Designs
- Upon clicking the "+" button, trigger an AI analysis of the selected design's code representation
- Use OpenAI's GPT-4o to analyze the React/HTML code for improvements in:
  - Visual hierarchy
  - Color contrast and accessibility
  - Component selection and placement
  - Text legibility
  - Overall usability
  - Alignment with design best practices
- Provide GPT-4o with context about UI/UX best practices to inform its analysis
- Store analysis results for reference

#### 2.3.3 Optional User Prompting
- Allow users to provide additional context or specific requirements for iteration
- Implement a prompt input field that appears when clicking the "+" button
- Support natural language inputs like "Improve the contrast" or "Make the call-to-action more prominent"
- Use the user's prompt to guide the AI's iteration process

#### 2.3.4 Code-Based Design Generation
- Generate improved code version(s) based on the AI analysis and optional user prompts
- GPT-4o suggests code modifications to improve the design based on its analysis
- Apply these code modifications to create a new React component version
- Render the iterated design next to the original for easy comparison
- Maintain component hierarchy and structure where appropriate
- Ensure the generated code creates a design that adheres to best practices
- Store both original and modified code for each iteration

#### 2.3.5 Multiple Iterations
- Support multiple iterations from a single design
- Create a visual history/tree of iterations
- Allow users to branch iterations from any point in the history

### 2.4 Design Management

#### 2.4.1 Design Comparison
- Provide side-by-side comparison of original and iterated designs
- Highlight key differences between versions
- Implement a toggle to view before/after states

#### 2.4.2 Design Selection and Manipulation
- Allow users to select, move, and resize designs on the canvas
- Support basic manipulation operations (copy, paste, delete)
- Implement undo/redo functionality

#### 2.4.3 Feedback Capture
- Add functionality for users to provide feedback on iterations
- Implement commenting or annotation features
- Use feedback to improve future iterations

### 2.5 Code Export

#### 2.5.1 Integration with Anima
- Leverage the existing Anima integration used for design import
- Since designs are already stored as code, focus on framework conversion
- Support conversion to multiple frameworks/languages:
  - React (already available from import)
  - HTML/CSS
  - Vue
  - Other frameworks supported by Anima

#### 2.5.2 Code Preview
- Provide a code preview within the application
- Support syntax highlighting
- Implement code copying functionality

#### 2.5.3 Export Options
- Allow users to export the entire design or selected components
- Provide configuration options for export (framework, styling approach, etc.)
- Support downloading code as files or project archives

### 2.6 Collaboration Features

#### 2.6.1 Sharing
- Generate shareable links for designs and iterations
- Control access permissions (view-only, edit)
- Support easy sharing via email or copy-to-clipboard

#### 2.6.2 Team Workspace
- Create team workspaces for collaborative design
- Manage team members and permissions
- Support simultaneous viewing (real-time updates)

## 3. Technical Architecture

### 3.1 Frontend

#### 3.1.1 Technology Stack
- **Framework**: Next.js with React 18+
- **Styling**: Styled Components (currently in use based on package.json)
- **State Management**: React Context API (already implemented for Page and Design contexts)

#### 3.1.2 Core Components
- **Canvas**: Main workspace component with zooming/panning capabilities
- **Sidebar**: Navigation and page management
- **Toolbar**: Top navigation and actions
- **DesignRenderer**: Component for rendering code-based designs on the canvas
- **DesignItem**: Component for containing and managing individual rendered designs
- **IterationPanel**: Interface for triggering and managing iterations
- **CodePreview**: Component for viewing and editing the underlying code of designs

### 3.2 Backend

#### 3.2.1 API Layer
- **Framework**: Next.js API routes (deployed on Vercel)
- **Authentication**: Supabase Auth with JWT
- **Serverless Functions**: Vercel serverless functions for API endpoints
- **Endpoints**:
  - User management (leveraging Supabase Auth)
  - Design storage and retrieval
  - AI analysis and iteration requests
  - Code export

#### 3.2.2 Database
- **Database System**: Supabase (PostgreSQL-based)
- **Authentication**: Supabase Auth for user management
- **Storage**: Supabase Storage for design assets and larger code files
- **Real-time**: Leverage Supabase's real-time capabilities for collaboration features
- **Data Models**:
  - Users (integrated with Supabase Auth)
  - Projects
  - Pages
  - Designs (storing code representations rather than visual objects)
  - Iterations (storing multiple code versions of the same design)
  - DesignMetadata (information about design components, structure, etc.)
  - Comments/Feedback

### 3.3 AI Integration

#### 3.3.1 OpenAI Integration
- Implement secure API communication with OpenAI
- Create structured prompts for design analysis
- Process and structure AI responses for use in generation

#### 3.3.2 Code-Based Design Generation Pipeline
1. **Analysis**: Send design's code representation to GPT-4o for evaluation
2. **Interpretation**: Parse AI suggestions into specific code modifications
3. **Code Modification**: Apply changes to create new code version
4. **Rendering**: Render the modified code on the canvas
5. **Validation**: Ensure generated design meets requirements

#### 3.3.3 Anima Integration
- Implement Anima API for both design import and code export
- Use Anima to convert Figma links directly to React components
- Render these components on the canvas
- Support conversion to multiple framework outputs for export

## 4. Implementation Plan

### 4.1 Core Canvas Functionality
The canvas functionality is already partially implemented with the following features:
- Basic canvas with zoom/pan capabilities
- Sidebar for page management
- Design placement on canvas
- Image pasting support

### 4.2 Figma and Anima Integration
1. Implement Figma OAuth authentication
2. Set up Anima API integration for design import
3. Develop the workflow to convert Figma links to React components via Anima
4. Create component renderer to display code-based designs on canvas

### 4.3 AI Iteration Feature
1. Develop OpenAI integration for code-based design analysis
2. Create structured prompt templates for GPT-4o to analyze and improve React components
3. Implement code modification pipeline based on GPT-4o suggestions
4. Build UI for displaying rendered iterations and capturing feedback

### 4.4 Code Export
1. Extend the existing Anima integration to support framework conversion
2. Develop UI for selecting export options (framework, styling approach)
3. Implement code preview and export functionality

### 4.5 Collaboration Features
1. Create sharing mechanism using Supabase row-level security (RLS) policies
2. Implement real-time updates using Supabase's real-time subscriptions
3. Develop team workspace functionality with shared access controls
4. Integrate with Vercel's preview deployments for sharing design iterations

## 5. User Experience

### 5.1 User Flow
1. **Authentication**: User logs in via Figma
2. **Canvas Setup**: User creates a new page or opens an existing project
3. **Design Import**: User pastes a Figma design link which is converted to code via Anima API
4. **Design Rendering**: The code-based design is rendered on the canvas
5. **Iteration**: User clicks the "+" button, optionally adds a prompt
6. **Code Analysis**: GPT-4o analyzes the code and suggests improvements
7. **Code Modification**: System applies the suggested modifications to create a new version
8. **Review**: User reviews the rendered iteration alongside the original
9. **Refinement**: User provides feedback or triggers additional iterations
10. **Export**: User exports the final code to their preferred framework

### 5.2 UI Design Guidelines
- **Visual Style**: Clean, minimalist interface similar to Figma
- **Color Palette**: Neutral background with accent colors for actions
- **Typography**: Sans-serif fonts for readability (currently using Plus Jakarta Sans)
- **Spacing**: Consistent padding and margins throughout the interface
- **Interactions**: Smooth transitions and feedback for user actions

## 6. Performance and Technical Requirements

### 6.1 Performance Metrics
- Page load time < 2 seconds
- Design import time < 5 seconds
- AI iteration response time < 30 seconds
- Smooth canvas operation at 60fps

### 6.2 Browser Compatibility
- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)

### 6.3 Responsive Design
- Support desktop resolutions from 1280x720 and above
- Optional: Tablet support for viewing designs

### 6.4 Security Requirements
- Secure authentication using OAuth standards and Supabase Auth
- HTTPS for all communication (provided by Vercel)
- Data encryption for sensitive information
- Supabase Row Level Security (RLS) policies for access control
- Vercel environment variables for API keys and secrets
- Regular security audits

## 7. Implementation Notes for Cursor AI

When implementing Coterate with Cursor AI on Vercel with Supabase, follow these guidelines to ensure efficient development:

### 7.1 Setup Instructions
1. The project is already initialized with Next.js and has basic components implemented
2. Use the existing file structure and component patterns
3. Build upon the existing contexts (PageContext and DesignContext)
4. Implement new features incrementally, testing each component

### 7.2 API Integration Approach
1. For OpenAI integration:
   - Create a structured prompt template that includes the design's code
   - Provide context about UI/UX best practices for GPT-4o to reference
   - Ask GPT-4o to suggest specific code modifications to improve the design
   - Parse the response to extract actionable code changes

2. For Figma integration:
   - Implement Figma OAuth for authentication
   - Set up API endpoints to receive Figma selection links

3. For Anima integration:
   - Use Anima API to convert Figma links directly to React components
   - Render these components on the canvas
   - For export, use Anima to convert the React code to other frameworks
   - Handle responses to display or download generated code

### 7.3 Component Development
1. Create a DesignRenderer component that can render React code on the canvas
2. Enhance the existing Canvas component to support code-based designs and iterations
3. Create a new IterationControls component for the "+" button and related UI
4. Develop a CodePreview component for viewing and editing the underlying code
5. Build a DiffViewer component to highlight changes between iterations
6. Add code export UI components with framework selection options
7. Implement Supabase client hooks for data fetching and real-time updates
8. Optimize component rendering for Vercel Edge Network deployment

### 7.4 Context and Database Integration
1. Modify the DesignContext to store code representations instead of visual objects
2. Integrate Supabase client for data persistence and retrieval
3. Extend the DesignContext to include iteration tracking and code version history
4. Create a new context for managing AI operations and Anima API interactions
5. Implement proper state management for code-based design history using a combination of local state and Supabase
6. Add functionality to track relationships between original designs and iterations
7. Set up Supabase real-time subscriptions for collaborative editing
8. Implement optimistic UI updates with eventual consistency through Supabase

### 7.5 Testing and Deployment Approach
1. Implement unit tests for individual components
2. Create integration tests for the AI workflow
3. Test the complete iteration process with sample designs
4. Set up Vercel preview environments for testing pull requests
5. Use Supabase local development environment for database testing
6. Implement Vercel deployment pipeline with environment-specific configurations
7. Set up monitoring and logging for production deployments

## 8. Metrics and Success Criteria

### 8.1 Key Performance Indicators
- Number of active users
- Designs imported per user
- Iterations generated per design
- Time saved (estimated) compared to manual iteration
- Code export utilization

### 8.2 Success Criteria
- Users can successfully import designs from Figma
- AI iterations produce meaningful improvements to designs
- Generated code accurately represents the design
- User satisfaction with iteration quality > 8/10

## 9. Future Enhancements

### 9.1 Potential Future Features
- Custom design component library integration
- Design system analysis and recommendations
- Animation and interaction design support
- User testing integration and feedback collection
- Advanced collaboration features (commenting, approval workflows)
- Mobile app for viewing designs on the go

### 9.2 Scalability Considerations
- Implement edge caching with Vercel for faster design loading
- Leverage Vercel's serverless functions for AI processing
- Design the Supabase schema to support large design libraries
- Use Supabase Row Level Security for fine-grained access control
- Implement connection pooling for database performance
- Consider Supabase enterprise features for larger teams
- Use Vercel's edge functions for global performance optimization

## 10. Appendix

### 10.1 Glossary
- **Design Iteration**: The process of refining a design based on feedback or analysis
- **Canvas**: The main workspace where designs are displayed and manipulated
- **Design Component**: Individual UI elements that make up a complete design
- **Visual Hierarchy**: The arrangement of elements to show their order of importance
- **Code-Based Design**: A design represented as React/HTML code rather than as a visual object
- **Design Renderer**: A component that renders code-based designs on the canvas

### 10.2 References
- Figma API Documentation: https://www.figma.com/developers/api
- OpenAI API Documentation: https://platform.openai.com/docs/
- Anima API Documentation: https://docs.animaapp.com/
- Vercel Documentation: https://vercel.com/docs
- Supabase Documentation: https://supabase.com/docs
- Next.js Documentation: https://nextjs.org/docs