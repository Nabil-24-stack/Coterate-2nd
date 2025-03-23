// Interface for Page
export interface Page {
  id: string;
  name: string;
  baseImage?: string;
  vectorizedSvg?: string;
  showOriginalWithAnalysis?: boolean;
  isAnalyzing?: boolean;
  uiComponents?: UIComponent[];
  uiAnalysis?: UIAnalysis;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  error?: string; // Error message if any operation fails
}

// Interface for Page Context
export interface PageContextType {
  pages: Page[];
  currentPage: Page | null;
  addPage: (name: string) => void;
  updatePage: (id: string, updates: Partial<Page>) => void;
  deletePage: (id: string) => void;
  setCurrentPage: (page: Page) => void;
  renamePage: (id: string, newName: string) => void;
  analyzeAndVectorizeImage?: () => Promise<void>;
  analyzeFigmaDesign?: (figmaUrl: string) => Promise<void>;
  toggleOriginalImage?: () => void;
  isLoggedIn: boolean;
  userProfile?: any;
}

// UI Component Analysis Types
export interface UIComponent {
  id: string;
  type: 'button' | 'text_field' | 'icon' | 'image' | 'text' | 'container' | 'unknown';
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
    zIndex?: number;
  };
  style: {
    colors: string[];
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string;
    borderRadius?: number;
    borderWidth?: number;
    borderColor?: string;
    shadow?: {
      offsetX: number;
      offsetY: number;
      blur: number;
      color: string;
    };
    opacity?: number;
  };
  content?: string;
  vectorizedSvg?: string;
  children?: string[];
  parent?: string;
}

export interface UIAnalysis {
  components: UIComponent[];
  hierarchy: {
    root: string[];
    relationships: Record<string, string[]>;
  };
  improvementSuggestions: {
    component: string;
    suggestions: string[];
  }[];
}