// Interface for Page
export interface Page {
  id: string;
  name: string;
  baseImage?: string;
  vectorizedSvg?: string;
  showOriginalWithAnalysis?: boolean;
  uiComponents?: UIComponent[];
  uiAnalysis?: UIAnalysis;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
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
  vectorizeCurrentPage?: () => Promise<void>;
  analyzeCurrentPage?: () => Promise<void>;
  toggleOriginalImage?: () => void;
}

// UI Component Analysis Types (importing from UIAnalysisService)
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
  children?: string[]; // IDs of child components
  parent?: string;     // ID of parent component
}

export interface UIAnalysis {
  components: UIComponent[];
  hierarchy: {
    root: string[];    // Root component IDs
    relationships: Record<string, string[]>; // Parent ID -> Child IDs
  };
  improvementSuggestions: {
    component: string; // Component ID
    suggestions: string[];
  }[];
} 