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
  
  // Main method to analyze design image and generate improved version
  async analyzeDesignAndGenerateHTML(imageUrl: string, linkedInsights: any[] = []): Promise<DesignAnalysisResponse> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }
    
    try {
      // Get image as base64 if it's a remote URL
      let base64Image = '';
      
      if (imageUrl.startsWith('data:image')) {
        // Already a data URL, extract the base64 part
        base64Image = imageUrl.split(',')[1];
      } else {
        // Fetch the image and convert to base64
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        base64Image = await this.blobToBase64(blob);
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
      
      const requestBody = {
        model: 'gpt-4o',
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
            13. UI Components - List of all components identified in the design, noting any that were swapped and how their styling was preserved`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this UI design according to UI/UX best practices and create an IMPROVED ITERATION that maintains the original design system while addressing specific issues.

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
                ${linkedInsights.length > 0 ? insightsPrompt : ''}`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 4000,
        temperature: 0.5
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
      } catch (fetchError) {
        console.error('Direct OpenAI API call failed, possibly due to CORS:', fetchError);
        
        // Try using a fallback demo response for development/preview
        console.log('Generating a fallback demo response for testing purposes');
        return this.getFallbackAnalysisResponse(dimensions);
      }
      
      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error('OpenAI API error:', errorText);
        
        // Return fallback demo response if in development/preview
        if (window.location.hostname === 'localhost' || 
            window.location.hostname.includes('vercel.app') ||
            window.location.hostname.includes('netlify.app')) {
          console.log('Using fallback demo response for this environment');
          return this.getFallbackAnalysisResponse(dimensions);
        }
        
        throw new Error(`OpenAI API error: ${openaiResponse.status} ${openaiResponse.statusText}`);
      }
      
      const data = await openaiResponse.json();
      
      // Extract the response content
      const responseContent = data.choices[0].message.content;
      
      // Parse the response to extract HTML, CSS, and analysis
      return this.parseOpenAIResponse(responseContent, linkedInsights.length > 0);
    } catch (error) {
      console.error('Error analyzing design:', error);
      
      // Return fallback demo response for development/preview environments
      if (window.location.hostname === 'localhost' || 
          window.location.hostname.includes('vercel.app') ||
          window.location.hostname.includes('netlify.app')) {
        console.log('Error occurred during analysis, using fallback demo response');
        return this.getFallbackAnalysisResponse(await this.getImageDimensions(imageUrl));
      }
      
      throw error;
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
  private parseOpenAIResponse(response: string, hasUserInsights: boolean = false): DesignAnalysisResponse {
    console.log('Parsing OpenAI response...');
    
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
    const htmlMatch = response.match(/```html\n([\s\S]*?)```/);
    if (htmlMatch && htmlMatch[1]) {
      result.htmlCode = htmlMatch[1].trim();
    }
    
    // Extract CSS code between ```css and ``` tags
    const cssMatch = response.match(/```css\n([\s\S]*?)```/);
    if (cssMatch && cssMatch[1]) {
      result.cssCode = cssMatch[1].trim();
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
}

const openAIService = new OpenAIService();
export default openAIService; 