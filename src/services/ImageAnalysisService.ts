/**
 * ImageAnalysisService.ts
 * Service for analyzing UI images directly using GPT-4o Vision
 */

import axios from 'axios';
import { UIComponent, UIAnalysis } from '../types';

// OpenAI API configuration
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o';

// Get the OpenAI API key from environment variables
const getOpenAIApiKey = () => {
  return process.env.REACT_APP_OPENAI_API_KEY || '';
};

/**
 * Analyzes an image to identify UI components directly using GPT-4o Vision
 * @param imageData - Base64 encoded image data
 * @returns Promise with the UI components
 */
export const analyzeImageWithGPT4Vision = async (imageData: string): Promise<UIComponent[]> => {
  try {
    const apiKey = getOpenAIApiKey();
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Ensure the image data is properly formatted
    const formattedImageData = imageData.startsWith('data:') 
      ? imageData 
      : `data:image/png;base64,${imageData}`;

    // Create the prompt for GPT-4o Vision
    const prompt = `
    Please analyze this UI design image and identify all the UI components present. 
    For each component, provide:
    1. Type (button, text_field, icon, image, text, container)
    2. Position (approximate x, y coordinates and width, height in pixels)
    3. Style details (colors, font, borders, etc.)
    4. Any text content visible
    
    Format your response as JSON following this structure:
    [
      {
        "id": "unique-id",
        "type": "button|text_field|icon|image|text|container|unknown",
        "position": {
          "x": 100,
          "y": 200,
          "width": 150,
          "height": 40,
          "zIndex": 1
        },
        "style": {
          "colors": ["#ffffff", "#000000"],
          "fontFamily": "Arial",
          "fontSize": 16,
          "fontWeight": "bold",
          "borderRadius": 8,
          "borderWidth": 1,
          "borderColor": "#cccccc"
        },
        "content": "Any text content"
      }
    ]
    
    Be precise and thorough, focusing on every visible UI element. Don't simplify or omit components.
    `;

    // Call GPT-4o with vision capabilities
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert UI/UX designer and developer specializing in analyzing UI designs and identifying all components accurately with precise details.'
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: formattedImageData,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 4096,
        temperature: 0.2 // Lower temperature for more deterministic output
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    if (response.data && response.data.choices && response.data.choices.length > 0) {
      const content = response.data.choices[0].message.content;
      
      // Extract the JSON from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const components = JSON.parse(jsonMatch[0]);
          return components;
        } catch (error) {
          console.error('Error parsing JSON from GPT-4o response:', error);
          throw new Error('Failed to parse component data from GPT-4o response');
        }
      } else {
        throw new Error('No valid JSON found in GPT-4o response');
      }
    } else {
      throw new Error('Invalid response from OpenAI API');
    }
  } catch (error) {
    console.error('Error analyzing image with GPT-4o:', error);
    throw error;
  }
};

/**
 * Generates UI improvement suggestions for components identified by GPT-4o
 * @param components - The identified UI components
 * @param imageData - The original image for context
 * @returns Promise with the UI analysis including suggestions
 */
export const generateImprovementSuggestions = async (
  components: UIComponent[],
  imageData: string
): Promise<UIAnalysis> => {
  try {
    const apiKey = getOpenAIApiKey();
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Build component details for the prompt
    const componentDetails = components.map(component => {
      return `Component ID: ${component.id}
Type: ${component.type}
Position: x=${component.position.x}, y=${component.position.y}, width=${component.position.width}, height=${component.position.height}
Style: ${JSON.stringify(component.style)}
Content: ${component.content || 'N/A'}
      `;
    }).join('\n\n');

    // Format image data properly
    const formattedImageData = imageData.startsWith('data:') 
      ? imageData 
      : `data:image/png;base64,${imageData}`;

    // Create the prompt for improvement suggestions
    const promptText = `
    Here's a detailed analysis of UI components I've identified in this design:
    
    ${componentDetails}
    
    For each component, please provide specific improvement suggestions following modern UI/UX best practices.
    Focus on:
    - Visual appearance improvements
    - Usability enhancements
    - Accessibility considerations
    - Modern design trends
    
    Format your response as JSON following this structure:
    {
      "improvementSuggestions": [
        {
          "component": "component-id",
          "suggestions": [
            "Specific suggestion 1",
            "Specific suggestion 2",
            "Specific suggestion 3"
          ]
        }
      ]
    }
    
    Include 3-5 specific, actionable suggestions for each component.
    `;

    // Call GPT-4o with vision capabilities for better context
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert UI/UX designer specializing in modern web application design. Your task is to analyze UI components and provide specific, actionable improvement suggestions that follow modern design principles and best practices.'
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: promptText },
              {
                type: 'image_url',
                image_url: {
                  url: formattedImageData,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 4096,
        temperature: 0.3
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    if (response.data && response.data.choices && response.data.choices.length > 0) {
      const content = response.data.choices[0].message.content;
      
      // Extract the JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[0]);
          
          // Build relationship hierarchy based on component positions
          const hierarchy = buildComponentHierarchy(components);
          
          return {
            components,
            hierarchy,
            improvementSuggestions: data.improvementSuggestions || []
          };
        } catch (error) {
          console.error('Error parsing JSON from GPT-4o response:', error);
          // Fallback to a simple analysis with empty suggestions
          return createFallbackAnalysis(components);
        }
      } else {
        return createFallbackAnalysis(components);
      }
    } else {
      throw new Error('Invalid response from OpenAI API');
    }
  } catch (error) {
    console.error('Error generating improvement suggestions:', error);
    return createFallbackAnalysis(components);
  }
};

/**
 * Creates a fallback analysis when GPT-4o fails
 * @param components - The UI components
 * @returns A basic UI analysis
 */
const createFallbackAnalysis = (components: UIComponent[]): UIAnalysis => {
  const hierarchy = buildComponentHierarchy(components);
  
  const improvementSuggestions = components.map(component => {
    const suggestions = getFallbackSuggestionsForType(component.type);
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