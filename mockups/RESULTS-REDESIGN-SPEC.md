# Results Page Redesign — Implementation Spec

## Goal
Replace the current flat results page (`app/results/[id]/page.tsx`) with the Option B "Bold & Dynamic" design from the mockup. The current page shows a plain `62/100` text score and stacked list rows for dimensions. The new design uses a **conic-gradient score ring**, a **4×2 tile grid** for dimension scores with colored progress bars, and a **dark CTA panel** with gradient accents.

---

## Files to Modify

### 1. `app/results/[id]/page.tsx` — Main results page (server component)
### 2. `components/ScoreBreakdown.tsx` — Dimension score display (client component)
### 3. `components/InstallCtaCard.tsx` — Bottom CTA card (client component)

No new files needed. All changes use existing Tailwind classes + a small amount of inline style for the conic-gradient.

---

## Section-by-Section Spec

### A. Page Background & Container

**Current:** `bg-background` (white), `max-w-7xl`
**New:** `bg-slate-50` (light gray), `max-w-5xl` (narrower for a more focused feel)

```tsx
<main className="min-h-screen bg-slate-50">
  <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
```

Keep the existing `<Link href="/">Back to home</Link>` as-is.

---

### B. Overall Score Hero Card

**Current:** A simple Card with `62/100` text and a one-line tagline.

**New:** A white card with horizontal layout: **score ring on the left**, **text summary on the right**.

#### Score Ring
- 160×160px circle using `conic-gradient` based on `overallScore`
- Inner white circle (128px) with the score number (48px, font-weight 900) and "OVERALL" label
- The gradient should sweep from indigo → cyan → amber, stopping at `(score/100) * 360` degrees, remainder is `slate-200`

#### Right Side
- **Heading**: Dynamic based on score (e.g., "Room to grow", "Looking strong", "Needs attention") — use `scoreTagline()` but make it punchier:
  - ≤40: "Needs work"
  - ≤60: "Room to grow"
  - ≤80: "Looking strong"
  - >80: "Excellent"
- **Body text**: `"Your homepage has a solid foundation but underperforms in [lowest 2 dimensions]. Our layout alternatives address these gaps directly."`
  - Derive the 2 lowest-scoring dimensions from `scoringDetails`
- **Percentile badge**: `bg-indigo-50 text-indigo-700 rounded-lg px-3 py-1.5 text-sm font-semibold inline-block`
  - Text: `"Top {percentile} percentile in {industry}"` — pull from `benchmarkComparison` if available, otherwise omit

#### Tailwind Classes
```tsx
{/* Score Hero Card */}
<div className="bg-white rounded-2xl shadow-sm p-10 mb-8 flex items-center gap-10">
  {/* Score Ring — see inline style below */}
  <div
    className="w-40 h-40 rounded-full flex items-center justify-center flex-shrink-0"
    style={{
      background: `conic-gradient(
        #4F46E5 0deg,
        #06B6D4 ${(overallScore / 100) * 240}deg,
        #F59E0B ${(overallScore / 100) * 360}deg,
        #E2E8F0 ${(overallScore / 100) * 360}deg
      )`
    }}
  >
    <div className="w-32 h-32 rounded-full bg-white flex flex-col items-center justify-center">
      <span className="text-5xl font-black tracking-tighter leading-none text-slate-900">
        {overallScore}
      </span>
      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
        Overall
      </span>
    </div>
  </div>

  {/* Summary */}
  <div className="flex-1">
    <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-2">
      {scoreHeadline(overallScore)}
    </h2>
    <p className="text-sm text-slate-500 leading-relaxed mb-4">
      {summaryText}
    </p>
    {percentileBadge && (
      <span className="inline-block bg-indigo-50 text-indigo-700 rounded-lg px-3 py-1.5 text-sm font-semibold">
        {percentileBadge}
      </span>
    )}
  </div>
</div>
```

**Remove** the separate "Summary message" Card that currently exists below the score card. Merge its content into the hero card's body text.

---

### C. Dimension Score Grid (ScoreBreakdown.tsx)

**Current:** Vertical stack of bordered rows, each with dimension name on left and `score/100` on right. Click opens a dialog.

**New:** 4-column, 2-row grid of **score tiles**. Each tile is a white card showing:
1. Large score number (28px, font-weight 900, color-coded)
2. Dimension label (12px, uppercase, letter-spacing, slate-500)
3. Thin progress bar (4px height, color-coded fill)

#### Color Logic (same thresholds, new colors)
- **≤40** → `text-red-500` / `bg-red-500` (bar)
- **41–60** → `text-amber-500` / `bg-amber-500`
- **61–80** → `text-emerald-500` / `bg-emerald-500`
- **>80** → `text-blue-500` / `bg-blue-500`

#### Tile Markup
```tsx
<div className="grid grid-cols-4 gap-3 mb-10">
  {details.map((d) => (
    <button
      key={d.dimension}
      onClick={() => setOpenDimension(d.dimension)}
      className="bg-white rounded-2xl p-5 text-center shadow-sm
                 hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer"
    >
      <div className={cn("text-3xl font-black tracking-tight leading-none mb-1.5", colorClass(d.score))}>
        {d.score}
      </div>
      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
        {shortLabel(d.dimension)}
      </div>
      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full", barColorClass(d.score))}
          style={{ width: `${d.score}%` }}
        />
      </div>
    </button>
  ))}
</div>
```

#### Short Labels
Use shorter dimension names for the tiles:
```ts
const SHORT_LABELS: Record<string, string> = {
  clarity: "Clarity",
  visual: "Visual",
  hierarchy: "Hierarchy",
  trust: "Trust",
  conversion: "Conversion",
  content: "Content",
  mobile: "Mobile",
  performance: "Performance",
};
```

Keep the existing Dialog for showing issues/recommendations when a tile is clicked.

#### Responsive
On mobile (`sm:` and below), switch to `grid-cols-2` so tiles don't get too cramped:
```tsx
className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10"
```

---

### D. Section Heading for Dimensions

**Current:** `<h2 className="text-xl font-semibold mb-4">Score by dimension</h2>`

**New:** Remove the heading. The grid speaks for itself visually. Or if you want to keep it, change to:
```tsx
<h2 className="text-lg font-bold text-slate-900 tracking-tight mb-4">Score by dimension</h2>
```

---

### E. CTA Panel (InstallCtaCard.tsx)

**Current:** Dashed-border card with muted text and outline button.

**New:** Dark panel (`bg-slate-900`) with gradient radial accents, centered text, and a glowing indigo button.

```tsx
<div className="relative rounded-3xl bg-slate-900 p-12 text-center text-white overflow-hidden">
  {/* Gradient accents — decorative divs */}
  <div
    className="absolute -top-1/2 -left-1/5 w-3/5 h-full pointer-events-none"
    style={{ background: 'radial-gradient(ellipse, rgba(79,70,229,0.2), transparent 60%)' }}
  />
  <div
    className="absolute -bottom-2/5 -right-[15%] w-1/2 h-full pointer-events-none"
    style={{ background: 'radial-gradient(ellipse, rgba(6,182,212,0.15), transparent 60%)' }}
  />

  <h3 className="relative z-10 text-2xl font-extrabold tracking-tight mb-2">
    Love what you see?
  </h3>
  <p className="relative z-10 text-slate-400 text-sm mb-7">
    Get a full implementation quote for any of your layout alternatives.
  </p>
  <Button
    onClick={() => setOpen(true)}
    className="relative z-10 bg-indigo-600 hover:bg-indigo-500 text-white font-bold
               px-8 py-3 rounded-xl shadow-[0_0_24px_rgba(79,70,229,0.4)]
               hover:shadow-[0_0_32px_rgba(79,70,229,0.6)] hover:-translate-y-0.5 transition-all"
  >
    Get a Quote
  </Button>
</div>
```

---

### F. Sections to Keep As-Is

These sections should remain unchanged in this pass:
- **SEO Audit section** (`SeoAuditSection`)
- **Benchmark Comparison** (`BenchmarkComparison`) — though consider hiding it if the new hero card already shows the percentile badge
- **Layout Section** (`LayoutSection` with tabs for Option 1/2/3)
- **Back to home** link

---

## Helper Functions to Add/Modify

In `app/results/[id]/page.tsx`:

```ts
function scoreHeadline(score: number): string {
  if (score <= 40) return "Needs work";
  if (score <= 60) return "Room to grow";
  if (score <= 80) return "Looking strong";
  return "Excellent";
}

function buildSummaryText(
  score: number,
  details: DimensionDetail[]
): string {
  if (!details.length) return scoreTagline(score);
  // Find 2 lowest-scoring dimensions
  const sorted = [...details].sort((a, b) => a.score - b.score);
  const lowest = sorted.slice(0, 2).map(
    (d) => DIMENSION_LABELS[d.dimension] ?? d.dimension
  );
  return `Your homepage has a solid foundation but underperforms in ${lowest[0].toLowerCase()} and ${lowest[1].toLowerCase()}. Our layout alternatives address these gaps directly.`;
}
```

---

## Visual Reference

See `mockups/option-b-bold.html` — scroll to the "Results Preview" section at the bottom. The HTML/CSS in that file is the source of truth for colors, spacing, and layout.

Key design tokens used:
- **Background**: `#F8FAFC` (slate-50)
- **Card surface**: `#FFFFFF` (white)
- **Score ring gradient**: indigo (#4F46E5) → cyan (#06B6D4) → amber (#F59E0B) → slate-200 (#E2E8F0)
- **Score colors**: red-500 (≤40), amber-500 (41-60), emerald-500 (61-80), blue-500 (>80)
- **CTA background**: slate-900 (#0F172A)
- **CTA button**: indigo-600 with glow shadow
- **Border radius**: `rounded-2xl` (16px) for cards, `rounded-3xl` (24px) for CTA
- **Font**: Inter (already loaded in the project)

---

## What NOT to Change

- Data fetching logic in `getRefresh()`
- Token/auth validation
- Layout section (tabs, iframe previews)
- SEO audit section
- Any API routes or server logic
- The Dialog in ScoreBreakdown (keep click-to-expand behavior)
