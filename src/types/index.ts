// Interface for Page
export interface Page {
  id: string;
  name: string;
  baseImage?: string;
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
} 