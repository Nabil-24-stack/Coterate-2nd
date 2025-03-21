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

// OpenAI API configuration
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o';

// Get the OpenAI API key from environment variables
const getOpenAIApiKey = () => {
  return process.env.REACT_APP_OPENAI_API_KEY || '';
};

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
 * Calls GPT-4o API to generate UI improvement suggestions
 * @param prompt - The prompt for GPT-4o
 * @returns Promise with the GPT-4o response
 */
const callGPT4o = async (prompt: string): Promise<string> => {
  try {
    const apiKey = getOpenAIApiKey();
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert UI/UX designer and front-end developer specializing in modern web application design. Your task is to analyze UI components and provide specific, actionable improvement suggestions that follow modern design principles and best practices.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    if (response.data && response.data.choices && response.data.choices.length > 0) {
      return response.data.choices[0].message.content.trim();
    } else {
      throw new Error('Invalid response from OpenAI API');
    }
  } catch (error) {
    console.error('Error calling GPT-4o:', error);
    throw error;
  }
};

/**
 * Processes AI response to extract individual suggestions
 * @param aiResponse - The raw response from GPT-4o
 * @returns Array of individual suggestion strings
 */
const processSuggestions = (aiResponse: string): string[] => {
  // Split response by newlines and filter out empty lines
  const lines = aiResponse.split('\n').filter(line => line.trim().length > 0);
  
  // Handle list format (numbers, bullets, etc.)
  const suggestions: string[] = [];
  let currentSuggestion = '';
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Check if this is a new suggestion (starts with number or bullet)
    if (/^(\d+[\.\)]\s|\-\s|\*\s)/.test(trimmedLine)) {
      // If we already have a suggestion in progress, add it to results
      if (currentSuggestion) {
        suggestions.push(currentSuggestion.trim());
      }
      // Start a new suggestion (remove the bullet/number prefix)
      currentSuggestion = trimmedLine.replace(/^(\d+[\.\)]\s|\-\s|\*\s)/, '');
    } else {
      // This is a continuation of the current suggestion
      currentSuggestion += ' ' + trimmedLine;
    }
  }
  
  // Add the last suggestion if there is one
  if (currentSuggestion) {
    suggestions.push(currentSuggestion.trim());
  }
  
  // If no suggestions were found (no list format), just return each line as a suggestion
  if (suggestions.length === 0) {
    return lines;
  }
  
  return suggestions;
};

/**
 * Generates improvement suggestions for UI components using GPT-4o
 * @param components - The identified UI components
 * @returns Promise with improvement suggestions
 */
export const generateImprovementSuggestions = async (
  components: UIComponent[]
): Promise<UIAnalysis> => {
  try {
    // Check if OpenAI API key is configured
    const apiKey = getOpenAIApiKey();
    if (!apiKey) {
      console.warn('OpenAI API key not configured. Using fallback suggestions.');
      return generateFallbackSuggestions(components);
    }

    // Build basic hierarchy based on position overlaps
    const hierarchy = buildComponentHierarchy(components);
    
    // Generate individual component prompts
    const improvementSuggestions: UIAnalysis['improvementSuggestions'] = [];
    
    // Process components in batches to reduce API calls
    const componentsByType: Record<UIComponent['type'], UIComponent[]> = {
      button: [],
      text_field: [],
      icon: [],
      image: [],
      text: [],
      container: [],
      unknown: []
    };
    
    // Group components by type
    components.forEach(component => {
      componentsByType[component.type].push(component);
    });
    
    // Process each type of component
    for (const [type, typeComponents] of Object.entries(componentsByType)) {
      if (typeComponents.length === 0) continue;
      
      // Create a detailed prompt about these components
      const componentDetails = typeComponents.map(component => {
        let details = `Component ID: ${component.id}\n`;
        details += `Type: ${component.type}\n`;
        details += `Position: x=${component.position.x}, y=${component.position.y}, width=${component.position.width}, height=${component.position.height}\n`;
        details += `Style: colors=[${component.style.colors.join(', ')}]`;
        
        if (component.style.borderRadius) {
          details += `, borderRadius=${component.style.borderRadius}px`;
        }
        
        if (component.style.fontFamily) {
          details += `, fontFamily=${component.style.fontFamily}`;
        }
        
        if (component.style.fontSize) {
          details += `, fontSize=${component.style.fontSize}px`;
        }
        
        if (component.content) {
          details += `\nContent: "${component.content}"`;
        }
        
        return details;
      }).join('\n\n');
      
      const prompt = `I have identified ${typeComponents.length} ${type} components in a UI design. 
      
Here are the details:

${componentDetails}

Please provide specific improvement suggestions for these ${type} components following modern UI/UX design principles and best practices. 
Focus on visual appearance, usability, and accessibility.
For each component, provide numbered suggestions that are specific and actionable.
Format your suggestions as a numbered list for each component ID.

Example format:
1. [Specific suggestion about colors]
2. [Specific suggestion about size/shape]
3. [Specific suggestion about usability/accessibility]`;

      try {
        // Call GPT-4o with the prompt
        const aiResponse = await callGPT4o(prompt);
        
        // Process and parse the response to extract suggestions for each component
        const responseLines = aiResponse.split('\n');
        let currentComponentId = '';
        let currentSuggestions: string[] = [];
        
        for (const line of responseLines) {
          // Check if this line is a component ID header
          const componentIdMatch = line.match(/component id:?\s*([a-z\-0-9]+)/i);
          if (componentIdMatch) {
            // If we were processing a previous component, add it to results
            if (currentComponentId && currentSuggestions.length > 0) {
              improvementSuggestions.push({
                component: currentComponentId,
                suggestions: currentSuggestions
              });
            }
            
            // Start processing new component
            currentComponentId = componentIdMatch[1];
            currentSuggestions = [];
            continue;
          }
          
          // Check if this line is a suggestion (starts with number)
          const suggestionMatch = line.match(/^\s*(\d+\.|\*|\-)\s+(.+)$/);
          if (suggestionMatch && currentComponentId) {
            currentSuggestions.push(suggestionMatch[2].trim());
          }
        }
        
        // Add the last component if there is one
        if (currentComponentId && currentSuggestions.length > 0) {
          improvementSuggestions.push({
            component: currentComponentId,
            suggestions: currentSuggestions
          });
        }
        
        // If we couldn't parse component-specific suggestions, assign general suggestions to all components
        if (improvementSuggestions.length === 0 && typeComponents.length > 0) {
          const generalSuggestions = processSuggestions(aiResponse);
          
          typeComponents.forEach(component => {
            improvementSuggestions.push({
              component: component.id,
              suggestions: generalSuggestions
            });
          });
        }
      } catch (error) {
        console.error(`Error generating suggestions for ${type} components:`, error);
        // Use fallback suggestions for this type
        typeComponents.forEach(component => {
          improvementSuggestions.push({
            component: component.id,
            suggestions: getFallbackSuggestionsForType(component.type)
          });
        });
      }
    }
    
    // If we couldn't get AI suggestions for some components, provide fallback suggestions
    components.forEach(component => {
      const hasSuggestions = improvementSuggestions.some(suggestion => suggestion.component === component.id);
      if (!hasSuggestions) {
        improvementSuggestions.push({
          component: component.id,
          suggestions: getFallbackSuggestionsForType(component.type)
        });
      }
    });
    
    return {
      components,
      hierarchy,
      improvementSuggestions
    };
  } catch (error) {
    console.error('Error generating improvement suggestions:', error);
    // Fallback to simpler suggestions
    return generateFallbackSuggestions(components);
  }
};

/**
 * Generates fallback improvement suggestions if GPT-4o is unavailable
 * @param components - The identified UI components
 * @returns UIAnalysis with basic suggestions
 */
const generateFallbackSuggestions = (components: UIComponent[]): UIAnalysis => {
  // Build basic hierarchy based on position overlaps
  const hierarchy = buildComponentHierarchy(components);
  
  // Generate sample improvement suggestions
  const improvementSuggestions = components.map(component => {
    return {
      component: component.id,
      suggestions: getFallbackSuggestionsForType(component.type)
    };
  });
  
  return {
    components,
    hierarchy,
    improvementSuggestions
  };
};

/**
 * Returns fallback suggestions for a specific component type
 * @param type - The component type
 * @returns Array of suggestion strings
 */
const getFallbackSuggestionsForType = (type: UIComponent['type']): string[] => {
  switch (type) {
    case 'button':
      return [
        'Consider using a more vibrant color for better visibility',
        'Add hover states to improve interactivity',
        'Ensure adequate padding around text for better readability',
        'Maintain consistent border radius with other buttons'
      ];
    case 'text_field':
      return [
        'Add a clear placeholder text for better user guidance',
        'Consider adding validation indicators',
        'Ensure proper contrast between text and background',
        'Add appropriate labels for accessibility'
      ];
    case 'text':
      return [
        'Ensure text has sufficient contrast with its background',
        'Check line height for optimal readability',
        'Use consistent font styles throughout the interface',
        'Consider hierarchical sizing for different text roles'
      ];
    case 'icon':
      return [
        'Make sure icon has enough padding around it',
        'Consider using a consistent icon style throughout the UI',
        'Ensure icon is recognizable at smaller sizes',
        'Add tooltips for clarity if needed'
      ];
    case 'container':
      return [
        'Consider adding subtle borders or shadows for visual hierarchy',
        'Maintain consistent spacing between contained elements',
        'Ensure adequate padding within the container',
        'Verify alignment with other containers on the page'
      ];
    case 'image':
      return [
        'Ensure image has appropriate alt text for accessibility',
        'Optimize image for faster loading',
        'Consider using aspect ratio constraints',
        'Add subtle border or shadow for better visual separation'
      ];
    default:
      return [
        'Review spacing and alignment with other elements',
        'Check for consistency with overall design language',
        'Ensure appropriate contrast for visibility',
        'Verify accessibility requirements are met'
      ];
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