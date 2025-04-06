import supabaseService from './SupabaseService';

interface DesignAnalysisResponse {
  analysis: {
    strengths: string[];
    weaknesses: string[];
    improvementAreas: string[];
    specificChanges?: string[];
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
            content: `You are a top-tier UI/UX designer with exceptional pixel-perfect reproduction skills. Your task is to analyze a design image and create a visually identical HTML/CSS version with subtle improvements to usability while maintaining the exact visual style.

            VISUAL FIDELITY REQUIREMENTS (HIGHEST PRIORITY):
            1. Create HTML/CSS that PERFECTLY matches the visual appearance of the original design
            2. Maintain exact spacing, alignment, and proportions from the original
            3. Match colors with precise hex/rgba values that look identical to the original
            4. Replicate typography with exact font sizes, weights, line heights, and letter spacing
            5. Preserve all visual elements including shadows, gradients, borders, and rounded corners
            6. Ensure the rendered result is indistinguishable from the original at a glance
            7. Position elements using absolute positioning when necessary to achieve pixel-perfect layout
            
            IMPROVEMENT REQUIREMENTS (SECONDARY PRIORITY):
            While maintaining visual fidelity, make subtle enhancements to:
            1. Visual hierarchy - ensure important elements stand out appropriately
            2. Color contrast - improve accessibility without changing the color palette feel
            3. Text legibility - ensure all text is readable while preserving the original look
            4. Component spacing - maintain the original spacing while ensuring consistent rhythm
            5. Element alignment - ensure pixel-perfect alignment throughout the design

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
            
            DESIGN ANALYSIS REQUIREMENTS:
            1. Identify the specific visual strengths of the design
            2. Identify specific weaknesses in terms of usability and accessibility
            3. List SPECIFIC improvements made in your implementation versus the original
            4. Extract the exact color palette with accurate hex codes
            5. Identify the fonts used with specific weights and styles
            6. List all UI components present in the design
            7. Include a "Specific Changes" section that precisely details every enhancement made

            Your response MUST include:
            1. HTML code block (marked with \`\`\`html)
            2. CSS code block (marked with \`\`\`css)
            3. Detailed analysis section with all requirements above`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this UI design and create a visually identical HTML/CSS version with subtle improvements to usability, accessibility, and visual hierarchy. 

                The design must be recreated with PIXEL-PERFECT accuracy at ${dimensions.width}px × ${dimensions.height}px.
                
                IMPORTANT: For any images in the design, DO NOT use external image URLs or placeholders. 
                Instead, replace them with simple colored div elements that match the dimensions and 
                positioning of the original images. Use appropriate background colors and subtle borders.
                
                Your response must include:
                
                1. A complete HTML/CSS implementation that matches the original design with perfect visual fidelity
                2. Thorough analysis including:
                   - Design strengths
                   - Design weaknesses
                   - Specific improvements made (list EACH change with clear before/after description)
                   - Complete color palette with exact hex codes
                   - Typography specifications
                   - UI components identified
                
                Focus on recreating the design with PERFECT visual fidelity first, then make subtle improvements to usability.
                
                Every visual detail matters - spacing, alignment, typography, colors, and component layout must be exact.
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
        specificChanges: []
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
    
    // Extract strengths
    result.analysis.strengths = this.extractListItems(response, 'Strengths');
    
    // Extract weaknesses
    result.analysis.weaknesses = this.extractListItems(response, 'Weaknesses');
    
    // Extract improvement areas
    result.analysis.improvementAreas = this.extractListItems(response, 
      'Improvements|Improvement Areas|Areas for Improvement');
    
    // Extract specific changes
    result.analysis.specificChanges = this.extractListItems(response, 
      'Specific Changes|Changes Made|Implemented Changes');
    
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
      result.userInsightsApplied = this.extractListItems(response, 
        'User Insights Applied|User Insights|User Research Applied');
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