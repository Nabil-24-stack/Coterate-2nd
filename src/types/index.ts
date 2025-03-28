// Interface for Design
export interface Design {
  id: string;
  imageUrl: string;
  position: { x: number; y: number };
  iterations?: DesignIteration[];
  htmlContent?: string;
  cssContent?: string;
}

// Interface for Design Iteration
export interface DesignIteration {
  id: string;
  parentId: string;
  htmlContent: string;
  cssContent: string;
  position: { x: number; y: number };
  analysis?: DesignAnalysis;
  created_at?: string;
}

// Interface for Design Analysis
export interface DesignAnalysis {
  strengths: string[];
  weaknesses: string[];
  improvementAreas: string[];
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