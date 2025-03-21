/**
 * UIAnalysisService.ts
 * Service for analyzing vectorized SVGs and identifying UI components
 */

import axios from 'axios';

// Types for UI component analysis
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

/**
 * Analyzes an SVG to identify UI components
 * @param svgData - The SVG data as a string
 * @returns Promise with the UI analysis
 */
export const analyzeUIComponents = async (svgData: string): Promise<UIComponent[]> => {
  try {
    // Parse the SVG to identify UI components
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgData, 'image/svg+xml');
    
    const components: UIComponent[] = [];
    
    // Extract UI components from the SVG
    // This is a basic implementation that can be enhanced with more sophisticated algorithms
    
    // Find potential buttons (rectangles with text)
    const rects = svgDoc.querySelectorAll('rect');
    rects.forEach((rect, index) => {
      const x = parseFloat(rect.getAttribute('x') || '0');
      const y = parseFloat(rect.getAttribute('y') || '0');
      const width = parseFloat(rect.getAttribute('width') || '0');
      const height = parseFloat(rect.getAttribute('height') || '0');
      const fill = rect.getAttribute('fill') || '#ffffff';
      const stroke = rect.getAttribute('stroke') || 'none';
      const rx = parseFloat(rect.getAttribute('rx') || '0');
      
      // Check if this might be a button or text field based on shape and style
      const isRounded = rx > 0;
      const hasBorder = stroke !== 'none';
      
      // Determine component type based on properties
      let type: UIComponent['type'] = 'unknown';
      if (isRounded && width < 300 && height < 100) {
        type = 'button';
      } else if (hasBorder && height < 50) {
        type = 'text_field';
      } else {
        type = 'container';
      }
      
      components.push({
        id: `component-${index}`,
        type,
        position: {
          x,
          y,
          width,
          height,
          zIndex: index
        },
        style: {
          colors: [fill, stroke],
          borderRadius: rx,
          borderWidth: stroke !== 'none' ? 1 : 0,
          borderColor: stroke !== 'none' ? stroke : undefined
        }
      });
    });
    
    // Find text elements
    const texts = svgDoc.querySelectorAll('text');
    texts.forEach((text, index) => {
      const x = parseFloat(text.getAttribute('x') || '0');
      const y = parseFloat(text.getAttribute('y') || '0');
      const content = text.textContent || '';
      const fontFamily = text.getAttribute('font-family') || undefined;
      const fontSize = parseFloat(text.getAttribute('font-size') || '0');
      const fill = text.getAttribute('fill') || '#000000';
      
      components.push({
        id: `text-${index}`,
        type: 'text',
        position: {
          x,
          y,
          width: content.length * (fontSize / 2), // Approximate width based on content length
          height: fontSize * 1.2, // Approximate height based on font size
          zIndex: components.length + index
        },
        style: {
          colors: [fill],
          fontFamily,
          fontSize,
          fontWeight: text.getAttribute('font-weight') || undefined
        },
        content
      });
    });
    
    // Find paths that might be icons
    const paths = svgDoc.querySelectorAll('path');
    paths.forEach((path, index) => {
      const d = path.getAttribute('d') || '';
      const fill = path.getAttribute('fill') || 'none';
      const stroke = path.getAttribute('stroke') || 'none';
      
      // Try to determine bounding box from the path data
      // This is a simplification, as calculating the exact bounding box for a path is complex
      const coordinates = d.split(/[A-Za-z]/).filter(Boolean).join(' ').split(/\s+/).filter(Boolean).map(parseFloat);
      const xValues = coordinates.filter((_, i) => i % 2 === 0);
      const yValues = coordinates.filter((_, i) => i % 2 === 1);
      
      const minX = Math.min(...xValues);
      const maxX = Math.max(...xValues);
      const minY = Math.min(...yValues);
      const maxY = Math.max(...yValues);
      
      const width = maxX - minX;
      const height = maxY - minY;
      
      // Small paths with no text are likely icons
      if (width < 50 && height < 50 && fill !== 'none') {
        components.push({
          id: `icon-${index}`,
          type: 'icon',
          position: {
            x: minX,
            y: minY,
            width,
            height,
            zIndex: components.length + texts.length + index
          },
          style: {
            colors: [fill, stroke]
          }
        });
      }
    });
    
    return components;
  } catch (error) {
    console.error('Error analyzing UI components:', error);
    throw error;
  }
};

/**
 * Generates improvement suggestions for UI components using GPT-4o or similar AI
 * @param components - The identified UI components
 * @returns Promise with improvement suggestions
 */
export const generateImprovementSuggestions = async (
  components: UIComponent[]
): Promise<UIAnalysis> => {
  try {
    // For MVP, we'll implement a simplified version without actual GPT-4o integration
    // In a real implementation, you would make an API call to OpenAI's API
    
    // Build basic hierarchy based on position overlaps
    const hierarchy = buildComponentHierarchy(components);
    
    // Generate sample improvement suggestions
    const improvementSuggestions = components.map(component => {
      const suggestions: string[] = [];
      
      switch (component.type) {
        case 'button':
          suggestions.push('Consider using a more vibrant color for better visibility');
          suggestions.push('Add hover states to improve interactivity');
          break;
        case 'text_field':
          suggestions.push('Add a clear placeholder text for better user guidance');
          suggestions.push('Consider adding validation indicators');
          break;
        case 'text':
          if (component.style.fontSize && component.style.fontSize < 12) {
            suggestions.push('Text size may be too small for readability, consider increasing to at least 14px');
          }
          suggestions.push('Ensure text has sufficient contrast with its background');
          break;
        case 'icon':
          suggestions.push('Make sure icon has enough padding around it');
          suggestions.push('Consider using a consistent icon style throughout the UI');
          break;
        default:
          suggestions.push('Review spacing and alignment with other elements');
      }
      
      return {
        component: component.id,
        suggestions
      };
    });
    
    return {
      components,
      hierarchy,
      improvementSuggestions
    };
  } catch (error) {
    console.error('Error generating improvement suggestions:', error);
    throw error;
  }
};

/**
 * Builds a component hierarchy based on position overlaps
 * @param components - The UI components
 * @returns Component hierarchy
 */
const buildComponentHierarchy = (components: UIComponent[]) => {
  const relationships: Record<string, string[]> = {};
  const allChildIds = new Set<string>();
  
  // Sort components by z-index (if available) or area (larger components first)
  const sortedComponents = [...components].sort((a, b) => {
    const aZ = a.position.zIndex || 0;
    const bZ = b.position.zIndex || 0;
    
    if (aZ !== bZ) return aZ - bZ;
    
    const aArea = a.position.width * a.position.height;
    const bArea = b.position.width * b.position.height;
    return bArea - aArea; // Larger area first
  });
  
  // Build parent-child relationships
  for (let i = 0; i < sortedComponents.length; i++) {
    const potentialParent = sortedComponents[i];
    
    for (let j = i + 1; j < sortedComponents.length; j++) {
      const potentialChild = sortedComponents[j];
      
      // Check if child is contained within parent
      if (
        potentialChild.position.x >= potentialParent.position.x &&
        potentialChild.position.y >= potentialParent.position.y &&
        potentialChild.position.x + potentialChild.position.width <= potentialParent.position.x + potentialParent.position.width &&
        potentialChild.position.y + potentialChild.position.height <= potentialParent.position.y + potentialParent.position.height
      ) {
        // Add to parent's children
        if (!relationships[potentialParent.id]) {
          relationships[potentialParent.id] = [];
        }
        relationships[potentialParent.id].push(potentialChild.id);
        allChildIds.add(potentialChild.id);
      }
    }
  }
  
  // Find root components (not children of any other component)
  const rootIds = components
    .map(c => c.id)
    .filter(id => !allChildIds.has(id));
  
  return {
    root: rootIds,
    relationships
  };
}; 