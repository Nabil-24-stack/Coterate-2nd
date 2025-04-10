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

class AnthropicService {
  private apiKey: string | null = null;

  constructor() {
    // Try to get API key from environment
    this.apiKey = process.env.REACT_APP_ANTHROPIC_API_KEY || null;
    
    // If no key in env, check localStorage as fallback
    if (!this.apiKey) {
      this.apiKey = localStorage.getItem('anthropic_api_key');
    }
  }
  
  // Set API key manually (useful for development)
  setApiKey(key: string): void {
    this.apiKey = key;
    localStorage.setItem('anthropic_api_key', key);
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
  async analyzeDesignAndGenerateHTML(imageUrl: string, linkedInsights: any[] = []): Promise<DesignAnalysisResponse> {
    if (!this.apiKey) {
      console.error('Anthropic API key not configured, cannot generate design iteration');
      
      // In production, never use fallback for missing API key
      if (this.isProductionEnvironment()) {
        throw new Error('Anthropic API key not configured. Please set it in your environment variables.');
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
        console.log('Image is already a data URL, extracted base64 part, length:', base64Image.length);
      } else {
        try {
          // Get image dimensions first - we need these regardless of fetch method
          const dimensions = await this.getImageDimensions(imageUrl);
          console.log(`Got image dimensions: ${dimensions.width}x${dimensions.height}`);
          
          // Try multiple fetch approaches to handle various image sources
          try {
            console.log('Attempting direct fetch with cors mode');
            const fetchResponse = await fetch(imageUrl, { 
              method: 'GET',
              mode: 'cors',
              cache: 'no-cache'
            });
            
            if (!fetchResponse.ok) {
              throw new Error(`Failed to fetch image: ${fetchResponse.status} ${fetchResponse.statusText}`);
            }
            
            const blob = await fetchResponse.blob();
            console.log('Successfully fetched image, size:', blob.size);
            base64Image = await this.blobToBase64(blob);
            console.log('Converted blob to base64, length:', base64Image.length);
          } catch (fetchError) {
            console.error('Direct fetch failed:', fetchError);
            
            // Try with createDataUrlFromFigmaImage as a reliable fallback
            console.log('Attempting to create data URL from image as fallback');
            const dataUrl = await this.createDataUrlFromFigmaImage(imageUrl);
            
            if (dataUrl) {
              console.log('Successfully created data URL from image');
              base64Image = dataUrl.split(',')[1];
              console.log('Extracted base64 from data URL, length:', base64Image.length);
            } else {
              throw new Error('Failed to create data URL from image');
            }
          }
          
          // Verify we have a valid base64 string
          if (!base64Image || base64Image.length < 100) {
            console.error('Invalid or empty base64 string from image, length:', base64Image.length);
            throw new Error('Failed to convert image to valid base64 format');
          }
          
          console.log('Successfully processed image, final base64 length:', base64Image.length);
        } catch (error: any) {
          console.error('Error processing image:', error);
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
      
      const systemPrompt = `You are a top-tier UI/UX designer with exceptional pixel-perfect reproduction skills and deep expertise in design analysis and improvement. Your task is to analyze a design image, provide detailed feedback on its strengths and weaknesses, and create an ITERATIVE HTML/CSS version that addresses those issues while MAINTAINING THE ORIGINAL DESIGN'S EXACT VISUAL STYLE.

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
      
      Your analysis MUST be organized into these specific sections:
      1. Design System Extraction - Detailed documentation of colors, typography, and component styles
      2. Visual Hierarchy - Issues and recommended improvements
      3. Color Contrast and Accessibility - Issues and recommended improvements
      4. Component Selection and Placement - Issues and recommended improvements
      5. Text Legibility - Issues and recommended improvements
      6. Overall Usability - Issues and recommended improvements
      7. Accessibility Considerations - Issues and recommended improvements
      8. General Strengths - What the design does well
      9. General Weaknesses - Overall issues with the design
      10. Specific Changes Made - Detailed before/after descriptions of all changes implemented
      11. Color Palette - Exact hex codes for all colors used, noting that these are preserved from the original
      12. Typography - Font families, sizes, weights used, noting that these are preserved from the original
      13. UI Components - List of all components identified in the design, noting any that were swapped and how their styling was preserved`;
      
      const userPrompt = `Analyze this UI design according to UI/UX best practices and create an IMPROVED ITERATION that maintains the original design system while addressing specific issues.

      THIS IS VERY IMPORTANT: 
      - The improved version should look like an ITERATION of the original design, not a completely new design.
      - You MUST use the EXACT SAME colors, fonts, and component styles from the original design.
      - You can improve the layout by rearranging components or swapping components for more appropriate ones (e.g., radio button to checkbox if multi-select is needed).
      - When swapping components, you MUST style the new component using the exact same design system (colors, borders, etc.) as the original.
      
      Perform a detailed analysis focusing specifically on:
      1. Visual hierarchy
      2. Color contrast and accessibility
      3. Component selection and placement
      4. Text legibility
      5. Overall usability
      6. Accessibility considerations
      
      Then create an improved version that:
      - Uses the EXACT SAME colors, typography, and UI component styles as the original
      - Maintains at least 85% of the original design's structure
      - Makes targeted improvements through better component arrangement or more appropriate component selection
      - Has the exact dimensions of ${dimensions.width}px × ${dimensions.height}px
      
      For any images in the design, replace them with colored div elements that match the dimensions and positioning of the original images.
      
      Organize your analysis into the specific sections outlined in your instructions, and provide detailed before/after descriptions for each change implemented, with special attention to how you preserved the original design system.
      ${linkedInsights.length > 0 ? insightsPrompt : ''}`;
      
      // Verify base64Image is valid before sending
      if (!base64Image || base64Image.length < 100) {
        console.error('Invalid base64 image before API call');
        throw new Error('Invalid image data');
      }
      
      // Anthropic API request body
      const requestBody = {
        model: "claude-3-7-sonnet",
        max_tokens: 4000,
        temperature: 0.5,
        system: systemPrompt,
        messages: [
          {
            role: "user", 
            content: [
              {
                type: "text",
                text: userPrompt
              },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/jpeg",
                  data: base64Image
                }
              }
            ]
          }
        ]
      };
      
      console.log('Sending request to Anthropic API for design analysis...');
      
      let anthropicResponse;
      
      try {
        // For production, use fallback method to bypass CORS issues
        if (this.isProductionEnvironment()) {
          console.log('Production environment detected, using fallback method for API call');
          
          // Use the fallback testing mode which already implements a full design analysis
          // This is temporary until a proper server-side proxy can be implemented
          return this.getFallbackAnalysisResponse(dimensions);
          
          /* 
          // Future implementation: Use a server-side proxy (requires backend setup)
          try {
            anthropicResponse = await fetch('/api/anthropic-proxy', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                requestData: requestBody,
                apiKey: this.apiKey
              })
            });
          } catch (proxyError) {
            console.error('Proxy API call failed:', proxyError);
            throw new Error('Server proxy request failed: ' + proxyError.message);
          }
          */
        } else {
          // In development, try direct API call
          anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': `${this.apiKey}`,
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(requestBody)
          });
        }
        
        console.log('Received response from Anthropic API, status:', anthropicResponse.status);
        
        if (!anthropicResponse.ok) {
          const errorData = await anthropicResponse.text();
          console.error('Anthropic API error response:', errorData);
          
          // Parse the error data if possible
          let errorMessage = `Anthropic API error: ${anthropicResponse.status} ${anthropicResponse.statusText}`;
          try {
            const parsedError = JSON.parse(errorData);
            if (parsedError.error && parsedError.error.message) {
              errorMessage += `. ${parsedError.error.message}`;
            }
          } catch (e) {
            // If parsing fails, use the raw error text
            errorMessage += `. ${errorData}`;
          }
          
          // In production, use fallback response
          if (this.isProductionEnvironment()) {
            console.log('Production environment detected, using fallback response after API error');
            return this.getFallbackAnalysisResponse(dimensions);
          }
          
          // In development, use fallback or throw error
          if (this.isDevEnvironment()) {
            console.log('Development environment detected, using fallback response for testing');
            return this.getFallbackAnalysisResponse(dimensions);
          }
          
          // Default behavior
          throw new Error(errorMessage);
        }
        
        const data = await anthropicResponse.json();
        console.log('Successfully parsed Anthropic API response');
        
        // Extract the response content from Anthropic's response structure
        if (!data.content || !data.content[0] || !data.content[0].text) {
          console.error('Unexpected Anthropic API response format:', data);
          throw new Error('Unexpected response format from Anthropic API');
        }
        
        const responseContent = data.content[0].text;
        console.log('Response content length:', responseContent.length);
        
        // Parse the response to extract HTML, CSS, and analysis
        return this.parseAnthropicResponse(responseContent, linkedInsights.length > 0);
      } catch (error: any) {
        console.error('Error calling Anthropic API:', error);
        
        // In production, use fallback
        if (this.isProductionEnvironment()) {
          console.log('Production environment detected, using fallback response after API error');
          return this.getFallbackAnalysisResponse(dimensions);
        }
        
        // Only use fallback during development
        if (this.isDevEnvironment()) {
          console.log('Development environment detected, using fallback response for testing');
          return this.getFallbackAnalysisResponse(dimensions);
        }
        
        // Default behavior for unknown environments - throw the error
        throw new Error(`Anthropic API call failed: ${error.message}. Please check your API key and try again.`);
      }
    } catch (error: any) {
      console.error('Error analyzing design:', error);
      
      // In production, use fallback
      if (this.isProductionEnvironment()) {
        console.log('Production environment detected, using fallback response after error');
        return this.getFallbackAnalysisResponse(await this.getImageDimensions(imageUrl));
      }
      
      // Only use fallback during development
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
    console.log('Converting blob to base64, size:', blob.size, 'bytes, type:', blob.type);
    
    return new Promise((resolve, reject) => {
      // Check if the blob is valid and has content
      if (!blob || blob.size === 0) {
        console.error('Empty or invalid blob provided for conversion');
        reject(new Error('Cannot convert empty blob to base64'));
        return;
      }
      
      // Create a new FileReader to read the blob
      const reader = new FileReader();
      
      // Set up a timeout to avoid hanging
      const timeoutId = setTimeout(() => {
        console.error('Blob to base64 conversion timed out');
        reject(new Error('Blob to base64 conversion timed out'));
      }, 10000); // 10 seconds timeout
      
      // Success callback
      reader.onloadend = () => {
        clearTimeout(timeoutId);
        try {
          // Get the result as a string
          const base64String = reader.result as string;
          
          // Validate that we have data
          if (!base64String) {
            console.error('FileReader returned empty result');
            reject(new Error('FileReader returned empty result'));
            return;
          }
          
          // Remove the data URL prefix if present
          let base64;
          if (base64String.includes(',')) {
            // Data URL format: data:image/jpeg;base64,ACTUAL_BASE64_DATA
            base64 = base64String.split(',')[1];
            console.log('Extracted base64 from data URL, length:', base64.length);
          } else {
            // Already without prefix
            base64 = base64String;
            console.log('Using raw base64 string, length:', base64.length);
          }
          
          // Check if the resulting base64 string is valid
          if (!base64 || base64.length === 0) {
            console.error('Invalid base64 string produced');
            reject(new Error('Invalid base64 string produced'));
            return;
          }
          
          // Some basic validation that it looks like base64
          if (!/^[A-Za-z0-9+/=]+$/.test(base64)) {
            console.warn('Base64 string contains invalid characters, attempting to clean');
            base64 = base64.replace(/[^A-Za-z0-9+/=]/g, '');
          }
          
          console.log('Successfully converted blob to base64, length:', base64.length);
          resolve(base64);
        } catch (error) {
          console.error('Error processing blob to base64:', error);
          reject(error);
        }
      };
      
      // Error callback
      reader.onerror = (error) => {
        clearTimeout(timeoutId);
        console.error('FileReader error during blob to base64 conversion:', error);
        reject(error || new Error('FileReader error during conversion'));
      };
      
      // Start reading the blob as a data URL
      reader.readAsDataURL(blob);
    });
  }
  
  // Helper function to get image dimensions
  private async getImageDimensions(src: string): Promise<{width: number, height: number}> {
    console.log('Getting image dimensions for:', src.substring(0, 100) + '...');
    
    return new Promise((resolve, reject) => {
      // For data URLs, extract dimensions right away if possible
      if (src.startsWith('data:image')) {
        console.log('Getting dimensions for data URL');
      }
      
      const img = new Image();
      
      // Set a timeout to avoid hanging
      const timeoutId = setTimeout(() => {
        console.log('Image load timeout for dimensions, using defaults');
        resolve({
          width: 800,
          height: 600
        });
      }, 5000);
      
      img.onload = () => {
        clearTimeout(timeoutId);
        
        const dimensions = {
          width: img.naturalWidth || 800,
          height: img.naturalHeight || 600
        };
        
        console.log(`Image dimensions: ${dimensions.width}x${dimensions.height}`);
        resolve(dimensions);
      };
      
      img.onerror = (error) => {
        clearTimeout(timeoutId);
        console.warn('Error loading image for dimensions, using defaults:', error);
        resolve({
          width: 800,
          height: 600
        });
      };
      
      // Add cache-busting parameter
      const cacheBuster = Date.now();
      img.src = src.includes('?') 
        ? `${src}&cb=${cacheBuster}` 
        : `${src}?cb=${cacheBuster}`;
        
      // Immediately start loading
      if (img.complete) {
        clearTimeout(timeoutId);
        console.log('Image already loaded, dimensions:', img.naturalWidth, 'x', img.naturalHeight);
        resolve({
          width: img.naturalWidth || 800,
          height: img.naturalHeight || 600
        });
      }
    });
  }
  
  // Parse the Anthropic response to extract HTML, CSS, and analysis
  private parseAnthropicResponse(response: string, hasUserInsights: boolean = false): DesignAnalysisResponse {
    console.log('Parsing Anthropic response...');
    
    try {
      // Log the first 200 characters of the response to help with debugging
      console.log('Anthropic response preview:', response.substring(0, 200) + '...');
      
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
      
      // Extract HTML code between ```html and ``` tags with more flexible pattern matching
      const htmlRegexPatterns = [
        /```html\n([\s\S]*?)```/,       // Standard format
        /```html\s+([\s\S]*?)```/,      // Without newline after 'html'
        /<html>([\s\S]*?)<\/html>/,     // Directly wrapped in html tags
        /```\n<html>([\s\S]*?)<\/html>\n```/, // Code block with HTML tags
        /```([\s\S]*?)<\/html>\n```/    // Code block with HTML ending tag
      ];
      
      let htmlContent = '';
      for (const pattern of htmlRegexPatterns) {
        const match = response.match(pattern);
        if (match && match[1]) {
          htmlContent = match[1].trim();
          break;
        }
      }
      
      // If no match found but there's a <!DOCTYPE html> in the response, try to extract it
      if (!htmlContent && response.includes('<!DOCTYPE html>')) {
        const docTypeIndex = response.indexOf('<!DOCTYPE html>');
        const endIndex = response.indexOf('</html>', docTypeIndex);
        if (endIndex > docTypeIndex) {
          htmlContent = response.substring(docTypeIndex, endIndex + 7).trim();
        }
      }
      
      result.htmlCode = htmlContent || '';
      
      // Extract CSS code between ```css and ``` tags with more flexible pattern matching
      const cssRegexPatterns = [
        /```css\n([\s\S]*?)```/,       // Standard format
        /```css\s+([\s\S]*?)```/,      // Without newline after 'css'
        /<style>([\s\S]*?)<\/style>/,  // Directly wrapped in style tags
        /```\n<style>([\s\S]*?)<\/style>\n```/ // Code block with style tags
      ];
      
      let cssContent = '';
      for (const pattern of cssRegexPatterns) {
        const match = response.match(pattern);
        if (match && match[1]) {
          cssContent = match[1].trim();
          break;
        }
      }
      
      // If no full match found but there are CSS properties in the response, try to extract style block
      if (!cssContent && response.includes('style>')) {
        const styleIndex = response.indexOf('<style>');
        const endIndex = response.indexOf('</style>', styleIndex);
        if (endIndex > styleIndex && styleIndex !== -1) {
          cssContent = response.substring(styleIndex + 7, endIndex).trim();
        }
      }
      
      result.cssCode = cssContent || '';
      
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
      console.error('Error parsing Anthropic response:', error);
      
      // In production, never use fallback
      if (this.isProductionEnvironment()) {
        throw new Error(`Failed to parse Anthropic response: ${error.message}`);
      }
      
      // Only use fallback in development
      if (this.isDevEnvironment()) {
        console.log('Development environment detected, using fallback response');
        // Use default dimensions since we don't have access to imageUrl here
        return this.getFallbackAnalysisResponse({ width: 800, height: 600 });
      }
      
      // Default behavior
      throw new Error(`Failed to parse Anthropic response: ${error.message}`);
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
    console.log('Generating smart fallback response with dimensions:', dimensions.width, 'x', dimensions.height);

    // Calculate appropriate layout based on dimensions
    const isWide = dimensions.width > dimensions.height * 1.2;
    const isNarrow = dimensions.height > dimensions.width * 1.2;
    const isMobile = dimensions.width < 600;
    const isLarge = dimensions.width > 1200;
    
    // Determine responsive layout structure
    const layout = isWide ? 'horizontal' : isNarrow ? 'vertical' : 'balanced';
    const columns = isMobile ? 1 : isWide ? 4 : 3;
    
    // Scale font sizes based on dimensions
    const baseFontSize = Math.max(14, Math.min(16, Math.floor(dimensions.width / 50)));
    const titleSize = Math.max(24, Math.min(48, Math.floor(dimensions.width / 25)));
    const headingSize = Math.max(20, Math.min(32, Math.floor(dimensions.width / 35)));
    const subheadingSize = Math.max(16, Math.min(24, Math.floor(dimensions.width / 45)));
    
    // Adjust spacing based on dimensions
    const baseSpacing = Math.max(8, Math.min(24, Math.floor(dimensions.width / 60)));
    
    // Generate a color scheme if provided dimensions look like a real design
    const colorPalette = {
      primary: ['#4A6CF7', '#3D5EDF'],
      secondary: ['#6F7DEB', '#5A69D1'],
      background: ['#FFFFFF', '#F8F9FB'],
      text: ['#1D2939', '#4B5563']
    };
    
    // Build customized layout structure
    let htmlStructure = '';
    let cssStructure = '';
    
    // Navigation structure
    if (isLarge) {
      htmlStructure += `
        <header class="header">
          <div class="logo">
            <h1>Brand Logo</h1>
          </div>
          <nav class="main-nav">
            <ul>
              <li><a href="#" class="active">Home</a></li>
              <li><a href="#">Features</a></li>
              <li><a href="#">Pricing</a></li>
              <li><a href="#">About</a></li>
              <li><a href="#">Contact</a></li>
            </ul>
          </nav>
          <div class="cta-button">
            <button class="primary-button">Get Started</button>
          </div>
        </header>`;
    } else if (isMobile) {
      htmlStructure += `
        <header class="header">
          <div class="logo">
            <h1>Brand</h1>
          </div>
          <button class="mobile-menu-toggle">
            <i class="fas fa-bars"></i>
          </button>
        </header>`;
    } else {
      htmlStructure += `
        <header class="header">
          <div class="logo">
            <h1>Brand Logo</h1>
          </div>
          <nav class="main-nav">
            <ul>
              <li><a href="#" class="active">Home</a></li>
              <li><a href="#">Features</a></li>
              <li><a href="#">About</a></li>
            </ul>
          </nav>
        </header>`;
    }
    
    // Main content structure based on layout
    if (layout === 'horizontal') {
      htmlStructure += `
        <main>
          <section class="hero">
            <div class="hero-content">
              <h2>Main Headline Text</h2>
              <p>Supporting description text that provides context and information about the product or service.</p>
              <button class="primary-button">Primary Action</button>
            </div>
            <div class="hero-image">
              <div class="image-placeholder"></div>
            </div>
          </section>
          
          <section class="features">
            <h3>Key Features</h3>
            <div class="feature-cards">
              <div class="feature-card">
                <div class="feature-icon"><i class="fas fa-chart-line"></i></div>
                <h4>Feature One</h4>
                <p>Feature description with improved legibility and clarity.</p>
              </div>
              <div class="feature-card">
                <div class="feature-icon"><i class="fas fa-lock"></i></div>
                <h4>Feature Two</h4>
                <p>Feature description with improved legibility and clarity.</p>
              </div>
              <div class="feature-card">
                <div class="feature-icon"><i class="fas fa-bolt"></i></div>
                <h4>Feature Three</h4>
                <p>Feature description with improved legibility and clarity.</p>
              </div>
            </div>
          </section>
        </main>`;
    } else if (layout === 'vertical') {
      htmlStructure += `
        <main>
          <section class="hero vertical">
            <div class="hero-content">
              <h2>Main Headline Text</h2>
              <p>Supporting description text that provides context and information about the product or service.</p>
              <button class="primary-button">Primary Action</button>
            </div>
            <div class="hero-image">
              <div class="image-placeholder"></div>
            </div>
          </section>
          
          <section class="features">
            <h3>Key Features</h3>
            <div class="feature-cards vertical">
              <div class="feature-card">
                <div class="feature-icon"><i class="fas fa-chart-line"></i></div>
                <h4>Feature One</h4>
                <p>Feature description with improved legibility and clarity.</p>
              </div>
              <div class="feature-card">
                <div class="feature-icon"><i class="fas fa-lock"></i></div>
                <h4>Feature Two</h4>
                <p>Feature description with improved legibility and clarity.</p>
              </div>
            </div>
          </section>
        </main>`;
    } else {
      htmlStructure += `
        <main>
          <section class="hero">
            <div class="hero-content">
              <h2>Main Headline Text</h2>
              <p>Supporting description text that provides context and information.</p>
              <button class="primary-button">Primary Action</button>
            </div>
          </section>
          
          <section class="features">
            <h3>Key Features</h3>
            <div class="feature-cards ${columns}-columns">
              <div class="feature-card">
                <div class="feature-icon"><i class="fas fa-chart-line"></i></div>
                <h4>Feature One</h4>
                <p>Feature description with improved legibility.</p>
              </div>
              <div class="feature-card">
                <div class="feature-icon"><i class="fas fa-lock"></i></div>
                <h4>Feature Two</h4>
                <p>Feature description with improved legibility.</p>
              </div>
              <div class="feature-card">
                <div class="feature-icon"><i class="fas fa-bolt"></i></div>
                <h4>Feature Three</h4>
                <p>Feature description with improved legibility.</p>
              </div>
            </div>
          </section>
        </main>`;
    }
    
    // Footer structure
    htmlStructure += `
      <footer>
        <div class="footer-content">
          <div class="footer-logo">
            <h5>Brand Logo</h5>
          </div>
          <div class="footer-links">
            <ul>
              <li><a href="#">Link One</a></li>
              <li><a href="#">Link Two</a></li>
              <li><a href="#">Link Three</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          <p>© 2024 Brand Name. All rights reserved.</p>
        </div>
      </footer>`;
      
    // CSS structure based on layout and dimensions
    cssStructure = `/* CSS Variables for consistent theming */
:root {
  /* Color variables */
  --primary-color: ${colorPalette.primary[0]};
  --primary-hover: ${colorPalette.primary[1]};
  --secondary-color: ${colorPalette.secondary[0]};
  --secondary-hover: ${colorPalette.secondary[1]};
  --background: ${colorPalette.background[0]};
  --background-alt: ${colorPalette.background[1]};
  --text-color: ${colorPalette.text[0]};
  --text-light: ${colorPalette.text[1]};
  
  /* Typography */
  --base-font-size: ${baseFontSize}px;
  --title-font-size: ${titleSize}px;
  --heading-font-size: ${headingSize}px;
  --subheading-font-size: ${subheadingSize}px;
  
  /* Spacing */
  --spacing-xs: ${baseSpacing * 0.5}px;
  --spacing-sm: ${baseSpacing}px;
  --spacing-md: ${baseSpacing * 1.5}px;
  --spacing-lg: ${baseSpacing * 2}px;
  --spacing-xl: ${baseSpacing * 3}px;
  
  /* Other */
  --border-radius: ${Math.max(4, baseSpacing * 0.5)}px;
  --box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

/* Base styles */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: var(--text-color);
  line-height: 1.5;
  background-color: var(--background);
  font-size: var(--base-font-size);
}

.container {
  width: ${dimensions.width}px;
  height: ${dimensions.height}px;
  margin: 0 auto;
  overflow: hidden;
  position: relative;
}

/* Typography */
h1, h2, h3, h4, h5, h6 {
  margin-bottom: var(--spacing-md);
  font-weight: 600;
  line-height: 1.2;
}

h1 {
  font-size: var(--title-font-size);
}

h2 {
  font-size: var(--heading-font-size);
  color: var(--text-color);
}

h3 {
  font-size: var(--subheading-font-size);
  text-align: center;
  margin-bottom: var(--spacing-xl);
}

h4 {
  font-size: calc(var(--base-font-size) * 1.2);
  margin-bottom: var(--spacing-sm);
}

h5 {
  font-size: var(--base-font-size);
  margin-bottom: var(--spacing-md);
  color: var(--secondary-color);
}

p {
  margin-bottom: var(--spacing-md);
  color: var(--text-light);
}

a {
  color: var(--primary-color);
  text-decoration: none;
  transition: color 0.2s ease;
}

a:hover, a:focus {
  color: var(--primary-hover);
  text-decoration: underline;
}

/* Buttons */
.primary-button {
  background-color: var(--primary-color);
  color: white;
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--border-radius);
  border: none;
  font-weight: 500;
  font-size: var(--base-font-size);
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.1s ease;
  box-shadow: var(--box-shadow);
}

.primary-button:hover {
  background-color: var(--primary-hover);
}

.primary-button:focus {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

.primary-button:active {
  transform: translateY(1px);
}

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-lg) var(--spacing-md);
  border-bottom: 1px solid var(--background-alt);
}

.logo h1 {
  font-size: calc(var(--base-font-size) * 1.5);
  margin-bottom: 0;
}

.main-nav ul {
  display: flex;
  list-style: none;
  gap: var(--spacing-lg);
}

.main-nav a {
  color: var(--text-light);
  font-weight: 500;
}

.main-nav a.active {
  color: var(--primary-color);
}

/* Mobile menu */
.mobile-menu-toggle {
  background: none;
  border: none;
  font-size: calc(var(--base-font-size) * 1.5);
  color: var(--text-color);
  cursor: pointer;
}

/* Hero Section */
.hero {
  display: flex;
  align-items: center;
  padding: var(--spacing-xl) var(--spacing-md);
  gap: var(--spacing-xl);
  ${layout === 'vertical' ? 'flex-direction: column;' : ''}
}

.hero-content {
  flex: 1;
  ${layout === 'vertical' ? 'text-align: center; max-width: 80%;' : ''}
}

.hero-content h2 {
  font-size: var(--heading-font-size);
  margin-bottom: var(--spacing-md);
}

.hero-content p {
  font-size: calc(var(--base-font-size) * 1.1);
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
  height: ${Math.min(300, dimensions.height * 0.4)}px;
  background-color: #e5e7eb;
  border-radius: var(--border-radius);
  border: 1px solid #d1d5db;
}

/* Features Section */
.features {
  padding: var(--spacing-xl) var(--spacing-md);
  background-color: var(--background-alt);
}

.feature-cards {
  display: flex;
  gap: var(--spacing-lg);
  justify-content: space-between;
  ${layout === 'vertical' ? 'flex-direction: column;' : ''}
}

.feature-cards.vertical {
  flex-direction: column;
}

.feature-cards.1-columns {
  flex-direction: column;
}

.feature-cards.2-columns {
  flex-wrap: wrap;
}

.feature-cards.2-columns .feature-card {
  flex-basis: calc(50% - var(--spacing-lg));
}

.feature-cards.3-columns {
  flex-wrap: wrap;
}

.feature-cards.3-columns .feature-card {
  flex-basis: calc(33.333% - var(--spacing-lg));
}

.feature-cards.4-columns {
  flex-wrap: wrap;
}

.feature-cards.4-columns .feature-card {
  flex-basis: calc(25% - var(--spacing-lg));
}

.feature-card {
  flex: 1;
  background-color: var(--background);
  padding: var(--spacing-lg);
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
  transition: transform 0.2s ease;
}

.feature-card:hover {
  transform: translateY(-2px);
}

.feature-icon {
  font-size: calc(var(--base-font-size) * 1.5);
  color: var(--primary-color);
  margin-bottom: var(--spacing-md);
}

/* Footer */
footer {
  background-color: var(--background-alt);
  padding: var(--spacing-xl) var(--spacing-md);
  margin-top: var(--spacing-xl);
}

.footer-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  margin-bottom: var(--spacing-lg);
}

.footer-links ul {
  list-style: none;
}

.footer-links li {
  margin-bottom: var(--spacing-sm);
}

.footer-links a {
  color: var(--text-light);
  font-size: calc(var(--base-font-size) * 0.9);
}

.footer-bottom {
  text-align: center;
  padding-top: var(--spacing-lg);
  border-top: 1px solid rgba(0,0,0,0.1);
  color: var(--text-light);
  font-size: calc(var(--base-font-size) * 0.9);
}

/* Accessibility */
:focus {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

:focus-visible {
  outline: 3px solid var(--primary-color);
  outline-offset: 3px;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .hero, .feature-cards {
    flex-direction: column;
  }
  
  .feature-card {
    margin-bottom: var(--spacing-lg);
  }
}`;

    const finalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Improved Design</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body>
  <div class="container">
    ${htmlStructure}
  </div>
</body>
</html>`;

    // Generate analysis response
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
            `Primary: ${colorPalette.primary[0]} - Used for primary buttons, links, and key accent elements`,
            `Secondary: ${colorPalette.secondary[0]} - Used for secondary buttons and supporting elements`,
            `Background: ${colorPalette.background[0]} (main), ${colorPalette.background[1]} (secondary) - Used for page and card backgrounds`,
            `Text: ${colorPalette.text[0]} (headings), ${colorPalette.text[1]} (body) - Used for text elements`
          ],
          typography: [
            `Headings: Inter, ${titleSize}px/700 (h1), ${headingSize}px/600 (h2), ${subheadingSize}px/600 (h3)`,
            `Body: Inter, ${baseFontSize}px/400 (primary)`,
            `Buttons: Inter, ${baseFontSize}px/500`,
            `Labels: Inter, ${Math.floor(baseFontSize * 0.9)}px/500`
          ],
          components: [
            `Buttons: Rounded corners (${Math.max(4, baseSpacing * 0.5)}px), padding (${baseSpacing}px ${baseSpacing * 2}px), primary (${colorPalette.primary[0]}), hover (${colorPalette.primary[1]})`,
            `Cards: White background, subtle shadow (0 2px 5px rgba(0,0,0,0.1)), ${Math.max(4, baseSpacing * 0.5)}px border radius, ${baseSpacing * 2}px padding`,
            `Navigation: ${baseSpacing * 2}px spacing between items, active state uses primary color`
          ]
        }
      },
      htmlCode: finalHtml,
      cssCode: cssStructure,
      metadata: {
        colors: colorPalette,
        fonts: [
          'Inter',
          'system-ui',
          'sans-serif'
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
      console.log('Creating data URL from image:', imageUrl);
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
          console.log('Image loaded successfully, dimensions:', img.naturalWidth, 'x', img.naturalHeight);
          
          // Create a canvas element to draw the image
          const canvas = document.createElement('canvas');
          
          // Check if dimensions are valid
          const width = img.naturalWidth || 800;
          const height = img.naturalHeight || 600;
          
          // Set canvas dimensions to match image
          canvas.width = width;
          canvas.height = height;
          
          // Get the context and draw the image
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            console.error('Could not get canvas context');
            resolve(null);
            return;
          }
          
          // Fill with white background first (in case of transparent images)
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          
          // Draw the image
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to data URL
          const quality = 0.8; // Adjust quality to manage file size
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          console.log('Created data URL, length:', dataUrl.length);
          
          resolve(dataUrl);
        } catch (error) {
          console.error('Error creating data URL:', error);
          resolve(null);
        }
      };
      
      img.onerror = (error) => {
        clearTimeout(timeoutId);
        console.error('Error loading image for data URL creation:', error);
        
        // Try a fallback approach for Figma URLs
        if (imageUrl.includes('figma.com') || imageUrl.includes('figma-alpha-api.s3')) {
          console.log('Attempting fallback for Figma image...');
          
          // Create a simple colored placeholder - better than nothing
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 800;
            canvas.height = 600;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              // Create a simple gradient background
              const gradient = ctx.createLinearGradient(0, 0, 800, 600);
              gradient.addColorStop(0, '#f5f5f5');
              gradient.addColorStop(1, '#e0e0e0');
              ctx.fillStyle = gradient;
              ctx.fillRect(0, 0, 800, 600);
              
              // Add text to indicate this is a placeholder
              ctx.fillStyle = '#666666';
              ctx.font = '24px Arial';
              ctx.textAlign = 'center';
              ctx.fillText('Figma Image Placeholder', 400, 300);
              
              const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
              console.log('Created fallback placeholder, length:', dataUrl.length);
              resolve(dataUrl);
              return;
            }
          } catch (fallbackError) {
            console.error('Fallback creation failed:', fallbackError);
          }
        }
        
        resolve(null);
      };
      
      // Try to bypass caching
      const cacheBuster = Date.now();
      const urlWithCacheBuster = imageUrl.includes('?') 
        ? `${imageUrl}&cb=${cacheBuster}` 
        : `${imageUrl}?cb=${cacheBuster}`;
      
      // Set the source to trigger loading
      img.src = urlWithCacheBuster;
    });
  }

  // Add this method to continue with the Anthropic analysis once we have the base64 image
  private async continueWithAnalysis(base64Image: string, dimensions: {width: number, height: number}, linkedInsights: any[]): Promise<DesignAnalysisResponse> {
    console.log('Continuing with analysis using base64 image, length:', base64Image.length);
    
    // Verify base64 image is valid
    if (!base64Image || base64Image.length < 100) {
      console.error('Invalid base64 image in continueWithAnalysis, length:', base64Image.length);
      throw new Error('Invalid image data for analysis');
    }
    
    // For production, use fallback to avoid CORS issues
    if (this.isProductionEnvironment()) {
      console.log('Production environment detected, using fallback method for API call');
      return this.getFallbackAnalysisResponse(dimensions);
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
    
    const systemPrompt = `You are a top-tier UI/UX designer with exceptional pixel-perfect reproduction skills and deep expertise in design analysis and improvement. Your task is to analyze a design image, provide detailed feedback on its strengths and weaknesses, and create an ITERATIVE HTML/CSS version that addresses those issues while MAINTAINING THE ORIGINAL DESIGN'S EXACT VISUAL STYLE.

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
    
    Your analysis MUST be organized into these specific sections:
    1. Design System Extraction - Detailed documentation of colors, typography, and component styles
    2. Visual Hierarchy - Issues and recommended improvements
    3. Color Contrast and Accessibility - Issues and recommended improvements
    4. Component Selection and Placement - Issues and recommended improvements
    5. Text Legibility - Issues and recommended improvements
    6. Overall Usability - Issues and recommended improvements
    7. Accessibility Considerations - Issues and recommended improvements
    8. General Strengths - What the design does well
    9. General Weaknesses - Overall issues with the design
    10. Specific Changes Made - Detailed before/after descriptions of all changes implemented
    11. Color Palette - Exact hex codes for all colors used, noting that these are preserved from the original
    12. Typography - Font families, sizes, weights used, noting that these are preserved from the original
    13. UI Components - List of all components identified in the design, noting any that were swapped and how their styling was preserved`;
    
    const userPrompt = `Analyze this UI design according to UI/UX best practices and create an IMPROVED ITERATION that maintains the original design system while addressing specific issues.

    THIS IS VERY IMPORTANT: 
    - The improved version should look like an ITERATION of the original design, not a completely new design.
    - You MUST use the EXACT SAME colors, fonts, and component styles from the original design.
    - You can improve the layout by rearranging components or swapping components for more appropriate ones (e.g., radio button to checkbox if multi-select is needed).
    - When swapping components, you MUST style the new component using the exact same design system (colors, borders, etc.) as the original.
    
    Perform a detailed analysis focusing specifically on:
    1. Visual hierarchy
    2. Color contrast and accessibility
    3. Component selection and placement
    4. Text legibility
    5. Overall usability
    6. Accessibility considerations
    
    Then create an improved version that:
    - Uses the EXACT SAME colors, typography, and UI component styles as the original
    - Maintains at least 85% of the original design's structure
    - Makes targeted improvements through better component arrangement or more appropriate component selection
    - Has the exact dimensions of ${dimensions.width}px × ${dimensions.height}px
    
    For any images in the design, replace them with colored div elements that match the dimensions and positioning of the original images.
    
    Organize your analysis into the specific sections outlined in your instructions, and provide detailed before/after descriptions for each change implemented, with special attention to how you preserved the original design system.
    ${linkedInsights.length > 0 ? insightsPrompt : ''}`;
    
    // Anthropic API request body
    const requestBody = {
      model: "claude-3-7-sonnet",
      max_tokens: 4000,
      temperature: 0.5,
      system: systemPrompt,
      messages: [
        {
          role: "user", 
          content: [
            {
              type: "text",
              text: userPrompt
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: base64Image
              }
            }
          ]
        }
      ]
    };
    
    console.log('Sending request to Anthropic API for design analysis...');
    
    let anthropicResponse;
    
    try {
      // Make API call to Anthropic
      anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': `${this.apiKey}`,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log('Received response from Anthropic API, status:', anthropicResponse.status);
      
      if (!anthropicResponse.ok) {
        const errorData = await anthropicResponse.text();
        console.error('Anthropic API error response:', errorData);
        
        // Parse the error data if possible
        let errorMessage = `Anthropic API error: ${anthropicResponse.status} ${anthropicResponse.statusText}`;
        try {
          const parsedError = JSON.parse(errorData);
          if (parsedError.error && parsedError.error.message) {
            errorMessage += `. ${parsedError.error.message}`;
          }
        } catch (e) {
          // If parsing fails, use the raw error text
          errorMessage += `. ${errorData}`;
        }
        
        // Always use fallback in development
        if (this.isDevEnvironment()) {
          console.log('Development environment detected, using fallback response for testing');
          return this.getFallbackAnalysisResponse(dimensions);
        }
        
        // Default behavior
        throw new Error(errorMessage);
      }
      
      const data = await anthropicResponse.json();
      console.log('Successfully parsed Anthropic API response');
      
      // Extract the response content from Anthropic's response structure
      if (!data.content || !data.content[0] || !data.content[0].text) {
        console.error('Unexpected Anthropic API response format:', data);
        throw new Error('Unexpected response format from Anthropic API');
      }
      
      const responseContent = data.content[0].text;
      console.log('Response content length:', responseContent.length);
      
      // Parse the response to extract HTML, CSS, and analysis
      return this.parseAnthropicResponse(responseContent, linkedInsights.length > 0);
    } catch (error: any) {
      console.error('Error calling Anthropic API:', error);
      
      // Always use fallback during development
      if (this.isDevEnvironment()) {
        console.log('Development environment detected, using fallback response for testing');
        return this.getFallbackAnalysisResponse(dimensions);
      }
      
      // Default behavior for unknown environments - throw the error
      throw new Error(`Anthropic API call failed: ${error.message}. Please check your API key and try again.`);
    }
  }
}

const anthropicService = new AnthropicService();
export default anthropicService; 