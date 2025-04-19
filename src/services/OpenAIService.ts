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
  };
  svgContent: string;
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
      // Get image dimensions first
      const dimensions = await this.getImageDimensions(imageUrl);
      
      // Initialize base64Image
      let base64Image = '';
      
      // If it's already a data URL, extract the base64 part
      if (imageUrl.startsWith('data:image')) {
        base64Image = imageUrl.split(',')[1];
      } else {
        // For all images (including Figma), use the canvas approach directly
        console.log('Converting image to data URL');
        const dataUrl = await this.createDataUrlFromImage(imageUrl);
        
        if (dataUrl) {
          base64Image = dataUrl.split(',')[1];
        } else {
          throw new Error('Failed to create data URL from image');
        }
      }
      
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
            content: `You are a top-tier UI/UX designer with exceptional pixel-perfect reproduction skills and deep expertise in design analysis and improvement. Your task is to analyze a design image, provide detailed feedback on its strengths and weaknesses, and create an ITERATIVE SVG VERSION that addresses those issues while MAINTAINING THE ORIGINAL DESIGN'S EXACT VISUAL STYLE.

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
            The generated SVG MUST match the EXACT dimensions of the original design, which is ${dimensions.width}px width by ${dimensions.height}px height. All elements must be properly positioned and sized to match the original layout's scale and proportions.
            
            SVG REQUIREMENTS:
            1. Create a SINGLE, self-contained SVG that includes all styling within the SVG markup
            2. Use proper SVG structure with all necessary elements (rect, circle, path, text, etc.)
            3. Include proper grouping with <g> elements for logical content organization
            4. Use CSS within the SVG for styling (either inline or in a <style> element)
            5. Handle text properly with <text> elements, preserving all font properties
            6. Create clean, optimized SVG without unnecessary elements or attributes
            7. Ensure the SVG viewBox is set correctly to match the design dimensions
            8. Include descriptions for accessibility where appropriate
            9. Use SVG filters for effects like shadows, gradients, etc. where needed
           10. Make sure the SVG validates with no errors
            
            FONT REQUIREMENTS:
            For typography:
            1. Use web-safe fonts or specify fallbacks using font-family
            2. Include <defs> section with @font-face declarations if needed
            3. Ensure text is selectable and accessible in the SVG
            4. Apply appropriate font-size, font-weight, and other typography properties
            
            IMAGE PLACEHOLDERS:
            For any images in the original design:
            1. Replace with <rect> elements with appropriate dimensions and styling
            2. Use a background-color that makes sense in context
            3. Add a subtle stroke (border) to indicate it's an image placeholder
            
            ICON REQUIREMENTS:
            For icons:
            1. Use SVG path data to recreate icons accurately
            2. For simple icons, create them directly with SVG shapes
            3. Apply the EXACT SAME colors from the original design
            
            OUTPUT FORMAT INSTRUCTIONS (IMPORTANT):
            Your response MUST be structured as follows:
            
            1. DESIGN SYSTEM:
               Document the extracted design system in detail (colors, typography, components)
            
            2. ANALYSIS:
               Provide a detailed analysis of the design's strengths and weaknesses, organized by category (visual hierarchy, color contrast, etc.)
            
            3. SVG CODE:
               Provide the complete SVG markup for the improved design, wrapped between triple backticks like this:
               \`\`\`svg
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 width height">
               ...your SVG code here...
               </svg>
               \`\`\`
               Make sure the SVG is complete, valid, and self-contained. All styling should be included within the SVG.
            
            4. IMPROVEMENTS SUMMARY:
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
      
      // Call OpenAI API directly
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
      
      // Parse the response to extract SVG and analysis
      return this.parseOpenAIResponse(responseContent, linkedInsights.length > 0);
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
  
  // Helper to create a basic SVG fallback when needed
  private createBasicSvgFallback(dimensions: {width: number, height: number}): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimensions.width} ${dimensions.height}" width="${dimensions.width}" height="${dimensions.height}">
      <defs>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&amp;display=swap');
          text { font-family: 'Inter', sans-serif; }
        </style>
      </defs>
      <rect width="100%" height="100%" fill="#f8f9fa" />
      <g transform="translate(${dimensions.width/2}, ${dimensions.height/2})">
        <text x="0" y="-20" text-anchor="middle" font-size="16" fill="#6c757d">SVG Rendering Failed</text>
        <text x="0" y="10" text-anchor="middle" font-size="14" fill="#6c757d">Please try again or check console for errors</text>
      </g>
    </svg>`;
  }
  
  // Parse the OpenAI response to extract SVG and analysis
  private parseOpenAIResponse(response: string, hasUserInsights: boolean = false): DesignAnalysisResponse {
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
          }
        },
        svgContent: '',
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
      
      // Extract SVG code between ```svg and ``` tags with more flexible pattern matching
      const svgRegexPatterns = [
        /```svg\n([\s\S]*?)```/,       // Standard format
        /```svg\s+([\s\S]*?)```/,      // Without newline after 'svg'
        /<svg[\s\S]*?<\/svg>/,         // Direct SVG tags
        /```\n<svg[\s\S]*?<\/svg>\n```/, // Code block with SVG tags
        /```([\s\S]*?)<\/svg>\n```/    // Code block with SVG ending tag
      ];
      
      let svgContent = '';
      for (const pattern of svgRegexPatterns) {
        const match = response.match(pattern);
        if (match && match[0]) {
          // Extract either the group or the entire match depending on the pattern
          svgContent = match[1] ? match[1].trim() : match[0].trim();
          
          // If the extracted content doesn't start with <svg, but we have a match, then it's the entire match
          if (!svgContent.startsWith('<svg') && match[0].includes('<svg')) {
            svgContent = match[0].replace(/```svg\n?|```/g, '').trim();
          }
          
          break;
        }
      }
      
      // Clean up the SVG if needed (remove code block markers)
      svgContent = svgContent.replace(/```svg\n?|```/g, '').trim();
      
      // Ensure the SVG content has the correct opening tag
      if (!svgContent.startsWith('<svg')) {
        // Try to find the start of the SVG tag in the response
        const svgStartIndex = response.indexOf('<svg');
        const svgEndIndex = response.indexOf('</svg>');
        
        if (svgStartIndex !== -1 && svgEndIndex !== -1) {
          svgContent = response.substring(svgStartIndex, svgEndIndex + 6); // +6 to include </svg>
        }
      }
      
      // Add fallback for SVG content if extraction failed
      if (!svgContent || svgContent.length < 10) {
        console.error('FAILED TO EXTRACT SVG from response, using fallback');
        svgContent = this.createBasicSvgFallback({ width: 800, height: 600 });
      }
      
      result.svgContent = svgContent;
      
      // Log success or failure of SVG extraction
      if (svgContent && svgContent.length > 0) {
        console.log('Successfully extracted SVG, length:', svgContent.length);
        console.log('SVG preview:', svgContent.substring(0, 100) + '...');
      } else {
        console.error('FAILED TO EXTRACT SVG from response');
      }
      
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
      
      // Extract colors from SVG style elements or inline styles
      if (svgContent) {
        // Extract color values from style elements
        const styleColors = svgContent.match(/(?:fill|stroke|color|background|stop-color):\s*(#[0-9A-Fa-f]{3,8}|rgba?\([^)]+\))/g) || [];
        const uniqueColors = Array.from(new Set(styleColors.map(c => {
          const match = c.match(/(#[0-9A-Fa-f]{3,8}|rgba?\([^)]+\))/);
          return match ? match[1] : '';
        }).filter(Boolean)));
        
        // Organize colors into categories based on frequency and context
        if (uniqueColors.length > 0) {
          result.metadata.colors.primary = uniqueColors.slice(0, Math.min(3, uniqueColors.length));
          
          if (uniqueColors.length > 3) {
            result.metadata.colors.secondary = uniqueColors.slice(3, Math.min(6, uniqueColors.length));
          }
          
          if (uniqueColors.length > 6) {
            result.metadata.colors.background = uniqueColors.slice(6, Math.min(9, uniqueColors.length));
          }
          
          if (uniqueColors.length > 9) {
            result.metadata.colors.text = uniqueColors.slice(9, Math.min(12, uniqueColors.length));
          }
        }
        
        // Extract fonts from SVG
        const fontFamilies = svgContent.match(/font-family:\s*([^;>"']+)/g) || [];
        result.metadata.fonts = fontFamilies
          .map(f => {
            const match = f.match(/font-family:\s*([^;>"']+)/);
            return match ? match[1].trim() : '';
          })
          .filter(Boolean)
          .filter((f, i, self) => self.indexOf(f) === i); // Unique values only
      }
      
      // Fallback for extracting colors from the analysis text if SVG extraction failed
      if (result.metadata.colors.primary.length === 0) {
        result.metadata.colors.primary = this.extractColors(response, 'Primary');
        result.metadata.colors.secondary = this.extractColors(response, 'Secondary');
        result.metadata.colors.background = this.extractColors(response, 'Background');
        result.metadata.colors.text = this.extractColors(response, 'Text');
      }
      
      // Extract fonts from the text if SVG extraction failed
      if (result.metadata.fonts.length === 0) {
        result.metadata.fonts = this.extractListItems(response, 'Fonts|Typography');
      }
      
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
        }
      },
      svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimensions.width} ${dimensions.height}" width="${dimensions.width}" height="${dimensions.height}">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&amp;family=Plus+Jakarta+Sans:wght@400;500;600;700&amp;display=swap');
      
      .header {
        font-family: 'Plus Jakarta Sans', sans-serif;
      }
      
      .body-text {
        font-family: 'Inter', sans-serif;
        font-size: 16px;
        line-height: 1.5;
        fill: #4B5563;
      }
      
      .heading {
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-weight: 600;
        fill: #1D2939;
      }
      
      .h1 {
        font-size: 28px;
        font-weight: 700;
      }
      
      .h2 {
        font-size: 24px;
        font-weight: 600;
      }
      
      .h3 {
        font-size: 20px;
        font-weight: 600;
      }
      
      .button {
        cursor: pointer;
      }
      
      .primary-button {
        fill: #4A6CF7;
        stroke: none;
        rx: 8;
        ry: 8;
      }
      
      .primary-button-text {
        fill: white;
        font-family: 'Inter', sans-serif;
        font-weight: 500;
        font-size: 16px;
        text-anchor: middle;
        dominant-baseline: middle;
      }
      
      .secondary-button {
        fill: #EEF1FF;
        stroke: none;
        rx: 8;
        ry: 8;
      }
      
      .secondary-button-text {
        fill: #6F7DEB;
        font-family: 'Inter', sans-serif;
        font-weight: 500;
        font-size: 16px;
        text-anchor: middle;
        dominant-baseline: middle;
      }
      
      .card {
        fill: white;
        stroke: #E5E7EB;
        stroke-width: 1;
        rx: 16;
        ry: 16;
        filter: drop-shadow(0 2px 5px rgba(0,0,0,0.08));
      }
      
      .feature-icon {
        fill: #4A6CF7;
      }
      
      .nav-item {
        font-family: 'Inter', sans-serif;
        font-weight: 500;
        font-size: 16px;
        fill: #6B7280;
      }
      
      .nav-item.active {
        fill: #4A6CF7;
      }
      
      .image-placeholder {
        fill: #F8F9FB;
        stroke: #E5E7EB;
        stroke-width: 1;
        rx: 8;
        ry: 8;
      }
    </style>
    
    <filter id="shadow-sm" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000000" flood-opacity="0.05"/>
    </filter>
    
    <filter id="shadow-md" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.1"/>
    </filter>
  </defs>
  
  <!-- Header -->
  <g class="header" transform="translate(0, 0)">
    <rect width="${dimensions.width}" height="80" fill="white" />
    <text class="heading h1" x="40" y="50">Brand Logo</text>
    
    <!-- Navigation -->
    <g transform="translate(${dimensions.width/2 - 150}, 45)">
      <text class="nav-item active" x="0" y="0">Home</text>
      <text class="nav-item" x="80" y="0">Features</text>
      <text class="nav-item" x="180" y="0">Pricing</text>
      <text class="nav-item" x="260" y="0">About</text>
    </g>
    
    <!-- CTA Button -->
    <g class="button" transform="translate(${dimensions.width - 150}, 30)">
      <rect class="primary-button" width="120" height="40" />
      <text class="primary-button-text" x="60" y="20">Get Started</text>
    </g>
  </g>
  
  <!-- Hero Section -->
  <g transform="translate(40, 100)">
    <text class="heading h2" x="0" y="40">Improved Design With SVG</text>
    <text class="body-text" x="0" y="80" width="400">This is a demonstration of an SVG-based design iteration. It showcases improved readability, better visual hierarchy, and enhanced component design while maintaining the original style.</text>
    
    <g class="button" transform="translate(0, 100)">
      <rect class="primary-button" width="120" height="40" />
      <text class="primary-button-text" x="60" y="20">Try It Now</text>
    </g>
    
    <!-- Hero Image -->
    <rect class="image-placeholder" x="${dimensions.width - 380}" y="0" width="300" height="200" />
  </g>
  
  <!-- Features Section -->
  <g transform="translate(0, 350)">
    <rect width="${dimensions.width}" height="300" fill="#F8F9FB" />
    <text class="heading h3" x="${dimensions.width/2}" y="40" text-anchor="middle">Key Features</text>
    
    <!-- Feature Cards -->
    <g transform="translate(40, 70)">
      <!-- Card 1 -->
      <rect class="card" width="${dimensions.width/3 - 60}" height="180" />
      <circle class="feature-icon" cx="40" cy="40" r="20" />
      <text class="heading" x="40" y="90" text-anchor="middle">Feature 1</text>
      <text class="body-text" x="20" y="120" width="${dimensions.width/3 - 100}">Improved feature with better spacing and contrast.</text>
      
      <!-- Card 2 -->
      <g transform="translate(${dimensions.width/3}, 0)">
        <rect class="card" width="${dimensions.width/3 - 60}" height="180" />
        <circle class="feature-icon" cx="40" cy="40" r="20" />
        <text class="heading" x="40" y="90" text-anchor="middle">Feature 2</text>
        <text class="body-text" x="20" y="120" width="${dimensions.width/3 - 100}">Enhanced component with clear visual hierarchy.</text>
      </g>
      
      <!-- Card 3 -->
      <g transform="translate(${dimensions.width*2/3}, 0)">
        <rect class="card" width="${dimensions.width/3 - 60}" height="180" />
        <circle class="feature-icon" cx="40" cy="40" r="20" />
        <text class="heading" x="40" y="90" text-anchor="middle">Feature 3</text>
        <text class="body-text" x="20" y="120" width="${dimensions.width/3 - 100}">Optimized layout with improved accessibility.</text>
      </g>
    </g>
  </g>
  
  <!-- Footer -->
  <g transform="translate(0, ${dimensions.height - 150})">
    <rect width="${dimensions.width}" height="150" fill="#F8F9FB" />
    
    <!-- Footer Columns -->
    <g transform="translate(40, 30)">
      <!-- Column 1 -->
      <text class="heading" x="0" y="0">Company</text>
      <text class="body-text" x="0" y="30">About Us</text>
      <text class="body-text" x="0" y="55">Careers</text>
      <text class="body-text" x="0" y="80">Contact</text>
      
      <!-- Column 2 -->
      <g transform="translate(${dimensions.width/3}, 0)">
        <text class="heading" x="0" y="0">Resources</text>
        <text class="body-text" x="0" y="30">Blog</text>
        <text class="body-text" x="0" y="55">Documentation</text>
        <text class="body-text" x="0" y="80">Help Center</text>
      </g>
      
      <!-- Column 3 -->
      <g transform="translate(${dimensions.width*2/3}, 0)">
        <text class="heading" x="0" y="0">Legal</text>
        <text class="body-text" x="0" y="30">Privacy</text>
        <text class="body-text" x="0" y="55">Terms</text>
        <text class="body-text" x="0" y="80">Security</text>
      </g>
    </g>
    
    <!-- Copyright -->
    <text class="body-text" x="${dimensions.width/2}" y="130" text-anchor="middle">© 2023 Example Company. All rights reserved.</text>
  </g>
</svg>`,
      metadata: {
        colors: {
          primary: ['#4A6CF7', '#4338CA'],
          secondary: ['#6F7DEB', '#EEF1FF'],
          background: ['#FFFFFF', '#F8F9FB'],
          text: ['#1D2939', '#4B5563', '#6B7280']
        },
        fonts: [
          'Plus Jakarta Sans', 
          'Inter'
        ],
        components: [
          'Navigation Menu',
          'Hero Section',
          'Feature Cards',
          'Primary Button',
          'Secondary Button',
          'Footer',
          'Logo'
        ]
      }
    };
  }

  // Method to create a data URL from an image using canvas
  private async createDataUrlFromImage(imageUrl: string): Promise<string | null> {
    return new Promise((resolve) => {
      const img = new Image();
      // Set crossOrigin to anonymous to handle CORS properly
      img.crossOrigin = 'anonymous';
      
      // Set a more generous timeout to avoid premature failure
      const timeoutId = setTimeout(() => {
        console.log('Image load timed out after 8 seconds, resolving with null');
        resolve(null);
      }, 8000);
      
      img.onload = () => {
        clearTimeout(timeoutId);
        try {
          const canvas = document.createElement('canvas');
          const width = img.naturalWidth || 800;
          const height = img.naturalHeight || 600;
          
          // Log successful dimensions
          console.log(`Successfully loaded image: ${width}x${height}`);
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            
            // Try JPEG first with lower quality for better performance, fallback to PNG if needed
            try {
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
              console.log('Successfully created JPEG data URL');
              resolve(dataUrl);
            } catch (jpegError) {
              console.warn('JPEG conversion failed, trying PNG:', jpegError);
              try {
                const pngDataUrl = canvas.toDataURL('image/png');
                console.log('Successfully created PNG data URL');
                resolve(pngDataUrl);
              } catch (pngError) {
                console.error('All data URL formats failed:', pngError);
                resolve(null);
              }
            }
          } else {
            console.error('Failed to get canvas 2D context');
            resolve(null);
          }
        } catch (error) {
          console.error('Error creating data URL from canvas:', error);
          resolve(null);
        }
      };
      
      img.onerror = (err) => {
        clearTimeout(timeoutId);
        console.error('Error loading image for data URL creation:', err);
        resolve(null);
      };
      
      // Create a properly cache-busted URL
      // This is important to prevent CORS and caching issues
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 10);
      const cacheBuster = `t=${timestamp}&cb=${randomStr}`;
      const separator = imageUrl.includes('?') ? '&' : '?';
      
      // Use the cache-busted URL
      const bustImageUrl = `${imageUrl}${separator}${cacheBuster}`;
      img.src = bustImageUrl;
      
      console.log(`Attempting to load image with URL: ${bustImageUrl.substring(0, 100)}...`);
    });
  }
}

const openAIService = new OpenAIService();
export default openAIService; 