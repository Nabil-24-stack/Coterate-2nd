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
            content: `You are a top-tier UI/UX designer with exceptional pixel-perfect reproduction skills and deep expertise in design analysis and improvement. Your task is to analyze a design image, provide detailed feedback on its strengths and weaknesses, and create an improved HTML/CSS version that addresses those issues while maintaining the design's visual identity.

            DESIGN ANALYSIS REQUIREMENTS (HIGHEST PRIORITY):
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
            Based on your analysis, create an improved version that:
            
            1. Maintains the original design's visual identity and brand elements
            2. Addresses all identified issues in visual hierarchy, contrast, component selection, text legibility, usability, and accessibility
            3. Makes thoughtful, evidence-based improvements that enhance the user experience
            4. Preserves the original layout and structure while making targeted enhancements
            5. Follows best practices in modern UI/UX design
            
            DIMENSIONS REQUIREMENT:
            The generated HTML/CSS MUST match the EXACT dimensions of the original design, which is ${dimensions.width}px width by ${dimensions.height}px height. All elements must be properly positioned and sized to match the original layout's scale and proportions.
            
            CSS REQUIREMENTS:
            1. Use CSS Grid and Flexbox for layouts that need to be responsive
            2. Use absolute positioning for pixel-perfect placement when needed
            3. Include CSS variables for colors, spacing, and typography
            4. Ensure clean, well-organized CSS with descriptive class names
            5. Include detailed comments in CSS explaining design decisions
            6. Avoid arbitrary magic numbers - document any precise pixel measurements
            
            ICON REQUIREMENTS:
            For any icons identified in the UI:
            1. Use Font Awesome icons that EXACTLY match the original icons (via CDN: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css")
            2. If no perfect Font Awesome match exists, create the icon using CSS
            3. Ensure icon sizing and positioning exactly matches the original
            
            IMAGE REQUIREMENTS:
            For any images identified in the original design:
            1. DO NOT use any external image URLs, placeholders, or Unsplash images
            2. Instead, replace each image with a simple colored div (rectangle or square)
            3. Use a background color that makes sense in the context (gray, light blue, etc.)
            4. Maintain the exact same dimensions, positioning, and styling (borders, etc.) as the original image
            5. Add a subtle 1px border to the div to indicate it's an image placeholder
            6. You can add a simple CSS pattern or gradient if appropriate
            
            Your analysis MUST be organized into these specific sections:
            1. Visual Hierarchy - Issues and recommended improvements
            2. Color Contrast and Accessibility - Issues and recommended improvements
            3. Component Selection and Placement - Issues and recommended improvements
            4. Text Legibility - Issues and recommended improvements
            5. Overall Usability - Issues and recommended improvements
            6. Accessibility Considerations - Issues and recommended improvements
            7. General Strengths - What the design does well
            8. General Weaknesses - Overall issues with the design
            9. Specific Changes Made - Detailed before/after descriptions of all changes implemented
            10. Color Palette - Exact hex codes for all colors used
            11. Typography - Font families, sizes, weights used
            12. UI Components - List of all components identified in the design`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this UI design according to UI/UX best practices and create an improved HTML/CSS version that addresses any identified issues. 

                Perform a detailed analysis focusing specifically on:
                1. Visual hierarchy
                2. Color contrast and accessibility
                3. Component selection and placement
                4. Text legibility
                5. Overall usability
                6. Accessibility considerations
                
                Then create an improved version that:
                - Maintains the original design's visual identity
                - Addresses all identified issues
                - Makes thoughtful improvements to enhance user experience
                - Has the exact dimensions of ${dimensions.width}px × ${dimensions.height}px
                
                For any images in the design, replace them with colored div elements that match the dimensions and positioning of the original images.
                
                Organize your analysis into the specific sections outlined in your instructions, and provide detailed before/after descriptions for each change implemented.
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
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error:', errorText);
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Extract the response content
      const responseContent = data.choices[0].message.content;
      
      // Parse the response to extract HTML, CSS, and analysis
      return this.parseOpenAIResponse(responseContent, linkedInsights.length > 0);
    } catch (error) {
      console.error('Error analyzing design:', error);
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
}

const openAIService = new OpenAIService();
export default openAIService; 