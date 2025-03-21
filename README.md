# Coterate 2nd

A simplified version of the Coterate UI design tool that focuses only on the UI and page management functionality without any AI integrations.

## Features

- **Page Management**: Create, rename, and delete pages to organize your UI designs
- **UI Pasting**: Paste UI mockups from your clipboard directly into the canvas
- **Canvas Manipulation**: Pan and zoom the canvas for better viewing and manipulation of designs

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

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

3. Start the development server:
   ```
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Adding Pages

Click the "+ New Page" button in the sidebar to create a new page.

### Renaming Pages

Click the "•••" menu on any page and select "Rename Page".

### Deleting Pages

Click the "•••" menu on any page and select "Delete Page".

### Pasting UI Designs

1. Copy a UI design to your clipboard (from Figma, Sketch, or any other design tool)
2. Click on the current page in the app
3. Paste (Ctrl+V or Cmd+V) the design into the app

### Canvas Navigation

- **Pan**: Click and drag the canvas
- **Zoom**: Use the mouse wheel to zoom in and out
- **Reset View**: Click the "Reset View" button in the top-right corner

## Project Structure

- `src/components/`: UI components
- `src/contexts/`: React context providers
- `src/types/`: TypeScript type definitions

## Built With

- [React](https://reactjs.org/) - UI framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Styled Components](https://styled-components.com/) - Styling
- [React Router](https://reactrouter.com/) - Routing