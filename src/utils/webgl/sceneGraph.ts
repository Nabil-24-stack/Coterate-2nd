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
}

// Overall scene graph containing the root node
export interface SceneGraph {
  root: ContainerNode;
  width: number;
  height: number;
}

// Container node type
export interface ContainerNode extends SceneNode {
  type: 'container';
  backgroundColor?: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
  borderRadius?: number;
  shadowColor?: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  children: SceneNode[];
}

// Create a scene from JSON data
export function createScene(data: any): SceneGraph {
  // Basic validation
  if (!data || !data.width || !data.height || !data.root) {
    throw new Error('Invalid scene data: missing required properties');
  }
  
  return {
    width: data.width,
    height: data.height,
    root: parseNode(data.root) as ContainerNode
  };
}

// Helper to parse a node from the JSON data
function parseNode(nodeData: any): SceneNode {
  if (!nodeData.id || !nodeData.type) {
    throw new Error('Invalid node data: missing required properties');
  }
  
  const baseNode: SceneNode = {
    id: nodeData.id,
    type: nodeData.type,
    x: nodeData.x || 0,
    y: nodeData.y || 0,
    width: nodeData.width || 100,
    height: nodeData.height || 100,
    rotation: nodeData.rotation || 0,
    opacity: nodeData.opacity !== undefined ? nodeData.opacity : 1,
    visible: nodeData.visible !== undefined ? nodeData.visible : true
  };
  
  // If the node has children, parse them recursively
  if (nodeData.children && Array.isArray(nodeData.children)) {
    baseNode.children = nodeData.children.map(parseNode);
  }
  
  return baseNode;
}

// Render a scene graph to a WebGL context
export function renderScene(gl: WebGLRenderingContext, scene: SceneGraph, shaderPrograms: ShaderPrograms) {
  // Clear the canvas
  gl.clear(gl.COLOR_BUFFER_BIT);
  
  // Create the projection matrix for the scene
  const projectionMatrix = createOrthographicMatrix(
    0, scene.width,
    scene.height, 0,
    -1, 1
  );
  
  // Render the root node and its children
  renderNode(gl, scene.root, projectionMatrix, shaderPrograms);
}

// Helper to render a node and its children
function renderNode(
  gl: WebGLRenderingContext, 
  node: SceneNode, 
  projectionMatrix: Float32Array, 
  shaderPrograms: ShaderPrograms,
  parentModelViewMatrix?: Float32Array
) {
  // Skip invisible nodes
  if (node.visible === false) return;
  
  // Create the model-view matrix for this node
  const modelViewMatrix = createTransformMatrix(
    node.x,
    node.y,
    1, // scaleX
    1, // scaleY
    node.rotation || 0
  );
  
  // Very basic rendering for now - we'll implement proper rendering later
  // This is a placeholder that creates a simple colored rectangle for each node
  
  // Render any children
  if (node.children && node.children.length > 0) {
    node.children.forEach(childNode => {
      renderNode(gl, childNode, projectionMatrix, shaderPrograms, modelViewMatrix);
    });
  }
}
