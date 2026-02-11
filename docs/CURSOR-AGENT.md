# pagerefresh.ai - Cursor Agent Introduction

## Your Mission

You are building **pagerefresh.ai** - an AI-powered website analysis and redesign tool that helps SMB business owners improve their websites in minutes instead of months.

**Your goal**: Build a working MVP that can analyze any website URL, score it 0-100 across 8 quality dimensions, and generate 3 improved layout proposals with AI-refreshed copy.

## What You're Building

### Product Overview

**pagerefresh.ai** - "Paste your website and get a $50,000 quality refresh in 5 minutes. Pay only if you love it."

**User Flow**:
1. Business owner pastes their website URL
2. System analyzes the site (60-90 seconds)
3. Shows a score (e.g., "35/100") with specific issues
4. Generates 3 layout proposals that fix those issues
5. User can toggle between original copy and AI-refreshed copy
6. User requests a quote or installation service

**Value**: Instead of paying $10k-50k and waiting weeks for a designer, users get professional-quality redesigns in 5 minutes for $699-$949.

## Your Implementation Plan

You have a detailed implementation plan at:
**`/Users/dovidthomas/Desktop/pagerefresh-mvp-plan-REVISED.md`**

This is your bible. Follow it phase by phase.

### High-Level Phases

1. **Phase 1: Setup & Foundation**
   - Create Next.js project with TypeScript + Tailwind
   - Set up Prisma + PostgreSQL database
   - Import 20 templates from existing markdown files
   - Create 20 industry scoring criteria
   - Build universal scoring rubric (8 dimensions)

2. **Phase 2: Core Analysis Pipeline**
   - Build Puppeteer screenshot service
   - Build HTML/CSS asset extractor (colors, fonts, images, copy)
   - Build basic SEO auditor
   - Integrate Claude Vision API (screenshot analysis)
   - Integrate Claude Text API (industry detection)
   - **Build 0-100 scoring engine** (critical new component)
   - Build layout generator (3 proposals)
   - Build AI copy refresher

3. **Phase 3: Frontend UI**
   - Build landing page with URL input
   - Build analysis progress UI (gamified, 60-90 sec countdown)
   - Build results dashboard (score breakdown + 8 dimensions)
   - Build layout cards with live HTML previews
   - **Build Design/Copy toggle** (instant switching)
   - Build Request Quote form
   - Build Request Install form

4. **Phase 4: Error Handling**
   - Handle blocked websites (fallback chain)
   - Handle API rate limits (retry logic)
   - Handle low-confidence industry detection
   - Handle failed layout generation
   - Global error boundary

5. **Phase 5: Performance Optimization**
   - Parallel processing (screenshot + HTML fetch, Vision + Text APIs)
   - Caching (industries, templates, rubric)
   - Database optimization (indexes, connection pooling)
   - Asset optimization (compress screenshots, WebP format)

## Critical Components You Need to Build

### 1. **Scoring Engine** (NEW - Most Important)

**File**: `lib/scoring/scorer.ts` + `app/api/score/route.ts`

This is the heart of the system. It must:
- Score a website 0-100 across 8 universal dimensions:
  1. Clarity (What is it, who is it for, what do I do?)
  2. Visual Quality (Modern, intentional, trustworthy)
  3. Information Hierarchy (Logical flow, scannable)
  4. Trust & Credibility (Social proof, legitimacy)
  5. Conversion & Actionability (Easy next step, clear CTA)
  6. Content Quality (Written for humans, no buzzwords)
  7. Mobile Experience (Designed for phones)
  8. Performance & Technical (Fast, secure, not broken)

- For each dimension:
  - Use Claude Text API to evaluate based on scoring rubric
  - Return score (0-100) + specific issues + recommendations
- Calculate overall score (average of 8 dimensions)
- Store all results in database

**Example Scoring Prompt**:
```
You are evaluating the CLARITY of a website (0-100).

RUBRIC:
- 0-20: No clear value prop, confusing navigation, no CTA
- 21-40: Vague messaging, generic headlines, weak CTA
- 41-60: Basic clarity, identifiable service, visible CTA
- 61-80: Strong clarity, specific value prop, compelling CTA
- 81-100: Exceptional - instant understanding <5 sec, perfect CTA

WEBSITE CONTEXT:
- Screenshot analysis: {brandAnalysis}
- Headline: {h1}
- CTA: {ctaText}

EVALUATE:
1. Score (0-100):
2. Issues found:
3. Recommendations:

Return JSON: {score, issues[], recommendations[]}
```

Repeat this for all 8 dimensions.

### 2. **Design/Copy Toggle** (NEW - Critical UX Feature)

**File**: `components/DesignCopyToggle.tsx` + `components/LayoutCard.tsx`

Each of the 3 layout proposals must have a toggle:
- **Design** mode: Shows layout with **original copy** from their website
- **Design + Copy** mode: Shows layout with **AI-refreshed copy**

Requirements:
- Two-state switch component (like a tab switcher)
- Default: "Design" (original copy)
- Instant switching (no loading, use client-side state)
- Clear visual indicator of active state
- Smooth transition animation

Implementation:
- Store both versions in component state:
  - `layout1Html` (with original copy)
  - `layout1CopyRefreshed` (with AI-refreshed copy)
- Toggle switches between the two
- Update iframe/preview instantly

### 3. **Copy Refresher** (NEW)

**File**: `lib/templates/copy-refresher.ts` + `app/api/refresh-copy/route.ts`

For each of the 3 layouts, generate AI-refreshed copy using OpenAI GPT-4:

**Input**: Original copy extracted from their website
**Output**: Improved copy (headline, subheadline, CTA, hero section, body sections)

**Prompt Example**:
```
You are a conversion copywriter. Rewrite this homepage copy for a {industry} business.

CURRENT COPY:
- Headline: {h1}
- Subheadline: {h2}
- CTA: {cta}
- Hero: {hero}

REQUIREMENTS:
- Make it clearer and more compelling
- Focus on benefits, not features
- Eliminate jargon and filler words
- Make it scannable (short paragraphs, bullet points)
- Keep the brand voice but elevate it

Return JSON:
{
  "headline": "...",
  "subheadline": "...",
  "cta": "...",
  "heroSection": "...",
  "sections": [...]
}
```

Store the refreshed copy in `Analysis.layout1CopyRefreshed`, etc.

## What You Have Access To

### Existing Resources

**Templates** (8 existing, you'll create 12 more):
- Location: `/Users/dovidthomas/dev/brand-builder/web-design-and-development/`
- Format: Markdown files with HTML + CSS code blocks
- Examples: dual-hero-navattic-template.md, logo-marquee-template.md, etc.
- **Your job**: Parse these, extract HTML/CSS, insert into database

**Industry Guidelines** (6 existing, you'll create 14 more):
- Location: `/Users/dovidthomas/dev/bhi-claude-skills/` (available to you)
- Format: Markdown files with structured guidelines
- Examples: Accountants, Lawyers, Golf Courses, Beauty Salons, Barbershops, HOAs
- **Your job**: Use these as reference to create scoring criteria for 20 industries

**Reference Documentation**:
- `/Users/dovidthomas/dev/brand-builder/web-design-and-development/design-brief-generator (1).html`
- `/Users/dovidthomas/dev/brand-builder/web-design-and-development/brand-building-system-readme.md`
- `/Users/dovidthomas/dev/brand-builder/web-design-and-development/phase-guides/`

### Pre-Launch Checklist

Before you start coding, review:
**`/Users/dovidthomas/Desktop/pagerefresh-PRE-LAUNCH-CHECKLIST.md`**

This lists all API keys, database credentials, and assets you need. Make sure everything is ready.

## Your Tech Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API routes (serverless on Netlify), Prisma ORM
- **Database**: PostgreSQL on AWS RDS
- **Storage**: Netlify Blobs (screenshots, assets)
- **AI**: Claude API (Vision + Text), OpenAI API (GPT-4)
- **Hosting**: Netlify
- **Package Manager**: pnpm

## Key Implementation Details

### Database Schema

You have a complete Prisma schema in the plan. Key tables:
- `Analysis` - Stores all analysis results, scores, layouts, lead capture
- `Industry` - 20 industries with scoring criteria
- `Template` - 20 templates (HTML/CSS)
- `PromptLog` - Logs all AI prompts/responses (for debugging)
- `ScoringRubric` - Scoring criteria for 8 dimensions × 5 score ranges

### API Routes Structure

```
/app/api/
├── /analyze - Main orchestration (calls all other routes)
├── /screenshot - Puppeteer screenshot capture
├── /extract-assets - HTML/CSS parsing, asset extraction
├── /seo-audit - Basic SEO checks
├── /claude/vision - Claude Vision API wrapper
├── /claude/text - Claude Text API wrapper
├── /openai - OpenAI GPT-4 wrapper
├── /score - 0-100 scoring engine
├── /generate-layouts - Template selection + asset injection
├── /refresh-copy - AI copy generation
├── /request-quote - Lead capture form handler
└── /request-install - Lead capture form handler
```

### Critical Flows

**1. Main Analysis Flow** (`/api/analyze`):
```
URL → Screenshot → Extract Assets → SEO Audit →
Parallel: (Vision Analysis + Industry Detection) →
Score 8 Dimensions → Generate 3 Layouts → Refresh Copy →
Save to Database → Return Analysis ID
```

**2. Scoring Flow** (for each dimension):
```
Load Rubric → Construct Prompt with Website Context →
Call Claude Text API → Parse Score + Issues + Recommendations →
Store in Database
```

**3. Layout Generation Flow**:
```
Load Templates → Select 3 (GPT-4 recommendation) →
Inject Assets (colors, fonts, images, copy) →
Generate HTML/CSS for each →
Store in Database
```

**4. Copy Refresh Flow**:
```
Extract Original Copy → Construct Refresh Prompt →
Call GPT-4 → Parse Refreshed Copy →
Store in Database
```

## What's NOT in MVP (Don't Build These)

❌ **Deferred to v2**:
- Peer benchmarking (200 best sites comparison)
- Category-specific dimension weighting
- 6 layouts (MVP is 3 only, not 3+3 more)
- Payment integration (Stripe)
- Installation scheduling (Calendly)
- Analysis history (past analyses list)
- Platform exports (Squarespace/WordPress/Wix code downloads)
- PDF reports
- Deep SEO/LLM optimization
- User authentication

If you're tempted to build any of these, STOP. Focus on MVP only.

## Development Workflow

### Step-by-Step

1. **Read the full implementation plan** (pagerefresh-mvp-plan-REVISED.md)
2. **Check the pre-launch checklist** (pagerefresh-PRE-LAUNCH-CHECKLIST.md)
3. **Set up the project** (Phase 1):
   - Create Next.js project
   - Set up Prisma + database
   - Install shadcn/ui
   - Import templates
   - Create industries
   - Create scoring rubric
4. **Build the backend** (Phase 2):
   - Screenshot service
   - Asset extractor
   - SEO auditor
   - Claude API integration
   - **Scoring engine** (critical!)
   - Layout generator
   - Copy refresher
   - Main orchestration
5. **Build the frontend** (Phase 3):
   - Landing page
   - Progress UI
   - Results dashboard
   - **Layout cards with toggle** (critical!)
   - Lead capture forms
6. **Add error handling** (Phase 4)
7. **Optimize performance** (Phase 5)
8. **Test everything end-to-end**

### Testing Protocol

For each component:
1. **Build** it
2. **Test** it in isolation (unit test or manual test)
3. **Integrate** with the full pipeline
4. **Test end-to-end** with a real URL

Use test URLs across different industries (accountant, restaurant, lawyer, etc.).

## Common Pitfalls to Avoid

### 1. **Security**
- ❌ NEVER expose API keys in frontend code
- ✅ Always use environment variables on backend
- ❌ Don't use API keys directly in browser
- ✅ All AI API calls go through Next.js API routes

### 2. **Performance**
- ❌ Don't run API calls sequentially if they can be parallel
- ✅ Use `Promise.all()` for independent operations
- ❌ Don't block the main thread with heavy processing
- ✅ Use serverless functions for intensive tasks

### 3. **Error Handling**
- ❌ Don't let the app crash if an API fails
- ✅ Wrap all external calls in try/catch
- ❌ Don't show cryptic errors to users
- ✅ Show helpful, actionable error messages

### 4. **Database**
- ❌ Don't forget to index frequently queried fields
- ✅ Add indexes for: url, industryDetected, createdAt
- ❌ Don't load huge text fields when you don't need them
- ✅ Use `select` to lazy load only required fields

### 5. **Scoring**
- ❌ Don't hardcode scoring logic
- ✅ Use the scoring rubric from database
- ❌ Don't return scores outside 0-100 range
- ✅ Validate and clamp scores

## Success Criteria

You're done when:

1. ✅ I can input a URL and get a complete analysis in < 90 seconds
2. ✅ The score is accurate (0-100) and reflects site quality
3. ✅ All 8 dimensions are scored with specific issues + recommendations
4. ✅ 3 layouts are generated and look good with extracted assets
5. ✅ The Design/Copy toggle works instantly and smoothly
6. ✅ Request Quote and Request Install forms work
7. ✅ The system handles errors gracefully (blocked sites, API failures)
8. ✅ The code is secure (no exposed keys, no vulnerabilities)
9. ✅ The code is clean and well-typed (TypeScript strict mode)
10. ✅ The app can be deployed to Netlify

## Your Oversight Agent

**Claude Code Agent** is your technical reviewer. They will:
- Review your code for quality and correctness
- Verify you're following the implementation plan
- Test each component as you build it
- Flag bugs and security issues
- Guide you when you're stuck

**Work with them, not against them.** They're here to help you build a great product.

## Communication

### Ask Questions
If you're unsure about:
- A requirement (what should this do?)
- An implementation detail (how should I build this?)
- A design decision (which approach is better?)

**Ask!** Don't guess. It's better to clarify than to build the wrong thing.

### Report Progress
Periodically update on your progress:
- "Phase 1 complete: Database set up, templates imported, scoring rubric loaded."
- "Scoring engine working: tested with 3 URLs, all 8 dimensions scoring correctly."
- "Frontend complete: landing page, results dashboard, toggle working."

### Flag Blockers
If you're stuck:
- "Can't connect to database - getting ECONNREFUSED error"
- "Claude API returning 429 (rate limit) - need guidance on retry logic"
- "Not sure how to structure the scoring rubric - need clarification"

Your oversight agent will help you unblock.

## Remember

- **Follow the plan** - it's comprehensive and well-thought-out
- **Focus on MVP** - don't build v2 features
- **Test as you go** - don't wait until the end to test
- **Security first** - never expose API keys
- **Quality over speed** - build it right, not just fast

**You're building a tool that will help thousands of small business owners improve their websites and grow their businesses. Make it great!**

Good luck! 🚀