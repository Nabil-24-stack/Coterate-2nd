// Scene Graph Implementation for WebGL rendering
// This module handles the creation and management of the UI element hierarchy

import { ShaderPrograms, createTransformMatrix, createOrthographicMatrix } from './webglCore';

// Base types for scene nodes
export interface SceneNode {
  id: string;
  type: string;
  children?: SceneNode[];
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  visible?: boolean;
  render(gl: WebGLRenderingContext, shaderPrograms: ShaderPrograms): void;
}

// Overall scene graph containing the root node
export interface SceneGraph {
  root: ContainerNode;
  width: number;
  height: number;
}

// Geometry buffer for WebGL rendering
interface GeometryBuffer {
  vertexBuffer: WebGLBuffer;
  indexBuffer: WebGLBuffer;
  textureCoordBuffer: WebGLBuffer;
  numIndices: number;
}

// Color represented as RGBA
export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

// Common properties for all nodes
interface BaseNodeProps {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  visible?: boolean;
  children?: SceneNodeData[];
}

// Container node (div-like)
export interface ContainerNode extends SceneNode {
  type: 'container';
  backgroundColor?: Color;
  borderColor?: Color;
  borderWidth?: number;
  borderRadius?: number;
  shadowColor?: Color;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
}

// Rectangle node (basic shape)
export interface RectNode extends SceneNode {
  type: 'rect';
  fillColor: Color;
  borderColor?: Color;
  borderWidth?: number;
  borderRadius?: number;
}

// Text node
export interface TextNode extends SceneNode {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight?: string;
  textColor: Color;
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number;
}

// Button node
export interface ButtonNode extends SceneNode {
  type: 'button';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight?: string;
  backgroundColor: Color;
  textColor: Color;
  borderRadius?: number;
  borderColor?: Color;
  borderWidth?: number;
}

// Image node
export interface ImageNode extends SceneNode {
  type: 'image';
  imageUrl: string;
  borderRadius?: number;
}

// Input field node
export interface InputNode extends SceneNode {
  type: 'input';
  placeholder?: string;
  fontFamily: string;
  fontSize: number;
  backgroundColor: Color;
  textColor: Color;
  borderColor?: Color;
  borderWidth?: number;
  borderRadius?: number;
}

// Gradient definition
export interface Gradient {
  type: 'linear' | 'radial';
  colors: Color[];
  stops: number[]; // Values between 0 and 1
  startX?: number; // For linear gradient
  startY?: number;
  endX?: number;
  endY?: number;
  centerX?: number; // For radial gradient
  centerY?: number;
  radius?: number;
}

// JSON representation types for parse/serialize
export type SceneNodeData = 
  ContainerNodeData | 
  RectNodeData | 
  TextNodeData | 
  ButtonNodeData | 
  ImageNodeData | 
  InputNodeData;

interface ContainerNodeData extends BaseNodeProps {
  type: 'container';
  backgroundColor?: {r: number, g: number, b: number, a: number};
  borderColor?: {r: number, g: number, b: number, a: number};
  borderWidth?: number;
  borderRadius?: number;
  shadowColor?: {r: number, g: number, b: number, a: number};
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
}

interface RectNodeData extends BaseNodeProps {
  type: 'rect';
  fillColor: {r: number, g: number, b: number, a: number};
  borderColor?: {r: number, g: number, b: number, a: number};
  borderWidth?: number;
  borderRadius?: number;
}

interface TextNodeData extends BaseNodeProps {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight?: string;
  textColor: {r: number, g: number, b: number, a: number};
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number;
}

interface ButtonNodeData extends BaseNodeProps {
  type: 'button';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight?: string;
  backgroundColor: {r: number, g: number, b: number, a: number};
  textColor: {r: number, g: number, b: number, a: number};
  borderRadius?: number;
  borderColor?: {r: number, g: number, b: number, a: number};
  borderWidth?: number;
}

interface ImageNodeData extends BaseNodeProps {
  type: 'image';
  imageUrl: string;
  borderRadius?: number;
}

interface InputNodeData extends BaseNodeProps {
  type: 'input';
  placeholder?: string;
  fontFamily: string;
  fontSize: number;
  backgroundColor: {r: number, g: number, b: number, a: number};
  textColor: {r: number, g: number, b: number, a: number};
  borderColor?: {r: number, g: number, b: number, a: number};
  borderWidth?: number;
  borderRadius?: number;
}

// Texture cache for rendered text and images
const textureCache: {[key: string]: WebGLTexture} = {};

// Create a geometry buffer for a rectangle
function createRectGeometry(gl: WebGLRenderingContext): GeometryBuffer {
  // Create vertex positions buffer
  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  
  // Rectangle vertices (x, y, z)
  const vertices = new Float32Array([
    0.0, 0.0, 0.0,  // Bottom left
    1.0, 0.0, 0.0,  // Bottom right
    1.0, 1.0, 0.0,  // Top right
    0.0, 1.0, 0.0   // Top left
  ]);
  
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  
  // Create texture coordinate buffer
  const textureCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
  
  // Texture coordinates
  const textureCoords = new Float32Array([
    0.0, 1.0,  // Bottom left
    1.0, 1.0,  // Bottom right
    1.0, 0.0,  // Top right
    0.0, 0.0   // Top left
  ]);
  
  gl.bufferData(gl.ARRAY_BUFFER, textureCoords, gl.STATIC_DRAW);
  
  // Create index buffer
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  
  // Indices for two triangles forming a rectangle
  const indices = new Uint16Array([
    0, 1, 2,  // First triangle
    0, 2, 3   // Second triangle
  ]);
  
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  
  return {
    vertexBuffer: vertexBuffer!,
    indexBuffer: indexBuffer!,
    textureCoordBuffer: textureCoordBuffer!,
    numIndices: indices.length
  };
}

// Create a texture for text rendering
function createTextTexture(
  gl: WebGLRenderingContext, 
  text: string, 
  fontFamily: string, 
  fontSize: number,
  fontWeight: string = 'normal',
  textColor: Color = {r: 0, g: 0, b: 0, a: 1},
  width: number,
  height: number
): WebGLTexture {
  // Create an offscreen canvas for text rendering
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d')!;
  
  // Clear background
  ctx.clearRect(0, 0, width, height);
  
  // Set text properties
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}, sans-serif`;
  ctx.fillStyle = `rgba(${textColor.r * 255}, ${textColor.g * 255}, ${textColor.b * 255}, ${textColor.a})`;
  ctx.textBaseline = 'top';
  
  // Draw the text
  const textMetrics = ctx.measureText(text);
  const textHeight = fontSize;
  const x = 0;
  const y = (height - textHeight) / 2;
  
  ctx.fillText(text, x, y);
  
  // Create a texture from the canvas
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  
  // Set texture parameters
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  
  // Upload the canvas pixels to the texture
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  
  return texture;
}

// Load an image texture for WebGL
function loadImageTexture(gl: WebGLRenderingContext, url: string): Promise<WebGLTexture> {
  return new Promise((resolve, reject) => {
    // Check cache first
    if (textureCache[url]) {
      resolve(textureCache[url]);
      return;
    }
    
    const image = new Image();
    image.crossOrigin = 'anonymous';
    
    image.onload = () => {
      const texture = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      
      // Set texture parameters
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      
      // Upload the image pixels to the texture
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      
      // Cache the texture
      textureCache[url] = texture;
      
      resolve(texture);
    };
    
    image.onerror = () => {
      reject(new Error(`Failed to load image: ${url}`));
    };
    
    image.src = url;
  });
}

// Implementation of node rendering

// Render a container node
function renderContainer(node: ContainerNode, gl: WebGLRenderingContext, shaderPrograms: ShaderPrograms) {
  if (node.visible === false) return;
  
  const projectionMatrix = createOrthographicMatrix(0, node.width, node.height, 0, -1, 1);
  const modelViewMatrix = createTransformMatrix(node.x, node.y, node.width, node.height, node.rotation || 0);
  
  // Draw background if specified
  if (node.backgroundColor) {
    const program = node.borderRadius ? shaderPrograms.roundedCorners : shaderPrograms.basic;
    gl.useProgram(program);
    
    // Create geometry for the container
    const geometry = createRectGeometry(gl);
    
    // Set up attribute pointers
    const positionAttrib = gl.getAttribLocation(program, 'aPosition');
    gl.bindBuffer(gl.ARRAY_BUFFER, geometry.vertexBuffer);
    gl.vertexAttribPointer(positionAttrib, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionAttrib);
    
    const texCoordAttrib = gl.getAttribLocation(program, 'aTexCoord');
    gl.bindBuffer(gl.ARRAY_BUFFER, geometry.textureCoordBuffer);
    gl.vertexAttribPointer(texCoordAttrib, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(texCoordAttrib);
    
    // Set uniforms
    gl.uniformMatrix4fv(
      gl.getUniformLocation(program, 'uProjectionMatrix'),
      false,
      projectionMatrix
    );
    
    gl.uniformMatrix4fv(
      gl.getUniformLocation(program, 'uModelViewMatrix'),
      false,
      modelViewMatrix
    );
    
    // Set color uniform
    const colorLoc = gl.getUniformLocation(program, 'uColor');
    gl.uniform4f(
      colorLoc,
      node.backgroundColor.r,
      node.backgroundColor.g,
      node.backgroundColor.b,
      (node.backgroundColor.a || 1.0) * (node.opacity || 1.0)
    );
    
    // Set rounded corners if needed
    if (node.borderRadius && node.borderRadius > 0) {
      gl.uniform2f(
        gl.getUniformLocation(program, 'uSize'),
        node.width,
        node.height
      );
      
      gl.uniform1f(
        gl.getUniformLocation(program, 'uRadius'),
        node.borderRadius
      );
    } else {
      // For basic shader
      gl.uniform1i(
        gl.getUniformLocation(program, 'uUseTexture'),
        0
      );
    }
    
    // Draw the container
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geometry.indexBuffer);
    gl.drawElements(gl.TRIANGLES, geometry.numIndices, gl.UNSIGNED_SHORT, 0);
    
    // Render border if specified
    if (node.borderColor && node.borderWidth && node.borderWidth > 0) {
      // Border rendering would go here...
      // Would use GL_LINE_LOOP or similar technique
    }
  }
  
  // Render shadow if specified
  if (node.shadowColor && node.shadowBlur && node.shadowBlur > 0) {
    // Shadow rendering would go here...
    // Would use the shadow shader program
  }
  
  // Recursively render children
  if (node.children && node.children.length > 0) {
    node.children.forEach(child => {
      child.render(gl, shaderPrograms);
    });
  }
}

// Implementation for creating nodes from data
function createNodeFromData(data: SceneNodeData): SceneNode {
  switch (data.type) {
    case 'container':
      return {
        id: data.id,
        type: 'container',
        x: data.x,
        y: data.y,
        width: data.width,
        height: data.height,
        rotation: data.rotation,
        opacity: data.opacity,
        visible: data.visible !== false,
        backgroundColor: data.backgroundColor,
        borderColor: data.borderColor,
        borderWidth: data.borderWidth,
        borderRadius: data.borderRadius,
        shadowColor: data.shadowColor,
        shadowBlur: data.shadowBlur,
        shadowOffsetX: data.shadowOffsetX,
        shadowOffsetY: data.shadowOffsetY,
        children: data.children?.map(createNodeFromData),
        render: function(gl, shaderPrograms) {
          renderContainer(this as ContainerNode, gl, shaderPrograms);
        }
      } as ContainerNode;
      
    // Additional implementations for other node types would go here
    
    default:
      throw new Error(`Unsupported node type: ${(data as any).type}`);
  }
}

// Create a scene graph from JSON description
export function createScene(data: any): SceneGraph {
  // Validate the input data
  if (!data || !data.root || !data.width || !data.height) {
    throw new Error('Invalid scene data: missing required properties');
  }
  
  // Create the root node
  const rootNode = createNodeFromData(data.root) as ContainerNode;
  
  return {
    root: rootNode,
    width: data.width,
    height: data.height
  };
}

// Render the entire scene
export function renderScene(
  gl: WebGLRenderingContext, 
  scene: SceneGraph, 
  shaderPrograms: ShaderPrograms
): void {
  // Clear the canvas before rendering
  gl.clearColor(1.0, 1.0, 1.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  
  // Set the viewport to match scene dimensions
  gl.viewport(0, 0, scene.width, scene.height);
  
  // Render from the root node
  scene.root.render(gl, shaderPrograms);
} 