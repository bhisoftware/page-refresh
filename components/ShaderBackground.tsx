"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const VERTEX_SHADER = `
  attribute vec3 position;
  void main() { gl_Position = vec4(position, 1.0); }
`;

// Subtractive blending: wave darkens cream toward sage green
const FRAGMENT_SHADER = `
  precision highp float;
  uniform vec2 resolution;
  uniform float time;
  uniform float xScale;
  uniform float yScale;
  uniform float distortion;
  uniform float brightness;
  uniform vec3 waveColor1;
  uniform vec3 waveColor2;
  uniform vec3 waveColor3;
  uniform vec3 baseColor;

  void main() {
    vec2 p = (gl_FragCoord.xy * 2.0 - resolution) / min(resolution.x, resolution.y);
    float d = length(p) * distortion;
    float rx = p.x * (1.0 + d);
    float gx = p.x;
    float bx = p.x * (1.0 - d);

    float r = brightness / abs(p.y + sin((rx + time) * xScale) * yScale);
    float g = brightness / abs(p.y + sin((gx + time) * xScale) * yScale);
    float b = brightness / abs(p.y + sin((bx + time) * xScale) * yScale);

    r = clamp(r, 0.0, 1.0);
    g = clamp(g, 0.0, 1.0);
    b = clamp(b, 0.0, 1.0);

    float intensity = (r + g + b) / 3.0;
    float total = r + g + b + 0.001;
    vec3 waveColor = waveColor1 * (r / total) + waveColor2 * (g / total) + waveColor3 * (b / total);

    vec3 color = mix(baseColor, waveColor, intensity);
    gl_FragColor = vec4(color, 1.0);
  }
`;

// #f5f0eb normalized
const BASE_COLOR = [0.961, 0.941, 0.922];
// Sage green target colors (chromatic split)
const WAVE_1 = [0.18, 0.35, 0.24]; // #2d5a3d
const WAVE_2 = [0.12, 0.29, 0.18]; // darker sage
const WAVE_3 = [0.24, 0.35, 0.18]; // warm olive

export function ShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene | null;
    camera: THREE.OrthographicCamera | null;
    renderer: THREE.WebGLRenderer | null;
    mesh: THREE.Mesh | null;
    uniforms: Record<string, { value: unknown }> | null;
    animationId: number | null;
  }>({
    scene: null,
    camera: null,
    renderer: null,
    mesh: null,
    uniforms: null,
    animationId: null,
  });

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const refs = sceneRef.current;

    refs.scene = new THREE.Scene();
    refs.renderer = new THREE.WebGLRenderer({ canvas });
    refs.renderer.setPixelRatio(window.devicePixelRatio);
    refs.renderer.setClearColor(new THREE.Color(0xf5f0eb));
    refs.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, -1);

    refs.uniforms = {
      resolution: { value: [window.innerWidth, window.innerHeight] },
      time: { value: 0.0 },
      xScale: { value: 1.0 },
      yScale: { value: 0.35 },
      distortion: { value: 0.05 },
      brightness: { value: 0.06 },
      baseColor: { value: BASE_COLOR },
      waveColor1: { value: WAVE_1 },
      waveColor2: { value: WAVE_2 },
      waveColor3: { value: WAVE_3 },
    };

    const positions = new THREE.BufferAttribute(
      new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]),
      3
    );
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", positions);

    const material = new THREE.RawShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: refs.uniforms,
      side: THREE.DoubleSide,
    });

    refs.mesh = new THREE.Mesh(geometry, material);
    refs.scene.add(refs.mesh);

    const handleResize = () => {
      if (!refs.renderer || !refs.uniforms) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      refs.renderer.setSize(w, h, false);
      refs.uniforms.resolution.value = [w, h];
    };

    const animate = () => {
      if (refs.uniforms) {
        (refs.uniforms.time.value as number) += 0.006; // slow, ambient speed
      }
      if (refs.renderer && refs.scene && refs.camera) {
        refs.renderer.render(refs.scene, refs.camera);
      }
      refs.animationId = requestAnimationFrame(animate);
    };

    handleResize();
    animate();
    window.addEventListener("resize", handleResize);

    return () => {
      if (refs.animationId) cancelAnimationFrame(refs.animationId);
      window.removeEventListener("resize", handleResize);
      if (refs.mesh) {
        refs.scene?.remove(refs.mesh);
        refs.mesh.geometry.dispose();
        if (refs.mesh.material instanceof THREE.Material) {
          refs.mesh.material.dispose();
        }
      }
      refs.renderer?.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ zIndex: 0 }}
    />
  );
}
