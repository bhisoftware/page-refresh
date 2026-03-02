# Agent Enhancement Ideas

Observations and suggestions based on deep analysis of the creative agent pipeline, asset extraction, layout rendering, and real output from lajollaivf.com analyses.

---

## 1. Agent Skills Admin Enhancements

### A/B Prompt Variants per Agent
Currently each agent has one system prompt. Allow multiple prompt variants per slug with traffic splitting (e.g., 50/50). Track which variant produces better layouts (via user selections at checkout). This turns prompt iteration into a data-driven process instead of guesswork.

### Per-Run Prompt Overrides
Add an optional "prompt override" textarea in the admin analysis detail page. When re-running a single layout, the admin can inject extra instructions (e.g., "use a split hero with text left, image right") without modifying the global prompt. Useful for debugging and client-specific tweaks.

### Prompt Diff Viewer
The seed script archives old prompts on version bump, but there's no UI to compare versions. A side-by-side diff viewer in Settings > Agent Skills would make it easy to see what changed between v7 and v8 and roll back if something regresses.

### Temperature & Max Tokens Sliders
These are already stored in the DB (`temperature`, `maxTokens`) but aren't exposed in the admin UI. Surfacing them with sliders lets you tune creativity vs. consistency per agent without code deploys.

---

## 2. Layout Quality Improvements

### Screenshot-Informed Layout Generation
The screenshot analysis agent already extracts layout patterns (heroType, navStyle, gridPattern, sectionCount). Currently this feeds the score agent but the creative agents only get the `designDirection` brief. Passing the screenshot analysis directly to creative agents would help them understand the existing site's visual DNA — column count, hero style, density — and produce layouts that feel like natural upgrades rather than generic templates.

### Industry-Specific Layout Templates
The pipeline already detects industry. Use this to inject industry-specific guidance into the creative brief. Medical/healthcare sites need HIPAA badges, trust signals, and warm imagery. Law firms need credential bars and consultation CTAs. E-commerce needs product grids and urgency elements. This could be a lookup table in the DB keyed by industry name, merged into `designDirection`.

### Multi-Section Image Strategy
Right now the agents get a flat list of `siteImageUrls` with no context about what each image depicts. If the asset extractor classified images more granularly (hero candidates, team/staff, facility/office, product/service, testimonial/social-proof), the creative agents could place them much more intentionally — staff photos in the "About" section, facility images in "Visit Us", etc.

### Generated Fallback Imagery
When a site has very few usable images (common for small businesses), the layouts suffer. Consider integrating a lightweight image generation step — even just SVG-based abstract patterns or gradient overlays customized to the brand colors — so every section has a visual anchor even when the source site is image-poor.

---

## 3. Asset Extraction Improvements

### JavaScript-Rendered Content Capture
The current pipeline fetches raw HTML via `fetch()` and parses with Cheerio. Sites built with React/Next.js/Vue often render content client-side, meaning the HTML has empty containers. Using the ScreenshotOne API's DOM extraction mode (or a lightweight Puppeteer pass) to capture the rendered DOM would yield much richer content, images, and copy.

### Image Quality Scoring
After downloading assets, run a quick quality check (dimensions, file size, format). Flag images below a minimum threshold (e.g., < 200px wide) and prefer alternatives. This prevents the pipeline from confidently handing a 48x48 icon to the creative agent as the "hero image."

### CSS Background Image Extraction
Many sites use `background-image` in CSS rather than `<img>` tags for hero sections. The asset extractor currently only checks `<img>` elements. Parsing the fetched CSS for `background-image: url(...)` declarations would catch these hero images that are currently invisible to the pipeline.

### Favicon as Logo Fallback
When no logo is found via `<img>` tags, the site's Apple Touch Icon (`<link rel="apple-touch-icon">`) is often a high-quality square logo at 180x180 or 512x512. This would be a better fallback than the current "first image on the page" behavior.

---

## 4. Layout Rendering & Preview

### Full-Height Iframe Auto-Sizing
The current iframe previews use fixed heights (80-85vh) with overflow scroll. Auto-sizing the iframe to match its content height would give a more accurate "this is what your site looks like" impression, especially for shorter pages.

### Mobile Preview Toggle
Add a mobile/tablet/desktop toggle to the layout preview. The agents already generate responsive HTML with Tailwind breakpoints. Simply resizing the iframe container (375px / 768px / 1280px) would let users see the mobile experience without needing to resize their browser.

### Live Layout Comparison
A side-by-side view showing the original site screenshot next to the generated layout would make the value proposition immediately obvious. The screenshot is already captured and stored — just needs a split-view UI.

---

## 5. Agent Architecture

### Layout Critique Agent
Add a post-generation review agent that checks the HTML output for common issues: broken image references, missing alt text, contrast violations, oversized elements, duplicate images, empty sections. Flag issues before showing to the user rather than displaying a broken layout.

### Iterative Refinement Loop
When the critique agent finds issues, automatically feed them back to the creative agent for a second pass. This self-correction loop could catch the blown-up logo and dark-on-dark contrast problems without needing ever-more-detailed prompt instructions.

### Copy Enhancement Agent
The current agents rephrase existing copy but can't improve weak content. A dedicated copy agent could take the extracted copy + industry context and produce tighter headlines, clearer value propositions, and stronger CTAs while staying faithful to the business's actual services. This would be a separate step between score and creative agents.

---

## 6. Data & Feedback Loop

### Layout Selection Tracking
Track which layout (1, 2, or 3) users select for purchase. Over time, this reveals which agent style resonates by industry. Use this data to weight agent assignment — if "Classy" wins 70% of the time for law firms, maybe run two Classy variants and one Modern for legal sites.

### Prompt Effectiveness Metrics
Log the full prompt + output for every creative run (partially done via `createPromptLog`). Build a dashboard showing: average layout quality by agent, common failure patterns, token usage trends. This makes prompt optimization measurable.

### User Feedback on Previews
Add a simple thumbs up/down or 1-5 star rating on each layout preview (even for non-purchasers). This lightweight signal is much cheaper to collect than purchase data and would enable faster iteration on prompt quality.
