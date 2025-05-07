import supabaseService from './SupabaseService';

interface DesignAnalysisResponse {
  analysis: {
    strengths: string[];
    weaknesses: string[];
    improvementAreas: string[];
    specificChanges?: string[];
    visualHierarchy: {
      issues: string[];
      improvements: string[];
    };
    colorContrast: {
      issues: string[];
      improvements: string[];
    };
    componentSelection: {
      issues: string[];
      improvements: string[];
    };
    textLegibility: {
      issues: string[];
      improvements: string[];
    };
    usability: {
      issues: string[];
      improvements: string[];
    };
    accessibility: {
      issues: string[];
      improvements: string[];
    };
    designSystem: {
      colorPalette: string[];
      typography: string[];
      components: string[];
    };
    rawResponse?: string;
    userPrompt?: string;
  };
  sceneDescription: string;
  htmlCode: string;
  cssCode: string;
  metadata: {
    colors: {
      primary: string[];
      secondary: string[];
      background: string[];
      text: string[];
    };
    fonts: string[];
    components: string[];
  };
  userInsightsApplied?: string[];
}

class OpenAIService {
  private apiKey: string | null = null;

  constructor() {
    // Try to get API key from environment
    this.apiKey = process.env.REACT_APP_OPENAI_API_KEY || null;
    
    // If no key in env, check localStorage as fallback
    if (!this.apiKey) {
      this.apiKey = localStorage.getItem('openai_api_key');
    }
  }
  
  // Set API key manually (useful for development)
  setApiKey(key: string): void {
    this.apiKey = key;
    localStorage.setItem('openai_api_key', key);
  }
  
  // Check if API key is available
  hasApiKey(): boolean {
    return !!this.apiKey;
  }
  
  // Helper to check if we're in a development environment
  private isDevEnvironment(): boolean {
    // Check if NODE_ENV is explicitly set to 'development'
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    
    // Fallback: check hostname for common development patterns
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      return hostname === 'localhost' || 
             hostname === '127.0.0.1' ||
             hostname.includes('.local');
    }
    
    return false;
  }

  // Helper to check if we're in a production environment where we should NEVER use fallbacks
  private isProductionEnvironment(): boolean {
    // Check if explicitly set to production
    if (process.env.NODE_ENV === 'production') {
      return true;
    }
    
    // Check hostname for production patterns
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      return hostname.includes('.com') || 
             hostname.includes('.org') || 
             hostname.includes('.io') ||
             hostname.includes('.app') ||
             hostname.includes('.vercel.app') ||
             hostname.includes('.netlify.app');
    }
    
    return false;
  }
  
  // Main method to analyze design image and generate improved version
  async analyzeDesignAndGenerateHTML(imageUrl: string, userPrompt: string = '', linkedInsights: any[] = []): Promise<DesignAnalysisResponse> {
    if (!this.apiKey) {
      console.error('OpenAI API key not configured, cannot generate design iteration');
      
      // In production, never use fallback for missing API key
      if (this.isProductionEnvironment()) {
        throw new Error('OpenAI API key not configured. Please set it in your environment variables.');
      }
      
      // Only in development, use fallback if API key is missing
      console.log('Development environment detected, using fallback response for missing API key');
      const dimensions = await this.getImageDimensions(imageUrl);
      return this.getFallbackAnalysisResponse(dimensions);
    }

    try {
      // Convert the image URL to base64
      const base64Image = await this.imageUrlToBase64(imageUrl);
      
      // Get image dimensions
      const dimensions = await this.getImageDimensions(imageUrl);
      
      // Start analysis with linked insights if provided
      return await this.continueWithAnalysis(
        base64Image,
        dimensions,
        linkedInsights,
        userPrompt
      );
    } catch (error: any) {
      console.error('Error analyzing design:', error);
      
      // In production, never use fallback
      if (this.isProductionEnvironment()) {
        throw new Error(`Failed to generate design iteration: ${error.message}`);
      }
      
      // Only use fallback in development
      if (this.isDevEnvironment()) {
        console.log('Development environment detected, using fallback response');
        return this.getFallbackAnalysisResponse(await this.getImageDimensions(imageUrl));
      }
      
      // Default behavior
      throw new Error(`Failed to generate design iteration: ${error.message}`);
    }
  }
  
  // Helper method to convert Blob to base64
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Remove the data URL prefix if present
        const base64 = base64String.includes(',') 
          ? base64String.split(',')[1] 
          : base64String;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  
  // Helper function to get image dimensions
  private async getImageDimensions(src: string): Promise<{width: number, height: number}> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight
        });
      };
      img.onerror = () => {
        // Default dimensions if we can't get the actual ones
        resolve({
          width: 800,
          height: 600
        });
      };
      img.src = src;
    });
  }
  
  // Parse the OpenAI WebGL scene response
  private parseWebGLResponse(response: string, hasUserInsights: boolean = false, userPrompt: string = ''): DesignAnalysisResponse {
    console.log('Parsing OpenAI WebGL response...');
    
    try {
      // Log the first 200 characters of the response to help with debugging
      console.log('OpenAI response preview:', response.substring(0, 200) + '...');
      
      // Initialize result structure
      const result: DesignAnalysisResponse = {
        analysis: {
          strengths: [],
          weaknesses: [],
          improvementAreas: [],
          specificChanges: [],
          visualHierarchy: {
            issues: [],
            improvements: []
          },
          colorContrast: {
            issues: [],
            improvements: []
          },
          componentSelection: {
            issues: [],
            improvements: []
          },
          textLegibility: {
            issues: [],
            improvements: []
          },
          usability: {
            issues: [],
            improvements: []
          },
          accessibility: {
            issues: [],
            improvements: []
          },
          designSystem: {
            colorPalette: [],
            typography: [],
            components: []
          },
          rawResponse: response,
          userPrompt: userPrompt
        },
        sceneDescription: '',
        htmlCode: '', // Keep for backward compatibility
        cssCode: '', // Keep for backward compatibility
        metadata: {
          colors: {
            primary: [],
            secondary: [],
            background: [],
            text: []
          },
          fonts: [],
          components: []
        }
      };
      
      // Extract JSON content from the response
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      
      if (!jsonMatch) {
        console.error('Failed to extract JSON from OpenAI response');
        throw new Error('Invalid response format: Could not find JSON block');
      }
      
      const jsonContent = jsonMatch[1];
      
      try {
        const parsedContent = JSON.parse(jsonContent);
        
        // Extract analysis
        if (parsedContent.analysis) {
          // Map analysis fields
          if (parsedContent.analysis.strengths) {
            result.analysis.strengths = parsedContent.analysis.strengths;
          }
          
          if (parsedContent.analysis.weaknesses) {
            result.analysis.weaknesses = parsedContent.analysis.weaknesses;
          }
          
          if (parsedContent.analysis.improvementAreas) {
            result.analysis.improvementAreas = parsedContent.analysis.improvementAreas;
          }
          
          if (parsedContent.analysis.specificChanges) {
            result.analysis.specificChanges = parsedContent.analysis.specificChanges;
          }
          
          // Map detailed analysis categories
          const categories = [
            'visualHierarchy', 'colorContrast', 'componentSelection',
            'textLegibility', 'usability', 'accessibility'
          ];
          
          categories.forEach(category => {
            if (parsedContent.analysis[category]) {
              const analysisCategory = category as keyof typeof result.analysis;
              const categoryData = parsedContent.analysis[category];
              
              if (categoryData.issues && typeof result.analysis[analysisCategory] === 'object') {
                (result.analysis[analysisCategory] as any).issues = categoryData.issues;
              }
              
              if (categoryData.improvements && typeof result.analysis[analysisCategory] === 'object') {
                (result.analysis[analysisCategory] as any).improvements = categoryData.improvements;
              }
            }
          });
          
          // Map design system
          if (parsedContent.analysis.designSystem) {
            if (parsedContent.analysis.designSystem.colorPalette) {
              result.analysis.designSystem.colorPalette = 
                Array.isArray(parsedContent.analysis.designSystem.colorPalette)
                  ? parsedContent.analysis.designSystem.colorPalette
                  : [parsedContent.analysis.designSystem.colorPalette];
            }
            
            if (parsedContent.analysis.designSystem.typography) {
              result.analysis.designSystem.typography = 
                Array.isArray(parsedContent.analysis.designSystem.typography)
                  ? parsedContent.analysis.designSystem.typography
                  : [parsedContent.analysis.designSystem.typography];
            }
            
            if (parsedContent.analysis.designSystem.components) {
              result.analysis.designSystem.components = 
                Array.isArray(parsedContent.analysis.designSystem.components)
                  ? parsedContent.analysis.designSystem.components
                  : [parsedContent.analysis.designSystem.components];
            }
          }
          
          // Extract metadata from the analysis
          this.extractMetadata(parsedContent.analysis, result.metadata);
        }
        
        // Extract scene description
        if (parsedContent.sceneDescription) {
          result.sceneDescription = JSON.stringify(parsedContent.sceneDescription);
        } else {
          console.error('No scene description found in OpenAI response');
          throw new Error('Invalid response format: Missing scene description');
        }
        
      } catch (error) {
        console.error('Error parsing JSON content:', error);
        throw new Error(`Failed to parse JSON content: ${error}`);
      }
      
      return result;
    } catch (error: any) {
      console.error('Error parsing OpenAI WebGL response:', error);
      throw new Error(`Failed to parse OpenAI response: ${error.message}`);
    }
  }
  
  // Helper to extract list items from a section
  private extractListItems(text: string, sectionPattern: string): string[] {
    const regex = new RegExp(`(?:${sectionPattern})(?:[:\\s]*)((?:[\\s\\S](?!\\n\\s*\\n))*?)(?:\\n\\s*\\n|$)`, 'i');
    const match = text.match(regex);
    
    if (!match) return [];
    
    // Split by common list item markers
    return match[1]
      .split(/\n-|\n\*|\n\d+\./)
      .map(item => item.trim())
      .filter(Boolean);
  }
  
  // Helper to extract colors from color sections
  private extractColors(text: string, colorType: string): string[] {
    const regex = new RegExp(`${colorType}[\\s\\S]*?(?:colors?|palette)?[:\\s]*((?:[\\s\\S](?!\\n\\s*\\n))*?)(?:\\n\\s*\\n|$)`, 'i');
    const match = text.match(regex);
    
    if (!match) return [];
    
    // Extract any hex color codes
    const hexCodes = match[1].match(/#[0-9A-Fa-f]{3,6}/g);
    return hexCodes || [];
  }
  
  // Create a fallback demo response for development/testing
  private getFallbackAnalysisResponse(dimensions: {width: number, height: number}): DesignAnalysisResponse {
    const fallbackResponse = "This is a fallback response for development/testing purposes. In production, this would contain the full GPT-4.1 analysis.";
    
    // Simple scene description for testing
    const fallbackSceneDescription = {
      width: dimensions.width,
      height: dimensions.height,
      root: {
        id: "root",
        type: "container",
        x: 0,
        y: 0,
        width: dimensions.width,
        height: dimensions.height,
        backgroundColor: {r: 1, g: 1, b: 1, a: 1},
        children: [
          {
            id: "header",
            type: "container",
            x: 0,
            y: 0,
            width: dimensions.width,
            height: 80,
            backgroundColor: {r: 0.95, g: 0.95, b: 0.95, a: 1},
            children: [
              {
                id: "logo",
                type: "text",
                x: 20,
                y: 20,
                width: 200,
                height: 40,
                text: "COTERATE",
                fontFamily: "Inter",
                fontSize: 24,
                fontWeight: "bold",
                textColor: {r: 0.2, g: 0.2, b: 0.8, a: 1}
              }
            ]
          },
          {
            id: "content",
            type: "container",
            x: 0,
            y: 80,
            width: dimensions.width,
            height: dimensions.height - 80,
            backgroundColor: {r: 1, g: 1, b: 1, a: 1},
            children: [
              {
                id: "heading",
                type: "text",
                x: 40,
                y: 40,
                width: dimensions.width - 80,
                height: 50,
                text: "Welcome to Coterate Demo",
                fontFamily: "Inter",
                fontSize: 28,
                fontWeight: "bold",
                textColor: {r: 0.1, g: 0.1, b: 0.1, a: 1}
              },
              {
                id: "description",
                type: "text",
                x: 40,
                y: 100,
                width: dimensions.width - 80,
                height: 80,
                text: "This is a fallback UI rendered with WebGL for testing purposes.",
                fontFamily: "Inter",
                fontSize: 16,
                textColor: {r: 0.3, g: 0.3, b: 0.3, a: 1}
              },
              {
                id: "cta-button",
                type: "button",
                x: 40,
                y: 200,
                width: 180,
                height: 50,
                text: "Get Started",
                fontFamily: "Inter",
                fontSize: 16,
                backgroundColor: {r: 0.2, g: 0.4, b: 0.8, a: 1},
                textColor: {r: 1, g: 1, b: 1, a: 1},
                borderRadius: 8
              }
            ]
          }
        ]
      }
    };
    
    return {
      analysis: {
        strengths: [
          "Clean and minimalist aesthetic with good use of whitespace",
          "Consistent color scheme throughout the design",
          "Clear visual distinction between different sections",
          "Good use of typography for main headings"
        ],
        weaknesses: [
          "Some text elements lack sufficient contrast with background",
          "Button states are not visually distinct enough",
          "Mobile responsiveness could be improved",
          "Some interactive elements lack clear affordances"
        ],
        improvementAreas: [
          "Enhance visual hierarchy to better guide users through the content",
          "Improve color contrast for better accessibility",
          "Add more distinctive hover/focus states to interactive elements",
          "Optimize spacing and alignment for better visual flow"
        ],
        specificChanges: [
          "Increased contrast ratio of primary button text from 3:1 to 4.5:1",
          "Added visual feedback on hover states for all interactive elements",
          "Fixed inconsistent spacing between section elements",
          "Enhanced form field styling for better input affordance"
        ],
        visualHierarchy: {
          issues: [
            "Main call-to-action doesn't stand out enough from secondary actions",
            "Important information lacks visual emphasis",
            "Content grouping could be more clearly defined"
          ],
          improvements: [
            "Enhanced emphasis on primary actions while maintaining original position and size",
            "Applied appropriate visual weight to headings and key content",
            "Improved content grouping through subtle spacing adjustments"
          ]
        },
        colorContrast: {
          issues: [
            "Primary button text has insufficient contrast (3:1)",
            "Some secondary text is too light against the background",
            "Link colors don't provide enough distinction from regular text"
          ],
          improvements: [
            "Increased button text contrast to 4.5:1 while preserving brand colors",
            "Darkened secondary text by 15% to improve readability",
            "Made links more distinctive without changing the overall color scheme"
          ]
        },
        componentSelection: {
          issues: [
            "Some toggle controls are ambiguous in their current state",
            "Input fields lack clear focus states",
            "Dropdown menus have insufficient visual cues"
          ],
          improvements: [
            "Enhanced toggle controls with more distinct visual states",
            "Added clear focus indicators to all interactive elements",
            "Improved dropdown affordance with consistent visual cues"
          ]
        },
        textLegibility: {
          issues: [
            "Body text is too small in some sections",
            "Line height is insufficient for comfortable reading",
            "Some headings lack sufficient spacing from body text"
          ],
          improvements: [
            "Increased body text size from 14px to 16px where needed",
            "Adjusted line height to 1.5 times the font size for better readability",
            "Added appropriate spacing between headings and related content"
          ]
        },
        usability: {
          issues: [
            "Navigation structure is not immediately clear",
            "Some interactive elements don't appear clickable",
            "Form submission process lacks visual feedback"
          ],
          improvements: [
            "Enhanced navigation indicators while maintaining original structure",
            "Improved hover/focus states for all interactive elements",
            "Added clear visual feedback for form interactions"
          ]
        },
        accessibility: {
          issues: [
            "Keyboard navigation path is not logical",
            "Some interactive elements lack accessible names",
            "Color alone is used to convey some information"
          ],
          improvements: [
            "Fixed focus order to follow natural content flow without restructuring the UI",
            "Added proper aria-labels while maintaining visual design",
            "Added non-color indicators for important state information"
          ]
        },
        designSystem: {
          colorPalette: [
            "Primary: #4A6CF7 - Used for primary buttons, links, and key accent elements",
            "Secondary: #6F7DEB - Used for secondary buttons and supporting elements",
            "Background: #FFFFFF (main), #F8F9FB (secondary) - Used for page and card backgrounds",
            "Text: #1D2939 (headings), #4B5563 (body), #6B7280 (secondary text)"
          ],
          typography: [
            "Headings: Plus Jakarta Sans, 28px/700 (h1), 24px/600 (h2), 20px/600 (h3)",
            "Body: Inter, 16px/400 (primary), 14px/400 (secondary)",
            "Buttons: Inter, 16px/500",
            "Labels: Inter, 14px/500"
          ],
          components: [
            "Buttons: Rounded corners (8px), consistent padding (16px horizontal, 10px vertical), primary (#4A6CF7), secondary (#EEF1FF with #6F7DEB text)",
            "Input fields: 1px border (#E5E7EB), 8px border radius, 12px padding, #F9FAFB background",
            "Cards: White background, subtle shadow (0 2px 5px rgba(0,0,0,0.08)), 16px border radius, 24px padding",
            "Navigation: Consistent 16px spacing between items, 2px accent indicator for active items"
          ]
        },
        rawResponse: fallbackResponse,
        userPrompt: "This is a fallback prompt for development/testing purposes."
      },
      sceneDescription: JSON.stringify(fallbackSceneDescription),
      htmlCode: '<div class="fallback-html">Fallback HTML</div>', // Keep for backward compatibility
      cssCode: '.fallback-html { color: #333; }', // Keep for backward compatibility
      metadata: {
        colors: {
          primary: ['#4f46e5', '#4338ca'],
          secondary: ['#6b7280'],
          background: ['#ffffff', '#f9fafb'],
          text: ['#1f2937', '#4b5563']  // Slightly adjusted for better contrast
        },
        fonts: [
          'Inter', 
          '-apple-system', 
          'BlinkMacSystemFont', 
          'Segoe UI', 
          'Roboto'
        ],
        components: [
          'Navigation Menu',
          'Hero Section',
          'Feature Cards',
          'Primary Button',
          'Footer',
          'Logo'
        ]
      }
    };
  }

  // Add this helper method to create a data URL from an image
  private async createDataUrlFromFigmaImage(imageUrl: string): Promise<string | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      // Set a timeout to avoid hanging
      const timeoutId = setTimeout(() => {
        console.log('Image load timed out, resolving with null');
        resolve(null);
      }, 5000);
      
      img.onload = () => {
        clearTimeout(timeoutId);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 800;
          canvas.height = img.naturalHeight || 600;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            resolve(dataUrl);
          } else {
            resolve(null);
          }
        } catch (error) {
          console.error('Error creating data URL:', error);
          resolve(null);
        }
      };
      
      img.onerror = () => {
        clearTimeout(timeoutId);
        console.error('Error loading image for data URL creation');
        resolve(null);
      };
      
      // Add a random query parameter to bypass cache
      img.src = `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
    });
  }

  // Add this method to continue with the OpenAI analysis once we have the base64 image
  private async continueWithAnalysis(base64Image: string, dimensions: {width: number, height: number}, linkedInsights: any[], userPrompt: string): Promise<DesignAnalysisResponse> {
    // Process linked insights if available
    const insightsPrompt = 
      linkedInsights.length > 0 
        ? `ADDITIONAL USER INSIGHTS:\n${linkedInsights.map(i => `- ${i}`).join('\n')}\n\nPlease incorporate these user insights into your analysis and improvements.`
        : '';
    
    const userPromptContent = 
      userPrompt 
        ? `USER REQUEST:\n${userPrompt}\n\nPlease address this specific user request in your analysis and improvements.`
        : '';
    
    const requestBody = {
      model: 'gpt-4.1',
      messages: [
        {
          role: 'system',
          content: `You are a top-tier UI/UX designer with exceptional pixel-perfect reproduction skills and deep expertise in design analysis and improvement. Your task is to analyze a design image, provide detailed feedback on its strengths and weaknesses, and create an ITERATIVE GPU-RENDERED version that addresses those issues while MAINTAINING THE ORIGINAL DESIGN'S EXACT VISUAL STYLE.

          MOST IMPORTANT: The iteration should clearly be a refined version of the original design, NOT a completely new design. Users should immediately recognize it as the same UI but with targeted improvements.

          DESIGN SYSTEM EXTRACTION:
          First, you must carefully extract and document the EXACT design system from the original design:
          
          1. Color palette: 
             - Document every single color used in the UI with precise hex codes
             - Identify primary, secondary, accent, background, and text colors
             - Note the exact usage pattern of each color (e.g., which color is used for primary buttons vs secondary buttons)
          
          2. Typography:
             - Document every font family used
             - Note the exact font sizes used for each text element type (headings, body, buttons, labels, etc.)
             - Document font weights, line heights, and letter spacing
             - Map out the typographic hierarchy exactly as used in the design
          
          3. UI Components:
             - Document every UI component type (buttons, inputs, checkboxes, etc.)
             - For each component, note its exact styling (colors, borders, shadows, padding)
             - Document different states if visible (hover, active, disabled)
             - Identify any consistent padding or spacing patterns between components
          
          This design system extraction is CRITICAL - you must use these EXACT same values in your improved version.
          
          DESIGN ANALYSIS REQUIREMENTS:
          Perform a comprehensive analysis of the design focusing on:
          
          1. Visual hierarchy:
             - Analyze how effectively the design guides the user's attention
             - Identify elements that compete for attention or are not properly emphasized
             - Evaluate the use of size, color, contrast, and spacing to establish hierarchy
          
          2. Color contrast and accessibility:
             - Identify text elements with insufficient contrast ratios (per WCAG guidelines)
             - Analyze color combinations that may cause visibility or accessibility issues
             - Evaluate overall color harmony and effective use of color to convey information
          
          3. Component selection and placement:
             - Evaluate the appropriateness of UI components for their intended functions
             - Identify issues with component placement, grouping, or organization
             - Assess consistency in component usage throughout the design
          
          4. Text legibility:
             - Identify any text that is too small, has poor contrast, or uses inappropriate fonts
             - Evaluate line length, line height, letter spacing, and overall readability
             - Assess font choices for appropriateness to the content and brand
          
          5. Overall usability:
             - Analyze the intuitiveness of interactions and flows
             - Identify potential points of confusion or friction
             - Evaluate spacing, alignment, and overall layout effectiveness
          
          6. Accessibility considerations:
             - Identify potential issues for users with disabilities
             - Assess keyboard navigability, screen reader compatibility, and semantic structure
             - Evaluate compliance with WCAG guidelines
          
          IMPROVEMENT REQUIREMENTS:
          Based on your analysis, create an IMPROVED VERSION that:
          
          1. ALWAYS USES THE EXACT SAME DESIGN SYSTEM - colors, typography, and component styles must be identical to the original
          2. MAINTAINS THE ORIGINAL DESIGN'S VISUAL STRUCTURE - at least 85% of the original layout must remain unchanged
          3. Makes targeted improvements ONLY to:
             - Visual hierarchy through component rearrangement where appropriate
             - Component selection where a more appropriate component type serves the same function better
             - Spacing and alignment to improve clarity and flow
             - Text size or weight adjustments ONLY when needed for legibility (but keep the same font family)
          4. When swapping a UI component for a more appropriate one (e.g., radio button to checkbox), you MUST style the new component using the EXACT SAME design system (colors, borders, etc.) as the original component
          5. Never changes the core brand identity or visual language
          6. Makes only the necessary changes to fix problems - avoid redesigning elements that work well
          7. Ensures the improved version is immediately recognizable as an iteration of the original
          
          DIMENSIONS REQUIREMENT:
          The generated scene MUST match the EXACT dimensions of the original design, which is ${dimensions.width}px × ${dimensions.height}px.

          JSON SCENE DESCRIPTION REQUIREMENTS:
          Instead of outputting HTML/CSS, you must create a JSON scene description that can be rendered by a WebGL engine. The JSON must follow this structure:

          {
            "width": ${dimensions.width},
            "height": ${dimensions.height},
            "root": {
              "id": "root",
              "type": "container",
              "x": 0,
              "y": 0,
              "width": ${dimensions.width},
              "height": ${dimensions.height},
              "children": [
                // Child UI elements go here
              ]
            }
          }

          Each UI element should be one of these types:
          1. "container" - For grouping elements, similar to a div
          2. "rect" - Basic rectangle shape with fill color
          3. "text" - For displaying text
          4. "button" - Interactive button element
          5. "image" - For image placeholders
          6. "input" - For input fields

          Each element must include:
          - "id": unique string ID
          - "type": one of the types above
          - "x", "y": position relative to parent
          - "width", "height": dimensions
          - "visible": boolean (optional, defaults to true)
          - Additional properties based on type (see examples below)

          Example container:
          {
            "id": "header",
            "type": "container",
            "x": 0,
            "y": 0,
            "width": 1200,
            "height": 80,
            "backgroundColor": {"r": 0.95, "g": 0.95, "b": 0.95, "a": 1},
            "borderRadius": 4,
            "shadowColor": {"r": 0, "g": 0, "b": 0, "a": 0.1},
            "shadowBlur": 5,
            "shadowOffsetX": 0,
            "shadowOffsetY": 2,
            "children": [...]
          }

          Example text:
          {
            "id": "headline",
            "type": "text",
            "x": 20,
            "y": 30,
            "width": 300,
            "height": 40,
            "text": "Welcome to Coterate",
            "fontFamily": "Inter",
            "fontSize": 24,
            "fontWeight": "bold",
            "textColor": {"r": 0.1, "g": 0.1, "b": 0.1, "a": 1},
            "textAlign": "left"
          }

          Example button:
          {
            "id": "submit-btn",
            "type": "button",
            "x": 100,
            "y": 200,
            "width": 120,
            "height": 40,
            "text": "Submit",
            "fontFamily": "Inter",
            "fontSize": 16,
            "backgroundColor": {"r": 0.2, "g": 0.4, "b": 0.8, "a": 1},
            "textColor": {"r": 1, "g": 1, "b": 1, "a": 1},
            "borderRadius": 8
          }

          IMPORTANT COLOR REPRESENTATION:
          All colors must be represented as RGB values between 0 and 1, not as hex codes or 0-255 values. For example:
          - Black: {"r": 0, "g": 0, "b": 0, "a": 1}
          - White: {"r": 1, "g": 1, "b": 1, "a": 1}
          - Red: {"r": 1, "g": 0, "b": 0, "a": 1}

          OUTPUT FORMAT:
          Your response must follow this exact format:

          \`\`\`json
          {
            "analysis": {
              "strengths": ["array of strengths"],
              "weaknesses": ["array of weaknesses"],
              "improvementAreas": ["array of improvement areas"]
            },
            "sceneDescription": {
              "width": 800,
              "height": 600,
              "root": {}
            }
          }
          \`\`\`

          The analysis section should include the same detailed analysis as before, just in JSON format instead of markdown.

          ${insightsPrompt}
          
          ${userPromptContent}`
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            },
            {
              type: 'text',
              text: 'Please analyze this UI design and create an improved version following the requirements.'
            }
          ]
        }
      ]
    };
    
    try {
      console.log('Sending request to OpenAI API...');
      
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error('OpenAI API error response:', errorText);
        
        // In production, never use fallback
        if (this.isProductionEnvironment()) {
          throw new Error(`OpenAI API error: ${openaiResponse.status} ${openaiResponse.statusText}. ${errorText}`);
        }
        
        // Only use fallback in development
        if (this.isDevEnvironment()) {
          console.log('Development environment detected, using fallback response for testing');
          return this.getFallbackAnalysisResponse(dimensions);
        }
        
        // Default behavior
        throw new Error(`OpenAI API error: ${openaiResponse.status} ${openaiResponse.statusText}. ${errorText}`);
      }
      
      const data = await openaiResponse.json();
      
      // Extract the response content
      const responseContent = data.choices[0].message.content;
      
      // Parse the response to extract the scene description and analysis
      return this.parseWebGLResponse(responseContent, linkedInsights.length > 0, userPrompt);
    } catch (error: any) {
      console.error('Error in continueWithAnalysis:', error);
      throw error;
    }
  }

  // Public method to parse a raw response and extract HTML/CSS
  parseRawResponse(rawResponse: string): DesignAnalysisResponse {
    console.log('Parsing raw response for reload...');
    
    try {
      // Use the same parsing method used for initial analysis
      return this.parseWebGLResponse(rawResponse, false);
    } catch (error) {
      console.error('Error parsing raw response:', error);
      throw new Error(`Failed to parse raw response: ${error}`);
    }
  }
  
  // Helper method to fix common CSS issues
  private fixCssIssues(css: string): string {
    console.log('Fixing CSS issues...');
    let fixedCss = css;
    
    // 1. Check for missing semicolons
    const propertyPattern = /([a-z-]+)\s*:\s*([^;}]+)(?=[}])/g;
    fixedCss = fixedCss.replace(propertyPattern, '$1: $2;');
    
    // 2. Count opening and closing braces
    const openBraces = (fixedCss.match(/{/g) || []).length;
    const closeBraces = (fixedCss.match(/}/g) || []).length;
    const missingCloseBraces = openBraces - closeBraces;
    
    // Add missing closing braces
    if (missingCloseBraces > 0) {
      console.log(`Adding ${missingCloseBraces} missing closing braces to CSS`);
      fixedCss = fixedCss + '\n' + '}'.repeat(missingCloseBraces);
    }
    
    // 3. Ensure last property has semicolon
    const lastPropertyPattern = /([a-z-]+)\s*:\s*([^;}]+)(?=\s*$)/g;
    fixedCss = fixedCss.replace(lastPropertyPattern, '$1: $2;');
    
    return fixedCss;
  }
  
  // Helper method to fix HTML to use inline styles
  private fixHtmlStyleReferences(html: string, css: string): string {
    // Replace external stylesheet references with inline style
    const linkStylesheetPattern = /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/g;
    const inlineStyleTag = `<style>\n${css}\n</style>`;
    
    let fixedHtml = html.replace(linkStylesheetPattern, inlineStyleTag);
    
    // If no replacement happened, check if there's a head tag to add the style to
    if (fixedHtml === html && !fixedHtml.includes('<style>')) {
      if (fixedHtml.includes('</head>')) {
        fixedHtml = fixedHtml.replace('</head>', `${inlineStyleTag}\n</head>`);
      } else if (fixedHtml.includes('<body')) {
        fixedHtml = fixedHtml.replace('<body', `${inlineStyleTag}\n<body`);
      }
    }
    
    // Fix viewport settings if they're extreme
    const viewportPattern = /<meta[^>]*name=["']viewport["'][^>]*content=["']([^"']*)["'][^>]*>/g;
    fixedHtml = fixedHtml.replace(viewportPattern, (match, content) => {
      // Check if viewport has extreme width/height values
      if (content.includes('width=') && content.match(/width=\d{4,}/)) {
        return '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
      }
      return match;
    });
    
    return fixedHtml;
  }

  // Add this method to extract metadata from the analysis
  private extractMetadata(analysis: any, metadata: any): void {
    // Extract colors if available
    if (analysis.designSystem && analysis.designSystem.colorPalette) {
      const colorPalette = analysis.designSystem.colorPalette;
      
      // Extract primary colors
      const primaryColors = colorPalette.filter((item: string) => 
        item.toLowerCase().includes('primary')
      );
      if (primaryColors.length > 0) {
        metadata.colors.primary = primaryColors.map((item: string) => {
          const match = item.match(/#[0-9A-Fa-f]{3,6}/);
          return match ? match[0] : null;
        }).filter(Boolean);
      }
      
      // Extract secondary colors
      const secondaryColors = colorPalette.filter((item: string) => 
        item.toLowerCase().includes('secondary')
      );
      if (secondaryColors.length > 0) {
        metadata.colors.secondary = secondaryColors.map((item: string) => {
          const match = item.match(/#[0-9A-Fa-f]{3,6}/);
          return match ? match[0] : null;
        }).filter(Boolean);
      }
      
      // Extract background colors
      const backgroundColors = colorPalette.filter((item: string) => 
        item.toLowerCase().includes('background')
      );
      if (backgroundColors.length > 0) {
        metadata.colors.background = backgroundColors.map((item: string) => {
          const match = item.match(/#[0-9A-Fa-f]{3,6}/);
          return match ? match[0] : null;
        }).filter(Boolean);
      }
      
      // Extract text colors
      const textColors = colorPalette.filter((item: string) => 
        item.toLowerCase().includes('text')
      );
      if (textColors.length > 0) {
        metadata.colors.text = textColors.map((item: string) => {
          const match = item.match(/#[0-9A-Fa-f]{3,6}/);
          return match ? match[0] : null;
        }).filter(Boolean);
      }
    }
    
    // Extract fonts if available
    if (analysis.designSystem && analysis.designSystem.typography) {
      const typography = analysis.designSystem.typography;
      
      // Extract font families
      const fonts = typography.reduce((acc: string[], item: string) => {
        const fontMatches = item.match(/['"]([^'"]+)['"]/g) || [];
        const extractedFonts = fontMatches.map((font: string) => 
          font.replace(/['"]/g, '')
        );
        return [...acc, ...extractedFonts];
      }, []);
      
      if (fonts.length > 0) {
        metadata.fonts = Array.from(new Set(fonts)); // Deduplicate
      }
    }
    
    // Extract components if available
    if (analysis.designSystem && analysis.designSystem.components) {
      const components = analysis.designSystem.components;
      
      // Extract component names
      const componentNames = components.reduce((acc: string[], item: string) => {
        const matches = item.match(/^([^:]+):/);
        if (matches && matches[1]) {
          acc.push(matches[1].trim());
        }
        return acc;
      }, []);
      
      if (componentNames.length > 0) {
        metadata.components = componentNames;
      }
    }
  }

  // Helper method to convert image URL to base64
  private async imageUrlToBase64(imageUrl: string): Promise<string> {
    try {
      // Handle data URLs - already in base64 format
      if (imageUrl.startsWith('data:')) {
        const base64Data = imageUrl.split(',')[1];
        return base64Data;
      }

      // For Figma URLs or others that might have CORS issues, try to use a data URL first
      const dataUrl = await this.createDataUrlFromFigmaImage(imageUrl);
      if (dataUrl) {
        return dataUrl.split(',')[1];
      }
      
      // Fallback to direct fetch for URLs we can access
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      return await this.blobToBase64(blob);
    } catch (error) {
      console.error('Error converting image URL to base64:', error);
      throw new Error('Failed to convert image URL to base64');
    }
  }
}

const openAIService = new OpenAIService();
export default openAIService; 