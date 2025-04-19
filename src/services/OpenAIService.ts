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
      
      // Extract SVG code - improved extraction logic
      console.log('Extracting SVG from response...');
      
      // First attempt: Try to find SVG content with more aggressive pattern matching
      let svgContent = '';
      
      // First try to extract SVG from code blocks
      const codeBlockMatch = response.match(/```(?:svg|html)?\s*([\s\S]*?<svg[\s\S]*?<\/svg>)[\s\S]*?```/i);
      if (codeBlockMatch && codeBlockMatch[1]) {
        svgContent = codeBlockMatch[1].trim();
        console.log('Found SVG in code block with length:', svgContent.length);
      }
      
      // If no match, look for SVG tags directly
      if (!svgContent || !svgContent.includes('<svg')) {
        const svgTagMatch = response.match(/<svg[^>]*>[\s\S]*?<\/svg>/);
        if (svgTagMatch) {
          svgContent = svgTagMatch[0].trim();
          console.log('Found direct SVG tag with length:', svgContent.length);
        }
      }
      
      // If still no match, try looking in sections with SVG: or SVG CODE: labels
      if (!svgContent || !svgContent.includes('<svg')) {
        const svgSectionMatch = response.match(/(?:SVG(?:\s*CODE)?:)\s*([\s\S]*?)(?=\n\n(?:\d+\.|\#|IMPROVEMENTS|$))/i);
        if (svgSectionMatch && svgSectionMatch[1]) {
          const sectionContent = svgSectionMatch[1].trim();
          const svgInSectionMatch = sectionContent.match(/<svg[\s\S]*?<\/svg>/);
          if (svgInSectionMatch) {
            svgContent = svgInSectionMatch[0].trim();
            console.log('Found SVG in labeled section with length:', svgContent.length);
          }
        }
      }
      
      // Last resort - scan the entire response for the longest SVG tag content
      if (!svgContent || !svgContent.includes('<svg')) {
        console.log('No SVG found with direct pattern matching, trying full response scan...');
        const allSvgTags = Array.from(response.matchAll(/<svg[\s\S]*?<\/svg>/g)).map(m => m[0]);
        
        if (allSvgTags.length > 0) {
          // Use the longest SVG content found
          svgContent = allSvgTags.reduce((longest, current) => 
            current.length > longest.length ? current : longest, allSvgTags[0]);
          console.log('Found SVG in full scan with length:', svgContent.length);
        }
      }
      
      // If we have SVG content, clean it up
      if (svgContent && svgContent.includes('<svg')) {
        // Remove code block markers if present
        svgContent = svgContent.replace(/```svg\n?|```/g, '').trim();
        
        // Make sure SVG content begins with <svg
        const svgTagStart = svgContent.indexOf('<svg');
        if (svgTagStart > 0) {
          svgContent = svgContent.substring(svgTagStart);
          console.log('Trimmed content before <svg> tag');
        }
        
        // Make sure SVG content ends with </svg>
        const svgTagEnd = svgContent.lastIndexOf('</svg>');
        if (svgTagEnd > 0 && svgTagEnd + 6 < svgContent.length) {
          svgContent = svgContent.substring(0, svgTagEnd + 6);
          console.log('Trimmed content after </svg> tag');
        }
        
        // Add xmlns attribute if missing
        if (!svgContent.includes('xmlns=')) {
          svgContent = svgContent.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
          console.log('Added missing xmlns attribute');
        }
        
        // Make sure we have proper viewBox and dimensions
        if (!svgContent.includes('viewBox=')) {
          const widthMatch = svgContent.match(/width=["']([^"']+)["']/);
          const heightMatch = svgContent.match(/height=["']([^"']+)["']/);
          
          if (widthMatch && heightMatch) {
            const width = widthMatch[1].replace('px', '');
            const height = heightMatch[1].replace('px', '');
            svgContent = svgContent.replace('<svg', `<svg viewBox="0 0 ${width} ${height}"`);
            console.log('Added viewBox attribute based on dimensions');
          }
        }
        
        // Enhanced SVG cleaning for critical tag structure issues
        svgContent = this.fixSvgStructure(svgContent);
        
        // Validate with DOMParser
        try {
          const parser = new DOMParser();
          const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
          const parserError = svgDoc.querySelector('parsererror');
          
          if (parserError) {
            console.warn('SVG parsing error detected, applying aggressive repair');
            
            const errorText = parserError.textContent || '';
            console.warn('SVG parsing error:', errorText);
            
            // Try more aggressive fixes based on common error patterns
            if (errorText.includes('tag mismatch')) {
              svgContent = this.repairTagMismatch(svgContent, errorText);
              console.log('Applied tag mismatch repairs');
            }
            
            // Force self-closing tags for elements that should be self-closing
            svgContent = this.forceSelfClosingTags(svgContent);
            console.log('Applied self-closing tag fixes');
            
            // Validate the fixes
            const fixedDoc = parser.parseFromString(svgContent, 'image/svg+xml');
            if (fixedDoc.querySelector('parsererror')) {
              // If still broken, use the fallback SVG
              console.error('SVG still has parsing errors after repairs, will use fallback');
              svgContent = '';
            } else {
              console.log('SVG successfully repaired!');
            }
          }
        } catch (parseError) {
          console.warn('SVG validation error:', parseError);
        }
      }
      
      // Add fallback for SVG content if extraction failed
      if (!svgContent || svgContent.length < 50 || !svgContent.includes('<svg')) {
        console.error('FAILED TO EXTRACT SVG from response, using fallback');
        
        // Before using generic fallback, check if we can extract any design information
        const colorPalette = this.extractListItems(response, 'Color Palette|Design System Extraction.*?Color[s]?\\s*Palette');
        const colorValues: string[] = [];
        
        // Extract any hex colors from the color palette
        colorPalette.forEach(item => {
          const hexMatches = item.match(/#[0-9A-Fa-f]{3,6}/g);
          if (hexMatches) {
            colorValues.push(...hexMatches);
          }
        });
        
        // Create a more detailed fallback SVG with extracted design info
        if (colorValues.length > 0) {
          const primaryColor = colorValues[0] || '#4A6CF7';
          const backgroundColor = colorValues.find(color => colorPalette.some(item => 
            item.toLowerCase().includes('background') && item.includes(color)
          )) || '#F8F9FA';
          const textColor = colorValues.find(color => colorPalette.some(item => 
            item.toLowerCase().includes('text') && item.includes(color)
          )) || '#1D2939';
          
          svgContent = this.createEnhancedFallbackSvg(backgroundColor, primaryColor, textColor);
        } else {
          // Use generic fallback
          svgContent = this.createBasicSvgFallback({ width: 800, height: 600 });
        }
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
  
  // Helper method to fix SVG structure
  private fixSvgStructure(svg: string): string {
    let fixedSvg = svg;
    
    // Fix unclosed tags
    const selfClosingElements = ['rect', 'circle', 'ellipse', 'line', 'path', 'polygon', 'polyline', 'image', 'use'];
    
    // First convert non-self-closing empty tags to self-closing
    selfClosingElements.forEach(tagName => {
      const emptyTagPattern = new RegExp(`<${tagName}([^>]*)></\\s*${tagName}\\s*>`, 'g');
      fixedSvg = fixedSvg.replace(emptyTagPattern, `<${tagName}$1/>`);
      console.log(`Fixed empty ${tagName} tags`);
      
      // Then ensure proper handling of tags that should be self-closing but aren't
      const nonClosedPattern = new RegExp(`<${tagName}([^/>][^>]*)>(?![\\s\\S]*?</${tagName}>)`, 'g');
      if (fixedSvg.match(nonClosedPattern)) {
        fixedSvg = fixedSvg.replace(nonClosedPattern, `<${tagName}$1/>`);
        console.log(`Fixed unclosed ${tagName} tag`);
      }
    });
    
    // Fix rect tags with missing closing tags
    if (fixedSvg.includes('<rect') && !fixedSvg.includes('</rect>') && !fixedSvg.includes('/>')) {
      fixedSvg = fixedSvg.replace(/<rect([^>]*[^\/])>/g, '<rect$1/>');
      console.log('Fixed unclosed rect tag');
    }
    
    // Fix g tags that are opened but never closed
    const gTagPattern = /<g[^>]*>(?![\\s\\S]*?<\\/g>)/g;
    const gTagsCount = (fixedSvg.match(/<g/g) || []).length;
    const gCloseTagsCount = (fixedSvg.match(/<\\/g>/g) || []).length;
    
    if (gTagsCount > gCloseTagsCount) {
      fixedSvg = fixedSvg.replace('</svg>', '</g></svg>'.repeat(gTagsCount - gCloseTagsCount));
      console.log(`Fixed unclosed g tag by adding ${gTagsCount - gCloseTagsCount} closing tags`);
    }
    
    // Fix CDATA sections in style elements
    if (fixedSvg.includes('<style>') && !fixedSvg.includes('CDATA') && fixedSvg.includes('{')) {
      fixedSvg = fixedSvg.replace(/<style>([\s\S]*?)<\/style>/g, '<style><![CDATA[$1]]></style>');
      console.log('Added CDATA to style tag');
    }
    
    // Fix missing style closing tag
    if (fixedSvg.includes('<style>') && !fixedSvg.includes('</style>')) {
      fixedSvg = fixedSvg.replace('<style>', '<style><![CDATA[').replace('</svg>', ']]></style></svg>');
      console.log('Fixed missing style closing tag');
    }
    
    return fixedSvg;
  }
  
  // Helper to repair tag mismatch errors with specific context of the error
  private repairTagMismatch(svg: string, errorText: string): string {
    let fixedSvg = svg;
    
    // Extract the specific tag mismatch information
    const tagMismatchMatch = errorText.match(/tag mismatch: ([^.]+)/);
    if (tagMismatchMatch) {
      const mismatchInfo = tagMismatchMatch[1].trim();
      console.log(`Detailed tag mismatch: "${mismatchInfo}"`);
      
      // Common tag mismatch patterns and their fixes
      if (mismatchInfo.includes('svg') && mismatchInfo.includes('rect')) {
        // SVG ending in a rect tag issue - make rect self-closing
        fixedSvg = fixedSvg.replace(/<rect([^>]*?)>([^<]*?)<\/svg>/g, '<rect$1/>$2</svg>');
        console.log('Fixed rect-svg tag mismatch');
      }
      
      if (mismatchInfo.includes('svg') && mismatchInfo.includes('g')) {
        // SVG ending in a g tag issue - add closing g tag
        fixedSvg = fixedSvg.replace(/<\/svg>/g, '</g></svg>');
        console.log('Fixed g-svg tag mismatch');
      }
      
      // Match tags mentioned in the error and try to fix them
      const tags = mismatchInfo.match(/[a-zA-Z]+/g) || [];
      if (tags.length >= 2) {
        const firstTag = tags[0];
        const secondTag = tags[1];
        
        if (firstTag && secondTag && firstTag !== 'line' && secondTag !== 'line') {
          // Check if first tag appears without closing before second tag appears
          const tagRegex = new RegExp(`<${firstTag}([^>]*)>([^<]*)<${secondTag}`, 'g');
          const matches = fixedSvg.match(tagRegex);
          
          if (matches) {
            // Fix by making first tag self-closing or adding missing closing tag
            if (['rect', 'circle', 'path', 'line', 'polygon', 'polyline', 'ellipse'].includes(firstTag)) {
              fixedSvg = fixedSvg.replace(tagRegex, `<${firstTag}$1/>$2<${secondTag}`);
              console.log(`Fixed ${firstTag}-${secondTag} tag mismatch by making ${firstTag} self-closing`);
            } else {
              fixedSvg = fixedSvg.replace(tagRegex, `<${firstTag}$1>$2</${firstTag}><${secondTag}`);
              console.log(`Fixed ${firstTag}-${secondTag} tag mismatch by adding closing tag`);
            }
          }
        }
      }
    }
    
    return fixedSvg;
  }
  
  // Helper to force self-closing tags for elements that should be self-closing
  private forceSelfClosingTags(svg: string): string {
    let fixedSvg = svg;
    const selfClosingElements = ['rect', 'circle', 'ellipse', 'line', 'path', 'polygon', 'polyline', 'image', 'use'];
    
    selfClosingElements.forEach(tagName => {
      // Pattern to find non-self-closing tags that should be
      const pattern = new RegExp(`<${tagName}([^>]*[^/])>(?![\\s\\S]*?</${tagName}>)`, 'g');
      fixedSvg = fixedSvg.replace(pattern, `<${tagName}$1/>`);
      
      // Also fix any improperly closed tags
      const badClosingPattern = new RegExp(`<${tagName}([^>]*)>\\s*</${tagName}>`, 'g');
      fixedSvg = fixedSvg.replace(badClosingPattern, `<${tagName}$1/>`);
    });
    
    return fixedSvg;
  }
  
  // Create a more visually appealing fallback SVG that shows an improved design
  private createEnhancedFallbackSvg(bgColor: string, primaryColor: string, textColor: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <defs>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;display=swap');
          
          text {
            font-family: 'Inter', sans-serif;
          }
          
          .heading {
            font-weight: 600;
            fill: ${textColor};
          }
          
          .body-text {
            font-size: 14px;
            fill: ${textColor}99;
          }
          
          .primary-button {
            fill: ${primaryColor};
            stroke: none;
          }
          
          .primary-button-text {
            fill: white;
            font-size: 14px;
            font-weight: 500;
            text-anchor: middle;
            dominant-baseline: middle;
          }
          
          .error-message {
            font-size: 16px;
            font-weight: 500;
            fill: #e53e3e;
            text-anchor: middle;
          }
          
          .card {
            fill: #fff;
            stroke: #e2e8f0;
            stroke-width: 1;
          }
        </style>
      </defs>
      
      <!-- Background -->
      <rect width="100%" height="100%" fill="${bgColor}" />
      
      <!-- Main content area -->
      <rect x="50" y="50" width="700" height="500" rx="8" class="card" />
      
      <!-- Header -->
      <text x="400" y="100" text-anchor="middle" class="heading" font-size="24">Design Iteration Preview</text>
      <text x="400" y="130" text-anchor="middle" class="body-text">Based on extracted design system</text>
      
      <!-- Extracted colors -->
      <g transform="translate(200, 180)">
        <text x="0" y="0" class="heading" font-size="16">Extracted Color Palette</text>
        <rect x="0" y="20" width="40" height="40" rx="4" fill="${primaryColor}" />
        <rect x="50" y="20" width="40" height="40" rx="4" fill="${textColor}" />
        <rect x="100" y="20" width="40" height="40" rx="4" fill="${bgColor}" />
        <rect x="150" y="20" width="40" height="40" rx="4" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" />
      </g>
      
      <!-- UI Component Samples -->
      <g transform="translate(200, 280)">
        <text x="0" y="0" class="heading" font-size="16">UI Components</text>
        
        <!-- Button -->
        <rect x="0" y="20" width="120" height="40" rx="6" class="primary-button" />
        <text x="60" y="40" class="primary-button-text">Primary Button</text>
        
        <!-- Input field -->
        <rect x="140" y="20" width="180" height="40" rx="6" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" />
        <text x="150" y="40" fill="${textColor}80" font-size="14">Input field</text>
        
        <!-- Toggle -->
        <rect x="340" y="20" width="60" height="30" rx="15" fill="${primaryColor}" />
        <circle cx="380" cy="35" r="10" fill="#ffffff" />
      </g>
      
      <!-- Error message -->
      <g transform="translate(400, 400)">
        <text x="0" y="0" class="error-message" text-anchor="middle">SVG Rendering Issue</text>
        <text x="0" y="30" class="body-text" text-anchor="middle">This is a placeholder showing the extracted design system.</text>
        <text x="0" y="50" class="body-text" text-anchor="middle">Try generating again with your design.</text>
      </g>
      
      <!-- Action button -->
      <g transform="translate(400, 480)">
        <rect x="-75" y="-20" width="150" height="40" rx="6" class="primary-button" />
        <text x="0" y="5" class="primary-button-text">Try Again</text>
      </g>
    </svg>`;
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