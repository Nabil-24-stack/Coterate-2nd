/**
 * GPT4VisionService.ts
 * Service for using GPT-4o Vision to analyze UI designs and generate improvement suggestions
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
 * Analyze UI components using GPT-4o and generate improvement suggestions
 * @param components - The UI components to analyze
 * @param imageData - The base64 image data
 * @returns Promise with the UI analysis including suggestions
 */
export const analyzeUIComponentsWithGPT4o = async (
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
    I'm analyzing a UI design extracted from Figma. Here are the identified components:
    
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
    
    Important: The suggestions should preserve the overall layout and structure of the design but enhance the visual aesthetics and usability of each component.
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
            content: 'You are an expert UI/UX designer specializing in modern web application design. Your task is to analyze UI components from a Figma design and provide specific, actionable improvement suggestions that follow modern design principles and best practices while preserving the original layout and structure.'
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
 * Analyze a Figma design image directly with GPT-4o to identify potential improvements
 * @param imageData - Base64 encoded image data
 * @param designDescription - Optional description of the design for context
 * @returns Promise with detailed improvement suggestions
 */
export const analyzeFigmaDesignImage = async (
  imageData: string,
  designDescription?: string
): Promise<string> => {
  try {
    const apiKey = getOpenAIApiKey();
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Format image data properly
    const formattedImageData = imageData.startsWith('data:') 
      ? imageData 
      : `data:image/png;base64,${imageData}`;

    // Create the prompt for design analysis
    const promptText = `
    Please analyze this UI design ${designDescription ? `for a ${designDescription}` : ''} and provide detailed feedback on:

    1. Component Analysis:
       - Identify the main UI components (buttons, text fields, icons, etc.)
       - Evaluate the visual hierarchy and layout

    2. Design Evaluation:
       - Assess color scheme, typography, and spacing
       - Identify strengths and weaknesses in the current design

    3. Specific Improvement Suggestions:
       - Provide actionable recommendations for enhancing the design
       - Suggest modern UI patterns or trends that could be applied
       - Recommend changes to improve accessibility and usability

    4. Implementation Guidance:
       - Include specific CSS properties or design values where helpful
       - Suggest alternative component designs where appropriate

    Important: Focus on preserving the original layout and structure while enhancing visual aesthetics and usability.
    `;

    // Call GPT-4o with vision capabilities
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert UI/UX designer specializing in modern web and mobile interfaces. Your task is to analyze UI designs and provide detailed, actionable improvement suggestions.'
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
      return response.data.choices[0].message.content;
    } else {
      throw new Error('Invalid response from OpenAI API');
    }
  } catch (error) {
    console.error('Error analyzing design image with GPT-4o:', error);
    throw error;
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