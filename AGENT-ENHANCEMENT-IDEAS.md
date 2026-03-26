# Agent Enhancement Ideas

Ideas for improving the creative agent pipeline, asset extraction, layout rendering, and feedback loops.

---

## 1. Agent Skills Admin Enhancements

### A/B Prompt Variants per Agent
Allow multiple prompt variants per slug with traffic splitting (e.g., 50/50). Track which variant produces better layouts (via user selections at checkout). This turns prompt iteration into a data-driven process instead of guesswork.

### Per-Run Prompt Overrides
Add an optional "prompt override" textarea in the admin analysis detail page. When re-running a single layout, the admin can inject extra instructions (e.g., "use a split hero with text left, image right") without modifying the global prompt. Useful for debugging and client-specific tweaks.

### Prompt Diff Viewer
Version history and rollback exist in the admin UI, but there's no side-by-side diff. Adding a diff viewer in Settings > Agent Skills would make it easy to compare prompt versions and catch regressions.

### ~~Temperature & Max Tokens~~
~~Done — editable in admin Settings via number inputs. Values apply at runtime in creative agent calls.~~

---

## 2. Layout Quality Improvements

### ~~Screenshot-Informed Layout Generation~~
~~Done — `buildOriginalStyle()` extracts colors, typography, layout signals (heroType, navStyle, gridPattern), density, and imagery style from screenshot analysis and passes it as `originalStyle` in `CreativeAgentInput`.~~

### Industry-Specific Layout Templates
The pipeline detects industry. Use this to inject industry-specific guidance into the creative brief via a structured lookup table (e.g., medical → HIPAA badges + trust signals, law → credential bars + consultation CTAs). Currently `industryRequirements` is free-form AI text from the score agent — a structured DB-keyed table would be more consistent.

### Multi-Section Image Strategy
Images are now classified by type (team photos, trust badges, event photos, unclassified) and filtered by quality (icons/decoratives excluded). Next step: use these classifications for intentional placement — staff photos in "About," facility images in "Visit Us," etc. — rather than just filtering.

### Generated Fallback Imagery
When a site has very few usable images, the agents are told via extraction notes to use gradients/solid colors. A programmatic step generating SVG patterns or gradient overlays customized to brand colors would produce better results than relying on the LLM to improvise.

---

## 3. Asset Extraction Improvements

### ~~JavaScript-Rendered Content Capture~~
~~Done — SPA shell detection (`isSpaShell()` in tech-detector.ts) triggers Firecrawl rendered scraping with 3s JS hydration wait. Mutually exclusive with bot-block Firecrawl path.~~

### Image Quality Scoring
Basic dimension filtering exists (skip < 50px, icons ≤ 128px square, hero requires ≥ 200px). A more robust quality score (resolution, aspect ratio, blur detection, file size) would prevent low-quality images from reaching creative agents.

### ~~CSS Background Image Extraction~~
~~Done — `asset-extractor.ts` parses `background-image: url(...)` from both CSS source and inline style attributes.~~

### Favicon as Logo Fallback
When no logo is found via `<img>` tags, the site's Apple Touch Icon (`<link rel="apple-touch-icon">`) is often a high-quality square logo at 180x180 or 512x512. Currently favicons are explicitly excluded from the logo role — worth reconsidering as a fallback.

---

## 4. Layout Rendering & Preview

### Full-Height Iframe Auto-Sizing
The current iframe previews use fixed viewport fractions (85vh) with overflow scroll. Auto-sizing via `contentDocument.scrollHeight` or `postMessage` would give a more accurate preview, especially for shorter pages.

### Mobile Preview Toggle
Add a mobile/tablet/desktop toggle to the layout preview. The agents already generate responsive HTML with Tailwind breakpoints. Simply resizing the iframe container (375px / 768px / 1280px) would show the mobile experience.

### Live Layout Comparison
A side-by-side view showing the original site screenshot next to the generated layout would make the value proposition immediately obvious. The screenshot is already captured and stored — just needs a split-view UI.

---

## 5. Agent Architecture

### Layout Critique Agent
Add a post-generation review agent that checks HTML output for: broken image references, missing alt text, contrast violations, oversized elements, duplicate images, empty sections. `validateLayoutQuality()` currently runs post-generation and logs warnings, but doesn't trigger re-generation.

### Iterative Refinement Loop
When the critique agent finds issues, automatically feed them back to the creative agent for a second pass. This self-correction loop could catch layout problems without needing ever-more-detailed prompt instructions.

### Copy Enhancement Agent
A dedicated copy agent between score and creative agents could take extracted copy + industry context and produce tighter headlines, clearer value propositions, and stronger CTAs while staying faithful to the business's actual services. (Note: the existing `scanning-copy` agent generates loading screen UX copy, not layout copy.)

---

## 6. Data & Feedback Loop

### Layout Selection Tracking
Track which layout (1, 2, or 3) users select for purchase. Over time, this reveals which agent style resonates by industry. Use this data to weight agent assignment — if "Classy" wins 70% for law firms, run two Classy variants and one Modern for legal sites. (`layoutIndex` is sent to checkout but not tracked separately for analytics.)

### Prompt Effectiveness Metrics
Raw per-run prompt logs exist (`PromptLog` + admin viewer). Next step: aggregated dashboard showing average layout quality by agent, common failure patterns, and token usage trends.

### User Feedback on Previews
Add a simple thumbs up/down or 1-5 star rating on each layout preview (even for non-purchasers). This lightweight signal is cheaper to collect than purchase data and would enable faster prompt iteration.
