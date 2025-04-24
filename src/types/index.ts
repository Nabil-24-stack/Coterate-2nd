// Interface for Design
export interface Design {
  id: string;
  imageUrl: string;
  position: { x: number; y: number };
  dimensions?: { width: number; height: number };
  iterations?: DesignIteration[];
  htmlContent?: string;
  cssContent?: string;
  
  // Figma-specific properties for native design import
  figmaFileKey?: string;   // The Figma file key 
  figmaNodeId?: string;    // The Figma node ID
  figmaSelectionLink?: string; // The original Figma selection link
  isFromFigma?: boolean;   // Whether this design was imported from Figma
  needsFigmaAuth?: boolean; // Whether Figma authentication is needed to import this design
}

// Interface for Design Iteration
export interface DesignIteration {
  id: string;
  parentId: string;
  htmlContent: string;
  cssContent: string;
  position: { x: number; y: number };
  dimensions?: { width: number; height: number };
  analysis?: DesignAnalysis;
  created_at?: string;
}

// Interface for Design Analysis
export interface DesignAnalysis {
  strengths: string[];
  weaknesses: string[];
  improvementAreas: string[];
  specificChanges?: string[];
  visualHierarchy?: {
    issues: string[];
    improvements: string[];
  };
  colorContrast?: {
    issues: string[];
    improvements: string[];
  };
  componentSelection?: {
    issues: string[];
    improvements: string[];
  };
  textLegibility?: {
    issues: string[];
    improvements: string[];
  };
  usability?: {
    issues: string[];
    improvements: string[];
  };
  accessibility?: {
    issues: string[];
    improvements: string[];
  };
  metadata?: {
    colors?: {
      primary?: string[];
      secondary?: string[];
      background?: string[];
      text?: string[];
    };
    fonts?: string[];
    components?: string[];
  };
  rawResponse?: string; // Store the full raw GPT-4.1 response
  userPrompt?: string; // Store the user's prompt input
}

// Interface for Page
export interface Page {
  id: string;
  name: string;
  baseImage?: string;
  designs?: Design[];
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

// Interface for Page Context
export interface PageContextType {
  pages: Page[];
  currentPage: Page | null;
  addPage: (name: string, baseImage?: string) => void;
  updatePage: (id: string, updates: Partial<Page>) => void;
  deletePage: (id: string) => void;
  setCurrentPage: (page: Page) => void;
  renamePage: (id: string, newName: string) => void;
  loading: boolean;
} 