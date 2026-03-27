# Creative Agent System Upgrade Plan

## Context

The three creative agents produce layout alternatives that lack visual distinction and production quality. The system has accumulated architectural drift: slugs don't match UI names, prompts are 60% identical boilerplate, extended thinking was added without documenting its temperature trade-off, and the Score Agent ignores the newly-built `industryBrief` field. This plan is a coordinated overhaul that treats the pipeline as a connected system — from scoring through creative generation through output validation.

### Design Principle: Graceful Degradation
Every enhancement is additive and optional. The pipeline must work at every level:
- **Full context**: Industry Brief + EXA + benchmarks + rich site → best output
- **Partial context**: No Industry Brief, no EXA → still good output
- **Minimal context**: Sparse site → simple honest page, nothing invented

Nothing in this plan creates a hard dependency. Missing data = less context, not breakage.

### What We're NOT Changing
- **max_tokens (32K)**: Agents use ~12K output + up to 12K thinking = ~24K peak. Not the bottleneck.
- **Model (Sonnet 4.0)**: Sonnet 4.6 was tried March 1 and reverted — 1.5-1.8x slower, broke 280s timeout. Fix prompts/rules first. Model change is a future consideration after the foundation is solid.
- **Reference HTML examples**: Overkill for MVP with infinite possible industries.
- **Per-agent input data**: Creative agents SHOULD receive the same analysis. Differentiation belongs in prompts.
- **Countdown timer**: Hardcoded 90s+240s already accommodates all timing changes in this plan.

---

## Phase 1: Foundation — Rename, Score Agent v3, Thinking Resolution

Everything that establishes the new infrastructure. Renames, the Score Agent gap, and the thinking/temperature decision — resolved together so all downstream work builds on a stable base.

### 1A. Rename slugs across the codebase

**New mapping:**
| New Slug | Layout | UI Name | Concept |
|----------|--------|---------|---------|
| `creative-classic` | 1 | Classic Refresh | Conservative cleanup. Honor existing structure. |
| `creative-modern` | 2 | Modern Upgrade | Contemporary redesign. Current web trends. |
| `creative-bold` | 3 | Bold Transformation | Dramatic reimagining. Break conventions. |

**Files to change:**

`lib/pipeline/agents/creative.ts` — Type system source of truth
- `CREATIVE_SLUGS` → `["creative-classic", "creative-modern", "creative-bold"]`
- `CreativeSlug` type derives automatically
- `STYLE_REMINDERS` keys → new slugs (placeholder content — full rewrite in Phase 2)
- `stepName` cast → `"creative_classic" | "creative_modern" | "creative_bold"`

`lib/pipeline/analyze.ts` (line 808)
- `allCreativeSlugs` → `["creative-classic", "creative-modern", "creative-bold"]`
- `allTemplateNames` stays `["Classic Refresh", "Modern Upgrade", "Bold Transformation"]`

`lib/config/agent-skills.ts` — Update `VALID_SLUGS` set

`app/admin/settings/page.tsx` (line 47) — Update `CREATIVE_SLUGS`

API routes (3 files in `app/api/admin/settings/skills/[slug]/`):
- `route.ts`, `history/route.ts`, `rollback/route.ts` — update `VALID_SLUGS` in each

`scripts/seed-agent-skills.ts` — Migration block in `main()`:
1. Find existing records by old slugs
2. Archive each to `AgentSkillHistory`
3. Set `active: false` on old records
4. Create 3 new entries with new slugs (v16, functional placeholder prompts aligned to new concepts)

**Backward compat:** Existing `Refresh` records store template names ("Classic Refresh"), not slugs — unaffected. Old `PromptLog` entries keep old step names — diagnostic only.

### 1B. Score Agent prompt v3 — industryBrief awareness

**Problem:** The `industryBrief` field (from the newly-built Industry Brief system) is already passed to the Score Agent in the JSON payload, but the v2 prompt has zero instructions for using it. The agent receives 3 benchmark data sources and ignores the third.

**What changes:**

`scripts/seed-agent-skills.ts` — Score Agent entry (lines 99-145):
- Bump version from 2 → 3
- Add new section after the "Benchmark handling" block:

```
Industry brief (optional):
You may receive an "industryBrief" field containing human-curated observations about
this industry's competitive landscape. These are written by analysts who reviewed scored
benchmark sites — patterns they noticed about layout, trust signals, design choices,
content strategies, and what distinguishes top performers.

This is your highest-signal input for industry context. Use it to:
- Calibrate dimension scores (e.g., if the brief notes competitors prominently display
  certifications, weight that in the Trust score)
- Write more specific issues and recommendations referencing real competitive patterns
- Inform creativeBrief priorities with concrete, industry-specific design direction

How industryBrief relates to other inputs:
- "benchmarkNote" provides quantitative averages (clarity: 72, visual: 65...)
- "exaIndustryContext" provides AI-summarized patterns from web search
- "industryBrief" provides human-curated synthesis — prioritize it when it conflicts
  with generic EXA summaries

If industryBrief is absent, proceed normally with benchmarks and general knowledge.
Do NOT copy industryBrief text verbatim into guidance fields. Synthesize the observations
into actionable design direction.
```

**Graceful degradation:** The section explicitly says "If industryBrief is absent, proceed normally." No breakage when the brief doesn't exist. No breakage when EXA isn't configured.

**Why this belongs in Phase 1:** Better `designDirection` from the Score Agent means better input for the creative agents when we rewrite their prompts in Phase 2. Getting this right first means Phase 2 testing shows the full benefit.

### 1C. Extended thinking — resolve and document

**Research findings:**
- Extended thinking was **deliberately planned** (documented in CREATIVE-AGENT-UPGRADE-PLAN.md from March 5)
- Temperature values (0.4/0.5/0.7) were **never systematically tested** — empirical defaults
- Thinking and temperature are **permanently mutually exclusive** in the Anthropic API
- Per-agent **thinking budgets** can serve as a differentiation lever
- The 12K thinking budget **counts against** the 32K max_tokens pool
- No way to measure thinking token usage separately in current PromptLog schema

**Decision: Keep extended thinking, use per-agent budgets for differentiation.**

Rationale:
- Thinking was added for a documented reason (planning layout structure, section decisions, image placement)
- Temperature values were never proven to produce meaningful differentiation
- Per-agent thinking budgets offer a similar lever: lower budget → more direct/conventional output, higher budget → more creative exploration

**Implementation:**

`lib/pipeline/agents/creative.ts`:
- Remove dead `_temperature` variable and misleading comment
- Read thinking budget from a per-agent config (DB field or hardcoded per slug)
- Apply different budgets:
  - `creative-classic`: 8000 (less exploration → more conventional decisions)
  - `creative-modern`: 12000 (balanced)
  - `creative-bold`: 16000 (more exploration → bolder creative choices)
- Add clear documentation comment explaining the thinking/temperature trade-off and the deliberate choice

`scripts/seed-agent-skills.ts`:
- Set `temperature: null` for all creative agents (remove misleading values)
- Consider adding `thinkingBudget` to the agent skill config (or hardcode per slug in creative.ts for simplicity)

`prisma/schema.prisma` (optional, deferred):
- Could add `thinkingBudget Int?` to `AgentSkill` for admin-adjustable budgets
- For now, hardcode in creative.ts — simpler, and budgets won't change frequently

**Add observability:**

`lib/pipeline/agents/creative.ts` — after response:
- Log: `[creative] ${slug} thinking budget: ${budget}, output tokens: ${response.usage?.output_tokens}`
- This helps us understand actual token consumption per agent

**No PromptLog schema change yet** — we can add separate `inputTokens`/`outputTokens`/`thinkingTokens` fields later when we have enough data to justify the migration.

### Phase 1 Verification
- `npx tsc --noEmit` — TypeScript compiles
- `npx tsx scripts/seed-agent-skills.ts` — old slugs deactivated, new slugs created (v16), Score Agent bumped to v3
- Admin settings: new agent names visible, Score Agent prompt includes industryBrief section
- Run one end-to-end analysis: all 3 tabs render, layouts generate, no errors
- Check PromptLog: score step payload includes `industryBrief` (if one exists for that industry) or omits it gracefully

---

## Phase 2: Prompt Rewrite — Full Differentiation

Each agent's prompt should be ~70% unique content. Shared content is limited to truly universal operational rules. This is the core quality lever.

### New prompt structure

```
SECTION 1: ROLE + DESIGN PHILOSOPHY (~300 words, 100% UNIQUE)
  Who this agent is, what "success" looks like, inspiration references,
  how it interprets originalStyle (honor vs modernize vs reimagine),
  how it explicitly differs from the other two agents.

SECTION 2: LAYOUT ARCHITECTURE (~400 words, 100% UNIQUE)
  Hero (type, height, CTA), nav (background, positioning, phone),
  section flow (rhythm, spacing, backgrounds), services (grid, cards, density),
  testimonials, trust signals, footer, typography (families, weights, sizing),
  color strategy, mobile conventions, target section count.

SECTION 3: DESIGN RULES — MUSTS & MUST-NOTs (~200 words, 100% UNIQUE)
  5-8 non-negotiable aesthetic rules, anti-patterns,
  explicit differentiation ("Unlike Classic/Bold, this agent...").

SECTION 4: SHARED OPERATIONAL RULES (~300 words, IDENTICAL across all 3)
  - Business identity: use businessName exactly
  - Content: use only real copy from brandAssets.copy, never invent
  - Navigation: all navLinks in nav + footer
  - Extraction notes: follow as no-exceptions overrides
  - Images: use only provided URLs, logo sizing, loading="lazy"
  - Links: # anchors, tel:, mailto: only
  - Phone/rating: display exactly or omit
  - Testimonials/features: use if present, never invent
  - Responsive: mobile-first Tailwind breakpoints
  - Accessibility: semantic HTML, 4.5:1 contrast, alt text, heading hierarchy
  - Brand config: include brand head block in <head>
  - Mobile nav: data-menu-toggle="mobile-menu" + id="mobile-menu" class="hidden md:flex"
  - CSS: hover transitions only (0.2-0.3s), no page-load animations
  - Output: <layout_html>...</layout_html><rationale>...</rationale>
```

### Per-agent details

**creative-classic (Classic Refresh):**
- "The owner should recognize their site, but better."
- Follow originalStyle closely — mirror hero type, nav pattern, visual density
- Conventional solid nav with phone. Standard 2-col/3-col grids. Professional serif or sans-serif (brand fonts preferred).
- Stay close to brand palette. Predictable section rhythm. Multi-column footer with contact info.
- MUST NOT: surprise the visitor. No bold color blocks, overlaps, giant typography, dark sections.
- Target: 4-5 sections. Professional, polished, recognizable.

**creative-modern (Modern Upgrade):**
- "This is what a modern version of this business should look like."
- Use originalStyle as starting point, then modernize the patterns.
- Pill CTAs (rounded-full). Asymmetric grids (40/60 splits). Transparent/minimal sticky nav.
- Clean sans-serif. Bold headings, tight tracking. Grayscale canvas + accent pops. Generous whitespace.
- Minimal single-row footer. 3-col card grids with subtle shadows.
- MUST NOT: use serif as primary, multi-column heavy footers, alternating cream backgrounds (Classic territory).
- Target: 4-5 sections. Current, spacious, asymmetric.

**creative-bold (Bold Transformation):**
- "This should make them say wow."
- Use originalStyle as springboard, push the brand's DNA further than they'd go themselves.
- ONE unconventional hero per generation (giant typography / collage / color block / statement card).
- Non-standard nav (accent bg, bold styling). 2+ pattern-breakers (dark sections, overlaps, color blocks).
- Display fonts with personality. Font-black headlines, font-light body. Full palette in active use.
- Non-standard service layouts (numbered blocks, bento, timeline). Distinctive footer matching personality.
- MUST NOT: standard card grids, conservative gray footers, play it safe.
- Target: 5-7 sections. Immediately distinguishable.

### STYLE_REMINDERS (creative.ts)
Shrink from 10-15 lines to 3-5 line reinforcement per agent:
- **Classic**: "Honor existing structure. Conventional nav, standard grids. Owner should recognize their site."
- **Modern**: "Pill CTAs, asymmetric grids, transparent nav, grayscale + accent. Fresh and spacious."
- **Bold**: "ONE unconventional hero. 2+ pattern-breakers. No standard card grids. Full palette. Wow factor."

### Version bump
- v17 in seed script (v16 was Phase 1 placeholder)

### Files changed
- `scripts/seed-agent-skills.ts` — full prompt rewrite for all 3 creative agents
- `lib/pipeline/agents/creative.ts` — STYLE_REMINDERS content update

### Phase 2 Verification
- `npx tsx scripts/seed-agent-skills.ts` — prompts updated to v17
- Admin page shows new prompts with style-first structure
- Run 3+ analyses on different sites:
  - Simple services (plumber, HVAC)
  - Content-rich professional (law firm, CPA)
  - Sparse/SPA site
- Compare 3 layouts side by side for each:
  - Classic feels familiar/conservative?
  - Modern feels fresh/contemporary?
  - Bold feels dramatic/surprising?
- Read each `<rationale>` — does it articulate role-aligned design choices?

---

## Phase 3: Output Quality Enforcement

All output quality improvements as a unified layer: critique-and-retry, server-side brand config safety net, and mobile nav functionality.

### 3A. Critique-and-retry pass

**When it fires** (critical validation failures only):
- `NO_CONTENT` (< 100 chars body text)
- `MISSING_H1`
- `MISSING_CTA` (no actionable link/button outside nav)
- `TRUNCATED_HTML` (severely unbalanced tags)

**Time budget:**
- Current pipeline: ~149s. Vercel timeout: 280s. Margin: +131s.
- Critique pass: ~30-60s per agent (multi-turn, system prompt cached).
- Trigger rate: ~15-20% of generations. Worst case adds ~60s.
- Worst case total: ~209s — still 71s of margin. No timer change needed.

**Flow change in `lib/pipeline/agents/creative.ts`:**
```
generate → parse → clean → validate →
  IF critical issues:
    → build critique prompt (list specific issues)
    → send multi-turn: [original prompt, flawed output, fix request]
    → same model, same system prompt (cached), thinking budget: 4000
    → parse → clean → validate again
    → IF still failing: use original output (don't recurse, don't make it worse)
  → attach final validation → return
```

Critique prompt: "Your layout has these structural problems: [issues]. Fix ONLY these. Keep all other HTML intact. Return corrected page in `<layout_html>` tags."

**`lib/pipeline/agents/types.ts`:** Add `retried?: boolean` to `CreativeAgentOutput`.

### 3B. Server-side brand head block injection

**Problem:** If agent omits or rewrites the brand config block, Tailwind brand tokens break.

**`lib/layout-preview.ts`:**
- Add `brandHeadBlock?: string` to `WrapInDocumentOptions`
- In `wrapInDocument()`: if `<head>` doesn't contain `tailwind.config` AND `brandHeadBlock` is provided → inject after `<meta charset>`
- Safety net, not replacement for prompt instruction

**`lib/pipeline/agents/creative.ts`:** Export `buildBrandHeadBlock`

**Integration:** Compute brand head block at render time from stored brand assets on the Refresh record (no schema change needed).

### 3C. Mobile nav toggle script

**`lib/layout-preview.ts`:**
```javascript
const MOBILE_NAV_SCRIPT = `<script>
document.querySelectorAll('[data-menu-toggle]').forEach(function(btn){
  var target = document.getElementById(btn.getAttribute('data-menu-toggle'));
  if(!target) return;
  btn.addEventListener('click', function(){ target.classList.toggle('hidden'); });
});
</script>`;
```
Inject before `</body>` alongside existing `LINK_DISABLE_SCRIPT`. Phase 2 prompts instruct agents to use the `data-menu-toggle` convention.

### Phase 3 Verification
- **Critique**: Run analysis on sparse/SPA site. Check logs for critique trigger. Verify `retried: true`. Verify fixed layout passes. Verify no trigger on good output.
- **Brand head**: Inspect iframe srcdoc — brand tokens present even when agent omitted block. No double-injection on correct output.
- **Mobile nav**: Click hamburger in preview iframe → nav toggles.
- **Timing**: Time full pipeline on critique-triggering site. Confirm under 280s.

---

## Implementation Sequence

| Phase | Depends On | Scope |
|-------|-----------|-------|
| 1: Foundation | Nothing | Slug rename (~8 files), Score Agent v3 (seed script), thinking resolution (creative.ts) |
| 2: Prompts | Phase 1 | Seed script (bulk), creative.ts STYLE_REMINDERS |
| 3: Quality | Phases 1+2 | creative.ts (critique pass), types.ts, layout-preview.ts (brand head + mobile nav) |

---

## Complete File Change Matrix

| File | Phase | Changes |
|------|-------|---------|
| `scripts/seed-agent-skills.ts` | 1, 2 | Slug migration, Score Agent v3, creative prompt rewrite (v16→v17), temperature cleanup |
| `lib/pipeline/agents/creative.ts` | 1, 2, 3 | Slug constants, thinking budgets, temp cleanup, STYLE_REMINDERS, critique pass, export buildBrandHeadBlock |
| `lib/pipeline/agents/types.ts` | 3 | `retried` flag on CreativeAgentOutput |
| `lib/pipeline/analyze.ts` | 1 | Slug array update |
| `lib/config/agent-skills.ts` | 1 | VALID_SLUGS update |
| `app/admin/settings/page.tsx` | 1 | CREATIVE_SLUGS update |
| `app/api/admin/settings/skills/[slug]/route.ts` | 1 | VALID_SLUGS |
| `app/api/admin/settings/skills/[slug]/history/route.ts` | 1 | VALID_SLUGS |
| `app/api/admin/settings/skills/[slug]/rollback/route.ts` | 1 | VALID_SLUGS |
| `lib/layout-preview.ts` | 3 | Brand head injection, mobile nav script |

---

## Appendix A: Current Prompt Audit (Line-by-Line)

### Shared vs. Unique Content Breakdown

Each v15 creative prompt is ~140 lines. The actual unique-to-shared ratio is **~20% unique / 80% shared** — worse than initially estimated.

**What's UNIQUE per agent (~25-30 lines each):**
- Role identity sentence: "You are the X Creative Agent" (line 1)
- Style identity block: 10-12 lines describing aesthetic, inspiration sources, specific CSS patterns
- Design principles (MUST/MUST NOT): 3 lines of agent-specific rules
- Layout structure (technical spec): 7-9 numbered items with specific Tailwind classes
- originalStyle interpretation: 1 sentence at the end of the ORIGINAL SITE STYLE section

**What's SHARED (100% identical across all 3, ~110 lines):**
- "You receive a designDirection..." preamble (5 lines)
- BUSINESS IDENTITY (4 lines)
- ORIGINAL SITE STYLE intro (5 lines — the field descriptions are identical, only the final interpretation sentence differs)
- RESPONSIVE DESIGN (6 lines)
- ACCESSIBILITY (5 lines)
- DESIGN DIRECTION (2 lines)
- CONTENT RULES (4 lines)
- NAVIGATION PRESERVATION (3 lines)
- IMAGE CONTEXT AWARENESS (3 lines)
- GRID AND LAYOUT COMPLETENESS (3 lines)
- TESTIMONIALS AND FEATURES (5 lines)
- EXTRACTION NOTES (3 lines)
- PHONE NUMBER (4 lines)
- RATING / REVIEWS (6 lines)
- WORKING WITH LIMITED DATA (5 lines)
- IMAGE USAGE (8 lines — logo, hero image, siteImageUrls, additionalImageUrls, reuse rules)
- LINK RULES (2 lines)
- CSS ANIMATIONS (2 lines)
- Output format (6 lines)

### How designDirection Is Referenced in Creative Prompts

The creative prompts reference `designDirection` in only 3 places — all generic:

1. **Preamble** (line 242/395/543): "You receive a designDirection and REAL brand assets..."
2. **Bullet 4** (line 246/399/547): "Respect the designDirection priorities (e.g. if trust guidance says to feature credentials, do so prominently)"
3. **DESIGN DIRECTION section** (line 282/435/583): "The designDirection field tells you what design areas to prioritize. It is context for your decisions, NOT content to display."

**Gap identified:** The prompts never explain the `designDirection` sub-fields:
- `priorities[].area` / `priorities[].priority` / `priorities[].guidance` — what these mean and how to use them
- `strengths[]` — what to preserve from the original site
- `industryRequirements[]` — industry-specific patterns to follow
- `contentDirection` — may contain SPA detection notes
- `technicalRequirements[]` — technical constraints

The Phase 2 prompt rewrite should add explicit guidance on interpreting these fields, especially `industryRequirements` (which carries the industry-specific guidance from the Score Agent → Industry Brief pipeline).

### buildBrandHeadBlock Output (for Phase 3 safety net reference)

For a site with colors `["#1a1a2e", "#16213e", "#0f3460"]` and fonts `["Playfair Display, serif", "Open Sans, sans-serif"]`, the function produces:

```html
<!-- BRAND CONFIG: Include this exact block in your <head>, AFTER <meta charset="utf-8"> -->
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@300;400;500;600;700&family=Open+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com/3.4.17"></script>
<script>
tailwind.config = {
  theme: {
    extend: {
      colors: { brand: { primary: '#1a1a2e', secondary: '#16213e', accent: '#0f3460' } },
      fontFamily: { heading: ['Playfair Display', 'sans-serif'], body: ['Open Sans', 'sans-serif'] }
    }
  }
}
</script>
```

**Detection for Phase 3 safety net:** Check `<head>` for the string `tailwind.config`. If absent, inject the block after `<meta charset="utf-8">` (or after `<head>` if no charset meta exists).

**Edge cases to handle:**
- Agent includes Tailwind CDN but no config → inject just the config `<script>` block
- Agent includes config but wrong colors → don't override (agent made a deliberate choice)
- Agent includes nothing → inject full block (Google Fonts link + CDN + config)

### STYLE_REMINDERS (current full text, for Phase 2 reference)

These are injected as the FIRST content in the user message, before the brand config block and JSON data.

**creative-modern (10 lines):**
```
=== GENERATE A MODERN LAYOUT ===
- Hero: full-bleed, min-h-screen, centered content. Primary CTA must be a pill: rounded-full (not rounded-lg).
- Nav: transparent sticky, minimal — logo left, 3-4 links right. Do NOT put phone numbers in the nav bar.
- Sections: asymmetric grid [40/60 splits using grid-cols-5]. Do NOT use centered single-column editorial blocks.
- Cards: 3-column card grid only. Use rounded-xl, NO borders, subtle shadow-sm.
- Typography: ONE sans-serif font only. No serif anywhere. Headlines: font-bold + tracking-tight.
- Color: grayscale everywhere EXCEPT CTAs and one accent per section. Restraint is mandatory.
- Dividers: whitespace only — no horizontal lines, no background color changes between sections.
- Footer: minimal single row, subtle border-t. No multi-column footer.
- Target 4-5 clean sections. Less is more.
```

**creative-classy (12 lines):**
```
=== GENERATE A CLASSY LAYOUT ===
- Hero: split layout — text left (~55%), image right (~45%). NOT full-viewport; max height ~80vh.
- Headlines: SERIF font required (Playfair Display, Cormorant, or Lora). font-medium, NOT font-bold.
- CTA: bordered button — border-2 rounded-lg. Do NOT use rounded-full pills.
- Nav: solid background (white or cream #faf8f5), NOT transparent. Include phone number on the right.
- Sections: centered editorial column — max-w-3xl or max-w-4xl mx-auto. Alternate white/cream backgrounds.
- Services: 2-COLUMN grid only (not 3). Separate with thin border-b.
- Testimonials: 2-column grid, boxed cards, italic serif quotes, small-caps attribution.
- Trust strip: horizontal band with grayscale logos.
- About: give real estate — tell the brand story.
- Footer: multi-column (address, phone, hours), warm dark bg (bg-gray-800), generous py-16.
- Target 5-6 well-spaced sections.
```

**creative-unique (10 lines):**
```
=== GENERATE A UNIQUE LAYOUT ===
- Hero: choose ONE unconventional option: (A) Giant typography, (B) Collage, (C) Bold color block, (D) Minimal title card.
- Nav: NOT standard — accent-color bg, OR hamburger/drawer, OR bold styling. All links accessible.
- Pattern-breakers (AT LEAST 2): bold color section; dark section (bg-gray-900); overlaps (-mt-12); height variance.
- Services: NOT a uniform card grid. Numbered blocks, bento grid, OR timeline.
- Typography: display font (Space Grotesk, Syne, Unbounded). font-black headlines + font-light body.
- Color: use FULL brand palette. At least one saturated bg and one dark section.
- Footer: match personality — NOT safe gray multi-column.
- Self-check: "Is this immediately distinguishable from a standard card-grid layout?"
- Target 5-7 sections with at least 2 unconventional layouts.
```

### User Message Assembly Order

The user message sent to each creative agent is assembled in `creative.ts` (lines 270-284):

```
1. STYLE_REMINDERS[slug]           ← agent-specific bullets (see above)
2. "=== BRAND CONFIG BLOCK ==="
3. Usage instructions for brand-* classes and font-heading/font-body
4. buildBrandHeadBlock() output    ← Google Fonts + Tailwind CDN + tailwind.config
5. "=== END BRAND CONFIG BLOCK ==="
6. "Here is the site data:"
7. JSON.stringify(creativeInput, null, 2)  ← the full CreativeAgentInput as pretty-printed JSON
```
