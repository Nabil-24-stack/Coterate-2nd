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
  
  // Main method to analyze design image and generate HTML
  async analyzeDesignAndGenerateHTML(imageUrl: string): Promise<DesignAnalysisResponse> {
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
      
      const requestBody = {
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a UI/UX expert who analyzes designs and creates improved versions.
            First, carefully analyze the design image to identify all UI elements, layout structure, colors, typography, and spacing.
            Identify specific strengths and weaknesses of the design, focusing on visual hierarchy, contrast, component selection, spacing, alignment, and overall usability.
            
            Then, create an improved HTML and CSS version addressing the identified issues while maintaining the original purpose and branding.
            The HTML/CSS should be complete and ready to render directly in a browser.

            IMPORTANT: The generated HTML/CSS must match the EXACT dimensions of the original design, which is ${dimensions.width}px width by ${dimensions.height}px height.
            Make sure all elements are properly positioned and sized to exactly match the original layout's scale and proportions.
            The entire design must be visible at these dimensions without scrolling.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this UI design and create an improved HTML/CSS version addressing any issues you find with visual hierarchy, contrast, spacing, or usability while maintaining the original purpose and style. 
                
                The original design dimensions are ${dimensions.width}px width by ${dimensions.height}px height. Ensure your HTML/CSS version maintains these EXACT dimensions and scales all elements appropriately.`
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
      return this.parseOpenAIResponse(responseContent);
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
  
  // Add a helper function to get image dimensions
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
  private parseOpenAIResponse(response: string): DesignAnalysisResponse {
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
    
    // If we don't have separate HTML and CSS, look for combined code
    if (!result.htmlCode) {
      const codeMatch = response.match(/```(?:html|)\n([\s\S]*?)```/);
      if (codeMatch && codeMatch[1]) {
        result.htmlCode = codeMatch[1].trim();
      }
    }
    
    // Extract analysis sections - this is more flexible as it depends on how GPT formats the response
    const strengthsMatch = response.match(/(?:Strengths|STRENGTHS)[:]\s*([\s\S]*?)(?:\n\n|\n(?:Weaknesses|WEAKNESSES))/i);
    if (strengthsMatch && strengthsMatch[1]) {
      // Split bullet points and clean them
      result.analysis.strengths = strengthsMatch[1]
        .split(/\n-|\n\*|\n\d+\./)
        .map(item => item.trim())
        .filter(Boolean);
    }
    
    const weaknessesMatch = response.match(/(?:Weaknesses|WEAKNESSES)[:]\s*([\s\S]*?)(?:\n\n|\n(?:Improvement|IMPROVEMENT|Areas|AREAS))/i);
    if (weaknessesMatch && weaknessesMatch[1]) {
      result.analysis.weaknesses = weaknessesMatch[1]
        .split(/\n-|\n\*|\n\d+\./)
        .map(item => item.trim())
        .filter(Boolean);
    }
    
    const improvementsMatch = response.match(/(?:Improvements|IMPROVEMENTS|Improvement Areas|IMPROVEMENT AREAS)[:]\s*([\s\S]*?)(?:\n\n|\n```|$)/i);
    if (improvementsMatch && improvementsMatch[1]) {
      result.analysis.improvementAreas = improvementsMatch[1]
        .split(/\n-|\n\*|\n\d+\./)
        .map(item => item.trim())
        .filter(Boolean);
    }
    
    // Extract color information if available
    const colorsMatch = response.match(/(?:Colors|COLORS|Color Palette|COLOR PALETTE)[:]\s*([\s\S]*?)(?:\n\n|\n(?:Fonts|FONTS)|$)/i);
    if (colorsMatch && colorsMatch[1]) {
      // Try to extract hex colors
      const hexColors = colorsMatch[1].match(/#[0-9A-Fa-f]{3,6}/g) || [];
      
      // Distribute colors to categories based on context
      if (hexColors.length > 0) {
        const colorText = colorsMatch[1].toLowerCase();
        
        hexColors.forEach(color => {
          if (colorText.indexOf(color.toLowerCase()) > -1) {
            const context = colorText.substring(
              Math.max(0, colorText.indexOf(color.toLowerCase()) - 30),
              colorText.indexOf(color.toLowerCase())
            ).toLowerCase();
            
            if (context.includes('primary')) {
              result.metadata.colors.primary.push(color);
            } else if (context.includes('secondary')) {
              result.metadata.colors.secondary.push(color);
            } else if (context.includes('background')) {
              result.metadata.colors.background.push(color);
            } else if (context.includes('text')) {
              result.metadata.colors.text.push(color);
            } else {
              // Default to primary if we can't categorize
              result.metadata.colors.primary.push(color);
            }
          }
        });
      }
    }
    
    // Extract fonts if available
    const fontsMatch = response.match(/(?:Fonts|FONTS|Typography|TYPOGRAPHY)[:]\s*([\s\S]*?)(?:\n\n|\n(?:Components|COMPONENTS)|$)/i);
    if (fontsMatch && fontsMatch[1]) {
      result.metadata.fonts = fontsMatch[1]
        .split(/\n-|\n\*|\n\d+\./)
        .map(item => item.trim())
        .filter(Boolean);
    }
    
    // Extract components if available
    const componentsMatch = response.match(/(?:Components|COMPONENTS)[:]\s*([\s\S]*?)(?:\n\n|\n```|$)/i);
    if (componentsMatch && componentsMatch[1]) {
      result.metadata.components = componentsMatch[1]
        .split(/\n-|\n\*|\n\d+\./)
        .map(item => item.trim())
        .filter(Boolean);
    }
    
    return result;
  }
}

const openAIService = new OpenAIService();
export default openAIService; 