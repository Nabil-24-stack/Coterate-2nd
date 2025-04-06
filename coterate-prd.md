# Coterate Product Requirements Document (PRD)

## 1. Product Overview

### 1.1 Product Vision
**Coterate** is an AI-powered tool designed to help UX/UI and product designers iterate faster — with the power of user insights baked into the design workflow.

The app is split into two core tabs: **Iteration** and **Insights**.

#### Iteration Tab
This tab mirrors the familiar Figma layout — a central canvas with a sidebar to manage pages. Designers authenticate with Figma and paste selection links of their designs. Coterate then recreates the design on the canvas.

From there, users can click a **+ button** to generate an AI-powered iteration. The AI analyzes the design and offers an improved version — enhancing aspects like visual hierarchy, color contrast, text legibility, and component choices. Users can also guide the AI with custom prompts for more tailored changes.

#### Insights Tab
This is where user feedback lives. Designers can upload interview recordings, research notes, and documents — organized in folders and linked to specific pages in the Iteration tab.

#### Connected Workflow
The real magic happens when both tabs work together. Once insights are linked to a design page, any AI iteration of that page is informed not just by visual best practices, but by real user feedback. This means smarter design iterations grounded in actual user needs — closing the gap between research and execution.

Coterate isn't just another AI design tool. It's your co-designer — one that listens to your users before making a single change.

### 1.2 Target Users
- Product designers
- UX/UI designers
- User researchers
- Design agencies
- Product teams
- Freelance designers

### 1.3 Key Value Propositions
- **Faster Design Iterations**: Reduce the time needed for design iterations from hours/days to minutes
- **AI-Powered Design Analysis**: Get objective, AI-driven analysis of design strengths and weaknesses
- **User Insight Integration**: Incorporate real user feedback directly into design iterations
- **Design Improvements**: Generate improved versions with better visual hierarchy, contrast, and component selection
- **Research-Design Connection**: Close the gap between user research and design execution
- **Figma Compatibility**: Seamlessly work with designs from Figma

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

### 2.2 Application Structure

#### 2.2.1 Dual-Tab Interface
- Implement a clean two-tab structure: Iteration Tab and Insights Tab
- Allow for seamless navigation between the two tabs
- Provide visual indicators when insights are connected to a design page
- Maintain consistent navigation and user experience across both tabs

### 2.3 Iteration Tab

#### 2.3.1 Canvas Structure
- Implement a Figma-like canvas as the main workspace
- Canvas should support:
  - Zooming in/out (via keyboard shortcuts and UI controls)
  - Panning across the workspace
  - Grid display toggle
  - Multiple pages/artboards

#### 2.3.2 Page Management
- Allow users to create multiple pages
- Provide page renaming, reordering, and deletion capabilities
- Visualize pages in a sidebar similar to Figma
- Add indicators to pages that have linked user insights

#### 2.3.3 Native Figma Design Import
- Support pasting Figma selection links directly into the canvas
- Integrate with Figma API to fetch and recreate designs accurately
- Preserve Figma design fidelity including:
  - Component hierarchy
  - Visual properties (size, position, color)
  - Typography
  - Imagery
- Display recreated designs as high-quality viewable components
- Maintain reference to original Figma file data

#### 2.3.4 Figma Design Import Flow
1. User copies a selection link from Figma
2. User pastes (Ctrl+V/Cmd+V) directly onto the Coterate canvas
3. System detects Figma selection link and processes it
4. System displays a loading indicator during the recreation process
5. Canvas displays the recreated design with high fidelity
6. Maintain original Figma file and node references for future editing/updating

### 2.4 Design Iteration

#### 2.4.1 Iteration Trigger
- Implement a "+" button next to each imported design
- Button should be visually prominent but not intrusive
- Provide visual feedback on hover and click

#### 2.4.2 AI Analysis of Designs
- Upon clicking the "+" button, trigger an AI analysis of the selected design
- Use OpenAI's GPT-4o to analyze the design for improvements in:
  - Visual hierarchy
  - Color contrast and accessibility
  - Component selection and placement
  - Text legibility
  - Overall usability
  - Alignment with design best practices
- Integrate linked user insights from the Insights tab into the analysis
- Provide GPT-4o with context about UI/UX best practices to inform its analysis
- Store analysis results for reference

#### 2.4.3 Optional User Prompting
- Allow users to provide additional context or specific requirements for iteration
- Implement a prompt input field that appears when clicking the "+" button
- Support natural language inputs like "Improve the contrast" or "Make the call-to-action more prominent"
- Use the user's prompt to guide the AI's iteration process

#### 2.4.4 Design Generation
- Generate improved design version(s) based on:
  1. AI analysis of design elements
  2. User insights linked to the page
  3. Optional user prompts
- Apply suggestions to create a new version
- Render the iterated design next to the original for easy comparison
- Maintain component hierarchy and structure where appropriate
- Ensure the generated design addresses both visual improvements and user feedback
- Store both original and modified versions for each iteration

#### 2.4.5 Multiple Iterations
- Support multiple iterations from a single design
- Create a visual history/tree of iterations
- Allow users to branch iterations from any point in the history

### 2.5 Design Management

#### 2.5.1 Design Comparison
- Provide side-by-side comparison of original and iterated designs
- Highlight key differences between versions
- Implement a toggle to view before/after states
- Include references to user insights that influenced the changes

#### 2.5.2 Design Selection and Manipulation
- Allow users to select, move, and resize designs on the canvas
- Support basic manipulation operations (copy, paste, delete)
- Implement undo/redo functionality

#### 2.5.3 Feedback Capture
- Add functionality for users to provide feedback on iterations
- Implement commenting or annotation features
- Use feedback to improve future iterations

#### 2.5.4 Round-Trip Figma Editing
- Provide an "Edit in Figma" button for each imported design
- Button opens the original Figma file at the specific node location
- Implement a "Refresh from Figma" button to update the design after edits
- Maintain design iteration history and relationships after updates

### 2.6 Insights Tab

#### 2.6.1 User Insights Management
- Create a dedicated interface for managing user insights and feedback
- Support uploading and organizing multiple types of user research:
  - User interview recordings
  - Documents (PDFs, text files, etc.)
  - Notes and observations
  - Survey results
  - User testing videos

#### 2.6.2 Insights Organization
- Implement a folder structure for organizing insights
- Allow tagging and categorization of insights
- Support searching and filtering insights
- Enable linking insights folders to specific pages in the Iteration tab

#### 2.6.3 Insights Processing
- Process uploaded insights using AI to extract key information
- Transcribe audio/video recordings automatically
- Generate summaries of long-form content
- Identify recurring themes and pain points across multiple insights

#### 2.6.4 Insights Connection
- Allow users to link insights folders to specific design pages
- Provide visual indicators of linked insights on the iteration tab
- Implement a bidirectional navigation between linked insights and designs

### 2.7 Figma Export

#### 2.7.1 Export to Figma
- Enable users to export Coterate-generated designs back to Figma
- Preserve all design elements, styles, and improvements made in Coterate
- Maintain component hierarchy and structure in the exported design
- Support seamless copy-paste workflow from Coterate back to Figma files

#### 2.7.2 Export Flow
- Provide an "Export to Figma" button for each design or iteration
- When clicked, prepare the design for Figma compatibility
- Generate a special clipboard format compatible with Figma
- Allow user to paste directly into their Figma file

#### 2.7.3 Export Options
- Allow exporting the entire design or selected components
- Support various export resolutions and quality settings
- Provide option to include design metadata (analysis insights, iteration history)
- Enable export with or without component flattening based on user preference

### 2.8 Collaboration Features

#### 2.8.1 Sharing
- Generate shareable links for designs and iterations
- Control access permissions (view-only, edit)
- Support easy sharing via email or copy-to-clipboard

#### 2.8.2 Team Workspace
- Create team workspaces for collaborative design
- Manage team members and permissions
- Support simultaneous viewing (real-time updates)

## 3. Technical Architecture

### 3.1 Frontend

#### 3.1.1 Technology Stack
- **Framework**: Next.js with React 18+
- **Styling**: Styled Components
- **State Management**: React Context API for global state

#### 3.1.2 Core Components
- **Canvas**: Main workspace component with zooming/panning capabilities
- **Sidebar**: Navigation and page management
- **Toolbar**: Top navigation and actions
- **FigmaDesignRenderer**: Component for rendering native Figma designs on the canvas
- **DesignItem**: Component for containing and managing individual rendered designs
- **IterationPanel**: Interface for triggering and managing iterations
- **CodePreview**: Component for viewing and editing generated code

### 3.2 Backend

#### 3.2.1 API Layer
- **Framework**: Next.js API routes (deployed on Vercel)
- **Authentication**: Supabase Auth with JWT
- **Serverless Functions**: Vercel serverless functions for API endpoints
- **Endpoints**:
  - User management (leveraging Supabase Auth)
  - Design storage and retrieval
  - AI analysis and iteration requests
  - Figma API proxying
  - Code export

#### 3.2.2 Database
- **Database System**: Supabase (PostgreSQL-based)
- **Authentication**: Supabase Auth for user management
- **Storage**: Supabase Storage for design assets
- **Real-time**: Leverage Supabase's real-time capabilities for collaboration features
- **Data Models**:
  - Users (integrated with Supabase Auth)
  - Projects
  - Pages
  - Designs (storing FigmaDesign metadata and references)
  - Iterations (storing multiple versions of the same design)
  - DesignMetadata (information about design components, structure, etc.)
  - Comments/Feedback

### 3.3 AI Integration

#### 3.3.1 OpenAI Integration
- Implement secure API communication with OpenAI
- Create structured prompts for design analysis and user insight processing
- Process and structure AI responses for use in generation

#### 3.3.2 User Insights Processing Pipeline
1. **Ingest**: Process uploaded user research materials (documents, videos, audio)
2. **Transcribe**: Convert audio/video content to text when necessary
3. **Extract**: Identify key insights, pain points, and user needs
4. **Organize**: Categorize insights by theme, priority, and relevance
5. **Connect**: Link processed insights to relevant design pages

#### 3.3.3 Design Analysis and Generation Pipeline
1. **Retrieval**: Fetch the Figma design data via API
2. **Insights Integration**: Compile relevant user insights from linked folders
3. **Combined Analysis**: Send design and insights to GPT-4o for holistic evaluation
4. **Suggestions**: Generate actionable design modifications informed by both design principles and user feedback
5. **Generation**: Create new design version that addresses both visual improvement needs and user pain points
6. **Rendering**: Render the modified design on the canvas
7. **Documentation**: Provide clear explanation of changes made and how they relate to user insights

#### 3.3.4 Figma API Integration
- Implement secure Figma API access using user OAuth tokens
- Fetch design data including nodes, components, and images
- Render Figma designs with high fidelity on the canvas
- Store references to original Figma file data

## 4. Implementation Plan

### 4.1 Core Functionality
The core functionality is already partially implemented with the following features:
- Basic canvas with zoom/pan capabilities
- Sidebar for page management
- Design placement on canvas
- Image pasting support

### 4.2 Application Structure Implementation

#### 4.2.1 Dual-Tab Interface
1. Design and implement the top-level navigation between Iteration and Insights tabs
2. Create container components for each tab
3. Implement state management for tab switching
4. Develop visual indicators for active tab and linked insights

### 4.3 Figma Authentication Integration
1. Complete Figma OAuth implementation
2. Set up secure token storage in Supabase
3. Implement profile management and session handling
4. Add login/logout functionality

### 4.4 Iteration Tab Implementation

#### 4.4.1 Figma Design Import
1. Implement the selection link parser to extract Figma file and node IDs
2. Create proxy endpoints for Figma API access
3. Develop the design recreation pipeline
4. Build design rendering components

#### 4.4.2 Design Iteration Features
1. Create the "+" button UI and interaction
2. Implement AI analysis with OpenAI integration
3. Build the iteration generation workflow
4. Develop side-by-side comparison views
5. Implement prompt input for user-guided iterations

### 4.5 Insights Tab Implementation

#### 4.5.1 User Research Upload
1. Build file upload interface for documents, recordings, and notes
2. Implement media processing pipelines for different content types
3. Develop automatic transcription for audio/video
4. Create summary generation for long-form content

#### 4.5.2 Insights Organization
1. Implement folder structure and management
2. Build tagging and categorization system
3. Create search and filter functionality
4. Develop insights linking mechanism to connect with design pages

### 4.6 Integration Between Tabs

#### 4.6.1 Linking System
1. Develop database schema for insights-to-design page connections
2. Create UI for establishing links between insights folders and design pages
3. Implement visual indicators for linked content
4. Build navigation components between related content

#### 4.6.2 AI-Powered Design Iteration with Insights
1. Enhance the OpenAI prompts to incorporate user research
2. Develop insight extraction and formatting pipeline
3. Create combined analysis system that evaluates both design and user feedback
4. Implement iteration algorithm that addresses both visual improvements and user needs

### 4.7 Figma Export Feature
1. Build the export-to-Figma functionality
2. Implement design preparation for Figma compatibility
3. Create clipboard integration for seamless export
4. Develop export options UI

### 4.8 Collaboration Features
1. Create sharing mechanism using Supabase row-level security (RLS) policies
2. Implement real-time updates using Supabase's real-time subscriptions
3. Develop team workspace functionality with shared access controls
4. Integrate with Vercel's preview deployments for sharing designs and insights

## 5. User Experience

### 5.1 User Flows

#### 5.1.1 Iteration Flow
1. **Authentication**: User logs in via Figma
2. **Tab Navigation**: User selects the Iteration tab
3. **Canvas Setup**: User creates a new page or opens an existing project
4. **Design Import**: User copies a selection link from Figma and pastes it into Coterate
5. **Linking Insights**: User optionally links relevant user research from the Insights tab
6. **Iteration**: User clicks the "+" button, optionally adds a prompt
7. **AI Analysis**: GPT-4o analyzes the design along with any linked user insights
8. **Review**: User reviews the suggested iteration alongside the original
9. **Refinement**: User provides feedback or triggers additional iterations
10. **Export**: User exports the final design back to Figma

#### 5.1.2 Insights Flow
1. **Authentication**: User logs in via Figma
2. **Tab Navigation**: User selects the Insights tab
3. **Folder Management**: User creates and organizes folders for user research
4. **Content Upload**: User uploads various research materials (recordings, documents, notes)
5. **Processing**: System automatically processes uploads (transcription, summarization)
6. **Organization**: User categorizes and tags insights for easy retrieval
7. **Linking**: User connects insights folders to relevant design pages
8. **Reference**: User can view processed insights and their connections to designs

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

## 7. Metrics and Success Criteria

### 7.1 Key Performance Indicators
- Number of active users
- Designs imported per user
- Iterations generated per design
- Time saved (estimated) compared to manual iteration
- Code export utilization

### 7.2 Success Criteria
- Users can successfully import designs from Figma
- AI iterations produce meaningful improvements to designs
- Generated code accurately represents the design
- User satisfaction with iteration quality > 8/10

## 8. Future Enhancements

### 8.1 Potential Future Features
- Figma plugin for seamless round-trip editing
- Custom design component library integration
- Design system analysis and recommendations
- Animation and interaction design support
- User testing integration and feedback collection
- Advanced collaboration features (commenting, approval workflows)
- Mobile app for viewing designs on the go

### 8.2 Scalability Considerations
- Implement edge caching with Vercel for faster design loading
- Leverage Vercel's serverless functions for AI processing
- Design the Supabase schema to support large design libraries
- Use Supabase Row Level Security for fine-grained access control
- Implement connection pooling for database performance
- Consider Supabase enterprise features for larger teams
- Use Vercel's edge functions for global performance optimization

## 9. Appendix

### 9.1 Glossary
- **Design Iteration**: The process of refining a design based on feedback or analysis
- **Canvas**: The main workspace where designs are displayed and manipulated
- **Design Component**: Individual UI elements that make up a complete design
- **Visual Hierarchy**: The arrangement of elements to show their order of importance
- **Figma Native**: A design imported directly from Figma maintaining its original structure and metadata
- **Round-Trip Editing**: The ability to edit a design in Figma and update it in Coterate

### 9.2 References
- Figma API Documentation: https://www.figma.com/developers/api
- OpenAI API Documentation: https://platform.openai.com/docs/
- Vercel Documentation: https://vercel.com/docs
- Supabase Documentation: https://supabase.com/docs
- Next.js Documentation: https://nextjs.org/docs
