"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const VERTEX_SHADER = `
  attribute vec3 position;
  void main() { gl_Position = vec4(position, 1.0); }
`;

const FRAGMENT_SHADER = `
  precision highp float;
  uniform vec2 resolution;
  uniform float time;
  uniform float xScale;
  uniform float yScale;
  uniform float distortion;
  uniform float brightness;
  uniform vec3 tintR;
  uniform vec3 tintG;
  uniform vec3 tintB;
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
    vec3 waveColor = tintR * (r / total) + tintG * (g / total) + tintB * (b / total);
    vec3 color = mix(baseColor, waveColor, intensity);
    gl_FragColor = vec4(color, 1.0);
  }
`;

// Sage tint: dark sage green bands on cream
const SAGE_TINT = {
  r: [0.18, 0.35, 0.24],
  g: [0.12, 0.29, 0.18],
  b: [0.24, 0.35, 0.18],
};

export function ShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ canvas });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(new THREE.Color(0xf5f0eb));
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, -1);

    const uniforms = {
      resolution: { value: [window.innerWidth, window.innerHeight] },
      time: { value: 0.0 },
      xScale: { value: 1.0 },
      yScale: { value: 0.35 },
      distortion: { value: 0.05 },
      brightness: { value: 0.06 },
      tintR: { value: SAGE_TINT.r },
      tintG: { value: SAGE_TINT.g },
      tintB: { value: SAGE_TINT.b },
      baseColor: { value: [0.961, 0.941, 0.922] }, // #f5f0eb
    };

    const positions = new THREE.BufferAttribute(
      new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]),
      3
    );
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", positions);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.RawShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        uniforms,
        side: THREE.DoubleSide,
      })
    );
    scene.add(mesh);

    const speed = 0.6;

    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h, false);
      uniforms.resolution.value = [w, h];
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    const animate = () => {
      uniforms.time.value += 0.01 * speed;
      renderer.render(scene, camera);
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      geo.dispose();
      mesh.material.dispose();
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 0,
        }}
      />
      {/* Soft cream wash overlay so shader stays subtle */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 1,
          background:
            "radial-gradient(ellipse at center, rgba(245,240,235,0.05) 0%, rgba(245,240,235,0.25) 100%)",
          pointerEvents: "none",
        }}
      />
    </>
  );
}
