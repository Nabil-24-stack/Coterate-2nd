import supabaseService from './SupabaseService';
import figmaService from './FigmaService';

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
    
    // If no key in env, check if we have other environment variables
    if (!this.apiKey) {
      this.apiKey = process.env.ANTHROPIC_API_KEY || 
                   process.env.VERCEL_ANTHROPIC_API_KEY || null;
      
      // Log available environment variables for debugging (without revealing actual keys)
      if (this.isDevEnvironment()) {
        console.log('Environment variables available:', {
          hasReactAppKey: !!process.env.REACT_APP_ANTHROPIC_API_KEY,
          hasRegularKey: !!process.env.ANTHROPIC_API_KEY,
          hasVercelKey: !!process.env.VERCEL_ANTHROPIC_API_KEY,
          nodeEnv: process.env.NODE_ENV
        });
      }
    }
    
    // If still no key from env, check localStorage as fallback for development
    if (!this.apiKey && this.isDevEnvironment()) {
      this.apiKey = localStorage.getItem('anthropic_api_key');
      console.log('Using API key from localStorage:', !!this.apiKey);
    }
  }
  
  // Set API key manually (useful for development)
  setApiKey(key: string): void {
    this.apiKey = key;
    localStorage.setItem('anthropic_api_key', key);
  }
  
  // Check if API key is available
  hasApiKey(): boolean {
    // For production environments (like Vercel), we'll assume the API key is configured
    // server-side and not check for it client-side
    if (this.isProductionEnvironment()) {
      // In production, we'll trust that the server has the API key
      // and test the connection directly rather than checking for a client-side key
      console.log('Production environment detected, assuming API key is configured server-side');
      return true;
    }
    
    // For development environments, we still check for a client-side key
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
  
  // Add a method to test the API connection
  async testApiConnection(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('Testing API connection to Anthropic proxy...');
      
      // Simple test request
      const testResponse = await fetch('/api/anthropic-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          model: "claude-3-7-sonnet-20250219",
          max_tokens: 10,
          temperature: 0.2,
          system: "You are a helpful assistant.",
          messages: [{ role: "user", content: [{ type: "text", text: "Hello" }] }]
        })
      });
      
      console.log(`Test response status: ${testResponse.status}`);
      
      // If not OK, throw an error
      if (!testResponse.ok) {
        const errorText = await testResponse.text();
        throw new Error(`API test failed with status ${testResponse.status}: ${errorText}`);
      }
      
      const responseData = await testResponse.json();
      return { 
        success: true, 
        message: 'API connection successful' 
      };
    } catch (error: any) {
      console.error('API connection test failed:', error);
      return { 
        success: false, 
        message: `API connection test failed: ${error.message}` 
      };
    }
  }
  
  // Main method to analyze design image and generate improved version
  async analyzeDesignAndGenerateHTML(imageUrl: string, linkedInsights: any[] = []): Promise<DesignAnalysisResponse> {
    // In production we don't check for API key client-side as it's handled by the server
    if (!this.hasApiKey()) {
      console.error('Anthropic API key not configured, cannot generate design iteration');
      throw new Error('Anthropic API key not configured. Please set it in your environment variables.');
    }
    
    try {
      // Get image dimensions first
      const dimensions = await this.getImageDimensions(imageUrl);
      console.log(`Got image dimensions: ${dimensions.width}x${dimensions.height}`);
      
      // Get image as base64 if it's a remote URL
      let base64Image = '';
      
      if (imageUrl.startsWith('data:image')) {
        // Already a data URL, extract the base64 part
        base64Image = imageUrl.split(',')[1];
        console.log('Image is already a data URL, extracted base64 part, length:', base64Image.length);
      } else {
        try {
          // Try a more aggressive approach to get the image data
          let imageData = null;
          
          // Attempt 1: Try direct fetch with cors
          try {
            console.log('Attempt 1: Direct fetch with CORS');
            const fetchResponse = await fetch(imageUrl, { 
              method: 'GET',
              mode: 'cors',
              cache: 'no-cache'
            });
            
            if (fetchResponse.ok) {
              const blob = await fetchResponse.blob();
              console.log('Successfully fetched image, size:', blob.size);
              imageData = await this.blobToBase64(blob);
              console.log('Converted blob to base64, length:', imageData.length);
            }
          } catch (directFetchError) {
            console.warn('Direct fetch failed:', directFetchError);
          }
          
          // Attempt 2: Try using createDataUrlFromFigmaImage (works better for Figma)
          if (!imageData) {
            console.log('Attempt 2: Creating data URL directly');
            const dataUrl = await this.createDataUrlFromFigmaImage(imageUrl);
            
            if (dataUrl) {
              console.log('Successfully created data URL from image');
              imageData = dataUrl.split(',')[1];
              console.log('Extracted base64 from data URL, length:', imageData?.length);
            }
          }
          
          // Attempt 3: Try fetch with no-cors (will result in opaque response)
          if (!imageData) {
            console.log('Attempt 3: Fetch with no-cors');
            try {
              const fetchResponse = await fetch(imageUrl, { 
                method: 'GET',
                mode: 'no-cors',
                cache: 'no-cache'
              });
              
              // This won't directly work due to CORS but might in some browsers
              const blob = await fetchResponse.blob();
              console.log('Got opaque response, attempting to process, size:', blob.size);
              const dataUrl = await this.createFallbackImageFromBlob(blob, dimensions);
              if (dataUrl) {
                imageData = dataUrl.split(',')[1];
              }
            } catch (noCorsError) {
              console.warn('No-cors fetch failed:', noCorsError);
            }
          }
          
          // If all attempts fail, throw error - we need the original image
          if (!imageData) {
            throw new Error('Failed to process image - cannot create iteration without original image');
          }
          
          // Set the base64Image from our attempts
          if (imageData) {
            base64Image = imageData;
          } else {
            throw new Error('All attempts to fetch image failed');
          }
        } catch (error: any) {
          console.error('Error processing image:', error);
          throw new Error(`Failed to process image: ${error.message}`);
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
      
      // Verify base64Image is valid before sending
      if (!base64Image || base64Image.length < 100) {
        console.error('Invalid base64 image before API call');
        throw new Error('Invalid image data');
      }
      
      // STEP 1: Analyze the original design with error handling and retries
      console.log('STEP 1: Analyzing original design...');
      
      const analysisSystemPrompt = `You are a UI/UX design expert tasked with thoroughly analyzing a user interface design. 

      Your analysis will be used to generate an ITERATIVE improvement that maintains the original design identity while addressing specific issues.
      
      Focus on these key areas:
      
      1. DESIGN SYSTEM EXTRACTION (extract exact specs from the original design):
         - Color palette (exact hex codes for all colors, categorized)
         - Typography (font families, sizes, weights, line heights)
         - UI components (styles, patterns, states)
         - Layout structure and spacing
      
      2. UX ANALYSIS (identify specific issues in):
         - Visual hierarchy (clarity of information priority)
         - Color contrast and accessibility
         - Component selection and placement
         - Text legibility
         - Overall usability
         - Accessibility
      
      3. IMPROVEMENT RECOMMENDATIONS:
         - Suggest MINIMAL, precise changes that address the identified issues
         - Explain why each change would improve the design
         - Maintain the original design system and layout structure
         - Focus on subtle adjustments rather than redesigns
      
      FORMAT YOUR ANALYSIS:
      1. Design System: Colors
      2. Design System: Typography
      3. Design System: Components
      4. Design System: Layout
      5. Visual Hierarchy Analysis
      6. Color/Contrast Analysis
      7. Component Selection Analysis
      8. Text Legibility Analysis
      9. Usability Analysis
      10. Accessibility Analysis
      11. Design Strengths
      12. Specific Improvements`;
      
      const analysisUserPrompt = `Analyze this UI design image and create a detailed UX analysis with precise design system extraction. 

      I need a thorough examination of:
      1. The complete design system (colors, typography, components, layout)
      2. Specific UX issues in the design
      3. Precise improvement recommendations
      
      My goal is to create a SUBTLE ITERATION of this design that maintains its identity while improving UX issues. Your analysis should be detailed enough to allow for a pixel-perfect recreation with targeted improvements.
      
      The design dimensions are ${dimensions.width}px × ${dimensions.height}px.
      ${linkedInsights.length > 0 ? insightsPrompt : ''}`;
      
      // Determine the correct media type based on the image data
      let mediaType = 'image/jpeg';
      let processedBase64Image = base64Image;
      
      // Check if it's a PNG by looking at the data
      if (imageUrl.startsWith('data:image/png') || (imageUrl.startsWith('data:image') && base64Image.startsWith('iVBOR'))) {
        mediaType = 'image/png';
      }
      
      // Process the base64 data to ensure it doesn't contain any metadata or padding
      if (processedBase64Image.includes(',')) {
        processedBase64Image = processedBase64Image.split(',')[1];
      }
      
      // Trim any whitespace and ensure it's a valid base64 string
      processedBase64Image = processedBase64Image.trim();
      
      // Check if it's a valid base64 string
      const isBase64 = /^[A-Za-z0-9+/=]+$/.test(processedBase64Image);
      if (!isBase64) {
        console.error('Invalid base64 image data');
        throw new Error('Invalid image data format');
      }
      
      console.log(`Using media type: ${mediaType} for image data length: ${processedBase64Image.length}`);
      
      const analysisRequestBody = {
        model: "claude-3-7-sonnet-20250219",
        max_tokens: 4000,
        temperature: 0.2,
        system: analysisSystemPrompt,
        messages: [
          {
            role: "user", 
            content: [
              {
                type: "text",
                text: analysisUserPrompt
              },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: processedBase64Image
                }
              }
            ]
          }
        ]
      };
      
      // First try the proxy endpoint, with fallback to direct call if allowed
      let analysisResponse;
      let analysisError = null;
      
      try {
        // Try using our server proxy first
        console.log('Trying server proxy for Anthropic API analysis...');
        
        // Fix: Explicitly set the method as POST and include proper content type headers
        analysisResponse = await fetch('/api/anthropic-proxy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(analysisRequestBody),
          cache: 'no-cache'
        });
        
        if (!analysisResponse.ok) {
          const errorText = await analysisResponse.text();
          console.error('Server proxy error response:', analysisResponse.status, errorText);
          
          // More detailed error logging
          if (analysisResponse.status === 405) {
            console.error('Method Not Allowed: The server proxy only accepts POST requests. Check if the request is being sent properly.');
          } else if (analysisResponse.status === 401 || analysisResponse.status === 403) {
            console.error('Authentication error: Check if the Anthropic API key is configured correctly in environment variables.');
          } else if (analysisResponse.status === 500) {
            console.error('Server error: The proxy server encountered an internal error. Check server logs for details.');
          }
          
          throw new Error(`Server proxy returned: ${analysisResponse.status} ${analysisResponse.statusText}`);
        }
      } catch (error: any) {
        const proxyError = error;
        // If we're not in production and have an API key, try direct call as fallback
        if (!this.isProductionEnvironment() && this.apiKey) {
          console.log('Server proxy failed, attempting direct API call:', proxyError.message);
          
          try {
            // Direct call to Anthropic API as fallback
            analysisResponse = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': `${this.apiKey}`,
                'anthropic-version': '2023-06-01'
              },
              body: JSON.stringify(analysisRequestBody)
            });
            
            if (!analysisResponse.ok) {
              throw new Error(`Direct API call also failed: ${analysisResponse.status}`);
            }
          } catch (fallbackError: any) {
            // If both failed, throw a combined error
            analysisError = new Error(`Server proxy failed: ${proxyError.message}. Direct API call failed: ${fallbackError.message}`);
            throw analysisError;
          }
        } else {
          // In production, we only try the proxy, so just throw the proxy error
          throw proxyError;
        }
      }
      
      const analysisData = await analysisResponse.json();
      
      if (!analysisData.content || !analysisData.content[0] || !analysisData.content[0].text) {
        console.error('Unexpected Anthropic API response format (analysis):', analysisData);
        throw new Error('Unexpected response format from Anthropic API');
      }
      
      const analysisText = analysisData.content[0].text;
      console.log('Design analysis complete, length:', analysisText.length);
      
      // Extract design system information from analysis
      const designSystem = this.extractDesignSystem(analysisText);
      
      // STEP 2: Generate HTML/CSS that accurately reproduces the original design with targeted improvements
      
      console.log('STEP 2: Generating improved HTML/CSS based on analysis...');
      
      const iterationSystemPrompt = `You are a UI/UX implementation expert who creates pixel-perfect HTML/CSS iterations of UI designs.

      YOUR TASK:
      Create an HTML/CSS implementation of a UI design that:
      1. EXACTLY reproduces the original design's layout, components, and visual style
      2. Applies ONLY specific, targeted improvements identified in the analysis
      3. Maintains 95% of the original design's visual identity
      
      REQUIREMENTS:
      1. Create clean, semantic HTML with inline CSS in a <style> tag
      2. Use the EXACT color palette, typography, and component styles from the analysis
      3. Match the layout and structure precisely to the original design
      4. Make ONLY the specific changes identified in the analysis - no other alterations
      5. Design must be responsive while maintaining proportions
      6. Final dimensions must match original: ${dimensions.width}px × ${dimensions.height}px
      7. Replace any images with appropriate colored div elements
      
      YOUR RESPONSE MUST INCLUDE:
      1. Complete HTML document with inline CSS
      2. A changelog listing the specific improvements made
      
      MOST IMPORTANT: Your implementation must be a true iteration that looks almost identical to the original design but with subtle, targeted improvements.`;
      
      const iterationUserPrompt = `Using the design analysis below, create an HTML/CSS implementation that precisely recreates the original design with only the specific UX improvements identified in the analysis.

      Design Analysis:
      ${analysisText}
      
      Design System Summary (use these exact values):
      - Colors: ${designSystem.colors.join(', ')}
      - Typography: ${designSystem.typography.join(', ')}
      - Components: ${designSystem.components.join(', ')}
      
      CRITICAL REQUIREMENTS:
      1. Create a pixel-perfect recreation of the original design
      2. Apply ONLY the specific improvements mentioned in the analysis
      3. Maintain the original design's visual identity
      4. Match the exact dimensions: ${dimensions.width}px × ${dimensions.height}px
      
      Your HTML/CSS must look like a subtle iteration of the original design, not a new design.`;
      
      const iterationRequestBody = {
        model: "claude-3-7-sonnet-20250219",
        max_tokens: 4000,
        temperature: 0.2,
        system: iterationSystemPrompt,
        messages: [
          {
            role: "user", 
            content: [
              {
                type: "text",
                text: iterationUserPrompt
              }
            ]
          }
        ]
      };
      
      // Make API call to Anthropic for HTML/CSS generation
      const iterationResponse = await fetch('/api/anthropic-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(iterationRequestBody),
        cache: 'no-cache'
      });
      
      if (!iterationResponse.ok) {
        const errorData = await iterationResponse.text();
        console.error('Anthropic API error response (iteration):', errorData);
        throw new Error(`HTML/CSS generation failed: ${iterationResponse.status} ${iterationResponse.statusText}`);
      }
      
      const iterationData = await iterationResponse.json();
      
      if (!iterationData.content || !iterationData.content[0] || !iterationData.content[0].text) {
        console.error('Unexpected Anthropic API response format (iteration):', iterationData);
        throw new Error('Unexpected response format from Anthropic API');
      }
      
      const iterationText = iterationData.content[0].text;
      console.log('HTML/CSS generation complete, length:', iterationText.length);
      
      // Parse the complete response to extract HTML, CSS, and analysis
      return this.parseResponseWithAnalysis(iterationText, analysisText, designSystem);
    } catch (error: any) {
      console.error('Error analyzing design:', error);
      throw new Error(`Failed to generate design iteration: ${error.message}`);
    }
  }
  
  // Helper to extract list items from a section
  private extractListItems(text: string): string[] {
    const result: string[] = [];
    
    // Check for bullet points with various markers
    const bulletPointPattern = /(?:^|\n)\s*(?:[-*•]|\d+\.)\s+(.*?)(?=\n\s*(?:[-*•]|\d+\.)\s+|\n\n|$)/g;
    let match;
    
    while ((match = bulletPointPattern.exec(text)) !== null) {
      if (match[1] && match[1].trim()) {
        result.push(match[1].trim());
      }
    }
    
    // If no bullet points found, try to split by newlines
    if (result.length === 0) {
      const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#'));
      
      result.push(...lines);
    }
    
    return result;
  }
  
  // Helper to extract design system from analysis text
  private extractDesignSystem(analysisText: string): {
    colors: string[];
    typography: string[];
    components: string[];
  } {
    const designSystem = {
      colors: [] as string[],
      typography: [] as string[],
      components: [] as string[]
    };
    
    // Extract colors
    const colorsRegex = /Design System: Colors:([\s\S]*?)(?:Design System: Typography|Typography|##)/i;
    const colorsMatch = analysisText.match(colorsRegex);
    if (colorsMatch && colorsMatch[1]) {
      // Extract hex codes
      const hexRegex = /#[0-9A-Fa-f]{3,6}/g;
      const hexMatches = colorsMatch[1].match(hexRegex);
      if (hexMatches) {
        // Create a new array with unique values instead of using Set
        designSystem.colors = hexMatches.filter((value, index, self) => 
          self.indexOf(value) === index
        );
      }
    }
    
    // Extract typography
    const typographyRegex = /Design System: Typography:([\s\S]*?)(?:Design System: Components|Components|##)/i;
    const typographyMatch = analysisText.match(typographyRegex);
    if (typographyMatch && typographyMatch[1]) {
      // Extract font families using exec instead of matchAll
      const fontRegex = /(?:font-family|font family|fonts?):\s*([^,\.;\n]+)/gi;
      let fontMatch;
      const fontNames: string[] = [];
      
      while ((fontMatch = fontRegex.exec(typographyMatch[1])) !== null) {
        if (fontMatch[1]) {
          const fontName = fontMatch[1].trim().replace(/['"`]/g, '');
          if (fontName.length > 0 && !fontNames.includes(fontName)) {
            fontNames.push(fontName);
          }
        }
      }
      
      designSystem.typography = fontNames;
    }
    
    // Extract components
    const componentsRegex = /Design System: Components:([\s\S]*?)(?:Design System: Layout|Layout|Visual Hierarchy|##)/i;
    const componentsMatch = analysisText.match(componentsRegex);
    if (componentsMatch && componentsMatch[1]) {
      // Extract component names from bullet points using exec instead of matchAll
      const componentRegex = /(?:^|\n)[-*•]\s*([A-Z][^:]+):/gm;
      let componentMatch;
      const componentNames: string[] = [];
      
      while ((componentMatch = componentRegex.exec(componentsMatch[1])) !== null) {
        if (componentMatch[1] && componentMatch[1].trim().length > 0) {
          componentNames.push(componentMatch[1].trim());
        }
      }
      
      designSystem.components = componentNames;
    }
    
    return designSystem;
  }
  
  // Parse the response and combine with analysis
  private parseResponseWithAnalysis(iterationText: string, analysisText: string, designSystem: {colors: string[], typography: string[], components: string[]}): DesignAnalysisResponse {
    console.log('Parsing response and combining with analysis...');
    
    try {
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
      
      // Extract HTML code between ```html and ``` tags
      const htmlRegex = /```html\s*([\s\S]*?)```/;
      const htmlMatch = iterationText.match(htmlRegex);
      if (htmlMatch && htmlMatch[1]) {
        result.htmlCode = htmlMatch[1].trim();
      } else {
        // If not found, try to extract HTML document directly
        const htmlDocRegex = /<!DOCTYPE html>\s*<html[^>]*>([\s\S]*?)<\/html>/;
        const htmlDocMatch = iterationText.match(htmlDocRegex);
        if (htmlDocMatch) {
          result.htmlCode = `<!DOCTYPE html><html>${htmlDocMatch[1]}</html>`;
        }
      }
      
      // Extract CSS code
      const cssRegex = /```css\s*([\s\S]*?)```/;
      const cssMatch = iterationText.match(cssRegex);
      if (cssMatch && cssMatch[1]) {
        result.cssCode = cssMatch[1].trim();
      } else if (result.htmlCode) {
        // If no separate CSS, try to extract from style tags in the HTML
        const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/;
        const styleMatch = result.htmlCode.match(styleRegex);
        if (styleMatch && styleMatch[1]) {
          result.cssCode = styleMatch[1].trim();
        }
      }
      
      // Extract specific changes from the iteration text
      const changelogRegex = /(?:Changes Made|Changelog|Improvements Made|Specific Changes):([\s\S]*?)(?:##|\n\n\n|```|$)/i;
      const changelogMatch = iterationText.match(changelogRegex);
      if (changelogMatch && changelogMatch[1]) {
        result.analysis.specificChanges = this.extractListItems(changelogMatch[1]);
      }
      
      // If no specific changes found, check for a summary section
      if (result.analysis.specificChanges && result.analysis.specificChanges.length === 0) {
        const summaryRegex = /(?:Summary|Overview|Implementation Summary):([\s\S]*?)(?:##|\n\n\n|```|$)/i;
        const summaryMatch = iterationText.match(summaryRegex);
        if (summaryMatch && summaryMatch[1]) {
          result.analysis.specificChanges = this.extractListItems(summaryMatch[1]);
        }
      }
      
      // Extract analysis data from the analysis text
      
      // Extract strengths
      const strengthsRegex = /(?:Design Strengths|Strengths):([\s\S]*?)(?:Design Weaknesses|Weaknesses|Specific Improvements|##)/i;
      const strengthsMatch = analysisText.match(strengthsRegex);
      if (strengthsMatch && strengthsMatch[1]) {
        result.analysis.strengths = this.extractListItems(strengthsMatch[1]);
      }
      
      // Extract weaknesses/improvement areas
      const weaknessesRegex = /(?:Design Weaknesses|Weaknesses):([\s\S]*?)(?:Specific Improvements|Improvements|##)/i;
      const weaknessesMatch = analysisText.match(weaknessesRegex);
      if (weaknessesMatch && weaknessesMatch[1]) {
        result.analysis.weaknesses = this.extractListItems(weaknessesMatch[1]);
      }
      
      // Extract improvement areas
      const improvementsRegex = /(?:Specific Improvements|Improvements|Improvement Areas):([\s\S]*?)(?:##|$)/i;
      const improvementsMatch = analysisText.match(improvementsRegex);
      if (improvementsMatch && improvementsMatch[1]) {
        result.analysis.improvementAreas = this.extractListItems(improvementsMatch[1]);
      }
      
      // Extract visual hierarchy analysis
      const visualHierarchyRegex = /Visual Hierarchy Analysis:([\s\S]*?)(?:Color|Contrast|Component|##)/i;
      const visualHierarchyMatch = analysisText.match(visualHierarchyRegex);
      if (visualHierarchyMatch && visualHierarchyMatch[1]) {
        // Look for clear issues/improvements sections
        const issuesRegex = /Issues:([\s\S]*?)(?:Recommendations|Improvements|$)/i;
        const issuesMatch = visualHierarchyMatch[1].match(issuesRegex);
        
        const improvementsRegex = /(?:Recommendations|Improvements):([\s\S]*?)$/i;
        const improvementsMatch = visualHierarchyMatch[1].match(improvementsRegex);
        
        if (issuesMatch && issuesMatch[1]) {
          result.analysis.visualHierarchy.issues = this.extractListItems(issuesMatch[1]);
        } else {
          // If no clear issues section, extract all bullet points as issues
          result.analysis.visualHierarchy.issues = this.extractListItems(visualHierarchyMatch[1]);
        }
        
        if (improvementsMatch && improvementsMatch[1]) {
          result.analysis.visualHierarchy.improvements = this.extractListItems(improvementsMatch[1]);
        }
      }
      
      // Extract color contrast analysis
      const colorContrastRegex = /(?:Color\/Contrast Analysis|Color Contrast Analysis|Contrast Analysis):([\s\S]*?)(?:Component|Text|##)/i;
      const colorContrastMatch = analysisText.match(colorContrastRegex);
      if (colorContrastMatch && colorContrastMatch[1]) {
        // Look for clear issues/improvements sections
        const issuesRegex = /Issues:([\s\S]*?)(?:Recommendations|Improvements|$)/i;
        const issuesMatch = colorContrastMatch[1].match(issuesRegex);
        
        const improvementsRegex = /(?:Recommendations|Improvements):([\s\S]*?)$/i;
        const improvementsMatch = colorContrastMatch[1].match(improvementsRegex);
        
        if (issuesMatch && issuesMatch[1]) {
          result.analysis.colorContrast.issues = this.extractListItems(issuesMatch[1]);
        } else {
          // If no clear issues section, extract all bullet points as issues
          result.analysis.colorContrast.issues = this.extractListItems(colorContrastMatch[1]);
        }
        
        if (improvementsMatch && improvementsMatch[1]) {
          result.analysis.colorContrast.improvements = this.extractListItems(improvementsMatch[1]);
        }
      }
      
      // Extract component selection analysis
      const componentSelectionRegex = /(?:Component Selection Analysis|Component Analysis):([\s\S]*?)(?:Text|Usability|##)/i;
      const componentSelectionMatch = analysisText.match(componentSelectionRegex);
      if (componentSelectionMatch && componentSelectionMatch[1]) {
        // Look for clear issues/improvements sections
        const issuesRegex = /Issues:([\s\S]*?)(?:Recommendations|Improvements|$)/i;
        const issuesMatch = componentSelectionMatch[1].match(issuesRegex);
        
        const improvementsRegex = /(?:Recommendations|Improvements):([\s\S]*?)$/i;
        const improvementsMatch = componentSelectionMatch[1].match(improvementsRegex);
        
        if (issuesMatch && issuesMatch[1]) {
          result.analysis.componentSelection.issues = this.extractListItems(issuesMatch[1]);
        } else {
          // If no clear issues section, extract all bullet points as issues
          result.analysis.componentSelection.issues = this.extractListItems(componentSelectionMatch[1]);
        }
        
        if (improvementsMatch && improvementsMatch[1]) {
          result.analysis.componentSelection.improvements = this.extractListItems(improvementsMatch[1]);
        }
      }
      
      // Extract text legibility analysis
      const textLegibilityRegex = /(?:Text Legibility Analysis|Text Analysis|Legibility Analysis):([\s\S]*?)(?:Usability|Accessibility|##)/i;
      const textLegibilityMatch = analysisText.match(textLegibilityRegex);
      if (textLegibilityMatch && textLegibilityMatch[1]) {
        // Look for clear issues/improvements sections
        const issuesRegex = /Issues:([\s\S]*?)(?:Recommendations|Improvements|$)/i;
        const issuesMatch = textLegibilityMatch[1].match(issuesRegex);
        
        const improvementsRegex = /(?:Recommendations|Improvements):([\s\S]*?)$/i;
        const improvementsMatch = textLegibilityMatch[1].match(improvementsRegex);
        
        if (issuesMatch && issuesMatch[1]) {
          result.analysis.textLegibility.issues = this.extractListItems(issuesMatch[1]);
        } else {
          // If no clear issues section, extract all bullet points as issues
          result.analysis.textLegibility.issues = this.extractListItems(textLegibilityMatch[1]);
        }
        
        if (improvementsMatch && improvementsMatch[1]) {
          result.analysis.textLegibility.improvements = this.extractListItems(improvementsMatch[1]);
        }
      }
      
      // Extract usability analysis
      const usabilityRegex = /(?:Usability Analysis|Overall Usability):([\s\S]*?)(?:Accessibility|Design Strengths|##)/i;
      const usabilityMatch = analysisText.match(usabilityRegex);
      if (usabilityMatch && usabilityMatch[1]) {
        // Look for clear issues/improvements sections
        const issuesRegex = /Issues:([\s\S]*?)(?:Recommendations|Improvements|$)/i;
        const issuesMatch = usabilityMatch[1].match(issuesRegex);
        
        const improvementsRegex = /(?:Recommendations|Improvements):([\s\S]*?)$/i;
        const improvementsMatch = usabilityMatch[1].match(improvementsRegex);
        
        if (issuesMatch && issuesMatch[1]) {
          result.analysis.usability.issues = this.extractListItems(issuesMatch[1]);
        } else {
          // If no clear issues section, extract all bullet points as issues
          result.analysis.usability.issues = this.extractListItems(usabilityMatch[1]);
        }
        
        if (improvementsMatch && improvementsMatch[1]) {
          result.analysis.usability.improvements = this.extractListItems(improvementsMatch[1]);
        }
      }
      
      // Extract accessibility analysis
      const accessibilityRegex = /(?:Accessibility Analysis|Accessibility):([\s\S]*?)(?:Design Strengths|Specific Improvements|##)/i;
      const accessibilityMatch = analysisText.match(accessibilityRegex);
      if (accessibilityMatch && accessibilityMatch[1]) {
        // Look for clear issues/improvements sections
        const issuesRegex = /Issues:([\s\S]*?)(?:Recommendations|Improvements|$)/i;
        const issuesMatch = accessibilityMatch[1].match(issuesRegex);
        
        const improvementsRegex = /(?:Recommendations|Improvements):([\s\S]*?)$/i;
        const improvementsMatch = accessibilityMatch[1].match(improvementsRegex);
        
        if (issuesMatch && issuesMatch[1]) {
          result.analysis.accessibility.issues = this.extractListItems(issuesMatch[1]);
        } else {
          // If no clear issues section, extract all bullet points as issues
          result.analysis.accessibility.issues = this.extractListItems(accessibilityMatch[1]);
        }
        
        if (improvementsMatch && improvementsMatch[1]) {
          result.analysis.accessibility.improvements = this.extractListItems(improvementsMatch[1]);
        }
      }
      
      // Populate design system information
      result.analysis.designSystem.colorPalette = designSystem.colors.map(color => `${color}`);
      result.analysis.designSystem.typography = designSystem.typography.map(font => `${font}`);
      result.analysis.designSystem.components = designSystem.components;
      
      // Populate metadata
      if (designSystem.colors.length > 0) {
        // Categorize colors by position if we have enough
        const totalColors = designSystem.colors.length;
        if (totalColors >= 4) {
          const primaryCount = Math.max(1, Math.floor(totalColors * 0.3));
          const secondaryCount = Math.max(1, Math.floor(totalColors * 0.2));
          const backgroundCount = Math.max(1, Math.floor(totalColors * 0.2));
          const textCount = totalColors - primaryCount - secondaryCount - backgroundCount;
          
          result.metadata.colors.primary = designSystem.colors.slice(0, primaryCount);
          result.metadata.colors.secondary = designSystem.colors.slice(primaryCount, primaryCount + secondaryCount);
          result.metadata.colors.background = designSystem.colors.slice(primaryCount + secondaryCount, primaryCount + secondaryCount + backgroundCount);
          result.metadata.colors.text = designSystem.colors.slice(primaryCount + secondaryCount + backgroundCount);
        } else {
          // If we don't have enough colors, assign them evenly
          result.metadata.colors.primary = [designSystem.colors[0]];
          result.metadata.colors.secondary = designSystem.colors.length > 1 ? [designSystem.colors[1]] : [designSystem.colors[0]];
          result.metadata.colors.background = designSystem.colors.length > 2 ? [designSystem.colors[2]] : [designSystem.colors[0]];
          result.metadata.colors.text = designSystem.colors.length > 3 ? [designSystem.colors[3]] : [designSystem.colors[0]];
        }
      }
      
      result.metadata.fonts = designSystem.typography;
      result.metadata.components = designSystem.components;
      
      // If HTML or CSS is still empty after extraction, throw an error
      if (!result.htmlCode || !result.cssCode) {
        console.error('Failed to extract HTML or CSS from response');
        throw new Error('Failed to extract HTML or CSS from response');
      }
      
      return result;
    } catch (error: any) {
      console.error('Error parsing response:', error);
      throw new Error(`Failed to parse response: ${error.message}`);
    }
  }
  
  // Helper to extract font families from typography text
  private extractFontFamilies(text: string): string[] {
    // Common font patterns
    const fontPatterns = [
      /font-family:\s*([^;]+)/gi,
      /font family:\s*([^,\.]+)/gi,
      /(?:headings?|body|text|buttons?)(?:\s*font)?:\s*([^,\.]+)/gi
    ];
    
    let fontMatches: string[] = [];
    
    // Try each pattern
    for (const pattern of fontPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1]) {
          // Clean up font names
          const fonts = match[1].split(',')
            .map((font: string) => font.trim().replace(/['"`]/g, ''))
            .filter((font: string) => font.length > 0 && !font.startsWith('#'));
          fontMatches = fontMatches.concat(fonts);
        }
      }
    }
    
    // Deduplicate using filter instead of Set
    return fontMatches.filter((value, index, self) => self.indexOf(value) === index);
  }
  
  // Helper to extract component types from components text
  private extractComponentTypes(text: string): string[] {
    // Common component pattern
    const commonComponents = [
      'Button', 'Input', 'Checkbox', 'Radio', 'Select', 'Dropdown', 'Toggle', 
      'Switch', 'Card', 'Modal', 'Dialog', 'Tooltip', 'Tab', 'Navbar', 'Navigation',
      'Menu', 'Footer', 'Header', 'Sidebar', 'Form', 'Table', 'List', 'Carousel',
      'Slider', 'Progress', 'Badge', 'Alert', 'Notification', 'Avatar', 'Icon'
    ];
    
    const componentMatches: string[] = [];
    
    // Look for components by name
    for (const component of commonComponents) {
      const regex = new RegExp(`\\b${component}s?\\b`, 'i');
      if (regex.test(text)) {
        componentMatches.push(component);
      }
    }
    
    // Also extract component names from bullet points
    const bulletPointsRegex = /(?:^|\n)[-*•]\s*([A-Z][^:]+):/gm;
    let match;
    while ((match = bulletPointsRegex.exec(text)) !== null) {
      if (match[1] && /button|input|element|component/i.test(match[1])) {
        componentMatches.push(match[1].trim());
      }
    }
    
    // Deduplicate using filter instead of Set
    return componentMatches.filter((value, index, self) => self.indexOf(value) === index);
  }

  // Helper to extract hex color codes from text
  private extractHexCodes(text: string): string[] {
    const hexRegex = /#[0-9A-Fa-f]{3,6}/g;
    const matches = text.match(hexRegex);
    if (!matches) return [];
    
    // Deduplicate using filter instead of Set
    return matches.filter((value, index, self) => self.indexOf(value) === index);
  }
  
  // Helper method to create a fallback image from a blob
  private async createFallbackImageFromBlob(blob: Blob, dimensions: {width: number, height: number}): Promise<string | null> {
    try {
      // Create a URL for the blob
      const blobUrl = URL.createObjectURL(blob);
      
      // Try to create a data URL from this blob URL
      const dataUrl = await this.createDataUrlFromFigmaImage(blobUrl);
      
      // Revoke the blob URL to avoid memory leaks
      URL.revokeObjectURL(blobUrl);
      
      return dataUrl;
    } catch (error) {
      console.error('Error creating fallback image from blob:', error);
      return null;
    }
  }
  
  // Helper method to create a placeholder image with text
  private createPlaceholderImage(dimensions: {width: number, height: number}, text: string): string {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }
      
      // Fill with a gradient background
      const gradient = ctx.createLinearGradient(0, 0, dimensions.width, dimensions.height);
      gradient.addColorStop(0, '#f8f9fa');
      gradient.addColorStop(1, '#e9ecef');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);
      
      // Add text to the canvas
      ctx.fillStyle = '#212529';
      ctx.font = `bold ${Math.max(16, Math.min(32, dimensions.width / 20))}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, dimensions.width / 2, dimensions.height / 2);
      
      // Add some UI-like elements to simulate a design
      this.drawSimulatedUI(ctx, dimensions);
      
      return canvas.toDataURL('image/jpeg', 0.9);
    } catch (error) {
      console.error('Error creating placeholder image:', error);
      // Return an empty data URL as fallback
      return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    }
  }
  
  // Helper method to draw UI-like elements on the placeholder
  private drawSimulatedUI(ctx: CanvasRenderingContext2D, dimensions: {width: number, height: number}): void {
    const width = dimensions.width;
    const height = dimensions.height;
    
    // Draw a header
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height * 0.1);
    
    // Draw a logo-like element
    ctx.fillStyle = '#4a6cf7';
    ctx.fillRect(width * 0.05, height * 0.03, width * 0.1, height * 0.04);
    
    // Draw navigation items
    ctx.fillStyle = '#495057';
    const navItems = 4;
    const navWidth = width * 0.1;
    const navGap = width * 0.02;
    const navStart = width * 0.5;
    
    for (let i = 0; i < navItems; i++) {
      ctx.fillRect(navStart + i * (navWidth + navGap), height * 0.03, navWidth, height * 0.04);
    }
    
    // Draw a main content area
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(width * 0.05, height * 0.15, width * 0.9, height * 0.6);
    
    // Draw some text blocks
    ctx.fillStyle = '#212529';
    ctx.fillRect(width * 0.1, height * 0.2, width * 0.4, height * 0.05);
    ctx.fillRect(width * 0.1, height * 0.28, width * 0.6, height * 0.03);
    ctx.fillRect(width * 0.1, height * 0.33, width * 0.6, height * 0.03);
    
    // Draw a button
    ctx.fillStyle = '#4a6cf7';
    ctx.fillRect(width * 0.1, height * 0.4, width * 0.2, height * 0.06);
    
    // Draw some card-like elements
    const cardWidth = width * 0.25;
    const cardHeight = height * 0.2;
    const cardGap = width * 0.05;
    const cardsY = height * 0.5;
    
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(width * 0.1 + i * (cardWidth + cardGap), cardsY, cardWidth, cardHeight);
      
      ctx.fillStyle = '#495057';
      ctx.fillRect(width * 0.12 + i * (cardWidth + cardGap), cardsY + height * 0.02, cardWidth - width * 0.04, height * 0.04);
      ctx.fillRect(width * 0.12 + i * (cardWidth + cardGap), cardsY + height * 0.08, cardWidth - width * 0.04, height * 0.02);
      ctx.fillRect(width * 0.12 + i * (cardWidth + cardGap), cardsY + height * 0.12, cardWidth - width * 0.04, height * 0.02);
    }
    
    // Draw a footer
    ctx.fillStyle = '#f1f3f5';
    ctx.fillRect(0, height * 0.8, width, height * 0.2);
    
    // Draw footer content
    ctx.fillStyle = '#495057';
    ctx.fillRect(width * 0.1, height * 0.85, width * 0.2, height * 0.03);
    ctx.fillRect(width * 0.4, height * 0.85, width * 0.15, height * 0.03);
    ctx.fillRect(width * 0.65, height * 0.85, width * 0.15, height * 0.03);
    
    // Draw footer line
    ctx.fillStyle = '#dee2e6';
    ctx.fillRect(width * 0.05, height * 0.9, width * 0.9, height * 0.002);
    
    // Draw copyright-like text
    ctx.fillStyle = '#6c757d';
    ctx.fillRect(width * 0.3, height * 0.93, width * 0.4, height * 0.02);
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
            console.warn('Base64 string contains invalid characters, cleaning...');
            base64 = base64.replace(/[^A-Za-z0-9+/=]/g, '');
            
            if (base64.length === 0) {
              console.error('Base64 string is empty after cleaning');
              reject(new Error('Base64 string is empty after cleaning'));
              return;
            }
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

  // Add this method to create a data URL from an image
  private async createDataUrlFromFigmaImage(imageUrl: string): Promise<string | null> {
    return new Promise((resolve) => {
      console.log('Creating data URL from image:', imageUrl);
      
      // Special handling for Figma URLs
      let processedUrl = imageUrl;
      if (imageUrl.includes('figma.com') || imageUrl.includes('figma-alpha')) {
        // Add cache busting parameter for Figma URLs
        const cacheBuster = Date.now();
        processedUrl = imageUrl.includes('?') 
          ? `${imageUrl}&t=${cacheBuster}` 
          : `${imageUrl}?t=${cacheBuster}`;
        console.log('Processing Figma URL with cache busting:', processedUrl);
      }
      
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      // Set a timeout to avoid hanging
      const timeoutId = setTimeout(() => {
        console.log('Image load timed out, trying to create pixel data manually');
        // Create a fallback image with dimensions from the current screen dimensions
        try {
          const width = window.innerWidth || 1200;
          const height = window.innerHeight || 800;
          
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Fill with a light color
            ctx.fillStyle = '#f8f9fa';
            ctx.fillRect(0, 0, width, height);
            
            // Add text indicating this is a fallback
            ctx.fillStyle = '#495057';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Original Design (Generated Placeholder)', width / 2, height / 2);
            
            // Get data URL
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            console.log('Created fallback dataURL after timeout');
            resolve(dataUrl);
            return;
          }
        } catch (e) {
          console.error('Error creating fallback image after timeout:', e);
        }
        
        resolve(null);
      }, 8000); // Increased timeout for slower connections
      
      img.onload = () => {
        clearTimeout(timeoutId);
        try {
          console.log('Image loaded successfully, dimensions:', img.naturalWidth, 'x', img.naturalHeight);
          
          if (img.naturalWidth === 0 || img.naturalHeight === 0) {
            console.warn('Image loaded but has zero dimensions, creating fallback');
            const fallbackDataUrl = this.createPlaceholderImage(
              {width: 800, height: 600}, 
              'Original Design'
            );
            resolve(fallbackDataUrl);
            return;
          }
          
          // Create a canvas element to draw the image
          const canvas = document.createElement('canvas');
          
          // Calculate safe dimensions
          const maxWidth = Math.min(img.naturalWidth, 4000);
          const maxHeight = Math.min(img.naturalHeight, 4000);
          
          // Set canvas dimensions
          canvas.width = maxWidth;
          canvas.height = maxHeight;
          
          // Get the context and draw the image
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            console.error('Could not get canvas context');
            resolve(null);
            return;
          }
          
          // Fill with white background first
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, maxWidth, maxHeight);
          
          // Draw the image
          ctx.drawImage(img, 0, 0, maxWidth, maxHeight);
          
          try {
            // First try with high quality
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            
            // Validate the data URL
            if (dataUrl && dataUrl.length > 100) {
              console.log('Created high quality data URL, length:', dataUrl.length);
              resolve(dataUrl);
              return;
            }
            
            // If that fails, try with lower quality
            console.log('High quality conversion failed, trying lower quality');
            const lowQualityDataUrl = canvas.toDataURL('image/jpeg', 0.6);
            
            if (lowQualityDataUrl && lowQualityDataUrl.length > 100) {
              console.log('Created low quality data URL, length:', lowQualityDataUrl.length);
              resolve(lowQualityDataUrl);
              return;
            }
            
            // If that also fails, try PNG format
            console.log('JPEG conversion failed, trying PNG format');
            const pngDataUrl = canvas.toDataURL('image/png');
            
            if (pngDataUrl && pngDataUrl.length > 100) {
              console.log('Created PNG data URL, length:', pngDataUrl.length);
              resolve(pngDataUrl);
              return;
            }
          } catch (canvasError) {
            console.error('Error creating data URL from canvas:', canvasError);
          }
          
          // Last resort - create a simple placeholder with same dimensions
          console.log('All canvas conversion attempts failed, creating placeholder');
          const fallbackDataUrl = this.createPlaceholderImage(
            {width: maxWidth, height: maxHeight},
            'Original Design'
          );
          resolve(fallbackDataUrl);
        } catch (error) {
          console.error('Error in image onload handler:', error);
          resolve(null);
        }
      };
      
      img.onerror = (error) => {
        clearTimeout(timeoutId);
        console.error('Error loading image for data URL creation:', error);
        
        // Try to determine dimensions for fallback
        if (typeof window !== 'undefined') {
          const fallbackWidth = window.innerWidth || 800;
          const fallbackHeight = window.innerHeight || 600;
          
          const fallbackDataUrl = this.createPlaceholderImage(
            {width: fallbackWidth, height: fallbackHeight},
            'Original Design'
          );
          resolve(fallbackDataUrl);
        } else {
          resolve(null);
        }
      };
      
      // Add more robust error handling
      img.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        console.log('Image loading aborted');
        resolve(null);
      });
      
      // Set the source to trigger loading
      img.src = processedUrl;
      
      // For browsers that may have the image cached
      if (img.complete) {
        clearTimeout(timeoutId);
        console.log('Image already complete - might be cached');
        
        try {
          if (img.naturalWidth === 0 || img.naturalHeight === 0) {
            console.warn('Cached image has invalid dimensions, retrying with cache buster');
            
            // Force reload with cache busting
            const newCacheBuster = Date.now() + 1;
            const forcedUrl = processedUrl.includes('?') 
              ? `${processedUrl}&cb=${newCacheBuster}` 
              : `${processedUrl}?cb=${newCacheBuster}`;
            
            img.src = forcedUrl;
          } else {
            // Process the complete image
            img.onload?.call(img, new Event('synthetic-load'));
          }
        } catch (e) {
          console.error('Error handling already complete image:', e);
          resolve(null);
        }
      }
    });
  }

  // Add a simplified method for design analysis that doesn't send the image
  async analyzeDesignWithPromptOnly(designDescription: string): Promise<DesignAnalysisResponse> {
    try {
      console.log('Using text-only analysis approach for more reliability');
      
      const analysisSystemPrompt = `You are a UI/UX design expert tasked with analyzing and improving user interface designs.
      
      Please provide a detailed analysis covering:
      1. Design System: Colors (provide a color palette with hex codes)
      2. Design System: Typography (font families, sizes, weights)
      3. Design System: Components (identify key UI components)
      4. Visual Hierarchy Analysis
      5. Accessibility Analysis
      6. Usability Analysis
      7. Strengths and Weaknesses
      8. Specific Improvement Recommendations
      
      Then, generate HTML/CSS code for an improved version of the design that addresses the issues you identified.`;
      
      const analysisUserPrompt = `I need you to analyze and improve this UI design:
      
      ${designDescription}
      
      Please provide a detailed analysis followed by HTML/CSS code for an improved version of this design.`;
      
      const analysisRequestBody = {
        model: "claude-3-7-sonnet-20250219",
        max_tokens: 4000,
        temperature: 0.2,
        system: analysisSystemPrompt,
        messages: [
          {
            role: "user", 
            content: [
              {
                type: "text",
                text: analysisUserPrompt
              }
            ]
          }
        ]
      };
      
      // First try the proxy endpoint, with fallback to direct call if allowed
      console.log('Trying text-only approach with server proxy...');
      
      // Fix: Explicitly set the method as POST and include proper content type headers
      const analysisResponse = await fetch('/api/anthropic-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(analysisRequestBody),
        cache: 'no-cache'
      });
      
      if (!analysisResponse.ok) {
        const errorText = await analysisResponse.text();
        console.error('Server proxy error response:', analysisResponse.status, errorText);
        throw new Error(`Server proxy returned: ${analysisResponse.status} ${analysisResponse.statusText}`);
      }
      
      const analysisData = await analysisResponse.json();
      
      if (!analysisData.content || !analysisData.content[0] || !analysisData.content[0].text) {
        console.error('Unexpected Anthropic API response format (analysis):', analysisData);
        throw new Error('Unexpected response format from Anthropic API');
      }
      
      const analysisText = analysisData.content[0].text;
      console.log('Design analysis complete, length:', analysisText.length);
      
      // Extract design system information from analysis
      const designSystem = this.extractDesignSystem(analysisText);
      
      // Create a simplified HTML example
      const htmlExample = this.extractHtmlFromResponse(analysisText);
      
      // Create a mock response with the data we have
      const result: DesignAnalysisResponse = {
        analysis: {
          strengths: this.extractListItems(analysisText.match(/Strengths?:([\s\S]*?)(?:Weaknesses|$)/i)?.[1] || ''),
          weaknesses: this.extractListItems(analysisText.match(/Weaknesses?:([\s\S]*?)(?:Recommendations|$)/i)?.[1] || ''),
          improvementAreas: this.extractListItems(analysisText.match(/Recommendations?:([\s\S]*?)(?:HTML|$)/i)?.[1] || ''),
          specificChanges: [],
          visualHierarchy: {
            issues: this.extractListItems(analysisText.match(/Visual Hierarchy:([\s\S]*?)(?:Accessibility|$)/i)?.[1] || ''),
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
            issues: this.extractListItems(analysisText.match(/Usability:([\s\S]*?)(?:Strengths|$)/i)?.[1] || ''),
            improvements: []
          },
          accessibility: {
            issues: this.extractListItems(analysisText.match(/Accessibility:([\s\S]*?)(?:Usability|Strengths|$)/i)?.[1] || ''),
            improvements: []
          },
          designSystem: {
            colorPalette: designSystem.colors,
            typography: designSystem.typography,
            components: designSystem.components
          }
        },
        htmlCode: htmlExample.html || '<div>Example HTML would go here</div>',
        cssCode: htmlExample.css || 'body { font-family: sans-serif; }',
        metadata: {
          colors: {
            primary: designSystem.colors.slice(0, 1),
            secondary: designSystem.colors.slice(1, 2),
            background: designSystem.colors.slice(2, 3),
            text: designSystem.colors.slice(3, 4)
          },
          fonts: designSystem.typography,
          components: designSystem.components
        }
      };
      
      return result;
    } catch (error: any) {
      console.error('Error analyzing design with text-only approach:', error);
      throw new Error(`Failed to generate design iteration: ${error.message}`);
    }
  }
  
  // Helper method to extract HTML and CSS from the response text
  private extractHtmlFromResponse(responseText: string): { html: string, css: string } {
    const result = { html: '', css: '' };
    
    // Extract HTML code between ```html and ``` tags
    const htmlRegex = /```html\s*([\s\S]*?)\s*```/i;
    const htmlMatch = responseText.match(htmlRegex);
    if (htmlMatch && htmlMatch[1]) {
      result.html = htmlMatch[1].trim();
    } else {
      // Try to find any HTML content
      const htmlDocRegex = /<html[^>]*>([\s\S]*?)<\/html>/i;
      const htmlDocMatch = responseText.match(htmlDocRegex);
      if (htmlDocMatch) {
        result.html = `<html>${htmlDocMatch[1]}</html>`;
      }
    }
    
    // Extract CSS code between ```css and ``` tags
    const cssRegex = /```css\s*([\s\S]*?)\s*```/i;
    const cssMatch = responseText.match(cssRegex);
    if (cssMatch && cssMatch[1]) {
      result.css = cssMatch[1].trim();
    } else if (result.html) {
      // Try to extract from style tags in the HTML
      const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/i;
      const styleMatch = result.html.match(styleRegex);
      if (styleMatch && styleMatch[1]) {
        result.css = styleMatch[1].trim();
      }
    }
    
    return result;
  }

  async convertFigmaDesignToHtmlCss(imageUrl: string, designInfo: { width: number, height: number, figmaFileKey: string, figmaNodeId: string }): Promise<{
    htmlContent: string;
    cssContent: string;
    error?: string;
  }> {
    try {
      console.log('Converting Figma design to HTML/CSS:', { 
        width: designInfo.width,
        height: designInfo.height,
        figmaFileKey: designInfo.figmaFileKey,
        figmaNodeId: designInfo.figmaNodeId 
      });
      
      // Try the direct vision-based approach first as it's more reliable
      if (imageUrl) {
        console.log('Using direct vision-based approach with Claude 3.7 Sonnet');
        try {
          const visionResult = await this.convertFigmaDesignWithVision(imageUrl, designInfo);
          return visionResult;
        } catch (visionError) {
          console.error('Vision-based approach failed, falling back to original method:', visionError);
          // Continue with the original approach as fallback
        }
      }
      
      // Original approach continues below (as fallback)
      // STEP 1: Get detailed design data directly from Figma API
      console.log('Falling back to Figma API based approach');
      let figmaStyleData = null;
      let figmaError = null;
      
      try {
        figmaStyleData = await figmaService.getStructuredNodeData(
          designInfo.figmaFileKey, 
          designInfo.figmaNodeId
        );
        console.log('Successfully retrieved Figma design data');
      } catch (error) {
        console.error('Error fetching Figma design data:', error);
        figmaError = error;
        // We'll continue with the fallback approach
      }
      
      // STEP 2: Image preparation (as fallback or additional reference)
      let validImageUrl = imageUrl;
      let imageOptimized = false;
      
      // Initialize conversion attempts with different strategies
      const conversionAttempts = [
        // Attempt 1: Full attempt with Figma data and image if available
        {
          strategy: 'full',
          includeImage: !!validImageUrl,
          includeFigmaData: true,
          simplifyFigmaData: false,
          description: 'Full data with detailed Figma information'
        },
        // Attempt 2: Simplified Figma data only, no image
        {
          strategy: 'figma-data-only',
          includeImage: false,
          includeFigmaData: true,
          simplifyFigmaData: true,
          description: 'Simplified Figma data only (no image)'
        },
        // Attempt 3: Fallback with minimal data
        {
          strategy: 'fallback',
          includeImage: false,
          includeFigmaData: true,
          simplifyFigmaData: true,
          directFallback: true,
          description: 'Fallback with minimal data'
        }
      ];
      
      // Try each strategy until one succeeds
      for (const attempt of conversionAttempts) {
        try {
          console.log(`Attempting HTML/CSS conversion with strategy: ${attempt.strategy} (${attempt.description})`);
          
          // Skip image-based approaches if no valid image
          if (attempt.includeImage && !validImageUrl) {
            console.log('No valid image available, skipping this approach');
            continue;
          }
          
          // If we're using the direct fallback (last resort)
          if (attempt.directFallback) {
            console.log('No valid image available, using Figma data only approach');
            // Generate a simplified HTML/CSS as fallback when all else fails
            if (figmaStyleData) {
              console.log('Sending request to Anthropic API via proxy (strategy: fallback)...');
              try {
                // Try text-only approach with simplified system prompt
                const systemPrompt = `You are a UI developer specializing in HTML/CSS recreation of designs.
Your task is to convert a Figma design into clean HTML and CSS code based on the design data provided.
Create semantic HTML with clean CSS that matches the provided specs exactly.`;

                const userPrompt = `Please create HTML and CSS based on this Figma design data:
                
Width: ${designInfo.width}px
Height: ${designInfo.height}px
Colors: ${figmaStyleData.designSystem.colors.primary.join(', ')} (primary), 
        ${figmaStyleData.designSystem.colors.background.join(', ')} (background),
        ${figmaStyleData.designSystem.colors.text.join(', ')} (text)
Typography: ${figmaStyleData.designSystem.typography.families.join(', ')} at sizes ${figmaStyleData.designSystem.typography.sizes.join(', ')}px
Component Name: ${figmaStyleData.styleData.name || 'Figma Component'}

Create a simple, clean component matching these specs.
Return HTML in a \`\`\`html code block and CSS in a \`\`\`css block.`;

                const maxRetries = 2;
                let retryCount = 0;
                let result = null;
                
                while (retryCount <= maxRetries) {
                  try {
                    result = await this.callAnthropicAPI(systemPrompt, userPrompt, {
                      model: "claude-3-7-sonnet-20250219",
                      max_tokens: 3000,
                      temperature: 0.2,
                      useProxy: true
                    });
                    break; // Success, exit the loop
                  } catch (error) {
                    retryCount++;
                    if (retryCount > maxRetries) throw error;
                    console.log(`Retry ${retryCount}/${maxRetries} for fallback conversion`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                  }
                }
                
                if (result) {
                  // Extract HTML and CSS blocks from the result
                  const htmlMatch = result.match(/```html\s*([\s\S]*?)\s*```/);
                  const cssMatch = result.match(/```css\s*([\s\S]*?)\s*```/);
                  
                  if (htmlMatch && cssMatch) {
                    return {
                      htmlContent: htmlMatch[1].trim(),
                      cssContent: cssMatch[1].trim(),
                      error: 'Used fallback approach with Figma data'
                    };
                  }
                }
              } catch (fallbackError) {
                console.error('Error in fallback approach:', fallbackError);
              }
            }
            
            // If we reach here, use the built-in fallback generator
            console.warn('All HTML/CSS conversion attempts failed, using built-in fallback');
            return this.generateSimplifiedHtmlCss(designInfo, figmaStyleData, 
              'All conversion attempts failed, using simplified fallback');
          }
          
          // For non-fallback attempts, try direct API call with different strategies
          try {
            // Implementation remains similar but with better error tolerance
            const figmaDataDescription = (attempt.includeFigmaData && figmaStyleData) 
              ? this.createFigmaDataDescription(figmaStyleData, attempt.simplifyFigmaData) 
              : '';
            
            // Create a comprehensive design description
            const designDescription = `
              Figma Design Component Information:
              - Type: UI Component from Figma
              - Dimensions: ${designInfo.width}px × ${designInfo.height}px
              - Figma File: ${designInfo.figmaFileKey}
              - Node ID: ${designInfo.figmaNodeId}
              ${figmaDataDescription}
            `;
            
            // Prepare system prompt with detailed instructions
            const systemPrompt = `You are a UI development expert specializing in pixel-perfect HTML/CSS recreation of designs.
Your task is to convert a Figma design into precise HTML and CSS code.

INSTRUCTIONS:
1. Create valid, semantic HTML5 structure
2. Use clean, modern CSS - prefer vanilla CSS over frameworks
3. Match visual details precisely - colors, spacing, typography, shadows, etc.
4. Focus on component dimensions: ${designInfo.width}px × ${designInfo.height}px
5. Use responsive techniques where appropriate
6. Separate HTML and CSS in your response
7. Keep your code clean and maintainable

FORMATTING REQUIREMENTS:
- Return HTML code in a \`\`\`html code block
- Return CSS code in a \`\`\`css code block
- Make CSS styles specific to avoid conflicts (use class prefixes)
- Include basic browser resets in your CSS

You're a UI conversion expert - maintain the original design exactly as shown.`;

            // Prepare user prompt with Figma data appropriate to the current attempt
            const userPrompt = `Please convert this Figma design into precise HTML and CSS code.

${(attempt.includeFigmaData && figmaStyleData) ? 'I am providing you with the exact design data extracted directly from Figma API:' : 'Design Information:'}
- Width: ${designInfo.width}px
- Height: ${designInfo.height}px
- Figma File Key: ${designInfo.figmaFileKey}
- Figma Node ID: ${designInfo.figmaNodeId}

${(attempt.includeFigmaData && figmaStyleData) ? 'USE THESE EXACT VALUES FROM FIGMA:' : 'Requirements:'}
${(attempt.includeFigmaData && figmaStyleData) 
  ? this.formatFigmaDataForPrompt(figmaStyleData, attempt.simplifyFigmaData) 
  : `
1. Create a pixel-perfect recreation of the design
2. Use semantic HTML5 elements
3. Use modern CSS (no unnecessary frameworks)
4. Focus on exact dimensions (${designInfo.width}px × ${designInfo.height}px)
5. Ensure exact matching of all visual properties:
   - Colors, gradients, and transparency
   - Typography (fonts, sizes, weights, line heights)
   - Spacing and positioning
   - Borders, shadows, and effects
6. Handle any visible text content exactly as shown
7. For any icons, use appropriate HTML/CSS or Font Awesome equivalents`}

If you encounter any issues processing the image, use the exact Figma data I've provided to create an accurate implementation.`;

            // Prepare message content array based on attempt strategy
            const contentArray = [];
            
            // Always include the design description text first
            contentArray.push({
              type: "text",
              text: designDescription
            });
            
            // Add image content only for image-based approaches
            if (attempt.includeImage && validImageUrl) {
              contentArray.push({
                type: "image",
                source: {
                  type: "url",
                  url: validImageUrl
                }
              });
            }
            
            // Add the main user prompt
            contentArray.push({
              type: "text",
              text: userPrompt
            });
            
            // Set up retry mechanism for API calls
            const maxRetries = 2;
            let retryCount = 0;
            let result = null;
            
            while (retryCount <= maxRetries) {
              try {
                // Call the API with a timeout
                result = await Promise.race([
                  this.callAnthropicAPI(systemPrompt, contentArray, {
                    model: "claude-3-7-sonnet-20250219",
                    max_tokens: 4000,
                    temperature: 0.2,
                    useProxy: true
                  }),
                  new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('API request timed out')), 120000)
                  )
                ]) as string;
                
                break; // Success, exit the loop
              } catch (error) {
                retryCount++;
                if (retryCount > maxRetries) throw error;
                console.log(`Retry ${retryCount}/${maxRetries} for strategy: ${attempt.strategy}`);
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            }
            
            if (result) {
              // Extract HTML and CSS blocks from the result
              const htmlMatch = result.match(/```html\s*([\s\S]*?)\s*```/);
              const cssMatch = result.match(/```css\s*([\s\S]*?)\s*```/);
              
              if (htmlMatch && cssMatch) {
                return {
                  htmlContent: htmlMatch[1].trim(),
                  cssContent: cssMatch[1].trim(),
                  error: attempt.strategy !== 'full' ? `Used ${attempt.strategy} strategy` : undefined
                };
              } else {
                throw new Error('Failed to extract HTML or CSS from the response');
              }
            } else {
              throw new Error('Empty response from Anthropic API');
            }
          } catch (directAttemptError) {
            console.error('Error in direct approach:', directAttemptError);
            // Continue with next strategy
          }
        } catch (strategyError) {
          console.error(`Strategy ${attempt.strategy} failed:`, strategyError);
          // Continue with the next strategy
        }
      }
      
      // If we've tried all strategies and none worked, use the built-in fallback
      console.warn('All conversion strategies failed, using built-in fallback');
      return this.generateSimplifiedHtmlCss(designInfo, figmaStyleData, 
        'All conversion approaches failed, using simplified fallback');
      
    } catch (error) {
      console.error('Error converting Figma design to HTML/CSS:', error);
      
      // Always return some usable output even in case of errors
      return this.generateSimplifiedHtmlCss(
        designInfo, 
        null, 
        `HTML/CSS generation error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Create a detailed description of Figma data
  private createFigmaDataDescription(figmaData: any, simplified = false): string {
    if (!figmaData) return '';
    
    const { styleData, designSystem } = figmaData;
    
    if (simplified) {
      // Return a simplified version with fewer details
      return `
      - Component Name: ${styleData.name}
      - Component Type: ${styleData.type}
      - Primary Colors: ${designSystem.colors.primary.slice(0, 3).join(', ')}
      - Text Colors: ${designSystem.colors.text.slice(0, 2).join(', ')}
      - Typography: ${designSystem.typography.families.slice(0, 2).join(', ')}
      `;
    }
    
    return `
    - Component Name: ${styleData.name}
    - Component Type: ${styleData.type}
    - Color Palette: ${styleData.colors.join(', ')}
    - Typography: ${designSystem.typography.families.join(', ')}
    - Text Content: ${styleData.typography.map((t: any) => t.text).filter(Boolean).join(' | ')}
    `;
  }

  // Format Figma data for the prompt
  private formatFigmaDataForPrompt(figmaData: any, simplified = false): string {
    if (!figmaData) return '';
    
    const { styleData, designSystem } = figmaData;
    let promptData = '';
    
    // Add colors section (simplified if requested)
    promptData += '\nCOLORS:\n';
    if (designSystem.colors.primary.length > 0) {
      promptData += `- Primary Colors: ${designSystem.colors.primary.slice(0, simplified ? 3 : undefined).join(', ')}\n`;
    }
    if (!simplified && designSystem.colors.secondary.length > 0) {
      promptData += `- Secondary Colors: ${designSystem.colors.secondary.slice(0, simplified ? 3 : undefined).join(', ')}\n`;
    }
    if (designSystem.colors.background.length > 0) {
      promptData += `- Background Colors: ${designSystem.colors.background.slice(0, simplified ? 2 : undefined).join(', ')}\n`;
    }
    if (designSystem.colors.text.length > 0) {
      promptData += `- Text Colors: ${designSystem.colors.text.slice(0, simplified ? 2 : undefined).join(', ')}\n`;
    }
    
    // Add all colors as fallback (only if not simplified)
    if (!simplified && styleData.colors.length > 0) {
      promptData += `- All Colors: ${styleData.colors.join(', ')}\n`;
    }
    
    // Add typography section
    promptData += '\nTYPOGRAPHY:\n';
    
    if (designSystem.typography.families.length > 0) {
      promptData += `- Font Families: ${designSystem.typography.families.join(', ')}\n`;
    }
    
    if (designSystem.typography.sizes.length > 0) {
      promptData += `- Font Sizes: ${designSystem.typography.sizes.slice(0, simplified ? 4 : undefined).join(', ')}px\n`;
    }
    
    if (designSystem.typography.weights.length > 0) {
      promptData += `- Font Weights: ${designSystem.typography.weights.join(', ')}\n`;
    }
    
    // Add detailed typography styles (limit if simplified)
    if (styleData.typography.length > 0) {
      promptData += '- Text Styles:\n';
      const typesToShow = simplified ? Math.min(3, styleData.typography.length) : styleData.typography.length;
      
      for (let i = 0; i < typesToShow; i++) {
        const style = styleData.typography[i];
        if (style.text && style.fontFamily) {
          promptData += `  ${i+1}. "${style.text}" - ${style.fontFamily}, ${style.fontSize}px, weight: ${style.fontWeight}\n`;
        }
      }
    }
    
    // Add shadows/effects (only if not simplified or if there are few)
    if (!simplified || styleData.effects.length <= 2) {
      if (styleData.effects.length > 0) {
        promptData += '\nEFFECTS:\n';
        const effectsToShow = simplified ? Math.min(2, styleData.effects.length) : styleData.effects.length;
        
        for (let i = 0; i < effectsToShow; i++) {
          const effect = styleData.effects[i];
          promptData += `- ${effect.type}: radius ${effect.radius}px, color: ${effect.color}\n`;
        }
      }
    }
    
    // Add components (only if not simplified or if there are few)
    if (!simplified || styleData.components.length <= 3) {
      if (styleData.components.length > 0) {
        promptData += '\nCOMPONENTS:\n';
        const componentsToShow = simplified ? Math.min(3, styleData.components.length) : styleData.components.length;
        
        for (let i = 0; i < componentsToShow; i++) {
          const component = styleData.components[i];
          promptData += `- ${component.name} (${component.type})\n`;
        }
      }
    }
    
    // Add structure information (simplified if requested)
    if (!simplified) {
      promptData += '\nStructure contains the following elements:\n';
      this.addChildStructure(styleData, promptData, 0);
    } else {
      promptData += '\nBasic structure:\n';
      promptData += `- ${styleData.name} (${styleData.type})\n`;
      
      // Only add first level children in simplified mode
      if (styleData.childrenData && styleData.childrenData.length > 0) {
        const childrenToShow = Math.min(5, styleData.childrenData.length);
        for (let i = 0; i < childrenToShow; i++) {
          const child = styleData.childrenData[i];
          promptData += `  - ${child.name} (${child.type})\n`;
        }
        
        if (styleData.childrenData.length > childrenToShow) {
          promptData += `  - ... and ${styleData.childrenData.length - childrenToShow} more elements\n`;
        }
      }
    }
    
    return promptData;
  }

  // Helper to recursively add child structure
  private addChildStructure(node: any, promptData: string, level: number): string {
    const indent = '  '.repeat(level);
    promptData += `${indent}- ${node.name} (${node.type})\n`;
    
    if (node.childrenData && node.childrenData.length > 0) {
      node.childrenData.forEach((child: any) => {
        this.addChildStructure(child, promptData, level + 1);
      });
    }
    
    return promptData;
  }

  // Helper method to generate a simplified but useful HTML/CSS component
  // This is used as a fallback when the main conversion process fails
  private generateSimplifiedHtmlCss(
    designInfo: { width: number, height: number, figmaFileKey: string, figmaNodeId: string },
    figmaData: any = null,
    errorMessage?: string
  ): Promise<{ htmlContent: string, cssContent: string, error?: string }> {
    return new Promise(resolve => {
      console.log('Generating simplified HTML/CSS as fallback');
      
      // Extract component name from the node ID for better labeling
      const componentName = designInfo.figmaNodeId.split(':').pop() || 'component';
      const containerClass = `figma-component-${componentName}`;
      
      // Use actual Figma colors if available
      let backgroundColor = '#f5f5f5';
      let textColor = '#333333';
      let borderColor = '#e0e0e0';
      let headerColor = '#f0f0f0';
      let fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
      
      if (figmaData) {
        // Use background color from Figma
        if (figmaData.designSystem.colors.background.length > 0) {
          backgroundColor = figmaData.designSystem.colors.background[0];
        }
        
        // Use text color from Figma
        if (figmaData.designSystem.colors.text.length > 0) {
          textColor = figmaData.designSystem.colors.text[0];
        }
        
        // Use border color - try to find a light gray
        if (figmaData.styleData.colors.length > 0) {
          // Find a light gray for borders
          const grayColor = figmaData.styleData.colors.find((color: string) => 
            color.toLowerCase().startsWith('#e') || 
            color.toLowerCase().startsWith('#d') ||
            color.toLowerCase().startsWith('#c')
          );
          if (grayColor) {
            borderColor = grayColor;
          }
        }
        
        // Use font family from Figma
        if (figmaData.designSystem.typography.families.length > 0) {
          fontFamily = figmaData.designSystem.typography.families.join(', ');
        }
      }
      
      // Generate HTML with reasonable semantic structure and actual Figma data if available
      const htmlContent = `<div class="${containerClass}-wrapper">
  <div class="${containerClass}" role="region" aria-label="Figma Component">
    <header class="${containerClass}-header">
      <h2 class="${containerClass}-title">${figmaData?.styleData?.name || 'Figma Component'}</h2>
      ${errorMessage ? `<p class="${containerClass}-error">Error: ${errorMessage}</p>` : ''}
    </header>
    <div class="${containerClass}-content">
      <div class="${containerClass}-placeholder">
        <p>Figma Design: ${designInfo.figmaFileKey}</p>
        <p>Node ID: ${designInfo.figmaNodeId}</p>
        <p>Dimensions: ${designInfo.width}px × ${designInfo.height}px</p>
        ${figmaData?.styleData?.typography?.map((t: any) => 
          t.text ? `<p class="${containerClass}-text" style="font-family: ${t.fontFamily || fontFamily}; font-size: ${t.fontSize || 14}px; font-weight: ${t.fontWeight || 400};">${t.text}</p>` : ''
        ).join('\n        ') || ''}
      </div>
    </div>
  </div>
</div>`;

      // Generate CSS with reasonable styling using actual Figma data
      const cssContent = `.${containerClass}-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  font-family: ${fontFamily};
}

.${containerClass} {
  width: ${designInfo.width}px;
  height: ${designInfo.height}px;
  background-color: ${backgroundColor};
  border: 1px solid ${borderColor};
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.${containerClass}-header {
  background-color: ${headerColor};
  padding: 12px 16px;
  border-bottom: 1px solid ${borderColor};
}

.${containerClass}-title {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: ${textColor};
}

.${containerClass}-error {
  color: #d32f2f;
  margin: 8px 0 0;
  font-size: 14px;
}

.${containerClass}-content {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px;
}

.${containerClass}-placeholder {
  text-align: center;
  color: ${textColor};
  font-size: 14px;
  line-height: 1.5;
}

.${containerClass}-placeholder p {
  margin: 4px 0;
}

.${containerClass}-text {
  margin: 8px 0;
}

@media (max-width: ${designInfo.width + 32}px) {
  .${containerClass} {
    width: 100%;
    height: auto;
    min-height: ${Math.min(designInfo.height, 300)}px;
  }
}`;

      resolve({
        htmlContent,
        cssContent,
        error: errorMessage || 'Used simplified fallback with Figma data'
      });
    });
  }

  // Helper method to call the Anthropic API with consistent error handling
  private async callAnthropicAPI(
    systemPrompt: string, 
    userContent: string | any[], 
    options: {
      model: string;
      max_tokens: number;
      temperature: number;
      useProxy: boolean;
    }
  ): Promise<string> {
    // Prepare content array if string was provided
    const content = Array.isArray(userContent) 
      ? userContent 
      : [{ type: "text", text: userContent }];
    
    // Prepare request body
    const requestBody = {
      model: options.model,
      max_tokens: options.max_tokens,
      temperature: options.temperature,
      system: systemPrompt,
      messages: [
        {
          role: "user", 
          content
        }
      ]
    };
    
    try {
      // Make the API call
      const response = await fetch('/api/anthropic-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody),
        cache: 'no-cache'
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorData}`);
      }
      
      const data = await response.json();
      return data.content?.[0]?.text || '';
    } catch (error) {
      console.error('Error calling Anthropic API:', error);
      throw error;
    }
  }

  // New method to directly convert Figma design to HTML/CSS using Claude's vision capabilities
  async convertFigmaDesignWithVision(
    imageUrl: string, 
    designInfo: { 
      width: number, 
      height: number,
      figmaFileKey: string, 
      figmaNodeId: string 
    }
  ): Promise<{
    htmlContent: string;
    cssContent: string;
    error?: string;
  }> {
    try {
      console.log('Converting Figma design with Claude vision capabilities:', {
        imageUrl: imageUrl.substring(0, 50) + '...',
        width: designInfo.width,
        height: designInfo.height,
      });
      
      // Simple direct approach that works reliably
      if (!imageUrl) {
        throw new Error('Missing image URL for Figma design conversion');
      }
      
      // System prompt focused on exact HTML/CSS conversion with detailed instructions
      const systemPrompt = `You are an expert UI developer who specializes in converting designs into pixel-perfect HTML and CSS. 
Your task is to convert the provided Figma design image into clean, semantic HTML and CSS code.

REQUIREMENTS:
1. Create semantic HTML with appropriate element hierarchy
2. Write clean, well-structured CSS that matches the design exactly
3. Ensure exact sizing, spacing, and layout of all elements
4. Match fonts, colors, and visual styles precisely
5. Organize CSS with clear class naming conventions
6. Return the HTML and CSS as separate code blocks

Your output must include:
1. An HTML code block with the complete markup (inside \`\`\`html tags)
2. A CSS code block with all necessary styles (inside \`\`\`css tags)`;

      // User prompt with specific design details
      const userPrompt = `Please convert this Figma design into HTML and CSS.

Design Details:
- Dimensions: ${designInfo.width}px × ${designInfo.height}px
- Figma File: ${designInfo.figmaFileKey}
- Node ID: ${designInfo.figmaNodeId}

I need a clean, semantic HTML implementation with precise CSS that matches this design exactly. Please pay careful attention to:
- Typography and text styling
- Color values and gradients
- Spacing and alignment
- Component structure
- Visual hierarchy

Return the code as separate HTML and CSS blocks that I can directly use.`;

      // Create the content array with text and image
      const contentArray = [
        {
          type: "text",
          text: userPrompt
        },
        {
          type: "image",
          source: {
            type: "url",
            url: imageUrl
          }
        }
      ];
      
      // Implement retry logic for resilience
      const maxRetries = 2;
      let lastError = null;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          console.log(`Attempt ${attempt + 1}/${maxRetries + 1} to convert design with Claude vision`);
          
          // Call Claude with timeout
          const result = await Promise.race([
            this.callAnthropicAPI(systemPrompt, contentArray, {
              model: "claude-3-7-sonnet-20250219",
              max_tokens: 4000,
              temperature: 0.2,
              useProxy: true
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Request timed out after 120 seconds')), 120000)
            )
          ]) as string;
          
          if (!result) {
            throw new Error('Empty response from Claude API');
          }
          
          // Extract HTML and CSS
          const htmlMatch = result.match(/```html\s*([\s\S]*?)\s*```/);
          const cssMatch = result.match(/```css\s*([\s\S]*?)\s*```/);
          
          if (htmlMatch && cssMatch) {
            console.log('Successfully extracted HTML and CSS from Claude response');
            return {
              htmlContent: htmlMatch[1].trim(),
              cssContent: cssMatch[1].trim()
            };
          } else {
            // Try alternative extraction if the standard pattern fails
            const altHtmlMatch = result.match(/<html[^>]*>([\s\S]*?)<\/html>/i);
            const altCssMatch = result.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
            
            if (altHtmlMatch && altCssMatch) {
              console.log('Extracted HTML/CSS using alternative patterns');
              return {
                htmlContent: `<html>${altHtmlMatch[1]}</html>`,
                cssContent: altCssMatch[1].trim()
              };
            }
            
            throw new Error('Failed to extract HTML/CSS from Claude response');
          }
        } catch (error) {
          console.error(`Attempt ${attempt + 1} failed:`, error);
          lastError = error;
          
          if (attempt < maxRetries) {
            // Wait before retrying (exponential backoff)
            const backoffTime = Math.min(2000 * Math.pow(2, attempt), 10000);
            console.log(`Retrying in ${backoffTime/1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
          }
        }
      }
      
      // If all attempts fail, use a simple fallback
      console.warn('All direct conversion attempts failed, using simplified fallback');
      return this.generateSimplifiedHtmlCss(
        designInfo, 
        null, 
        `Vision-based conversion failed: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`
      );
      
    } catch (error) {
      console.error('Error in vision-based Figma design conversion:', error);
      return this.generateSimplifiedHtmlCss(
        designInfo, 
        null, 
        `Vision conversion error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

const anthropicService = new AnthropicService();
export default anthropicService; 