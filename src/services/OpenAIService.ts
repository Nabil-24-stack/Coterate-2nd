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
      // Get image as base64 if it's a remote URL
      let base64Image = '';
      
      if (imageUrl.startsWith('data:image')) {
        // Already a data URL, extract the base64 part
        base64Image = imageUrl.split(',')[1];
      } else {
        try {
          // Get image dimensions first - we need these regardless of fetch method
          const dimensions = await this.getImageDimensions(imageUrl);
          
          // Try to handle CORS issues with Figma images
          let fetchResponse;
          try {
            // First attempt: direct fetch
            fetchResponse = await fetch(imageUrl, { mode: 'cors' });
          } catch (directFetchError) {
            console.log('Direct fetch failed, trying with proxy or CORS mode: no-cors');
            try {
              // Second attempt: try with no-cors mode
              fetchResponse = await fetch(imageUrl, { mode: 'no-cors' });
            } catch (corsError) {
              // If both failed, try with a proxy if we have one, otherwise rethrow
              console.error('Both fetch attempts failed:', corsError);
              // If the image URL is a Figma URL, try to create a placeholder or use a cached version
              if (imageUrl.includes('figma-alpha-api.s3') || imageUrl.includes('figma.com')) {
                // For Figma images that fail with CORS, use a hardcoded data URL as fallback
                console.log('Figma image detected, using data URL fallback');
                // Convert the design to a basic data URL by drawing it on a canvas
                const dataUrl = await this.createDataUrlFromFigmaImage(imageUrl);
                if (dataUrl) {
                  base64Image = dataUrl.split(',')[1];
                  return await this.continueWithAnalysis(base64Image, dimensions, linkedInsights, userPrompt);
                }
              }
              throw corsError;
            }
          }
          
          if (!fetchResponse.ok) {
            throw new Error(`Failed to fetch image: ${fetchResponse.status} ${fetchResponse.statusText}`);
          }
          
          const blob = await fetchResponse.blob();
          base64Image = await this.blobToBase64(blob);
        } catch (error: any) {
          console.error('Error fetching image:', error);
          
          // Try to create a data URL from the image as a last resort
          try {
            console.log('Attempting to create data URL from image as fallback');
            const dimensions = await this.getImageDimensions(imageUrl);
            const dataUrl = await this.createDataUrlFromFigmaImage(imageUrl);
            if (dataUrl) {
              base64Image = dataUrl.split(',')[1];
              return await this.continueWithAnalysis(base64Image, dimensions, linkedInsights, userPrompt);
            }
          } catch (fallbackError) {
            console.error('Fallback attempt also failed:', fallbackError);
          }
          
          throw new Error(`Failed to process image: ${error.message}`);
        }
      }
      
      // Get image dimensions
      const dimensions = await this.getImageDimensions(imageUrl);
      
      // Process linked insights if available
      let insightsPrompt = '';
      if (linkedInsights && linkedInsights.length > 0) {
        insightsPrompt = '\n\nImportant user insights to consider:\n';
        linkedInsights.forEach((insight, index) => {
          const summary = insight.summary || (insight.content ? insight.content.substring(0, 200) + '...' : 'No content');
          insightsPrompt += `${index + 1}. ${summary}\n`;
        });
        insightsPrompt += '\nMake sure to address these specific user needs and pain points in your design improvements.';
      }
      
      // Add the user prompt if provided
      const userPromptContent = userPrompt ? `\n\nSpecific user requirements to focus on:\n${userPrompt}\n\nConcentrate on these specific aspects in your design improvements.` : '';
      
      const requestBody = {
        model: 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content: `You are a top-tier UI/UX designer with exceptional pixel-perfect reproduction skills and deep expertise in design analysis and improvement. Your task is to analyze a design image, provide detailed feedback on its strengths and weaknesses, and create an ITERATIVE HTML/CSS version that addresses those issues while MAINTAINING THE ORIGINAL DESIGN'S EXACT VISUAL STYLE.

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
            The generated HTML/CSS MUST match the EXACT dimensions of the original design, which is ${dimensions.width}px width by ${dimensions.height}px height. All elements must be properly positioned and sized to match the original layout's scale and proportions.
            
            CSS REQUIREMENTS:
            1. Use CSS Grid and Flexbox for layouts that need to be responsive
            2. Use absolute positioning for pixel-perfect placement when needed
            3. Include CSS variables for colors, spacing, and typography - USING THE EXACT VALUES from the original design
            4. Ensure clean, well-organized CSS with descriptive class names
            5. Include detailed comments in CSS explaining design decisions
            6. Avoid arbitrary magic numbers - document any precise pixel measurements
            
            ICON REQUIREMENTS:
            For any icons identified in the UI:
            1. Use Font Awesome icons that EXACTLY match the original icons (via CDN: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css")
            2. If no perfect Font Awesome match exists, create the icon using CSS
            3. Ensure icon sizing and positioning exactly matches the original
            4. Apply the EXACT SAME colors from the original design to the icons
            
            IMAGE REQUIREMENTS:
            For any images identified in the original design:
            1. DO NOT use any external image URLs, placeholders, or Unsplash images
            2. Instead, replace each image with a simple colored div (rectangle or square)
            3. Use a background color that makes sense in the context (gray, light blue, etc.)
            4. Maintain the exact same dimensions, positioning, and styling (borders, etc.) as the original image
            5. Add a subtle 1px border to the div to indicate it's an image placeholder
            6. You can add a simple CSS pattern or gradient if appropriate
            
            OUTPUT FORMAT:
            Your response MUST be structured as follows:
            
            1. DESIGN SYSTEM:
               Document the extracted design system in detail (colors, typography, components)
            
            2. ANALYSIS:
               Provide a detailed analysis of the design's strengths and weaknesses, organized by category (visual hierarchy, color contrast, etc.)
            
            3. HTML CODE:
               Provide the complete HTML code for the improved design between \`\`\`html\`\`\` tags
            
            4. CSS CODE:
               Provide the complete CSS code for the improved design between \`\`\`css\`\`\` tags
            
            5. IMPROVEMENTS SUMMARY:
               List the specific improvements made to the design and explain the rationale behind each one
            ${insightsPrompt}${userPromptContent}`
          },
          {
            role: 'user',
            content: [{
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Image}`
              }
            }]
          }
        ],
        max_tokens: 4000
      };
      
      console.log('Sending request to OpenAI API for design analysis...');
      
      // Since direct fetch may face CORS issues in browser environment, use a proxy 
      // or fallback to server-side processing if needed
      let openaiResponse;
      
      try {
        // First try direct API call
        openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify(requestBody)
        });
      } catch (error: any) {
        console.error('Direct OpenAI API call failed, error details:', error);
        
        // In production, never use fallback
        if (this.isProductionEnvironment()) {
          throw new Error(`OpenAI API call failed: ${error.message}. Please check your API key and try again.`);
        }
        
        // Only use fallback during development
        if (this.isDevEnvironment()) {
          console.log('Development environment detected, using fallback response for testing');
          return this.getFallbackAnalysisResponse(dimensions);
        }
        
        // Default behavior for unknown environments - throw the error
        throw new Error(`OpenAI API call failed: ${error.message}. Please check your API key and try again.`);
      }
      
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
      
      // Parse the response to extract HTML, CSS, and analysis
      return this.parseOpenAIResponse(responseContent, linkedInsights.length > 0, userPrompt);
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
  
  // Parse the OpenAI response to extract HTML, CSS, and analysis
  private parseOpenAIResponse(response: string, hasUserInsights: boolean = false, userPrompt: string = ''): DesignAnalysisResponse {
    console.log('Parsing OpenAI response...');
    
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
        htmlCode: '',
        cssCode: '',
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
      
      // Use the more robust parsing logic from parseRawResponse
      const parsedCode = this.parseRawResponse(response);
      result.htmlCode = parsedCode.htmlCode;
      result.cssCode = parsedCode.cssCode;
      
      console.log('HTML/CSS extraction results:', { 
        htmlFound: !!result.htmlCode, 
        cssFound: !!result.cssCode,
        htmlLength: result.htmlCode?.length || 0,
        cssLength: result.cssCode?.length || 0 
      });
      
      // Extract design system information
      result.analysis.designSystem.colorPalette = this.extractListItems(response, 'Color Palette|Design System Extraction.*?Color[s]?\\s*Palette');
      result.analysis.designSystem.typography = this.extractListItems(response, 'Typography|Design System Extraction.*?Typography');
      result.analysis.designSystem.components = this.extractListItems(response, 'UI Components|Design System Extraction.*?Components');
      
      // Extract general analysis sections
      result.analysis.strengths = this.extractListItems(response, 'Strengths|General Strengths');
      result.analysis.weaknesses = this.extractListItems(response, 'Weaknesses|General Weaknesses');
      result.analysis.improvementAreas = this.extractListItems(response, 'Improvements|Improvement Areas|Areas for Improvement');
      result.analysis.specificChanges = this.extractListItems(response, 'Specific Changes|Changes Made|Implemented Changes');
      
      // Extract specific analysis categories
      result.analysis.visualHierarchy.issues = this.extractListItems(response, 'Visual Hierarchy(?:[:\\s]*Issues|[\\s\\-]*Issues|:)');
      result.analysis.visualHierarchy.improvements = this.extractListItems(response, 'Visual Hierarchy(?:[:\\s]*Improvements|[\\s\\-]*Improvements|[\\s\\-]*Recommendations)');
      
      result.analysis.colorContrast.issues = this.extractListItems(response, 'Color Contrast(?:[:\\s]*Issues|[\\s\\-]*Issues|:)|Accessibility(?:[:\\s]*Issues|[\\s\\-]*Issues|:)');
      result.analysis.colorContrast.improvements = this.extractListItems(response, 'Color Contrast(?:[:\\s]*Improvements|[\\s\\-]*Improvements|[\\s\\-]*Recommendations)|Accessibility(?:[:\\s]*Improvements|[\\s\\-]*Improvements|[\\s\\-]*Recommendations)');
      
      result.analysis.componentSelection.issues = this.extractListItems(response, 'Component Selection(?:[:\\s]*Issues|[\\s\\-]*Issues|:)|Component Placement(?:[:\\s]*Issues|[\\s\\-]*Issues|:)');
      result.analysis.componentSelection.improvements = this.extractListItems(response, 'Component Selection(?:[:\\s]*Improvements|[\\s\\-]*Improvements|[\\s\\-]*Recommendations)|Component Placement(?:[:\\s]*Improvements|[\\s\\-]*Improvements|[\\s\\-]*Recommendations)');
      
      result.analysis.textLegibility.issues = this.extractListItems(response, 'Text Legibility(?:[:\\s]*Issues|[\\s\\-]*Issues|:)');
      result.analysis.textLegibility.improvements = this.extractListItems(response, 'Text Legibility(?:[:\\s]*Improvements|[\\s\\-]*Improvements|[\\s\\-]*Recommendations)');
      
      result.analysis.usability.issues = this.extractListItems(response, 'Usability(?:[:\\s]*Issues|[\\s\\-]*Issues|:)|Overall Usability(?:[:\\s]*Issues|[\\s\\-]*Issues|:)');
      result.analysis.usability.improvements = this.extractListItems(response, 'Usability(?:[:\\s]*Improvements|[\\s\\-]*Improvements|[\\s\\-]*Recommendations)|Overall Usability(?:[:\\s]*Improvements|[\\s\\-]*Improvements|[\\s\\-]*Recommendations)');
      
      result.analysis.accessibility.issues = this.extractListItems(response, 'Accessibility(?:[:\\s]*Issues|[\\s\\-]*Issues|:)|Accessibility Considerations(?:[:\\s]*Issues|[\\s\\-]*Issues|:)');
      result.analysis.accessibility.improvements = this.extractListItems(response, 'Accessibility(?:[:\\s]*Improvements|[\\s\\-]*Improvements|[\\s\\-]*Recommendations)|Accessibility Considerations(?:[:\\s]*Improvements|[\\s\\-]*Improvements|[\\s\\-]*Recommendations)');
      
      // Extract colors
      result.metadata.colors.primary = this.extractColors(response, 'Primary');
      result.metadata.colors.secondary = this.extractColors(response, 'Secondary');
      result.metadata.colors.background = this.extractColors(response, 'Background');
      result.metadata.colors.text = this.extractColors(response, 'Text');
      
      // Extract all colors from CSS as a fallback
      if (result.cssCode) {
        const allCssColors = result.cssCode.match(/#[0-9A-Fa-f]{3,6}|rgba?\([^)]+\)/g) || [];
        
        // If we couldn't extract colors from the analysis, use the CSS colors
        if (
          result.metadata.colors.primary.length === 0 &&
          result.metadata.colors.secondary.length === 0 &&
          result.metadata.colors.background.length === 0 &&
          result.metadata.colors.text.length === 0
        ) {
          // Add unique colors from CSS - using Array.from instead of spread to handle Set in TypeScript
          const uniqueColors = Array.from(new Set(allCssColors));
          result.metadata.colors.primary = uniqueColors.slice(0, 2);
          result.metadata.colors.secondary = uniqueColors.slice(2, 4);
          result.metadata.colors.background = uniqueColors.slice(4, 6);
          result.metadata.colors.text = uniqueColors.slice(6, 8);
        }
      }
      
      // Extract fonts from CSS as a fallback
      if (result.cssCode && result.metadata.fonts.length === 0) {
        const fontFamilies = result.cssCode.match(/font-family:\s*([^;]+)/g) || [];
        result.metadata.fonts = fontFamilies
          .map(f => f.replace('font-family:', '').trim())
          .filter((f, i, self) => self.indexOf(f) === i); // Unique values only
      }
      
      // Extract fonts
      result.metadata.fonts = this.extractListItems(response, 'Fonts|Typography');
      
      // Extract components
      result.metadata.components = this.extractListItems(response, 'Components|UI Components');
      
      // Extract user insights applied if relevant
      if (hasUserInsights) {
        result.userInsightsApplied = this.extractListItems(response, 'User Insights Applied|User Insights|User Research Applied');
      }
      
      return result;
    } catch (error: any) {
      console.error('Error parsing OpenAI response:', error);
      
      // In production, never use fallback
      if (this.isProductionEnvironment()) {
        throw new Error(`Failed to parse OpenAI response: ${error.message}`);
      }
      
      // Only use fallback in development
      if (this.isDevEnvironment()) {
        console.log('Development environment detected, using fallback response');
        // Use default dimensions since we don't have access to imageUrl here
        return this.getFallbackAnalysisResponse({ width: 800, height: 600 });
      }
      
      // Default behavior
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
      htmlCode: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Improved Design</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body>
  <!-- This is a demo fallback response. In production, this would be an iterated version of the original UI -->
  <div class="container">
    <!-- Preserving original header structure -->
    <header class="header">
      <div class="logo">
        <h1>Original Logo</h1>
      </div>
      <nav class="main-nav">
        <ul>
          <li><a href="#" class="active">Home</a></li>
          <li><a href="#">Features</a></li>
          <li><a href="#">Pricing</a></li>
          <li><a href="#">About</a></li>
        </ul>
      </nav>
      <!-- Enhancement: Improved button with better contrast -->
      <div class="cta-button">
        <button class="primary-button">Get Started</button>
      </div>
    </header>
    
    <main>
      <!-- Preserving original hero structure with improved contrast -->
      <section class="hero">
        <div class="hero-content">
          <h2>Original Headline Text</h2>
          <p>Original description text with improved line height and spacing.</p>
          <button class="primary-button">Try It Now</button>
        </div>
        <div class="hero-image">
          <!-- Image placeholder preserving original dimensions -->
          <div class="image-placeholder"></div>
        </div>
      </section>
      
      <!-- Original features section with improved spacing -->
      <section class="features">
        <h3>Key Features</h3>
        <div class="feature-cards">
          <div class="feature-card">
            <div class="feature-icon"><i class="fas fa-magic"></i></div>
            <h4>Original Feature Title</h4>
            <p>Original feature description with improved legibility.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon"><i class="fas fa-bolt"></i></div>
            <h4>Original Feature Title</h4>
            <p>Original feature description with improved legibility.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon"><i class="fas fa-users"></i></div>
            <h4>Original Feature Title</h4>
            <p>Original feature description with improved legibility.</p>
          </div>
        </div>
      </section>
    </main>
    
    <!-- Preserving original footer structure -->
    <footer>
      <div class="footer-links">
        <div class="footer-column">
          <h5>Original Footer Title</h5>
          <ul>
            <li><a href="#">Original Link</a></li>
            <li><a href="#">Original Link</a></li>
            <li><a href="#">Original Link</a></li>
          </ul>
        </div>
        <div class="footer-column">
          <h5>Original Footer Title</h5>
          <ul>
            <li><a href="#">Original Link</a></li>
            <li><a href="#">Original Link</a></li>
            <li><a href="#">Original Link</a></li>
          </ul>
        </div>
        <div class="footer-column">
          <h5>Original Footer Title</h5>
          <ul>
            <li><a href="#">Original Link</a></li>
            <li><a href="#">Original Link</a></li>
            <li><a href="#">Original Link</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p>Original copyright text.</p>
      </div>
    </footer>
  </div>
</body>
</html>`,
      cssCode: `/* CSS Variables for consistent theming */
:root {
  /* Preserving original color values with adjustments for accessibility */
  --primary-color: #4f46e5;
  --primary-hover: #4338ca;
  --secondary-color: #6b7280;
  --text-color: #1f2937;
  --light-text: #4b5563; /* Slightly darker than original for better contrast */
  --background: #ffffff;
  --light-bg: #f9fafb;
  --border-color: #e5e7eb;
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  --border-radius: 0.375rem;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
}

/* Base styles - preserving original with minor enhancements */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  /* Preserving original font stack */
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  color: var(--text-color);
  line-height: 1.5; /* Improved from original 1.3 */
  background-color: var(--background);
  font-size: 16px; /* Preserved from original */
}

.container {
  width: ${dimensions.width}px; /* Preserving original width */
  margin: 0 auto;
  overflow: hidden;
}

/* Typography - preserving original with minor enhancements for readability */
h1, h2, h3, h4, h5, h6 {
  margin-bottom: var(--spacing-md);
  font-weight: 600;
  line-height: 1.2;
}

h1 {
  font-size: 1.875rem; /* Preserved from original */
}

h2 {
  font-size: 2.25rem; /* Preserved from original */
  color: var(--text-color);
}

h3 {
  font-size: 1.5rem; /* Preserved from original */
  text-align: center;
  margin-bottom: var(--spacing-xl);
}

h4 {
  font-size: 1.25rem; /* Preserved from original */
  margin-bottom: var(--spacing-sm);
}

h5 {
  font-size: 1rem; /* Preserved from original */
  margin-bottom: var(--spacing-md);
  color: var(--secondary-color);
}

p {
  margin-bottom: var(--spacing-md);
  color: var(--light-text); /* Adjusted for better contrast */
}

a {
  color: var(--primary-color);
  text-decoration: none;
  transition: color 0.2s ease;
}

/* Enhancement: Better hover states while preserving original styling */
a:hover, a:focus {
  color: var(--primary-hover);
  text-decoration: underline;
}

/* Buttons - preserving original with accessibility enhancements */
.primary-button {
  background-color: var(--primary-color);
  color: white;
  padding: 0.75rem 1.5rem; /* Preserved from original */
  border-radius: var(--border-radius);
  border: none;
  font-weight: 500;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.1s ease;
  box-shadow: var(--shadow-sm);
}

.primary-button:hover {
  background-color: var(--primary-hover);
}

/* Enhancement: Better focus states */
.primary-button:focus {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

.primary-button:active {
  transform: translateY(1px);
}

/* Header - preserving original structure */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-lg) 0;
  border-bottom: 1px solid var(--border-color);
}

.logo h1 {
  font-size: 1.5rem;
  margin-bottom: 0;
}

.main-nav ul {
  display: flex;
  list-style: none;
  gap: var(--spacing-lg);
}

.main-nav a {
  color: var(--light-text);
  font-weight: 500;
}

.main-nav a.active {
  color: var(--primary-color);
}

/* Hero Section - preserving original layout */
.hero {
  display: flex;
  align-items: center;
  padding: var(--spacing-xl) 0;
  gap: var(--spacing-xl);
}

.hero-content {
  flex: 1;
}

.hero-content h2 {
  font-size: 2.5rem; /* Preserved from original */
  margin-bottom: var(--spacing-md);
}

.hero-content p {
  font-size: 1.125rem; /* Preserved from original */
  margin-bottom: var(--spacing-lg);
}

.hero-image {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

.image-placeholder {
  width: 100%;
  height: 300px; /* Preserved from original */
  background-color: #e5e7eb;
  border-radius: var(--border-radius);
  border: 1px solid var(--border-color);
}

/* Features Section - preserving original with minor improvements */
.features {
  padding: var(--spacing-xl) 0;
  background-color: var(--light-bg);
}

.feature-cards {
  display: flex;
  gap: var(--spacing-lg);
  justify-content: space-between;
}

.feature-card {
  flex: 1;
  background-color: var(--background);
  padding: var(--spacing-lg);
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-md);
  transition: transform 0.2s ease;
}

/* Enhancement: Subtle hover effect */
.feature-card:hover {
  transform: translateY(-2px); /* More subtle than original */
}

.feature-icon {
  font-size: 1.5rem;
  color: var(--primary-color);
  margin-bottom: var(--spacing-md);
}

/* Footer - preserving original structure */
footer {
  background-color: var(--light-bg);
  padding: var(--spacing-xl) 0;
  margin-top: var(--spacing-xl);
}

.footer-links {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--spacing-xl);
}

.footer-column ul {
  list-style: none;
}

.footer-column li {
  margin-bottom: var(--spacing-sm);
}

.footer-column a {
  color: var(--light-text);
  font-size: 0.875rem; /* Preserved from original */
}

.footer-bottom {
  text-align: center;
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--border-color);
  color: var(--light-text);
  font-size: 0.875rem;
}

/* Accessibility Enhancements */
:focus {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

/* High contrast focus for keyboard navigation */
:focus-visible {
  outline: 3px solid var(--primary-color);
  outline-offset: 3px;
}`,
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
    // Process linked insights if available - research notes get the highest priority
    let insightsPrompt = '';
    if (linkedInsights && linkedInsights.length > 0) {
      // Separate research notes from other insights
      const researchNotes = linkedInsights.filter(insight => insight.type === 'research_notes');
      const otherInsights = linkedInsights.filter(insight => insight.type !== 'research_notes');
      
      if (researchNotes.length > 0) {
        insightsPrompt = '\n\n🎯 CRITICAL USER RESEARCH INSIGHTS (HIGHEST PRIORITY):\n';
        insightsPrompt += 'These are actual user research findings that MUST guide your design improvements:\n\n';
        researchNotes.forEach((insight, index) => {
          const content = insight.content || insight.summary || 'No content';
          insightsPrompt += `📝 Research Note ${index + 1}:\n${content}\n\n`;
        });
        insightsPrompt += '⚠️ IMPORTANT: These research insights should be your PRIMARY guide for design improvements. ';
        insightsPrompt += 'Address these user needs and pain points before considering any other changes.\n';
      }
      
      if (otherInsights.length > 0) {
        insightsPrompt += '\n\nAdditional user insights to consider:\n';
        otherInsights.forEach((insight, index) => {
          const summary = insight.summary || (insight.content ? insight.content.substring(0, 200) + '...' : 'No content');
          insightsPrompt += `${index + 1}. ${summary}\n`;
        });
      }
    }
    
    // Add the user prompt if provided - but with lower priority than research notes
    const userPromptContent = userPrompt ? `\n\nAdditional user requirements to consider (secondary priority):\n${userPrompt}\n\nApply these requirements only if they don't conflict with the research insights above.` : '';
    
    const requestBody = {
      model: 'gpt-4.1',
      messages: [
        {
          role: 'system',
          content: `You are a top-tier UI/UX designer with exceptional pixel-perfect reproduction skills and deep expertise in design analysis and improvement. Your task is to analyze a design image, provide detailed feedback on its strengths and weaknesses, and create an ITERATIVE HTML/CSS version that addresses those issues while MAINTAINING THE ORIGINAL DESIGN'S EXACT VISUAL STYLE.

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
          The generated HTML/CSS MUST match the EXACT dimensions of the original design, which is ${dimensions.width}px width by ${dimensions.height}px height. All elements must be properly positioned and sized to match the original layout's scale and proportions.
          
          CSS REQUIREMENTS:
          1. Use CSS Grid and Flexbox for layouts that need to be responsive
          2. Use absolute positioning for pixel-perfect placement when needed
          3. Include CSS variables for colors, spacing, and typography - USING THE EXACT VALUES from the original design
          4. Ensure clean, well-organized CSS with descriptive class names
          5. Include detailed comments in CSS explaining design decisions
          6. Avoid arbitrary magic numbers - document any precise pixel measurements
          
          ICON REQUIREMENTS:
          For any icons identified in the UI:
          1. Use Font Awesome icons that EXACTLY match the original icons (via CDN: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css")
          2. If no perfect Font Awesome match exists, create the icon using CSS
          3. Ensure icon sizing and positioning exactly matches the original
          4. Apply the EXACT SAME colors from the original design to the icons
          
          IMAGE REQUIREMENTS:
          For any images identified in the original design:
          1. DO NOT use any external image URLs, placeholders, or Unsplash images
          2. Instead, replace each image with a simple colored div (rectangle or square)
          3. Use a background color that makes sense in the context (gray, light blue, etc.)
          4. Maintain the exact same dimensions, positioning, and styling (borders, etc.) as the original image
          5. Add a subtle 1px border to the div to indicate it's an image placeholder
          6. You can add a simple CSS pattern or gradient if appropriate
          
          OUTPUT FORMAT:
          Your response MUST be structured as follows:
          
          1. DESIGN SYSTEM:
             Document the extracted design system in detail (colors, typography, components)
          
          2. ANALYSIS:
             Provide a detailed analysis of the design's strengths and weaknesses, organized by category (visual hierarchy, color contrast, etc.)
          
          3. HTML CODE:
             Provide the complete HTML code for the improved design between \`\`\`html\`\`\` tags
          
          4. CSS CODE:
             Provide the complete CSS code for the improved design between \`\`\`css\`\`\` tags
          
          5. IMPROVEMENTS SUMMARY:
             List the specific improvements made to the design and explain the rationale behind each one
          ${insightsPrompt}${userPromptContent}`
        },
        {
          role: 'user',
          content: [{
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${base64Image}`
            }
          }]
        }
      ],
      max_tokens: 4000
    };
    
    console.log('Sending request to OpenAI API for design analysis...');
    
    // Since direct fetch may face CORS issues in browser environment, use a proxy 
    // or fallback to server-side processing if needed
    let openaiResponse;
    
    try {
      // First try direct API call
      openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });
    } catch (error: any) {
      console.error('Direct OpenAI API call failed, error details:', error);
      
      // In production, never use fallback
      if (this.isProductionEnvironment()) {
        throw new Error(`OpenAI API call failed: ${error.message}. Please check your API key and try again.`);
      }
      
      // Only use fallback during development
      if (this.isDevEnvironment()) {
        console.log('Development environment detected, using fallback response for testing');
        return this.getFallbackAnalysisResponse(dimensions);
      }
      
      // Default behavior for unknown environments - throw the error
      throw new Error(`OpenAI API call failed: ${error.message}. Please check your API key and try again.`);
    }
    
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
    const responseContent = data.choices[0]?.message?.content || '';
    
    console.log('Received OpenAI API response, content length:', responseContent.length);
    
    // Process the response
    return this.parseOpenAIResponse(responseContent, linkedInsights.length > 0, userPrompt);
  }

  // Public method to parse a raw response and extract HTML/CSS
  parseRawResponse(response: string): { htmlCode: string; cssCode: string } {
    console.log('Parsing raw response for reload...');
    
    try {
      // Initialize result with empty strings
      const result = {
        htmlCode: '',
        cssCode: ''
      };
      
      // Extract HTML code with flexible pattern matching - improved patterns
      const htmlRegexPatterns = [
        /```html\s*\n([\s\S]*?)```/,       // Standard format with newline
        /```html\s+([\s\S]*?)```/,         // Without newline after 'html'
        /```html([\s\S]*?)```/,            // No space after 'html'
        /<html>([\s\S]*?)<\/html>/,        // Directly wrapped in html tags
        /```\s*<html>([\s\S]*?)<\/html>\s*```/, // Code block with HTML tags
        /```([\s\S]*?)<\/html>\s*```/,     // Code block with HTML ending tag
        /<!DOCTYPE html>([\s\S]*?)<\/html>/ // Full HTML document
      ];
      
      // Try each HTML pattern
      for (const pattern of htmlRegexPatterns) {
        const match = response.match(pattern);
        if (match) {
          // For patterns that capture the content inside the tags
          if (match[1]) {
            result.htmlCode = match[1].trim();
          } else {
            // For patterns that capture the full HTML including tags
            result.htmlCode = match[0].trim();
          }
          
          // If we found HTML, break out of the loop
          if (result.htmlCode) {
            console.log('HTML extracted using pattern:', pattern.source);
            break;
          }
        }
      }
      
      // If we still couldn't extract HTML but <!DOCTYPE html> exists, try a more manual approach
      if (!result.htmlCode && response.includes('<!DOCTYPE html>')) {
        const docTypeIndex = response.indexOf('<!DOCTYPE html>');
        const endIndex = response.indexOf('</html>', docTypeIndex);
        if (endIndex > docTypeIndex) {
          result.htmlCode = response.substring(docTypeIndex, endIndex + 7).trim();
          console.log('HTML extracted using manual DOCTYPE search');
        }
      }
      
      // If still no HTML, try to find any HTML-like content
      if (!result.htmlCode) {
        // Look for any content between <html> and </html> tags
        const basicHtmlMatch = response.match(/<html[\s\S]*?<\/html>/);
        if (basicHtmlMatch) {
          result.htmlCode = basicHtmlMatch[0].trim();
          console.log('HTML extracted using basic HTML tag search');
        }
      }
      
      // Extract CSS code with flexible pattern matching - improved patterns
      const cssRegexPatterns = [
        /```css\s*\n([\s\S]*?)```/,        // Standard format with newline
        /```css\s+([\s\S]*?)```/,          // Without newline after 'css'
        /```css([\s\S]*?)```/,             // No space after 'css'
        /<style>([\s\S]*?)<\/style>/,      // Directly wrapped in style tags
        /```\s*<style>([\s\S]*?)<\/style>\s*```/, // Code block with style tags
        /## \d+\. CSS CODE\s*```css\s*\n([\s\S]*?)```/  // Specifically for the format in user's response
      ];
      
      // Try each CSS pattern
      for (const pattern of cssRegexPatterns) {
        const match = response.match(pattern);
        if (match && match[1]) {
          result.cssCode = match[1].trim();
          console.log('CSS extracted using pattern:', pattern.source);
          break;
        }
      }
      
      // If no full match found but there are style tags
      if (!result.cssCode && response.includes('style>')) {
        const styleIndex = response.indexOf('<style>');
        const endIndex = response.indexOf('</style>', styleIndex);
        if (endIndex > styleIndex && styleIndex !== -1) {
          result.cssCode = response.substring(styleIndex + 7, endIndex).trim();
          console.log('CSS extracted using manual style tag search');
        }
      }
      
      // If still no CSS found, try to extract it using section headers
      if (!result.cssCode) {
        // Look for CSS section with various possible headers
        const cssSectionPatterns = [
          /## \d+\.\s*CSS CODE[\s\S]*?```css\s*\n([\s\S]*?)```/,  // Numbered section
          /CSS CODE[\s\S]*?```css\s*\n([\s\S]*?)```/,            // Direct section
          /CSS\s*```\s*\n([\s\S]*?)```/,                         // Simple CSS section
          /:root\s*\{[\s\S]*?\}/                                 // CSS variables block
        ];
        
        for (const pattern of cssSectionPatterns) {
          const match = response.match(pattern);
          if (match) {
            if (match[1]) {
              result.cssCode = match[1].trim();
              console.log('CSS extracted using section pattern:', pattern.source);
              break;
            } else if (match[0] && pattern.source.includes(':root')) {
              // For :root pattern, we want the whole match
              // Find all CSS rules starting from :root
              const rootIndex = response.indexOf(':root');
              if (rootIndex !== -1) {
                // Extract from :root to the end of CSS-like content
                let cssContent = response.substring(rootIndex);
                // Try to find the end of the CSS block
                const endPatterns = [/\n\n---/, /\n\n##/, /\n\n\*\*/];
                for (const endPattern of endPatterns) {
                  const endMatch = cssContent.match(endPattern);
                  if (endMatch) {
                    cssContent = cssContent.substring(0, endMatch.index);
                    break;
                  }
                }
                result.cssCode = cssContent.trim();
                console.log('CSS extracted using :root search');
                break;
              }
            }
          }
        }
      }
      
      // If still no CSS found, try to extract it from the raw text using more general regex
      if (!result.cssCode) {
        // Look for common CSS patterns like declarations and rules
        const cssBlockPattern = /\/\* .*? \*\/|:root\s*{[\s\S]*?}|\.[\w-]+\s*{[\s\S]*?}|[\w-]+\s*{[\s\S]*?}/g;
        const cssBlocks = response.match(cssBlockPattern);
        
        if (cssBlocks && cssBlocks.length > 0) {
          result.cssCode = cssBlocks.join('\n\n');
          console.log('CSS extracted using general pattern matching');
        }
      }
      
      // Fix common issues with extracted CSS
      if (result.cssCode) {
        result.cssCode = this.fixCssIssues(result.cssCode);
      }
      
      // Fix HTML to use inline styles instead of external stylesheets
      if (result.htmlCode && result.cssCode) {
        result.htmlCode = this.fixHtmlStyleReferences(result.htmlCode, result.cssCode);
      }
      
      console.log('Final extraction results:', { 
        htmlFound: !!result.htmlCode, 
        cssFound: !!result.cssCode,
        htmlLength: result.htmlCode?.length || 0,
        cssLength: result.cssCode?.length || 0 
      });
      
      return result;
    } catch (error) {
      console.error('Error parsing raw response:', error);
      return { htmlCode: '', cssCode: '' };
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
}

const openAIService = new OpenAIService();
export default openAIService; 