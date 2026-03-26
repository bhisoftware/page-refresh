"use client";

import { useEffect, useState } from "react";

interface ShowcaseApiItem {
  id: string;
  beforeImageUrl: string | null;
  afterImageUrl: string | null;
  siteLabel: string | null;
}

const TOTAL_CARDS = 10;

function BrowserChrome() {
  return (
    <div className="hiw-pc-chrome">
      <span className="hiw-pc-dot r" />
      <span className="hiw-pc-dot y" />
      <span className="hiw-pc-dot g" />
      <div className="hiw-pc-bar" />
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="hiw-pc-layout">
      <div className="hiw-pc-l-nav" />
      <div className="hiw-pc-l-hero" />
      <div className="hiw-pc-l-sub" />
      <div className="hiw-pc-l-row">
        <div className="hiw-pc-l-box" />
        <div className="hiw-pc-l-box" />
        <div className="hiw-pc-l-box" />
      </div>
      <div className="hiw-pc-l-btn" />
    </div>
  );
}

interface CardWrapProps {
  cwIndex: number;
  beforeUrl?: string | null;
  afterUrl?: string | null;
}

function CardWrap({ cwIndex, beforeUrl, afterUrl }: CardWrapProps) {
  const isReal = !!(beforeUrl && afterUrl);
  const n = cwIndex;
  return (
    <div className={`hiw-card-wrap hiw-cw-${n}`}>
      <div className={`hiw-preview-card hiw-pc-before${isReal ? "" : ` hiw-pb-${n}`}`}>
        <BrowserChrome />
        <div className="hiw-pc-body">
          {isReal ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={beforeUrl!}
              alt="Before"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <CardSkeleton />
          )}
          <span className="hiw-pc-badge">Before</span>
        </div>
      </div>
      <div className={`hiw-preview-card hiw-pc-after${isReal ? "" : ` hiw-pv-${n}`}`}>
        <BrowserChrome />
        <div className="hiw-pc-body">
          {isReal ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={afterUrl!}
              alt="After"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <CardSkeleton />
          )}
          <span className="hiw-pc-badge">After</span>
        </div>
      </div>
      <div className="hiw-wipe-line" />
    </div>
  );
}

export function HowItWorks() {
  const [showcaseEnabled, setShowcaseEnabled] = useState(false);
  const [items, setItems] = useState<ShowcaseApiItem[]>([]);

  useEffect(() => {
    fetch("/api/showcase")
      .then((r) => r.json())
      .then((data) => {
        setShowcaseEnabled(data.enabled === true);
        if (Array.isArray(data.items) && data.items.length >= 2) {
          setItems(data.items);
        }
      })
      .catch(() => {
        setShowcaseEnabled(false);
      });
  }, []);

  const cards = Array.from({ length: TOTAL_CARDS }, (_, i) => ({
    cwIndex: i + 1,
    beforeUrl: items[i]?.beforeImageUrl ?? null,
    afterUrl: items[i]?.afterImageUrl ?? null,
  }));

  return (
    <>
      <style>{`
        .hiw {
          width: 100%;
          padding: 80px 32px 0;
          overflow: hidden;
        }
        .hiw-inner {
          max-width: 1100px;
          margin: 0 auto;
        }
        .hiw-header {
          text-align: center;
          margin-bottom: 64px;
          animation: hiw-fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) both;
        }
        .hiw-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-family: 'Courier New', Courier, monospace;
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: #4a7c5f;
          margin-bottom: 18px;
        }
        .hiw-eyebrow::before, .hiw-eyebrow::after {
          content: '';
          display: block;
          width: 28px;
          height: 1px;
          background: #4a7c5f;
          opacity: 0.5;
        }
        .hiw-headline {
          font-size: 1.875rem;
          font-weight: 700;
          line-height: 1.1;
          color: #1a1a1a;
          letter-spacing: 0.025em;
        }
        @media (min-width: 768px) {
          .hiw-headline { font-size: 2.25rem; }
        }
        @media (min-width: 1024px) {
          .hiw-headline { font-size: 3rem; }
        }
        .hiw-steps {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          margin-bottom: 72px;
        }
        .hiw-step {
          position: relative;
          padding: 40px 32px 36px;
          background: rgba(255,255,255,0.55);
          border: 1px solid rgba(45,90,61,0.12);
          border-radius: 18px;
          overflow: hidden;
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          transition: transform 0.3s cubic-bezier(0.16,1,0.3,1), box-shadow 0.3s cubic-bezier(0.16,1,0.3,1);
          animation: hiw-fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) both;
        }
        .hiw-step:nth-child(1) { animation-delay: 0.08s; }
        .hiw-step:nth-child(2) { animation-delay: 0.16s; }
        .hiw-step:nth-child(3) { animation-delay: 0.24s; }
        .hiw-step::after {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, #2d5a3d, #4a7c5f);
          opacity: 0;
          transition: opacity 0.3s ease;
          border-radius: 18px 18px 0 0;
        }
        .hiw-step:hover { transform: translateY(-6px); box-shadow: 0 20px 48px rgba(45,90,61,0.1), 0 4px 12px rgba(45,90,61,0.06); }
        .hiw-step:hover::after { opacity: 1; }
        .hiw-step-ghost {
          position: absolute;
          bottom: -24px; right: 4px;
          font-family: 'Palatino Linotype', Palatino, Georgia, serif;
          font-size: 140px;
          font-weight: 700;
          line-height: 1;
          color: #2d5a3d;
          opacity: 0.045;
          user-select: none;
          pointer-events: none;
        }
        .hiw-num {
          width: 52px; height: 52px;
          background: #2d5a3d;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 22px;
          font-family: 'Palatino Linotype', Palatino, Georgia, serif;
          font-size: 17px; font-weight: 700; color: #fff;
          letter-spacing: 0.04em;
        }
        .hiw-step-title {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
          font-size: 19px; font-weight: 700; color: #1c2e24;
          margin-bottom: 12px; letter-spacing: -0.02em; line-height: 1.2;
        }
        .hiw-step-desc {
          font-family: 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif;
          font-size: 15.5px; line-height: 1.75; color: #6b7f71;
        }
        /* ── Marquee ── */
        .hiw-marquee-section {
          width: 100vw;
          position: relative;
          left: 50%; right: 50%;
          margin-left: -50vw; margin-right: -50vw;
          padding-bottom: 100px;
        }
        .hiw-marquee-label {
          text-align: center;
          font-family: 'Courier New', Courier, monospace;
          font-size: 10px; letter-spacing: 0.2em;
          text-transform: uppercase; color: #6b7f71;
          opacity: 0.55; margin-bottom: 28px;
        }
        .hiw-marquee-viewport {
          overflow: hidden; position: relative;
        }
        .hiw-marquee-viewport::before, .hiw-marquee-viewport::after {
          content: ''; position: absolute; top: 0; bottom: 0;
          width: 140px; z-index: 10; pointer-events: none;
        }
        .hiw-marquee-viewport::before { left: 0; background: linear-gradient(to right, #f5f0eb 0%, transparent 100%); }
        .hiw-marquee-viewport::after  { right: 0; background: linear-gradient(to left, #f5f0eb 0%, transparent 100%); }
        .hiw-marquee-track {
          display: flex; width: max-content;
          animation: hiw-marquee-scroll 44s linear infinite;
          padding: 16px 0 20px;
        }
        .hiw-marquee-track:hover { animation-play-state: paused; }
        @keyframes hiw-marquee-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        /* ── Card Wrap ── */
        .hiw-card-wrap {
          position: relative; width: 286px; height: 179px;
          flex-shrink: 0; margin-right: 20px;
        }
        /* ── Preview Cards ── */
        .hiw-preview-card {
          position: absolute; inset: 0;
          border-radius: 10px; overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.07), 0 6px 24px rgba(0,0,0,0.06);
          background: #fff;
        }
        .hiw-pc-chrome {
          height: 26px; background: #f0f0f2;
          border-bottom: 1px solid rgba(0,0,0,0.07);
          display: flex; align-items: center; padding: 0 9px; gap: 4px;
        }
        .hiw-pc-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .hiw-pc-dot.r { background: #ff5f57; }
        .hiw-pc-dot.y { background: #febc2e; }
        .hiw-pc-dot.g { background: #28c840; }
        .hiw-pc-bar { flex: 1; height: 13px; background: #e2e2e5; border-radius: 4px; margin-left: 6px; }
        .hiw-pc-body {
          height: calc(179px - 26px);
          position: relative; overflow: hidden;
        }
        .hiw-pc-layout {
          position: absolute; inset: 0;
          padding: 12px 11px 8px;
          display: flex; flex-direction: column; gap: 5px;
        }
        .hiw-pc-l-nav  { height: 14px; border-radius: 2px; background: rgba(255,255,255,0.15); width: 100%; margin-bottom: 4px; }
        .hiw-pc-l-hero { height: 28px; border-radius: 3px; background: rgba(255,255,255,0.18); }
        .hiw-pc-l-sub  { height: 9px; width: 60%; border-radius: 2px; background: rgba(255,255,255,0.12); }
        .hiw-pc-l-row  { display: flex; gap: 5px; margin-top: 2px; }
        .hiw-pc-l-box  { flex: 1; height: 28px; border-radius: 3px; background: rgba(255,255,255,0.1); }
        .hiw-pc-l-btn  { width: 52px; height: 12px; border-radius: 2px; background: rgba(255,255,255,0.28); margin-top: 2px; }
        .hiw-pc-badge {
          position: absolute; bottom: 8px; left: 9px;
          font-family: 'Courier New', Courier, monospace;
          font-size: 8px; font-weight: 700; letter-spacing: 0.12em;
          text-transform: uppercase; padding: 3px 7px;
          border-radius: 3px; line-height: 1;
        }
        /* Before card */
        .hiw-pc-before .hiw-pc-badge { background: rgba(0,0,0,0.28); color: rgba(255,255,255,0.7); }
        /* Before colors */
        .hiw-pb-1  .hiw-pc-body { background: #5b7fa0; }
        .hiw-pb-2  .hiw-pc-body { background: #8a6040; }
        .hiw-pb-3  .hiw-pc-body { background: #6a5898; }
        .hiw-pb-4  .hiw-pc-body { background: #6a8aa0; }
        .hiw-pb-5  .hiw-pc-body { background: #b07890; }
        .hiw-pb-6  .hiw-pc-body { background: #2a3848; }
        .hiw-pb-7  .hiw-pc-body { background: #688060; }
        .hiw-pb-8  .hiw-pc-body { background: #3a3a50; }
        .hiw-pb-9  .hiw-pc-body { background: #a09070; }
        .hiw-pb-10 .hiw-pc-body { background: #c87040; }
        /* Light before cards: dark skeleton */
        .hiw-pb-4 .hiw-pc-l-nav, .hiw-pb-4 .hiw-pc-l-hero, .hiw-pb-4 .hiw-pc-l-sub, .hiw-pb-4 .hiw-pc-l-box, .hiw-pb-4 .hiw-pc-l-btn,
        .hiw-pb-7 .hiw-pc-l-nav, .hiw-pb-7 .hiw-pc-l-hero, .hiw-pb-7 .hiw-pc-l-sub, .hiw-pb-7 .hiw-pc-l-box, .hiw-pb-7 .hiw-pc-l-btn,
        .hiw-pb-9 .hiw-pc-l-nav, .hiw-pb-9 .hiw-pc-l-hero, .hiw-pb-9 .hiw-pc-l-sub, .hiw-pb-9 .hiw-pc-l-box, .hiw-pb-9 .hiw-pc-l-btn { background: rgba(0,0,0,0.12); }
        .hiw-pb-4 .hiw-pc-l-btn, .hiw-pb-7 .hiw-pc-l-btn, .hiw-pb-9 .hiw-pc-l-btn { background: rgba(0,0,0,0.22); }
        .hiw-pb-4 .hiw-pc-badge, .hiw-pb-7 .hiw-pc-badge, .hiw-pb-9 .hiw-pc-badge { background: rgba(0,0,0,0.2); color: rgba(0,0,0,0.45); }
        /* After card */
        .hiw-pc-after {
          clip-path: inset(0 0 100% 0);
          animation: hiw-wipe-reveal 10s ease-in-out infinite;
        }
        .hiw-pc-after .hiw-pc-badge { background: rgba(45,90,61,0.75); color: #fff; }
        /* After colors */
        .hiw-pv-1  .hiw-pc-body { background: linear-gradient(140deg,#0c2340 0%,#1a4a80 55%,#2a72c0 100%); }
        .hiw-pv-2  .hiw-pc-body { background: linear-gradient(140deg,#3d1508 0%,#9b3d18 55%,#e05a28 100%); }
        .hiw-pv-3  .hiw-pc-body { background: linear-gradient(140deg,#18082e 0%,#432080 55%,#7848d8 100%); }
        .hiw-pv-4  .hiw-pc-body { background: linear-gradient(140deg,#eaf4ff 0%,#c8e4ff 100%); }
        .hiw-pv-5  .hiw-pc-body { background: linear-gradient(140deg,#fff0f6 0%,#ffd0e8 55%,#ffaad8 100%); }
        .hiw-pv-6  .hiw-pc-body { background: linear-gradient(140deg,#080f1e 0%,#101e3c 55%,#1c3464 100%); }
        .hiw-pv-7  .hiw-pc-body { background: linear-gradient(140deg,#e4f5de 0%,#bce6b0 55%,#8ecc80 100%); }
        .hiw-pv-8  .hiw-pc-body { background: linear-gradient(140deg,#0e0e1e 0%,#2a2a42 55%,#e8204a 100%); }
        .hiw-pv-9  .hiw-pc-body { background: linear-gradient(140deg,#faf5ee 0%,#efe4d2 100%); }
        .hiw-pv-10 .hiw-pc-body { background: linear-gradient(140deg,#ff6b45 0%,#f0943a 55%,#ffd040 100%); }
        /* Light after cards: dark skeleton */
        .hiw-pv-4 .hiw-pc-l-nav, .hiw-pv-4 .hiw-pc-l-hero, .hiw-pv-4 .hiw-pc-l-sub, .hiw-pv-4 .hiw-pc-l-box, .hiw-pv-4 .hiw-pc-l-btn,
        .hiw-pv-5 .hiw-pc-l-nav, .hiw-pv-5 .hiw-pc-l-hero, .hiw-pv-5 .hiw-pc-l-sub, .hiw-pv-5 .hiw-pc-l-box, .hiw-pv-5 .hiw-pc-l-btn,
        .hiw-pv-7 .hiw-pc-l-nav, .hiw-pv-7 .hiw-pc-l-hero, .hiw-pv-7 .hiw-pc-l-sub, .hiw-pv-7 .hiw-pc-l-box, .hiw-pv-7 .hiw-pc-l-btn,
        .hiw-pv-9 .hiw-pc-l-nav, .hiw-pv-9 .hiw-pc-l-hero, .hiw-pv-9 .hiw-pc-l-sub, .hiw-pv-9 .hiw-pc-l-box, .hiw-pv-9 .hiw-pc-l-btn { background: rgba(0,0,0,0.1); }
        .hiw-pv-4 .hiw-pc-l-btn, .hiw-pv-5 .hiw-pc-l-btn, .hiw-pv-7 .hiw-pc-l-btn, .hiw-pv-9 .hiw-pc-l-btn { background: rgba(0,0,0,0.2); }
        /* Wipe animation */
        @keyframes hiw-wipe-reveal {
          0%,  25%  { clip-path: inset(0 0 100% 0); }
          45%, 65%  { clip-path: inset(0 0 0%   0); }
          85%, 100% { clip-path: inset(0 0 100% 0); }
        }
        /* Sweep line */
        .hiw-wipe-line {
          position: absolute; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 20%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0.6) 80%, transparent 100%);
          z-index: 5; pointer-events: none;
          animation: hiw-wipe-line-anim 10s ease-in-out infinite;
        }
        @keyframes hiw-wipe-line-anim {
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
        /* Stagger delays */
        .hiw-cw-1  .hiw-pc-after, .hiw-cw-1  .hiw-wipe-line { animation-delay:  0s; }
        .hiw-cw-2  .hiw-pc-after, .hiw-cw-2  .hiw-wipe-line { animation-delay: -1s; }
        .hiw-cw-3  .hiw-pc-after, .hiw-cw-3  .hiw-wipe-line { animation-delay: -2s; }
        .hiw-cw-4  .hiw-pc-after, .hiw-cw-4  .hiw-wipe-line { animation-delay: -3s; }
        .hiw-cw-5  .hiw-pc-after, .hiw-cw-5  .hiw-wipe-line { animation-delay: -4s; }
        .hiw-cw-6  .hiw-pc-after, .hiw-cw-6  .hiw-wipe-line { animation-delay: -5s; }
        .hiw-cw-7  .hiw-pc-after, .hiw-cw-7  .hiw-wipe-line { animation-delay: -6s; }
        .hiw-cw-8  .hiw-pc-after, .hiw-cw-8  .hiw-wipe-line { animation-delay: -7s; }
        .hiw-cw-9  .hiw-pc-after, .hiw-cw-9  .hiw-wipe-line { animation-delay: -8s; }
        .hiw-cw-10 .hiw-pc-after, .hiw-cw-10 .hiw-wipe-line { animation-delay: -9s; }
        /* Fade up */
        @keyframes hiw-fadeUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        /* Responsive */
        @media (max-width: 860px) {
          .hiw { padding: 72px 24px 0; }
          .hiw-steps { grid-template-columns: 1fr; gap: 16px; margin-bottom: 56px; }
          .hiw-step { padding: 32px 24px 28px; }
          .hiw-step-ghost { font-size: 100px; }
          .hiw-header { margin-bottom: 48px; }
        }
      `}</style>

      <section className="hiw">
        <div className="hiw-inner">
          <header className="hiw-header">
            <h2 className="hiw-headline">How It Works</h2>
          </header>

          <div className="hiw-steps">
            <article className="hiw-step">
              <span className="hiw-step-ghost" aria-hidden="true">1</span>
              <div className="hiw-num">01</div>
              <h3 className="hiw-step-title">Enter URL</h3>
              <p className="hiw-step-desc">Paste your website address and we&apos;ll scan your homepage, brand assets, and content in seconds.</p>
            </article>
            <article className="hiw-step">
              <span className="hiw-step-ghost" aria-hidden="true">2</span>
              <div className="hiw-num">02</div>
              <h3 className="hiw-step-title">Choose A Refreshed Homepage</h3>
              <p className="hiw-step-desc">Receive three fully designed, production-ready homepage concepts built around your brand and industry.</p>
            </article>
            <article className="hiw-step">
              <span className="hiw-step-ghost" aria-hidden="true">3</span>
              <div className="hiw-num">03</div>
              <h3 className="hiw-step-title">Install Your Page</h3>
              <p className="hiw-step-desc">Love what you see? Pay once and get the complete HTML, CSS, and assets delivered straight to your inbox.</p>
            </article>
          </div>
        </div>

        {showcaseEnabled && (
        <div className="hiw-marquee-section">
          <p className="hiw-marquee-label">Refreshed Pages</p>
          <div className="hiw-marquee-viewport">
            <div className="hiw-marquee-track">
              {/* Set 1 */}
              {cards.map((card) => (
                <CardWrap key={`s1-${card.cwIndex}`} {...card} />
              ))}
              {/* Set 2 — duplicate for seamless loop */}
              {cards.map((card) => (
                <CardWrap key={`s2-${card.cwIndex}`} {...card} />
              ))}
            </div>
          </div>
        </div>
        )}
      </section>
    </>
  );
}
