// WebGL Core Utilities
// Responsible for initializing WebGL context and setting up basic shader programs

/**
 * Vertex shader for basic rendering
 */
const basicVertexShaderSource = `
  attribute vec4 aPosition;
  attribute vec2 aTexCoord;
  
  uniform mat4 uModelViewMatrix;
  uniform mat4 uProjectionMatrix;
  
  varying vec2 vTexCoord;
  
  void main() {
    gl_Position = uProjectionMatrix * uModelViewMatrix * aPosition;
    vTexCoord = aTexCoord;
  }
`;

/**
 * Fragment shader for basic rendering
 */
const basicFragmentShaderSource = `
  precision mediump float;
  
  uniform vec4 uColor;
  uniform sampler2D uSampler;
  uniform bool uUseTexture;
  
  varying vec2 vTexCoord;
  
  void main() {
    if (uUseTexture) {
      gl_FragColor = texture2D(uSampler, vTexCoord) * uColor;
    } else {
      gl_FragColor = uColor;
    }
  }
`;

/**
 * Vertex shader for gradient rendering
 */
const gradientVertexShaderSource = `
  attribute vec4 aPosition;
  attribute vec2 aTexCoord;
  
  uniform mat4 uModelViewMatrix;
  uniform mat4 uProjectionMatrix;
  
  varying vec2 vTexCoord;
  
  void main() {
    gl_Position = uProjectionMatrix * uModelViewMatrix * aPosition;
    vTexCoord = aTexCoord;
  }
`;

/**
 * Fragment shader for linear gradient rendering
 */
const linearGradientFragmentShaderSource = `
  precision mediump float;
  
  uniform vec4 uStartColor;
  uniform vec4 uEndColor;
  uniform vec2 uStartPoint;
  uniform vec2 uEndPoint;
  
  varying vec2 vTexCoord;
  
  void main() {
    vec2 gradientVector = uEndPoint - uStartPoint;
    float gradientLength = length(gradientVector);
    vec2 normalizedGradient = gradientVector / gradientLength;
    
    vec2 vectorToFrag = vTexCoord - uStartPoint;
    float projection = dot(vectorToFrag, normalizedGradient);
    float normalizedProjection = clamp(projection / gradientLength, 0.0, 1.0);
    
    gl_FragColor = mix(uStartColor, uEndColor, normalizedProjection);
  }
`;

/**
 * Fragment shader for radial gradient rendering
 */
const radialGradientFragmentShaderSource = `
  precision mediump float;
  
  uniform vec4 uStartColor;
  uniform vec4 uEndColor;
  uniform vec2 uCenter;
  uniform float uRadius;
  
  varying vec2 vTexCoord;
  
  void main() {
    float distance = length(vTexCoord - uCenter);
    float normalizedDistance = clamp(distance / uRadius, 0.0, 1.0);
    
    gl_FragColor = mix(uStartColor, uEndColor, normalizedDistance);
  }
`;

/**
 * Fragment shader for shadow effect
 */
const shadowFragmentShaderSource = `
  precision mediump float;
  
  uniform vec4 uShadowColor;
  uniform float uBlurRadius;
  uniform vec2 uOffset;
  
  varying vec2 vTexCoord;
  
  void main() {
    vec2 position = vTexCoord - uOffset;
    float distance = length(position);
    float alpha = smoothstep(uBlurRadius, 0.0, distance);
    
    gl_FragColor = vec4(uShadowColor.rgb, uShadowColor.a * alpha);
  }
`;

/**
 * Fragment shader for blur effect
 */
const blurFragmentShaderSource = `
  precision mediump float;
  
  uniform sampler2D uSampler;
  uniform vec2 uTextureSize;
  uniform float uRadius;
  
  varying vec2 vTexCoord;
  
  void main() {
    float sigma = uRadius / 3.0;
    float sigma2 = sigma * sigma;
    
    vec4 color = vec4(0.0);
    float weightSum = 0.0;
    
    for (float x = -uRadius; x <= uRadius; x += 1.0) {
      for (float y = -uRadius; y <= uRadius; y += 1.0) {
        float weight = exp(-(x * x + y * y) / (2.0 * sigma2));
        vec2 offset = vec2(x, y) / uTextureSize;
        color += texture2D(uSampler, vTexCoord + offset) * weight;
        weightSum += weight;
      }
    }
    
    gl_FragColor = color / weightSum;
  }
`;

/**
 * Fragment shader for rounded corners
 */
const roundedCornersFragmentShaderSource = `
  precision mediump float;
  
  uniform vec4 uColor;
  uniform vec2 uSize;
  uniform float uRadius;
  
  varying vec2 vTexCoord;
  
  float roundedRectangle(vec2 position, vec2 size, float radius) {
    // Convert from texture coordinates to pixel coordinates relative to center
    vec2 q = abs(position * size - size * 0.5) - size * 0.5 + radius;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
  }
  
  void main() {
    float distance = roundedRectangle(vTexCoord, uSize, uRadius);
    
    // Apply anti-aliasing
    float smoothWidth = 0.5;
    float alpha = 1.0 - smoothstep(-smoothWidth, 0.0, distance);
    
    gl_FragColor = vec4(uColor.rgb, uColor.a * alpha);
  }
`;

/**
 * Fragment shader for text rendering
 */
const textFragmentShaderSource = `
  precision mediump float;
  
  uniform sampler2D uSampler;
  uniform vec4 uTextColor;
  
  varying vec2 vTexCoord;
  
  void main() {
    vec4 texColor = texture2D(uSampler, vTexCoord);
    gl_FragColor = vec4(uTextColor.rgb, texColor.a * uTextColor.a);
  }
`;

// Shader program types
export interface ShaderPrograms {
  basic: WebGLProgram;
  linearGradient: WebGLProgram;
  radialGradient: WebGLProgram;
  shadow: WebGLProgram;
  blur: WebGLProgram;
  roundedCorners: WebGLProgram;
  text: WebGLProgram;
}

/**
 * Creates and compiles a shader
 */
function compileShader(gl: WebGLRenderingContext, source: string, type: number): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('Unable to create shader');
  }
  
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error('Shader compilation error: ' + info);
  }
  
  return shader;
}

/**
 * Creates a shader program from vertex and fragment shader sources
 */
function createShaderProgram(
  gl: WebGLRenderingContext, 
  vertexSource: string, 
  fragmentSource: string
): WebGLProgram {
  const vertexShader = compileShader(gl, vertexSource, gl.VERTEX_SHADER);
  const fragmentShader = compileShader(gl, fragmentSource, gl.FRAGMENT_SHADER);
  
  const program = gl.createProgram();
  if (!program) {
    throw new Error('Unable to create program');
  }
  
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error('Shader program link error: ' + info);
  }
  
  return program;
}

/**
 * Initializes WebGL context
 */
export function initWebGL(canvas: HTMLCanvasElement): WebGLRenderingContext {
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext;
  
  if (!gl) {
    throw new Error('WebGL is not supported or enabled in this browser');
  }
  
  return gl;
}

/**
 * Sets up all shader programs needed for the renderer
 */
export function setupShaders(gl: WebGLRenderingContext): ShaderPrograms {
  return {
    basic: createShaderProgram(gl, basicVertexShaderSource, basicFragmentShaderSource),
    linearGradient: createShaderProgram(gl, gradientVertexShaderSource, linearGradientFragmentShaderSource),
    radialGradient: createShaderProgram(gl, gradientVertexShaderSource, radialGradientFragmentShaderSource),
    shadow: createShaderProgram(gl, basicVertexShaderSource, shadowFragmentShaderSource),
    blur: createShaderProgram(gl, basicVertexShaderSource, blurFragmentShaderSource),
    roundedCorners: createShaderProgram(gl, basicVertexShaderSource, roundedCornersFragmentShaderSource),
    text: createShaderProgram(gl, basicVertexShaderSource, textFragmentShaderSource)
  };
}

/**
 * Creates orthographic projection matrix
 * Used for 2D rendering
 */
export function createOrthographicMatrix(
  left: number, right: number, 
  bottom: number, top: number, 
  near: number, far: number
): Float32Array {
  const matrix = new Float32Array(16);
  
  matrix[0] = 2 / (right - left);
  matrix[1] = 0;
  matrix[2] = 0;
  matrix[3] = 0;
  
  matrix[4] = 0;
  matrix[5] = 2 / (top - bottom);
  matrix[6] = 0;
  matrix[7] = 0;
  
  matrix[8] = 0;
  matrix[9] = 0;
  matrix[10] = 2 / (near - far);
  matrix[11] = 0;
  
  matrix[12] = (right + left) / (left - right);
  matrix[13] = (top + bottom) / (bottom - top);
  matrix[14] = (far + near) / (near - far);
  matrix[15] = 1;
  
  return matrix;
}

/**
 * Creates identity matrix
 */
export function createIdentityMatrix(): Float32Array {
  const matrix = new Float32Array(16);
  
  matrix[0] = 1;
  matrix[1] = 0;
  matrix[2] = 0;
  matrix[3] = 0;
  
  matrix[4] = 0;
  matrix[5] = 1;
  matrix[6] = 0;
  matrix[7] = 0;
  
  matrix[8] = 0;
  matrix[9] = 0;
  matrix[10] = 1;
  matrix[11] = 0;
  
  matrix[12] = 0;
  matrix[13] = 0;
  matrix[14] = 0;
  matrix[15] = 1;
  
  return matrix;
}

/**
 * Creates a transform matrix for 2D operations (translate, scale, rotate)
 */
export function createTransformMatrix(x: number, y: number, scaleX: number, scaleY: number, rotation: number): Float32Array {
  const matrix = createIdentityMatrix();
  
  // Translation
  matrix[12] = x;
  matrix[13] = y;
  
  // Scale
  matrix[0] = scaleX;
  matrix[5] = scaleY;
  
  // Rotation (if needed)
  if (rotation !== 0) {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    
    const newM0 = matrix[0] * cos;
    const newM1 = matrix[0] * sin;
    const newM4 = -matrix[5] * sin;
    const newM5 = matrix[5] * cos;
    
    matrix[0] = newM0;
    matrix[1] = newM1;
    matrix[4] = newM4;
    matrix[5] = newM5;
  }
  
  return matrix;
}

/**
 * Check if WebGL is supported
 */
export function isWebGLSupported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch (e) {
    return false;
  }
} 