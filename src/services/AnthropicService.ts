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
      
      // This is a two-step process:
      // STEP 1: Analyze the original design to extract the design system and identify issues
      
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
      
      const analysisRequestBody = {
        model: "claude-3-7-sonnet",
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
                  media_type: "image/jpeg",
                  data: base64Image
                }
              }
            ]
          }
        ]
      };
      
      // Make API call to Anthropic for analysis
      const analysisResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': `${this.apiKey}`,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(analysisRequestBody)
      });
      
      if (!analysisResponse.ok) {
        const errorData = await analysisResponse.text();
        console.error('Anthropic API error response (analysis):', errorData);
        throw new Error(`Design analysis failed: ${analysisResponse.status} ${analysisResponse.statusText}`);
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
        model: "claude-3-7-sonnet",
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
      const iterationResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': `${this.apiKey}`,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(iterationRequestBody)
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
        designSystem.colors = [...new Set(hexMatches)];
      }
    }
    
    // Extract typography
    const typographyRegex = /Design System: Typography:([\s\S]*?)(?:Design System: Components|Components|##)/i;
    const typographyMatch = analysisText.match(typographyRegex);
    if (typographyMatch && typographyMatch[1]) {
      // Extract font families
      const fontRegex = /(?:font-family|font family|fonts?):\s*([^,\.;\n]+)/gi;
      const fontMatches = [...typographyMatch[1].matchAll(fontRegex)];
      
      for (const match of fontMatches) {
        if (match[1]) {
          const fontName = match[1].trim().replace(/['"`]/g, '');
          if (fontName.length > 0 && !designSystem.typography.includes(fontName)) {
            designSystem.typography.push(fontName);
          }
        }
      }
    }
    
    // Extract components
    const componentsRegex = /Design System: Components:([\s\S]*?)(?:Design System: Layout|Layout|Visual Hierarchy|##)/i;
    const componentsMatch = analysisText.match(componentsRegex);
    if (componentsMatch && componentsMatch[1]) {
      // Extract component names from bullet points
      const componentRegex = /(?:^|\n)[-*•]\s*([A-Z][^:]+):/gm;
      const matches = [...componentsMatch[1].matchAll(componentRegex)];
      
      for (const match of matches) {
        if (match[1] && match[1].trim().length > 0) {
          designSystem.components.push(match[1].trim());
        }
      }
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
      if (result.analysis.specificChanges.length === 0) {
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
  
  // Helper to extract hex color codes from text
  private extractHexCodes(text: string): string[] {
    const hexRegex = /#[0-9A-Fa-f]{3,6}/g;
    const matches = text.match(hexRegex);
    return matches ? [...new Set(matches)] : [];
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
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        if (match[1]) {
          // Clean up font names
          const fonts = match[1].split(',')
            .map(font => font.trim().replace(/['"`]/g, ''))
            .filter(font => font.length > 0 && !font.startsWith('#'));
          fontMatches.push(...fonts);
        }
      }
    }
    
    // Deduplicate
    return [...new Set(fontMatches)];
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
    const matches = [...text.matchAll(bulletPointsRegex)];
    for (const match of matches) {
      if (match[1] && /button|input|element|component/i.test(match[1])) {
        componentMatches.push(match[1].trim());
      }
    }
    
    // Deduplicate
    return [...new Set(componentMatches)];
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
}

const anthropicService = new AnthropicService();
export default anthropicService; 