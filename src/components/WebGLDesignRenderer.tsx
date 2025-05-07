import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import styled from 'styled-components';
import { createScene, renderScene, SceneGraph, SceneNode } from '../utils/webgl/sceneGraph';
import { initWebGL, setupShaders } from '../utils/webgl/webglCore';
import { convertSceneToImage } from '../utils/webgl/imageUtils';

interface WebGLDesignRendererProps {
  sceneDescription: string; // JSON representation of the scene
  onRender?: (success: boolean) => void;
  width?: number;
  height?: number;
  showBorder?: boolean;
}

export interface WebGLDesignRendererHandle {
  convertToImage: () => Promise<string | null>;
  refreshContent: () => void;
}

const RendererContainer = styled.div<{ width?: number; height?: number; showBorder?: boolean }>`
  position: relative;
  width: ${props => props.width ? `${props.width}px` : 'auto'};
  height: ${props => props.height ? `${props.height}px` : 'auto'};
  min-width: 280px;
  overflow: hidden;
  background-color: white;
  box-shadow: ${props => props.showBorder ? '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)' : 'none'};
  border-radius: ${props => props.showBorder ? '4px' : '0'};
  transition: box-shadow 0.2s ease-in-out;
  
  &:hover {
    box-shadow: ${props => props.showBorder ? '0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23)' : 'none'};
  }
`;

const CanvasElement = styled.canvas`
  display: block;
  width: 100%;
  height: 100%;
`;

export const WebGLDesignRenderer = forwardRef<WebGLDesignRendererHandle, WebGLDesignRendererProps>(({
  sceneDescription,
  onRender,
  width = 800,
  height = 600,
  showBorder = true
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glContextRef = useRef<WebGLRenderingContext | null>(null);
  const sceneRef = useRef<SceneGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Process the JSON scene description
  const parseSceneDescription = (jsonString: string): SceneGraph | null => {
    try {
      const sceneData = JSON.parse(jsonString);
      return createScene(sceneData);
    } catch (err) {
      console.error('Error parsing scene description:', err);
      setError(`Scene parsing error: ${err}`);
      return null;
    }
  };
  
  // Initialize WebGL context and render the scene
  useEffect(() => {
    if (!canvasRef.current) return;
    
    try {
      // Initialize WebGL context
      const gl = initWebGL(canvasRef.current);
      if (!gl) {
        throw new Error('WebGL context initialization failed');
      }
      
      glContextRef.current = gl;
      
      // Set up initial WebGL configuration
      gl.viewport(0, 0, width, height);
      gl.clearColor(1.0, 1.0, 1.0, 1.0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      
      // Set up shaders
      const shaderPrograms = setupShaders(gl);
      
      // Parse the scene description if available
      if (sceneDescription) {
        const scene = parseSceneDescription(sceneDescription);
        if (scene) {
          sceneRef.current = scene;
          renderScene(gl, scene, shaderPrograms);
          onRender?.(true);
        } else {
          onRender?.(false);
        }
      } else {
        // Render a default empty scene
        gl.clear(gl.COLOR_BUFFER_BIT);
        console.warn('WebGLDesignRenderer: Empty scene description received');
        onRender?.(true);
      }
    } catch (err) {
      console.error('WebGL rendering error:', err);
      setError(`WebGL rendering error: ${err}`);
      onRender?.(false);
    }
    
    // Clean up WebGL context when component unmounts
    return () => {
      if (glContextRef.current) {
        // Lose the context to clean up resources
        const extension = glContextRef.current.getExtension('WEBGL_lose_context');
        if (extension) extension.loseContext();
      }
    };
  }, [sceneDescription, width, height, onRender]);
  
  // Method to convert the WebGL rendered scene to an image
  const convertToImage = async (): Promise<string | null> => {
    try {
      if (!canvasRef.current || !glContextRef.current || !sceneRef.current) {
        throw new Error('Canvas or WebGL context not available');
      }
      
      // Use the utility function to convert scene to image
      return convertSceneToImage(canvasRef.current);
    } catch (err) {
      console.error('Error converting WebGL scene to image:', err);
      return null;
    }
  };
  
  // Method to refresh content
  const refreshContent = () => {
    try {
      if (!glContextRef.current || !sceneRef.current) {
        console.warn('Cannot refresh: WebGL context or scene not available');
        return;
      }
      
      // Re-render the scene
      const gl = glContextRef.current;
      const shaderPrograms = setupShaders(gl);
      renderScene(gl, sceneRef.current, shaderPrograms);
      console.log('WebGLDesignRenderer: Content refreshed');
      setError(null);
      onRender?.(true);
    } catch (err) {
      console.error('Error refreshing WebGL content:', err);
      setError(`Refresh error: ${err}`);
      onRender?.(false);
    }
  };
  
  // Expose methods to parent components via ref
  useImperativeHandle(ref, () => ({
    convertToImage,
    refreshContent
  }));
  
  return (
    <RendererContainer width={width} height={height} showBorder={showBorder}>
      {error ? (
        <div style={{ color: 'red', padding: '8px' }}>
          Error: {error}
        </div>
      ) : (
        <CanvasElement 
          ref={canvasRef}
          width={width}
          height={height}
        />
      )}
    </RendererContainer>
  );
}); 