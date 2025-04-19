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
  private debugMode: boolean = false;

  constructor() {
    // Try to get API key from environment
    this.apiKey = process.env.REACT_APP_OPENAI_API_KEY || null;
    
    // If no key in env, check localStorage as fallback
    if (!this.apiKey) {
      this.apiKey = localStorage.getItem('openai_api_key');
    }
    
    // Set debug mode based on environment and localStorage preference
    this.debugMode = 
      process.env.NODE_ENV !== 'production' && 
      (localStorage.getItem('openai_debug_mode') === 'true');
  }
  
  // Toggle debug mode
  toggleDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    localStorage.setItem('openai_debug_mode', String(enabled));
  }
  
  // Debug log that only outputs in debug mode
  private debugLog(message: string, ...args: any[]): void {
    if (this.debugMode) {
      console.log(`[OpenAI] ${message}`, ...args);
    }
  }
  
  // Always log important messages regardless of debug mode
  private log(message: string, ...args: any[]): void {
    console.log(`[OpenAI] ${message}`, ...args);
  }
  
  // Log errors always
  private logError(message: string, ...args: any[]): void {
    console.error(`[OpenAI] ${message}`, ...args);
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
      
      // In production, never use fallback
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
      
      // IMPROVED SVG EXTRACTION LOGIC
      console.log('Extracting SVG from response...');
      
      // More robust SVG content extraction
      let svgContent = '';
      
      // Method 1: Look for SVG in code blocks (most structured approach)
      const svgCodeBlockPattern = /```(?:svg|html)?\s*([\s\S]*?<svg[\s\S]*?<\/svg>)[\s\S]*?```/i;
      const codeBlockMatch = response.match(svgCodeBlockPattern);
      if (codeBlockMatch && codeBlockMatch[1] && codeBlockMatch[1].includes('<svg')) {
        svgContent = codeBlockMatch[1].trim();
        console.log('Method 1: Found SVG in code block, length:', svgContent.length);
      }
      
      // Method 2: Look for complete SVG tags
      if (!svgContent || !svgContent.includes('<svg')) {
        const svgTagPattern = /<svg[\s\S]*?<\/svg>/g;
        const svgMatches = Array.from(response.matchAll(svgTagPattern));
        
        if (svgMatches.length > 0) {
          // Use the longest SVG content found (most likely to be complete)
          svgContent = svgMatches.reduce((longest, current) => 
            current[0].length > longest.length ? current[0] : longest, svgMatches[0][0]);
          console.log('Method 2: Found complete SVG tag, length:', svgContent.length);
        }
      }
      
      // Method 3: Look for SVG content in specific sections
      if (!svgContent || !svgContent.includes('<svg')) {
        const sectionHeaders = [
          'SVG CODE:', 'SVG:', 'SVG CONTENT:', 
          '3. SVG CODE:', '3. SVG CONTENT:', 
          'SVG MARKUP:', '3. SVG MARKUP:'
        ];
        
        for (const header of sectionHeaders) {
          if (svgContent && svgContent.includes('<svg')) break;
          
          const sectionPattern = new RegExp(`${header}\\s*([\\s\\S]*?)(?=\\n\\s*\\n\\s*(?:[0-9]+\\.|#|IMPROVEMENTS|$))`, 'i');
          const sectionMatch = response.match(sectionPattern);
          
          if (sectionMatch && sectionMatch[1]) {
            const sectionContent = sectionMatch[1].trim();
            const svgInSectionMatch = sectionContent.match(/<svg[\s\S]*?<\/svg>/);
            
            if (svgInSectionMatch) {
              svgContent = svgInSectionMatch[0].trim();
              console.log(`Method 3: Found SVG in "${header}" section, length:`, svgContent.length);
              break;
            } else if (sectionContent.includes('<svg')) {
              // If we have <svg> but not a complete tag, try to extract what we can
              const svgStart = sectionContent.indexOf('<svg');
              if (svgStart !== -1) {
                let extractedContent = sectionContent.substring(svgStart);
                // If there's no closing tag, add one
                if (!extractedContent.includes('</svg>')) {
                  extractedContent += '</svg>';
                }
                svgContent = extractedContent;
                console.log(`Method 3b: Extracted partial SVG from "${header}" section, length:`, svgContent.length);
                break;
              }
            }
          }
        }
      }
      
      // Method 4: Scan for SVG content outside of expected structures
      if (!svgContent || !svgContent.includes('<svg')) {
        // Look for SVG opening tag
        const svgStartIndex = response.indexOf('<svg');
        if (svgStartIndex !== -1) {
          // Find the matching closing tag
          const svgEndIndex = response.indexOf('</svg>', svgStartIndex);
          if (svgEndIndex !== -1) {
            svgContent = response.substring(svgStartIndex, svgEndIndex + 6); // +6 to include </svg>
            console.log('Method 4: Extracted SVG content from raw response, length:', svgContent.length);
          }
        }
      }
      
      // If we have SVG content, clean it up with improved methods
      if (svgContent && svgContent.includes('<svg')) {
        // Remove code block markers and other non-SVG content
        svgContent = svgContent.replace(/```(?:svg|html)?\n?|```/g, '').trim();
        
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
        
        // Add xmlns attribute if missing (crucial for SVG rendering)
        if (!svgContent.includes('xmlns=')) {
          svgContent = svgContent.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
          console.log('Added missing xmlns attribute');
        }
        
        // Make sure we have proper viewBox and dimensions
        if (!svgContent.includes('viewBox=')) {
          const widthMatch = svgContent.match(/width=["']([^"']*)["']/);
          const heightMatch = svgContent.match(/height=["']([^"']*)["']/);
          
          if (widthMatch && heightMatch) {
            const width = widthMatch[1].replace('px', '');
            const height = heightMatch[1].replace('px', '');
            svgContent = svgContent.replace('<svg', `<svg viewBox="0 0 ${width} ${height}"`);
            console.log('Added viewBox attribute based on dimensions');
          } else {
            // Default viewBox if dimensions not found
            svgContent = svgContent.replace('<svg', '<svg viewBox="0 0 800 600"');
            console.log('Added default viewBox attribute');
          }
        }
        
        // Enhanced SVG cleaning for critical tag structure issues
        svgContent = this.enhancedSvgRepair(svgContent);
        
        // Parse SVG with DOMParser to validate and potentially fix issues
        try {
          const parser = new DOMParser();
          const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
          const parserError = svgDoc.querySelector('parsererror');
          
          if (parserError) {
            console.warn('SVG parsing error detected, applying enhanced repairs');
            
            const errorText = parserError.textContent || '';
            console.warn('SVG parsing error:', errorText);
            
            // Apply targeted fixes based on the specific error
            if (errorText.includes('tag mismatch')) {
              svgContent = this.repairTagMismatch(svgContent, errorText);
              console.log('Applied tag mismatch repairs');
            }
            
            // Force CDATA for style tags
            if (svgContent.includes('<style>') && !svgContent.includes('CDATA')) {
              svgContent = svgContent.replace(/<style>([\s\S]*?)<\/style>/g, '<style><![CDATA[$1]]></style>');
              console.log('Added CDATA to style tag');
            }
            
            // Force self-closing tags for elements that should be self-closing
            svgContent = this.forceSelfClosingTags(svgContent);
            console.log('Applied self-closing tag fixes');
            
            // Check if we've fixed the issue
            const fixedDoc = parser.parseFromString(svgContent, 'image/svg+xml');
            if (fixedDoc.querySelector('parsererror')) {
              console.error('SVG still has parsing errors after repairs');
              
              // Last resort: try a more aggressive structure repair
              svgContent = this.aggressiveSvgRepair(svgContent);
              
              // Final validation
              const finalDoc = parser.parseFromString(svgContent, 'image/svg+xml');
              if (finalDoc.querySelector('parsererror')) {
                console.error('Failed to repair SVG after aggressive attempts, will use fallback');
                svgContent = ''; // Will trigger fallback
              } else {
                console.log('SVG successfully repaired with aggressive method!');
              }
            } else {
              console.log('SVG successfully repaired!');
            }
          } else {
            console.log('SVG validated successfully with DOMParser');
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
  
  // Enhanced SVG repair function with more targeted fixes
  private enhancedSvgRepair(svg: string): string {
    let fixedSvg = svg;
    
    // Check if SVG is malformed - doesn't have both opening and closing tags
    if (!fixedSvg.includes('<svg') || !fixedSvg.includes('</svg>')) {
      console.error('SVG is severely malformed, missing basic structure');
      return this.createBasicSvgFallback({ width: 800, height: 600 });
    }
    
    // Fix common attribute issues
    fixedSvg = this.fixSvgAttributes(fixedSvg);
    
    // ESSENTIAL FIX: Ensure style tags have CDATA sections to avoid XML parsing issues
    if (fixedSvg.includes('<style>') && !fixedSvg.includes('CDATA')) {
      // Check for CSS syntax in style tag
      const styleMatch = fixedSvg.match(/<style>([\s\S]*?)<\/style>/);
      if (styleMatch && (styleMatch[1].includes('{') || styleMatch[1].includes(':'))) {
        // Add CDATA wrapper
        fixedSvg = fixedSvg.replace(/<style>([\s\S]*?)<\/style>/g, '<style><![CDATA[$1]]></style>');
        console.log('Added CDATA to style tag containing CSS');
      }
    }
    
    // Fix malformed style tags (missing closing tag)
    if (fixedSvg.includes('<style>') && !fixedSvg.includes('</style>')) {
      fixedSvg = fixedSvg.replace('</svg>', '</style></svg>');
      console.log('Fixed missing style closing tag');
    }
    
    // Fix self-closing tags
    fixedSvg = this.forceSelfClosingTags(fixedSvg);
    
    // Fix improper nesting of elements before </svg>
    const endingPatterns = [
      { pattern: /<(rect|circle|path|line)([^>]*?)>([^<]*?)<\/svg>/g, replacement: '<$1$2/>$3</svg>' },
      { pattern: /<g([^>]*?)>([^<]*?)<\/svg>/g, replacement: '<g$1>$2</g></svg>' },
      { pattern: /<text([^>]*?)>([^<]*?)<\/svg>/g, replacement: '<text$1>$2</text></svg>' }
    ];
    
    endingPatterns.forEach(({ pattern, replacement }) => {
      if (fixedSvg.match(pattern)) {
        fixedSvg = fixedSvg.replace(pattern, replacement);
        console.log('Fixed improper nesting before </svg>');
      }
    });
    
    // Fix missing g tag closures - count g tags
    const openGTags = (fixedSvg.match(/<g\b[^>]*>/g) || []).length;
    const closeGTags = (fixedSvg.match(/<\/g>/g) || []).length;
    
    if (openGTags > closeGTags) {
      const missingClosures = openGTags - closeGTags;
      fixedSvg = fixedSvg.replace('</svg>', '</g>'.repeat(missingClosures) + '</svg>');
      console.log(`Added ${missingClosures} missing </g> tags`);
    }
    
    // Ensure text elements have proper closure
    if (fixedSvg.includes('<text') && !fixedSvg.includes('</text>')) {
      // Find unclosed text tags
      const textTagPattern = /<text\b[^>]*>([^<]*?)(?=<(?!\/text>))/g;
      fixedSvg = fixedSvg.replace(textTagPattern, '<text$1</text><');
      console.log('Fixed unclosed text tags');
    }
    
    return fixedSvg;
  }
  
  // Helper to fix common attribute issues in SVG
  private fixSvgAttributes(svg: string): string {
    // Repair common attribute errors
    return svg
      // Fix unquoted attributes (name=value) should be (name="value")
      .replace(/(\w+)=([^"'][^\s>]*)/g, '$1="$2"')
      // Fix standalone attributes (name) should be (name="")
      .replace(/(\s)(\w+)(\s|>)/g, (match, before, name, after) => {
        // Skip known boolean attributes
        if (['async', 'autofocus', 'autoplay', 'checked', 'controls', 'default', 
             'defer', 'disabled', 'hidden', 'ismap', 'loop', 'multiple', 'muted', 
             'novalidate', 'open', 'readonly', 'required', 'selected'].includes(name)) {
          return match;
        }
        return `${before}${name}=""${after}`;
      })
      // Fix missing XML namespace
      .replace(/<svg(?!\s+xmlns)/g, '<svg xmlns="http://www.w3.org/2000/svg"')
      // Fix attributes missing values, 'name=' -> 'name=""'
      .replace(/(\w+)=(?=[\s>])/g, '$1=""')
      // Fix mismatched quotes
      .replace(/(\w+)=['"]([^'"]*)['"]/g, (match, name, value) => {
        // Replace any remaining quotes in value with character entity
        const cleanValue = value
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
        return `${name}="${cleanValue}"`;
      })
      // Fix truncated attributes
      .replace(/(\w+)="([^"]*)(?=[><])/g, '$1="$2"');
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
  
  // Main aggressive SVG repair function that combines both approaches
  private aggressiveSvgRepair(svg: string, errorMsg?: string): string {
    let fixedSvg = svg;
    
    // Initially apply common fixes
    fixedSvg = this.fixSvgAttributes(fixedSvg);
    fixedSvg = this.forceSelfClosingTags(fixedSvg);
    
    // If we have specific error information, try more targeted fixes
    if (errorMsg) {
      // Extract line and column from error message if possible
      const lineMatch = errorMsg.match(/line (\d+)/);
      const colMatch = errorMsg.match(/column (\d+)/);
      
      if (lineMatch && colMatch) {
        const line = parseInt(lineMatch[1], 10);
        const col = parseInt(colMatch[1], 10);
        console.log(`Attribute error at line ${line}, column ${col}`);
        
        // Split into lines for line-specific repair
        const lines = fixedSvg.split('\n');
        
        if (lines.length >= line) {
          const problematicLine = lines[line-1];
          
          // Extract a window around the error column to see context
          if (col > 0 && col < problematicLine.length) {
            const start = Math.max(0, col - 20);
            const end = Math.min(problematicLine.length, col + 20);
            const context = problematicLine.substring(start, end);
            console.log(`Error context: "${context}"`);
            
            // Detect and fix common patterns that may cause attribute errors
            if (context.includes('=') && !context.includes('"') && !context.includes("'")) {
              // Unquoted attribute
              lines[line-1] = problematicLine.replace(/(\w+)=([^"'][^\s>]*)/g, '$1="$2"');
            } else if (context.includes('""') || context.includes("''")) {
              // Empty quotes
              lines[line-1] = problematicLine.replace(/""/g, '"&nbsp;"').replace(/''/g, "'&nbsp;'");
            } else if (context.includes('"') && context.includes("'")) {
              // Mixed quotes
              lines[line-1] = problematicLine
                .replace(/(\w+)='([^']*)"([^']*)'(?=[\s>])/g, '$1="$2&quot;$3"')
                .replace(/(\w+)="([^"]*)'([^"]*)"(?=[\s>])/g, '$1="$2&apos;$3"');
            } else {
              // For more complex cases, try to sanitize the entire tag
              const tagMatch = problematicLine.match(/<(\w+)/);
              if (tagMatch) {
                const tagName = tagMatch[1];
                
                // Extract any useful attributes we want to preserve
                const idMatch = problematicLine.match(/id=["']([^"']*)["']/);
                const id = idMatch ? idMatch[1] : '';
                
                const classMatch = problematicLine.match(/class=["']([^"']*)["']/);
                const className = classMatch ? classMatch[1] : '';
                
                const styleMatch = problematicLine.match(/style=["']([^"']*)["']/);
                const style = styleMatch ? styleMatch[1] : '';
                
                // Rebuild tag with clean attributes
                if (tagName === 'svg') {
                  lines[line-1] = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">';
                } else {
                  const selfClosingElements = ['rect', 'circle', 'ellipse', 'line', 'path', 'polygon', 'polyline', 'image', 'use'];
                  let attrs = '';
                  if (id) attrs += ` id="${id}"`;
                  if (className) attrs += ` class="${className}"`;
                  if (style) attrs += ` style="${style}"`;
                  
                  if (selfClosingElements.includes(tagName)) {
                    // For paths, try to preserve the path data
                    if (tagName === 'path') {
                      const dMatch = problematicLine.match(/d=["']([^"']*)["']/);
                      if (dMatch) attrs += ` d="${dMatch[1]}"`;
                    }
                    lines[line-1] = `<${tagName}${attrs}/>`;
                  } else {
                    // Check if this is likely a closing tag or opening tag
                    if (problematicLine.includes(`</${tagName}`)) {
                      lines[line-1] = `</${tagName}>`;
                    } else {
                      lines[line-1] = `<${tagName}${attrs}>`;
                    }
                  }
                }
              }
            }
          }
        }
        
        // Rebuild SVG with fixed lines
        fixedSvg = lines.join('\n');
        
        // Validate the repaired SVG
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(fixedSvg, 'image/svg+xml');
          const errorNode = doc.querySelector('parsererror');
          
          if (!errorNode) {
            console.log('Successfully fixed attribute construct error');
            return fixedSvg;
          } else {
            console.log('❌ SVG still has parsing errors after repairs');
          }
        } catch (e) {
          console.log('Error checking repaired SVG:', e);
        }
      }
    }
    
    // If line-specific repair failed or wasn't applicable, try more aggressive approaches
    
    // 1. Extract essential attributes from SVG root
    const svgRootMatch = fixedSvg.match(/<svg[^>]*>/);
    if (!svgRootMatch) {
      return this.createBasicSvgFallback({ width: 800, height: 600 });
    }
    
    // Extract essential attributes
    const attrsMatch = svgRootMatch[1] || '';
    const viewBoxMatch = attrsMatch.match(/viewBox=["']([^"']*)["']/);
    const viewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 800 600";
    
    const widthMatch = attrsMatch.match(/width=["']([^"']*)["']/);
    const width = widthMatch ? widthMatch[1].replace('px', '') : "800";
    
    const heightMatch = attrsMatch.match(/height=["']([^"']*)["']/);
    const height = heightMatch ? heightMatch[1].replace('px', '') : "600";
    
    // Extract style section if it exists
    let styleContent = '';
    const styleMatch = fixedSvg.match(/<style[^>]*>([\s\S]*?)<\/style>/);
    if (styleMatch) {
      styleContent = styleMatch[1];
      // Ensure CDATA wrapping
      if (!styleContent.includes('CDATA')) {
        styleContent = `<![CDATA[${styleContent}]]>`;
      }
    }
    
    // Extract all valid elements we can find
    const elements: string[] = [];
    
    // Safe elements to extract
    const elementTypes = ['rect', 'circle', 'path', 'text', 'g', 'ellipse', 'line', 'polygon', 'polyline', 'image'];
    
    // Extract self-closing elements
    const selfClosingPattern = /<(rect|circle|path|ellipse|line|polygon|polyline|image)([^>]*?)\/>/g;
    let match;
    while ((match = selfClosingPattern.exec(fixedSvg)) !== null) {
      elements.push(`<${match[1]}${match[2]}/>`);
    }
    
    // Try to extract properly closed elements (harder to do reliably)
    elementTypes.forEach(type => {
      if (type === 'g') return; // Skip g elements for now - harder to match reliably
      
      const pattern = new RegExp(`<${type}([^>]*)>([^<]*?)<\\/${type}>`, 'g');
      let elemMatch;
      while ((elemMatch = pattern.exec(fixedSvg)) !== null) {
        elements.push(`<${type}${elemMatch[1]}>${elemMatch[2]}</${type}>`);
      }
    });
    
    // If no elements were extracted, create some placeholders
    if (elements.length === 0) {
      // Extract colors from the SVG if possible
      let backgroundColor = '#F8F9FA';
      let foregroundColor = '#4A6CF7';
      let textColor = '#1D2939';
      
      const backgroundMatch = fixedSvg.match(/background(?:-color)?:\s*([#\w][^;}"']+)/);
      if (backgroundMatch) backgroundColor = backgroundMatch[1];
      
      const fillMatch = fixedSvg.match(/fill:\s*([#\w][^;}"']+)/);
      if (fillMatch) foregroundColor = fillMatch[1];
      
      const colorMatch = fixedSvg.match(/color:\s*([#\w][^;}"']+)/);
      if (colorMatch) textColor = colorMatch[1];
      
      // Add placeholder elements
      elements.push(`<rect width="100%" height="100%" fill="${backgroundColor}"/>`);
      elements.push(`<rect x="50" y="50" width="700" height="500" rx="8" fill="#FFFFFF" stroke="#E5E7EB" stroke-width="1"/>`);
      elements.push(`<rect x="80" y="120" width="640" height="80" rx="4" fill="${foregroundColor}"/>`);
      elements.push(`<rect x="80" y="230" width="200" height="40" rx="20" fill="${foregroundColor}"/>`);
      elements.push(`<rect x="300" y="230" width="200" height="40" rx="4" fill="#FFFFFF" stroke="${foregroundColor}" stroke-width="1"/>`);
      elements.push(`<rect x="520" y="230" width="200" height="40" rx="4" fill="#F3F4F6"/>`);
      elements.push(`<text x="400" y="85" text-anchor="middle" font-family="sans-serif" font-size="24" fill="${textColor}">Improved Design</text>`);
      elements.push(`<text x="180" y="250" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#FFFFFF">Primary Button</text>`);
      elements.push(`<text x="400" y="250" text-anchor="middle" font-family="sans-serif" font-size="14" fill="${textColor}">Secondary Button</text>`);
      elements.push(`<text x="620" y="250" text-anchor="middle" font-family="sans-serif" font-size="14" fill="${textColor}">Disabled</text>`);
      elements.push(`<text x="400" y="160" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#FFFFFF">This is a fallback rendering with basic UI elements</text>`);
      elements.push(`<text x="400" y="350" text-anchor="middle" font-family="sans-serif" font-size="16" fill="${textColor}">The AI-generated SVG had structural issues that prevented rendering</text>`);
      elements.push(`<text x="400" y="380" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#666666">View the analysis to see the improvements made to the design</text>`);
    }
    
    // Build a clean, minimal SVG
    let cleanSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}">`;
    
    // Add style if we found any
    if (styleContent) {
      cleanSvg += `<style>${styleContent}</style>`;
    }
    
    // Add all the extracted elements
    elements.forEach(element => {
      cleanSvg += element;
    });
    
    // Close the SVG
    cleanSvg += '</svg>';
    
    console.log('Created clean SVG with aggressive repair method');
    return cleanSvg;
  }
  
  // Create a more visually appealing fallback SVG that shows an improved design
  private createEnhancedFallbackSvg(bgColor: string, primaryColor: string, textColor: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <defs>
        <style><![CDATA[
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
        ]]></style>
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
  
  // Add the fallback response method
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

  // Helper method to extract and fix SVG content from a response
  private async extractSvgContent(response: string): Promise<string> {
    try {
      // Try to fix common SVG issues before extraction
      let fixedResponse = response;
      
      // Fix common attribute issues before attempting extraction
      fixedResponse = this.fixSvgAttributes(fixedResponse);
      
      // Apply self-closing tag fixes for elements that should be self-closing
      fixedResponse = this.forceSelfClosingTags(fixedResponse);
      
      console.log('Applied self-closing tag fixes');
      
      // Check if there are parsing errors
      if (typeof window !== 'undefined' && window.DOMParser) {
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(fixedResponse, 'image/svg+xml');
          const errorNode = doc.querySelector('parsererror');
          
          if (errorNode) {
            console.log('❗ SVG parsing error detected, applying enhanced repairs');
            
            // Extract the error message for better diagnostics
            const errorMsg = errorNode.textContent || '';
            console.log(`❗ SVG parsing error: ${errorMsg}`);
            
            // If we have an attribute construct error, try to fix it
            if (errorMsg.includes('attributes construct error')) {
              fixedResponse = this.aggressiveSvgRepair(fixedResponse, errorMsg);
              
              // Check if the repair fixed the issue
              const fixedDoc = parser.parseFromString(fixedResponse, 'image/svg+xml');
              if (fixedDoc.querySelector('parsererror')) {
                console.log('❌ SVG still has parsing errors after repairs');
              } else {
                console.log('Created clean SVG with aggressive repair method');
              }
            }
          }
        } catch (e) {
          console.log('Error checking SVG with DOMParser:', e);
        }
      }
      
      // Try to extract the SVG from the fixed response
      const svgCodeBlockPattern = /```(?:svg|html)?\s*([\s\S]*?<svg[\s\S]*?<\/svg>)[\s\S]*?```/i;
      const codeBlockMatch = fixedResponse.match(svgCodeBlockPattern);
      
      if (codeBlockMatch && codeBlockMatch[1] && codeBlockMatch[1].includes('<svg')) {
        const extractedSvg = codeBlockMatch[1].trim();
        console.log('Successfully extracted SVG from code block, length:', extractedSvg.length);
        return extractedSvg;
      }
      
      // Method 2: Look for complete SVG tags
      const svgTagPattern = /<svg[\s\S]*?<\/svg>/g;
      const svgMatches = Array.from(fixedResponse.matchAll(svgTagPattern));
      
      if (svgMatches.length > 0) {
        // Use the longest SVG content found (most likely to be complete)
        const extractedSvg = svgMatches.reduce((longest, current) => 
          current[0].length > longest.length ? current[0] : longest, svgMatches[0][0]);
        console.log('Found complete SVG tag, length:', extractedSvg.length);
        return extractedSvg;
      }
      
      // If we couldn't extract an SVG, use a fallback
      console.log('❌ FAILED TO EXTRACT SVG from response, using fallback');
      
      // Create a fallback SVG with minimal styling
      const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
        <rect width="100%" height="100%" fill="#f8f9fa" />
        <rect x="100" y="100" width="600" height="400" rx="10" fill="white" stroke="#4285f4" stroke-width="2" />
        <text x="400" y="250" text-anchor="middle" font-size="24" fill="#202124" font-family="sans-serif">SVG Generation Issue</text>
        <text x="400" y="300" text-anchor="middle" font-size="16" fill="#5f6368" font-family="sans-serif">Could not extract valid SVG content</text>
        <text x="400" y="330" text-anchor="middle" font-size="14" fill="#5f6368" font-family="sans-serif">Please try again</text>
      </svg>`;
      
      return fallbackSvg;
    } catch (error) {
      console.error('Error extracting SVG content:', error);
      
      // Return a simple error SVG
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
        <rect width="100%" height="100%" fill="#f8f9fa" />
        <rect x="100" y="100" width="600" height="400" rx="10" fill="white" stroke="#ea4335" stroke-width="2" />
        <text x="400" y="250" text-anchor="middle" font-size="24" fill="#202124" font-family="sans-serif">Error Processing SVG</text>
        <text x="400" y="300" text-anchor="middle" font-size="16" fill="#5f6368" font-family="sans-serif">${error instanceof Error ? error.message : 'Unknown error'}</text>
      </svg>`;
    }
  }

  // Helper to implement the common SVG repair process
  private fixCommonSvgIssues(svgString: string): string {
    let result = svgString;
    
    // Fix common attribute issues first
    result = this.fixSvgAttributes(result);
    
    // Apply self-closing tag fixes for elements that should be self-closing
    result = this.forceSelfClosingTags(result);
    
    console.log('Applied self-closing tag fixes');
    
    // Try to parse the SVG using DOM parser if available
    if (typeof window !== 'undefined' && window.DOMParser) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(result, 'image/svg+xml');
        const errorNode = doc.querySelector('parsererror');
        
        if (errorNode) {
          console.log('❗ SVG parsing error detected, applying enhanced repairs');
          
          // Extract the error message for better diagnostics
          const errorMsg = errorNode.textContent || '';
          console.log(`❗ SVG parsing error: ${errorMsg}`);
          
          // If we have an attribute construct error, try to fix it
          if (errorMsg.includes('attributes construct error')) {
            result = this.aggressiveSvgRepair(result, errorMsg);
          }
        }
      } catch (e) {
        console.log('Error checking SVG with DOMParser:', e);
      }
    }
    
    return result;
  }
}

const openAIService = new OpenAIService();
export default openAIService; 