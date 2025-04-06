import supabaseService from './SupabaseService';

interface DesignAnalysisResponse {
  analysis: {
    strengths: string[];
    weaknesses: string[];
    improvementAreas: string[];
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
            content: `You are an expert UI/UX designer who analyzes designs and creates improved versions.

            You will analyze the design image to identify issues in:
            1. Visual hierarchy
            2. Color contrast and accessibility
            3. Component selection and placement
            4. Text legibility
            5. Overall usability
            6. Spacing and alignment
            7. Consistency

            After analysis, create an improved HTML/CSS version addressing all identified issues while maintaining the original purpose and branding. The HTML/CSS should be complete and ready to render directly in a browser.

            IMPORTANT: The generated HTML/CSS must match the EXACT dimensions of the original design, which is ${dimensions.width}px width by ${dimensions.height}px height. All elements must be properly positioned and sized to match the original layout's scale and proportions.
            
            DESIGN ANALYSIS REQUIREMENTS:
            1. Identify specific strengths in the design's visual hierarchy, color palette, typography, and component choices
            2. Identify specific weaknesses in terms of usability, accessibility, and visual design
            3. Provide concrete improvement suggestions that address the weaknesses
            4. Identify the color palette used (primary, secondary, background, text colors)
            5. Identify the fonts used and their roles (headings, body text, etc.)
            6. Identify key UI components present in the design
            ${linkedInsights.length > 0 ? '7. Explain how your improvements address the provided user insights' : ''}
            
            ICON REQUIREMENTS:
            For any icons identified in the UI:
            1. Use the Font Awesome icon library (via CDN: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css")
            2. Find the most appropriate Font Awesome icon that matches each icon in the original design
            3. Implement the icon using the proper Font Awesome classes
            
            IMAGE REQUIREMENTS:
            For any images or photos identified in the UI:
            1. Use Unsplash for royalty-free stock photos that match the theme and purpose
            2. Use specific format for image implementation with div wrapper and exact dimensions
            3. IMPORTANT: Use "https://source.unsplash.com/random/[width]x[height]/?[keywords]" format

            Your response MUST include:
            1. HTML code block (marked with \`\`\`html)
            2. CSS code block (marked with \`\`\`css)
            3. Analysis section with:
               - List of strengths
               - List of weaknesses
               - List of improvement areas
               - Color palette identified (with hex codes)
               - Fonts identified
               - Components identified
               ${linkedInsights.length > 0 ? '- User insights applied' : ''}`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this UI design and create an improved HTML/CSS version addressing any issues with visual hierarchy, contrast, component selection, text legibility, and overall usability while maintaining the original purpose.
                
                The original design dimensions are ${dimensions.width}px width by ${dimensions.height}px height. Ensure your improved version maintains these exact dimensions.
                
                Provide a thorough analysis of:
                1. Design strengths
                2. Design weaknesses
                3. Areas for improvement
                4. Color palette (with hex codes)
                5. Typography choices
                6. UI components used
                ${linkedInsights.length > 0 ? '7. How you incorporated the following user insights:' + insightsPrompt : ''}
                
                Then create the improved HTML/CSS version that addresses the identified issues.`
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
        temperature: 0.7
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
        improvementAreas: []
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