"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";

interface TileData {
  label: string;
  accent: string;
  beforeLayout: ReactNode;
  afterLayout: ReactNode;
  marqueeWords: string[];
}

const tiles: TileData[] = [
  {
    label: "Modern",
    accent: "#ffad93",
    beforeLayout: (
      <>
        <div className="w-full h-8 rounded bg-white/12" />
        <div className="flex gap-1.5 mt-2">
          <div className="flex-1 h-2 rounded-full bg-white/8" />
          <div className="flex-1 h-2 rounded-full bg-white/8" />
          <div className="flex-1 h-2 rounded-full bg-white/8" />
        </div>
        <div className="flex gap-2 mt-3">
          <div className="w-1/2 h-6 rounded bg-white/6" />
          <div className="w-1/2 h-6 rounded bg-white/4" />
        </div>
        <div className="flex gap-2 mt-1.5">
          <div className="w-1/2 h-6 rounded bg-white/4" />
          <div className="w-1/2 h-6 rounded bg-white/6" />
        </div>
        <div className="grid grid-cols-3 gap-1.5 mt-3">
          <div className="h-4 rounded bg-white/6" />
          <div className="h-4 rounded bg-white/6" />
          <div className="h-4 rounded bg-white/6" />
        </div>
      </>
    ),
    afterLayout: (
      <>
        <div className="w-full h-8 rounded bg-gradient-to-r from-[#ffad93]/40 to-[#ffad93]/15" />
        <div className="flex gap-1.5 mt-2">
          <div className="flex-1 h-2 rounded-full bg-[#ffad93]/25" />
          <div className="flex-1 h-2 rounded-full bg-[#ffad93]/25" />
          <div className="flex-1 h-2 rounded-full bg-[#ffad93]/25" />
        </div>
        <div className="flex gap-2 mt-3">
          <div className="w-1/2 h-6 rounded bg-[#ffad93]/20" />
          <div className="w-1/2 h-6 rounded bg-[#ffad93]/10" />
        </div>
        <div className="flex gap-2 mt-1.5">
          <div className="w-1/2 h-6 rounded bg-[#ffad93]/10" />
          <div className="w-1/2 h-6 rounded bg-[#ffad93]/20" />
        </div>
        <div className="grid grid-cols-3 gap-1.5 mt-3">
          <div className="h-4 rounded bg-[#ffad93]/18" />
          <div className="h-4 rounded bg-[#ffad93]/18" />
          <div className="h-4 rounded bg-[#ffad93]/18" />
        </div>
      </>
    ),
    marqueeWords: ["Bold", "Clean", "Fast", "Minimal", "Sharp"],
  },
  {
    label: "Classy",
    accent: "#ffd9e2",
    beforeLayout: (
      <>
        <div className="w-3/4 h-7 rounded bg-white/12 mx-auto" />
        <div className="flex justify-center gap-1 mt-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-2 h-2 rounded-full bg-white/10" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1.5 mt-3">
          <div className="h-8 rounded bg-white/6" />
          <div className="h-8 rounded bg-white/6" />
          <div className="h-8 rounded bg-white/6" />
        </div>
        <div className="w-full h-3 rounded-full bg-white/5 mt-3" />
        <div className="w-2/3 h-5 rounded bg-white/6 mx-auto mt-2" />
      </>
    ),
    afterLayout: (
      <>
        <div className="w-3/4 h-7 rounded bg-gradient-to-r from-[#ffd9e2]/35 to-[#ffd9e2]/15 mx-auto" />
        <div className="flex justify-center gap-1 mt-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-2 h-2 rounded-full bg-[#ffd9e2]/30" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1.5 mt-3">
          <div className="h-8 rounded bg-[#ffd9e2]/18" />
          <div className="h-8 rounded bg-[#ffd9e2]/18" />
          <div className="h-8 rounded bg-[#ffd9e2]/18" />
        </div>
        <div className="w-full h-3 rounded-full bg-[#ffd9e2]/12 mt-3" />
        <div className="w-2/3 h-5 rounded bg-[#ffd9e2]/18 mx-auto mt-2" />
      </>
    ),
    marqueeWords: ["Elegant", "Refined", "Trusted", "Polished", "Premium"],
  },
  {
    label: "Unique",
    accent: "#e5b0fe",
    beforeLayout: (
      <>
        <div className="flex gap-1.5">
          <div className="w-2/3 h-10 rounded bg-white/12 -skew-x-2" />
          <div className="w-1/3 h-10 rounded bg-white/8 skew-x-2" />
        </div>
        <div className="w-full h-3 rounded-full bg-white/7 mt-2" />
        <div className="space-y-1.5 mt-3">
          <div className="w-4/5 h-4 rounded bg-white/6" />
          <div className="w-3/5 h-4 rounded bg-white/5 ml-auto" />
          <div className="w-full h-4 rounded bg-white/6" />
        </div>
        <div className="w-1/2 h-5 rounded bg-white/7 mt-2 ml-4" />
      </>
    ),
    afterLayout: (
      <>
        <div className="flex gap-1.5">
          <div className="w-2/3 h-10 rounded bg-gradient-to-r from-[#e5b0fe]/35 to-[#e5b0fe]/15 -skew-x-2" />
          <div className="w-1/3 h-10 rounded bg-[#e5b0fe]/20 skew-x-2" />
        </div>
        <div className="w-full h-3 rounded-full bg-[#e5b0fe]/15 mt-2" />
        <div className="space-y-1.5 mt-3">
          <div className="w-4/5 h-4 rounded bg-[#e5b0fe]/18" />
          <div className="w-3/5 h-4 rounded bg-[#e5b0fe]/12 ml-auto" />
          <div className="w-full h-4 rounded bg-[#e5b0fe]/18" />
        </div>
        <div className="w-1/2 h-5 rounded bg-[#e5b0fe]/20 mt-2 ml-4" />
      </>
    ),
    marqueeWords: ["Creative", "Daring", "Fresh", "Distinct", "Vibrant"],
  },
];

const scanStyles = `
  @keyframes dsc-wipe-reveal {
    0%,  25%  { clip-path: inset(0 0 100% 0); }
    45%, 65%  { clip-path: inset(0 0 0%   0); }
    85%, 100% { clip-path: inset(0 0 100% 0); }
  }
  @keyframes dsc-wipe-line {
    0%,  24%  { top: 0%;   opacity: 0; }
    25%        { top: 0%;   opacity: 1; }
    44%        { top: 100%; opacity: 1; }
    45%        { top: 100%; opacity: 0; }
    64%        { top: 100%; opacity: 0; }
    65%        { top: 100%; opacity: 1; }
    84%        { top: 0%;   opacity: 1; }
    85%        { top: 0%;   opacity: 0; }
    100%       { top: 0%;   opacity: 0; }
  }
  .dsc-after {
    clip-path: inset(0 0 100% 0);
    animation: dsc-wipe-reveal 10s ease-in-out infinite;
  }
  .dsc-sweep {
    position: absolute;
    left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 20%, rgba(255,255,255,0.8) 50%, rgba(255,255,255,0.5) 80%, transparent 100%);
    z-index: 5; pointer-events: none;
    animation: dsc-wipe-line 10s ease-in-out infinite;
  }
  .dsc-tile-1 .dsc-after, .dsc-tile-1 .dsc-sweep { animation-delay: 0s; }
  .dsc-tile-2 .dsc-after, .dsc-tile-2 .dsc-sweep { animation-delay: -3.3s; }
  .dsc-tile-3 .dsc-after, .dsc-tile-3 .dsc-sweep { animation-delay: -6.6s; }
`;

export function DesignShowcaseTiles() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: scanStyles }} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mt-12 md:mt-16 w-full relative z-10">
        {tiles.map((tile, i) => (
          <motion.div
            key={tile.label}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: i * 0.15 }}
            whileHover={{ scale: 1.03, y: -4 }}
            className={`dsc-tile-${i + 1} group relative rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-5 md:p-6 overflow-hidden cursor-default flex flex-col`}
          >
            {/* Glow on hover */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl pointer-events-none"
              style={{
                background: `radial-gradient(circle at 50% 0%, ${tile.accent}15, transparent 70%)`,
              }}
            />

            {/* Label */}
            <div className="flex items-center gap-2 mb-4 relative z-10">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: tile.accent }}
              />
              <span
                className="text-xs font-bold uppercase tracking-[0.2em]"
                style={{ color: tile.accent }}
              >
                {tile.label}
              </span>
            </div>

            {/* Wireframe area with scanning wipe */}
            <div className="relative z-10 mb-4 flex-1">
              {/* Before (muted) */}
              <div>{tile.beforeLayout}</div>
              {/* After (accent-colored) — wipes over */}
              <div className="dsc-after absolute inset-0">
                {tile.afterLayout}
              </div>
              {/* Sweep line */}
              <div className="dsc-sweep" />
            </div>

            {/* Scrolling marquee text */}
            <div className="relative z-10 overflow-hidden h-6">
              <motion.div
                className="flex whitespace-nowrap gap-6"
                animate={{ x: ["0%", "-50%"] }}
                transition={{
                  repeat: Infinity,
                  ease: "linear",
                  duration: 12 + i * 3,
                }}
              >
                {[...Array(2)].map((_, dupeIdx) => (
                  <span key={dupeIdx} className="flex gap-6">
                    {tile.marqueeWords.map((word) => (
                      <span
                        key={`${dupeIdx}-${word}`}
                        className="text-xs font-medium tracking-wider opacity-40"
                        style={{ color: tile.accent }}
                      >
                        {word}
                      </span>
                    ))}
                  </span>
                ))}
              </motion.div>
            </div>
          </motion.div>
        ))}
      </div>
    </>
  );
}
