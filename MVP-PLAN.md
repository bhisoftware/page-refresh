# pagerefresh.ai - MVP Implementation Plan (REVISED)

## Product Overview

**pagerefresh.ai** - "Paste your website and get a $50,000 quality refresh in 5 minutes. Pay only if you love it."

### Target Audience
- SMB business owners
- Simple websites that are stale and don't convert
- Businesses that can't afford $10k+ designer fees or don't have "taste" to use DIY tools

### Value Proposition
The typical path: hire designer → iterate for weeks → pay developer → hope it works. Cost: $5-50k. Time: weeks-months. Outcome: uncertain.

**pagerefresh.ai makes it dummy-proof:**
1. Paste your URL
2. Get scored (0-100) with specific reasons
3. See 3 upgraded designs (huge improvement from current)
4. Pay $699 (self-install) or $949 (we install in 15 min)
5. Done.

**No editing. No modifications. No endless iterations.** Take it or leave it.

---

## MVP Scope

### ✅ What's IN MVP

**Core Analysis Flow:**
1. URL input → Screenshot → HTML/CSS extraction
2. Claude Vision: Brand analysis from screenshot
3. Claude Text: Industry detection from content
4. **0-100 scoring across 8 universal quality dimensions**
5. Generate 3 layout proposals
6. **Design vs Design+Copy toggle** for each layout
7. Basic SEO audit (title, meta, headings)
8. Request Quote form (lead capture)
9. Request Install form (lead capture)

**Scoring System:**
- **Layer 1: Universal Quality Framework** - 8 dimensions, scored 0-100
  1. Clarity (What is it, who is it for, what do I do?)
  2. Visual Quality (Modern, intentional, trustworthy)
  3. Information Hierarchy (Logical flow, scannable)
  4. Trust & Credibility (Social proof, legitimacy signals)
  5. Conversion & Actionability (Easy next step, clear CTA)
  6. Content Quality (Written for humans, no buzzwords)
  7. Mobile Experience (Designed for phones)
  8. Performance & Technical (Fast, secure, not broken)

- **Equal weighting** for all industries (no category overlays yet)
- **Absolute scoring** (no peer benchmarking yet)

**User Experience:**
- Clean URL input page
- Gamified progress indicators (60-90 second analysis)
- Results dashboard showing:
  - Overall score (e.g., "35/100")
  - Breakdown by dimension with specific issues
  - Example: "Compared to web standards, you underindex on clarity of services, you lack trust proof above the fold, your CTA friction is high"
- 3 layout cards with live HTML preview
- Toggle: "Design" (keeps original copy) vs "Design + Copy" (AI-refreshed copy)
- Simple lead capture forms (no payment integration yet)

### ❌ What's NOT in MVP (v2 Features)

**Deferred to v2:**
- ❌ Peer benchmarking (200 best sites per category)
- ❌ Category-specific weighting (Law firms vs Restaurants)
- ❌ 6 layouts (MVP shows 3, not 3+3 more)
- ❌ Payment integration (Stripe, "pay only if you love it")
- ❌ Installation scheduling (Calendly/Cal.com booking)
- ❌ Analysis history (view past analyses)
- ❌ Platform exports (downloadable Squarespace/WordPress/Wix code)
- ❌ PDF reports (full analysis with Claude reasoning)
- ❌ Deep SEO/LLM optimization (just basic audit for MVP)

**v2 Roadmap documented below** so we don't miss a beat when ready to scale.

---

## Tech Stack

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui
- **State Management**: React Context + hooks

### Backend
- **API Routes**: Next.js API routes (serverless functions on Netlify)
- **Database**: PostgreSQL on AWS RDS
- **ORM**: Prisma
- **Storage**: Netlify Blobs (screenshots, assets, generated layouts)

### External Services
- **Screenshot Capture**: Puppeteer with @sparticuz/chromium (Netlify Functions compatible)
- **AI APIs**:
  - Claude API (Vision for screenshot analysis, Text for industry detection + scoring)
  - OpenAI API (GPT-4 for layout generation + copy refresh)
- **Hosting**: Netlify (frontend + serverless functions)

### Development Tools
- **Package Manager**: pnpm
- **Linting**: ESLint + Prettier
- **Type Checking**: TypeScript strict mode
- **Environment Variables**: .env.local for API keys

---

## Database Schema (MVP)

### Core Tables

```prisma
model Analysis {
  id                String   @id @default(cuid())
  url               String
  targetWebsite     String
  screenshotUrl     String?
  htmlSnapshot      String   @db.Text
  cssSnapshot       String   @db.Text

  // Extracted Assets
  extractedColors   Json     // Array of hex codes with names
  extractedFonts    Json     // Array of font families
  extractedImages   Json     // Array of image URLs + descriptions
  extractedCopy     Json     // Hero text, headlines, body samples
  extractedLogo     String?

  // AI Analysis Results
  brandAnalysis     String   @db.Text // Claude Vision output
  industryDetected  String   // Detected industry name
  industryConfidence Float   // 0-1 confidence score

  // 0-100 Scoring System (8 Dimensions)
  overallScore      Int      // Weighted average 0-100
  clarityScore      Int      // Dimension 1
  visualScore       Int      // Dimension 2
  hierarchyScore    Int      // Dimension 3
  trustScore        Int      // Dimension 4
  conversionScore   Int      // Dimension 5
  contentScore      Int      // Dimension 6
  mobileScore       Int      // Dimension 7
  performanceScore  Int      // Dimension 8

  // Dimension Details (JSON with issues/recommendations per dimension)
  scoringDetails    Json     // Array of {dimension, score, issues[], recommendations[]}

  // Basic SEO Audit
  seoAudit          Json     // {title, metaDescription, headings, issues[]}

  // Generated Layouts
  layout1Html       String   @db.Text
  layout1Css        String   @db.Text
  layout1Template   String   // Template name used
  layout1CopyRefreshed String @db.Text // AI-refreshed copy version

  layout2Html       String   @db.Text
  layout2Css        String   @db.Text
  layout2Template   String
  layout2CopyRefreshed String @db.Text

  layout3Html       String   @db.Text
  layout3Css        String   @db.Text
  layout3Template   String
  layout3CopyRefreshed String @db.Text

  // Lead Capture
  selectedLayout    Int?     // 1, 2, or 3 (if user selected one)
  quoteRequested    Boolean  @default(false)
  installRequested  Boolean  @default(false)
  contactEmail      String?
  contactPhone      String?
  hostingPlatform   String?  // For install request
  notes             String?  @db.Text

  // Metadata
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  processingTime    Int?     // Total time in seconds

  // Relationships
  promptHistory     PromptLog[]

  @@index([url])
  @@index([industryDetected])
  @@index([createdAt])
  @@index([quoteRequested])
  @@index([installRequested])
}

model Industry {
  id                String   @id @default(cuid())
  name              String   @unique
  description       String

  // Universal dimensions scoring criteria (JSON)
  scoringCriteria   Json     // Array of criteria per dimension

  // Template preferences
  preferredTemplates Json    // Array of template IDs suitable for this industry

  exampleWebsites   Json?    // Reference sites
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([name])
}

model Template {
  id                String   @id @default(cuid())
  name              String   @unique
  description       String
  htmlTemplate      String   @db.Text
  cssTemplate       String   @db.Text
  previewImageUrl   String?

  // Template metadata
  category          String   // 'hero', 'features', 'testimonials', etc.
  suitableIndustries Json    // Array of industry names

  // Performance tracking
  usageCount        Int      @default(0)
  conversionRate    Float?   // Future: track if users select this template

  // Platform compatibility
  supportsSquarespace Boolean @default(true)
  supportsWordPress   Boolean @default(true)
  supportsWix         Boolean @default(true)

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([category])
}

model PromptLog {
  id                String   @id @default(cuid())
  analysisId        String
  analysis          Analysis @relation(fields: [analysisId], references: [id], onDelete: Cascade)

  step              String   // 'screenshot_analysis' | 'industry_detection' | 'dimension_scoring' | etc.
  provider          String   // 'claude' | 'openai'
  model             String   // 'claude-3-5-sonnet-20241022' | 'gpt-4' | etc.

  promptText        String   @db.Text
  responseText      String   @db.Text

  tokensUsed        Int?
  responseTime      Int?     // milliseconds

  createdAt         DateTime @default(now())

  @@index([analysisId])
  @@index([step])
}

model ScoringRubric {
  id                String   @id @default(cuid())
  dimension         String   // 'clarity' | 'visual' | 'hierarchy' | etc.
  scoreRange        String   // '0-20' | '21-40' | '41-60' | '61-80' | '81-100'

  // Scoring criteria for this range
  criteria          Json     // {indicators: [], antipatterns: []}

  exampleSites      Json?    // Reference examples

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([dimension])
  @@index([scoreRange])
}
```

---

## Critical File Paths

### Existing Resources to Integrate

**Templates** (20 for MVP):
- `/Users/dovidthomas/dev/brand-builder/web-design-and-development/`
  - `dual-hero-navattic-template.md`
  - `logo-marquee-template.md`
  - `ios-card-fan-template.md`
  - `dual-demo-screenshots-template.md`
  - `switch-provider-cta-template.md`
  - `testimonials-carousel-template.md`
  - `saas-about-page-template.md`
  - `features-grid-template.md`
  - (Need 12 more templates - reference `/phase-guides/` or create new)

**Industry Scoring Criteria** (20 for MVP):
- `/Users/dovidthomas/dev/bhi-claude-skills/` - Reference existing guideline structures
- **20 industries**: accountants, lawyers, golf courses, beauty salons, barbershops, HOAs, veterinary clinics, property management, funeral homes, daycares, lawn care/landscaping, insurance agencies, gun clubs, community theatres, dentists, real estate agents, restaurants, fitness studios, auto repair, general contractors

**Design Brief Generator**:
- `/Users/dovidthomas/dev/brand-builder/web-design-and-development/design-brief-generator (1).html` - Reference for scoring criteria

### New Project Structure

```
/pagerefresh
├── /app
│   ├── /api
│   │   ├── /analyze
│   │   │   └── route.ts           # Main analysis orchestration
│   │   ├── /screenshot
│   │   │   └── route.ts           # Puppeteer screenshot capture
│   │   ├── /extract-assets
│   │   │   └── route.ts           # HTML/CSS asset extraction
│   │   ├── /seo-audit
│   │   │   └── route.ts           # Basic SEO audit
│   │   ├── /claude
│   │   │   ├── /vision/route.ts   # Claude Vision API wrapper
│   │   │   └── /text/route.ts     # Claude Text API wrapper
│   │   ├── /openai
│   │   │   └── route.ts           # OpenAI GPT-4 API wrapper
│   │   ├── /score
│   │   │   └── route.ts           # 0-100 scoring across 8 dimensions
│   │   ├── /generate-layouts
│   │   │   └── route.ts           # Layout generation logic
│   │   ├── /refresh-copy
│   │   │   └── route.ts           # AI copy refresh for layouts
│   │   ├── /request-quote
│   │   │   └── route.ts           # Handle quote requests
│   │   └── /request-install
│   │       └── route.ts           # Handle install requests
│   ├── /results
│   │   └── [id]/page.tsx          # Analysis results dashboard
│   ├── layout.tsx
│   └── page.tsx                   # Landing/URL input page
├── /components
│   ├── /ui                        # shadcn/ui components
│   ├── URLInputForm.tsx
│   ├── AnalysisProgress.tsx       # Gamified progress indicator
│   ├── ScoreBreakdown.tsx         # 8-dimension score visualization
│   ├── LayoutCard.tsx             # Layout preview with toggle
│   ├── DesignCopyToggle.tsx       # Design vs Design+Copy switch
│   ├── RequestQuoteForm.tsx       # Simple lead capture
│   └── RequestInstallForm.tsx     # Simple lead capture
├── /lib
│   ├── /scraping
│   │   ├── puppeteer.ts           # Screenshot + HTML fetch
│   │   ├── asset-extractor.ts     # Parse HTML/CSS for assets
│   │   └── fallback-scrapers.ts   # Alternative scraping methods
│   ├── /ai
│   │   ├── claude-vision.ts       # Claude Vision API client
│   │   ├── claude-text.ts         # Claude Text API client
│   │   ├── openai.ts              # OpenAI API client
│   │   └── prompt-templates.ts    # Prompt construction utilities
│   ├── /scoring
│   │   ├── scorer.ts              # 0-100 scoring engine
│   │   ├── dimensions.ts          # 8 dimension definitions
│   │   └── rubric.ts              # Scoring rubric loader
│   ├── /templates
│   │   ├── parser.ts              # Parse markdown template files
│   │   ├── injector.ts            # Inject assets into templates
│   │   ├── copy-refresher.ts      # AI copy refresh logic
│   │   └── selector.ts            # Template selection logic
│   ├── /seo
│   │   └── auditor.ts             # Basic SEO audit logic
│   ├── /storage
│   │   └── netlify-blobs.ts       # Netlify Blobs wrapper
│   ├── prisma.ts                  # Prisma client singleton
│   └── utils.ts                   # Common utilities
├── /prisma
│   ├── schema.prisma
│   └── seed.ts                    # Seed industries + templates + scoring rubric
├── /public
│   └── /templates                 # Imported template files
├── /scripts
│   ├── import-templates.ts        # Import from brand-builder
│   ├── create-industries.ts       # Generate 20 industries
│   └── create-scoring-rubric.ts   # Create scoring criteria for 8 dimensions
├── .env.local
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## Implementation Plan

### Phase 1: Project Setup & Foundation

**Goal**: Set up Next.js project, database, import templates, create scoring rubric

#### 1.1 Initialize Next.js Project
```bash
pnpm create next-app@latest pagerefresh --typescript --tailwind --app --eslint
cd pagerefresh
pnpm add prisma @prisma/client
pnpm add -D @types/node
```

#### 1.2 Configure Prisma + AWS RDS PostgreSQL
- Create `prisma/schema.prisma` with schema defined above
- Set `DATABASE_URL` in `.env.local` (AWS RDS connection string)
- Run `prisma migrate dev --name init`
- Create `lib/prisma.ts` singleton client

#### 1.3 Install shadcn/ui
```bash
pnpm dlx shadcn-ui@latest init
pnpm dlx shadcn-ui@latest add button card input textarea select dialog tabs progress badge toggle
```

#### 1.4 Import Existing Templates
**Script**: `scripts/import-templates.ts`
- Read markdown files from `/Users/dovidthomas/dev/brand-builder/web-design-and-development/`
- Parse each template (extract HTML, CSS, metadata)
- Insert into `Template` table
- Store original markdown in `/public/templates/`

**20 templates needed** (8 existing + 12 new from phase-guides)

#### 1.5 Create Industry Scoring Criteria
**Script**: `scripts/create-industries.ts`
- Reference existing guidelines in `/Users/dovidthomas/dev/bhi-claude-skills/`
- For each of 20 industries, create scoring criteria for the 8 dimensions
- Structure:
  ```json
  {
    "name": "Accountants",
    "description": "...",
    "scoringCriteria": {
      "clarity": {
        "weight": 1.0,
        "indicators": ["Clear services listed", "Specialization stated", ...],
        "antipatterns": ["Vague 'full service' claims", ...]
      },
      "visual": {...},
      // ... all 8 dimensions
    }
  }
  ```
- Insert into `Industry` table

#### 1.6 Create Universal Scoring Rubric
**Script**: `scripts/create-scoring-rubric.ts`
- Define scoring criteria for each dimension across score ranges
- Example for "Clarity" dimension:
  - 0-20: No clear value prop, confusing navigation, no CTA
  - 21-40: Vague messaging, generic headlines, weak CTA
  - 41-60: Basic clarity, identifiable service, visible CTA
  - 61-80: Strong clarity, specific value prop, compelling CTA
  - 81-100: Exceptional clarity, instant understanding, optimized CTA

- Create rubric entries for all 8 dimensions × 5 score ranges = 40 rubric entries
- Insert into `ScoringRubric` table

#### 1.7 Environment Variables Setup
Create `.env.local`:
```env
# Database
DATABASE_URL="postgresql://user:password@aws-rds-endpoint:5432/pagerefresh"

# AI APIs
ANTHROPIC_API_KEY="sk-ant-..."
OPENAI_API_KEY="sk-..."

# Netlify
NETLIFY_BLOBS_TOKEN="..."

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

### Phase 2: Core Analysis Pipeline

**Goal**: Build URL → Screenshot → Analysis → Scoring → 3 Layouts flow

#### 2.1 Puppeteer Screenshot Service
**File**: `app/api/screenshot/route.ts`
- Install: `pnpm add puppeteer @sparticuz/chromium`
- Capture full-page screenshot (desktop view)
- Upload to Netlify Blobs
- Return screenshot URL

**Fallback strategies**:
- Try Playwright if Puppeteer fails
- Try screenshot API service as last resort
- Return error with helpful message

#### 2.2 HTML/CSS Fetcher & Asset Extractor
**File**: `app/api/extract-assets/route.ts`
- Fetch HTML + CSS
- Parse with Cheerio
- Extract:
  - Colors (parse CSS, sort by frequency)
  - Fonts (extract font-family declarations)
  - Images (find logos, hero images, key visuals)
  - Copy (H1, H2, hero text, nav items, CTA text)
  - Logo (heuristics: filename, alt text, position)
- Store in database, upload images to Netlify Blobs

**Multiple scraping tools**: Puppeteer → Axios + Cheerio → Playwright → External API

#### 2.3 Basic SEO Audit
**File**: `app/api/seo-audit/route.ts`
- Check title tag (length, relevance)
- Check meta description (length, keyword usage)
- Check heading structure (H1, H2s)
- Check image alt tags
- Store results in `Analysis.seoAudit` JSON

#### 2.4 Claude Vision Analysis
**File**: `app/api/claude/vision/route.ts`
- Send screenshot to Claude Vision
- Prompt: "Analyze this website screenshot. Evaluate: visual quality, layout hierarchy, trust signals, mobile responsiveness indicators, clarity of messaging, CTA visibility. Provide specific observations for each dimension."
- Store response in `Analysis.brandAnalysis`
- Log prompt + response in `PromptLog`

#### 2.5 Industry Detection
**File**: `app/api/claude/text/route.ts`
- Send HTML content to Claude Text
- Prompt: "Detect the industry/business type from this content. Choose from: [list 20 industries]. Return industry name, confidence (0-1), and reasoning."
- If confidence < 0.7: Return top 3 options for user selection
- Store in `Analysis.industryDetected` + `industryConfidence`

#### 2.6 0-100 Scoring Engine
**File**: `app/api/score/route.ts` + `lib/scoring/scorer.ts`

**Scoring Flow**:
1. Load industry scoring criteria from database
2. Load universal scoring rubric
3. For each of 8 dimensions:
   - Construct prompt for Claude with:
     - Dimension definition
     - Scoring criteria (0-20, 21-40, etc.)
     - Website context (screenshot analysis + HTML + assets)
     - Industry-specific indicators
   - Call Claude Text API
   - Parse response to get score (0-100) + specific issues + recommendations
4. Calculate overall score (average of 8 dimensions)
5. Store all scores in database

**Example Prompt for "Clarity" Dimension**:
```
You are evaluating the CLARITY of a website homepage (0-100 scale).

DIMENSION DEFINITION:
Clarity = Can a visitor instantly understand what this business does, who it serves, and what action to take?

SCORING RUBRIC:
- 0-20: No clear value proposition, confusing navigation, no visible CTA
- 21-40: Vague messaging, generic headlines, weak CTA
- 41-60: Basic clarity, identifiable service, visible CTA
- 61-80: Strong clarity, specific value prop, compelling CTA
- 81-100: Exceptional - instant understanding in <5 seconds, perfect CTA placement

WEBSITE CONTEXT:
- Industry: {industryDetected}
- Screenshot analysis: {brandAnalysis}
- Headline: {extractedCopy.h1}
- CTA text: {extractedCopy.cta}

INDUSTRY-SPECIFIC EXPECTATIONS (Accountants):
- Must clearly state services (tax, bookkeeping, advisory)
- Target audience should be obvious (SMB, individuals, etc.)
- Specialization important (if any)

EVALUATE THIS WEBSITE:
1. Score (0-100):
2. Specific issues found:
3. Recommendations:

Return JSON: {score: number, issues: string[], recommendations: string[]}
```

**Repeat for all 8 dimensions**:
1. Clarity
2. Visual Quality
3. Information Hierarchy
4. Trust & Credibility
5. Conversion & Actionability
6. Content Quality
7. Mobile Experience
8. Performance & Technical

#### 2.7 Template Selection & Layout Generation
**File**: `app/api/generate-layouts/route.ts`

**Template Selection** (using OpenAI GPT-4):
- Prompt: "Given this industry ({industryDetected}), scoring results ({scoringDetails}), and extracted assets, recommend 3 templates from our library that would address the main issues and elevate the site. Return template IDs with reasoning."
- Parse response to get 3 template IDs

**Asset Injection**:
- For each template:
  - Load HTML + CSS
  - Replace CSS variables with extracted colors
  - Replace placeholder text with extracted copy
  - Replace images with extracted assets
  - Store in `Analysis.layout1Html/Css`, etc.

#### 2.8 Copy Refresh (for Design+Copy Toggle)
**File**: `app/api/refresh-copy/route.ts` + `lib/templates/copy-refresher.ts`

**For each of 3 layouts**:
- Extract original copy placeholders from layout
- Prompt OpenAI GPT-4: "Rewrite this homepage copy for a {industry} business. Current copy: {extractedCopy}. Make it: clearer, more compelling, benefit-focused, scannable. Maintain brand voice but eliminate jargon and filler. Return: {headline, subheadline, cta, heroSection, sections: []}"
- Store refreshed copy in `Analysis.layout1CopyRefreshed`, etc.

#### 2.9 Main Orchestration Endpoint
**File**: `app/api/analyze/route.ts`
- Accepts: `{ url: string }`
- Orchestration flow:
  1. Validate URL
  2. Call `/api/screenshot` → screenshot URL
  3. Call `/api/extract-assets` → assets JSON
  4. Call `/api/seo-audit` → SEO audit results
  5. Parallel:
     - `/api/claude/vision` → brand analysis
     - `/api/claude/text` → industry detection
  6. Call `/api/score` → 0-100 scores for 8 dimensions
  7. Call `/api/generate-layouts` → 3 layouts
  8. Call `/api/refresh-copy` → refreshed copy for each layout
  9. Save complete `Analysis` record to database
  10. Return analysis ID

**Progress tracking**: Emit Server-Sent Events (SSE) for real-time progress

**Target time**: 60-90 seconds total

---

### Phase 3: Frontend UI

**Goal**: Build user-facing application

#### 3.1 Landing Page
**File**: `app/page.tsx`
- Hero: "Paste your website and get a $50,000 quality refresh in 5 minutes"
- URL input form with validation
- "Analyze My Website" button
- On submit: POST to `/api/analyze`, navigate to `/results/[id]`

#### 3.2 Analysis Progress UI
**File**: `components/AnalysisProgress.tsx`
- Subscribe to SSE for real-time updates
- **Progress indicators**:
  - 3 horizontal progress bars (Screenshot → Analysis → Layouts)
  - Current step with animated icon
  - Time remaining countdown (60-90 seconds)

**Steps**:
1. 📸 Capturing screenshot... (10s)
2. 🔍 Extracting assets... (15s)
3. 🤖 Analyzing with Claude Vision... (10s)
4. 🏢 Detecting industry... (8s)
5. 📊 Scoring across 8 dimensions... (20s)
6. 🎨 Generating 3 layout proposals... (20s)
7. ✍️ Refreshing copy... (10s)
8. ✨ Finalizing... (5s)

#### 3.3 Results Dashboard
**File**: `app/results/[id]/page.tsx`
- Load `Analysis` by ID
- **Top Section**: Overall Score
  - Large display: "35/100"
  - Color-coded: 0-40 red, 41-60 yellow, 61-80 green, 81-100 blue
  - Tagline: "Your homepage has significant room for improvement"

- **Score Breakdown** (8 dimensions):
  - Each dimension shows:
    - Score (e.g., "Clarity: 28/100")
    - Specific issues found (bullet list)
    - Recommendations (bullet list)
  - Expandable accordion for each dimension

- **Example Message**:
  > "Your homepage design scores 35/100. Compared to web standards:
  > - You underindex on **clarity of services** (only 28/100)
  > - You lack **trust proof above the fold** (trust score: 32/100)
  > - Your **CTA friction is high** (conversion score: 41/100)
  >
  > Here are 3 homepage refresh directions that fix those exact gaps:"

- **3 Layout Cards**:
  - Side-by-side layout cards
  - Live HTML preview (iframe)
  - Template name + description
  - **Design vs Design+Copy Toggle** (prominent)
  - "Select This Layout" button

#### 3.4 Layout Card with Toggle
**File**: `components/LayoutCard.tsx` + `components/DesignCopyToggle.tsx`

**Toggle Component**:
- Two-state switch: "Design" | "Design + Copy"
- Default: "Design" (uses original copy from their site)
- When toggled to "Design + Copy": injects AI-refreshed copy
- Visual indicator showing which is active
- Instant preview update (no loading)

**Implementation**:
- Store both versions in state
- Toggle switches between `layout1Html` (original copy) and `layout1CopyRefreshed` (AI copy)
- Smooth transition animation

#### 3.5 Request Quote Form
**File**: `components/RequestQuoteForm.tsx`
- Triggered when user clicks "Select This Layout"
- Simple modal:
  - Email (required)
  - Phone (optional)
  - Notes (textarea, optional)
  - Platform selection: Squarespace | WordPress | Wix | Custom | Not sure
  - "Request Quote" button
- On submit: POST to `/api/request-quote`
  - Updates `Analysis` record: `quoteRequested = true`, stores contact info
  - Shows success message: "Thanks! We'll send you a quote within 24 hours."
  - Optional: Send email notification to admin

#### 3.6 Request Install Form
**File**: `components/RequestInstallForm.tsx`
- Alternative CTA: "Want us to install? +$250"
- Simple modal:
  - Email (required)
  - Phone (required)
  - Hosting platform (required): Squarespace | WordPress | Wix | Other
  - "Have hosting credentials ready?" checkbox
  - Preferred time: Dropdown (Morning | Afternoon | Evening)
  - Notes (textarea)
  - "Request Installation" button
- On submit: POST to `/api/request-install`
  - Updates `Analysis`: `installRequested = true`, stores info
  - Shows success: "Thanks! We'll reach out within 24 hours to schedule your 15-min install."

---

### Phase 4: Error Handling & Fallbacks

**Goal**: Robust error handling

#### 4.1 Screenshot Blocking
**File**: `lib/scraping/fallback-scrapers.ts`
- Fallback chain: Puppeteer → Playwright → Screenshot API → Error message
- If all fail: "This website blocks automated access. Please try a different URL or contact us."

#### 4.2 API Rate Limiting
- If Claude/OpenAI rate limit hit:
  - Save progress
  - Show: "Analysis paused due to API limits. Retrying in 10 seconds..."
  - Auto-retry after delay

#### 4.3 Industry Detection Fallback
- If confidence < 0.7: Show top 3 options for user to select
- If no match: Use "General Business" category with generic scoring

#### 4.4 Layout Generation Fallback
- If OpenAI fails: Use rule-based template selection (industry → templates)
- If asset injection fails: Use template with placeholders, show warning

#### 4.5 Global Error Boundary
**File**: `app/error.tsx`
- Catch-all error handler
- Friendly message: "Something went wrong. Please try again."
- "Try Again" button
- Log error to database for debugging

---

### Phase 5: Performance Optimization

**Goal**: Meet 60-90 second target

#### 5.1 Parallel Processing
- Run screenshot + HTML fetch concurrently
- Run Claude Vision + industry detection in parallel
- Batch dimension scoring (all 8 in parallel if possible)

#### 5.2 Caching
- Cache industry criteria in memory
- Cache template library in memory
- Cache scoring rubric in memory

#### 5.3 Database Optimization
- Index all frequently queried fields
- Use connection pooling
- Lazy load large text fields

#### 5.4 Asset Optimization
- Compress screenshots (WebP format)
- Optimize image downloads
- Lazy load layout previews

---

## Verification & Testing

### End-to-End Testing Flow

1. **Setup**: Seed database with 20 industries + 20 templates + scoring rubric

2. **Test Analysis Flow**:
   - Input: Test URL (diverse industries)
   - Verify: Screenshot captured
   - Verify: Assets extracted
   - Verify: SEO audit completed
   - Verify: Industry detected
   - Verify: All 8 dimensions scored (0-100)
   - Verify: Overall score calculated
   - Verify: 3 layouts generated
   - Verify: Copy refreshed for each layout
   - Verify: Total time < 90 seconds

3. **Test Results UI**:
   - Verify: Overall score displays correctly
   - Verify: 8 dimensions show with issues + recommendations
   - Verify: 3 layout cards render
   - Verify: Design/Design+Copy toggle works instantly
   - Verify: Layouts look good with extracted assets

4. **Test Lead Capture**:
   - Select layout
   - Submit Request Quote form
   - Verify: Analysis updated in database
   - Submit Request Install form
   - Verify: Analysis updated in database

5. **Test Error Scenarios**:
   - Blocked website (expect fallback)
   - Invalid URL (expect validation)
   - Rate limit (expect retry)
   - No industry match (expect generic scoring)

### Performance Benchmarks
- Average analysis time: < 90 seconds
- Database queries: < 100ms each
- Page load: < 2 seconds
- Toggle switch: < 100ms

---

## MVP Scope Summary

### ✅ In MVP

**Priority 1 - Core Flow:**
- [x] URL input → Screenshot → Asset extraction
- [x] Claude Vision brand analysis
- [x] Industry detection
- [x] 0-100 scoring across 8 universal dimensions (equal weights)
- [x] Tangible scoring breakdown with issues + recommendations
- [x] Generate 3 layout proposals
- [x] AI copy refresh for each layout
- [x] Basic SEO audit (title, meta, headings)

**Priority 2 - User Experience:**
- [x] Clean landing page
- [x] Gamified progress indicators (60-90 sec)
- [x] Results dashboard with score breakdown
- [x] Design vs Design+Copy toggle for each layout
- [x] Request Quote form (simple lead capture)
- [x] Request Install form (simple lead capture)

### ❌ Not in MVP (v2 Features)

**Deferred to v2:**
- [ ] Peer benchmarking ("2x higher than peers")
- [ ] 200-site benchmark database per category
- [ ] Category-specific weighting (law firms ≠ restaurants)
- [ ] 6 layouts (3 + "Show 3 More" option)
- [ ] Payment integration (Stripe, "pay only if you love it")
- [ ] Installation scheduling (Calendly/Cal.com)
- [ ] Analysis history (view past analyses)
- [ ] Platform exports (download Squarespace/WordPress/Wix code)
- [ ] PDF reports (full analysis with Claude reasoning)
- [ ] Deep SEO/LLM optimization
- [ ] User authentication
- [ ] Template performance tracking
- [ ] A/B testing

---

## v2 Roadmap (Post-MVP)

### Phase 1: Monetization & Operations
1. **Payment Integration**
   - Stripe integration
   - $699 self-install | $949 with installation
   - "Pay only if you love it" flow (show layouts first, charge after selection)

2. **Installation Scheduling**
   - Calendly/Cal.com integration
   - 15-min installation call booking
   - Hosting credentials collection workflow
   - Platform-specific install guides

3. **Platform Exports**
   - Downloadable code for self-installers
   - Squarespace: Developer Mode setup
   - WordPress: Theme .zip with instructions
   - Wix: Corvid/Velo code + setup guide
   - Custom: HTML/CSS .zip with README

### Phase 2: Enhanced Intelligence
4. **Peer Benchmarking**
   - Build 200-site database per category (20 categories × 200 = 4,000 sites)
   - Scrape + analyze best-in-class sites
   - Store benchmark scores per dimension per industry
   - Add comparative scoring: "Your CTA friction is 2x higher than top performers"

5. **Category-Specific Weighting**
   - Define dimension weights per industry
   - Law firms: Trust (2x), Credibility (1.5x), Clarity (1.2x)
   - Restaurants: Visual (2x), Mobile (1.5x), Conversion (1.3x)
   - Adjust overall score calculation based on industry priorities

6. **Deep SEO/LLM Optimization**
   - Full technical SEO audit (schema markup, crawlability, speed)
   - Content optimization for search intent
   - LLM discoverability optimization (structured data for AI search)
   - Generate SEO recommendations report

### Phase 3: User Experience Enhancements
7. **Analysis History**
   - User accounts (email login)
   - Dashboard showing past analyses
   - Compare scores over time
   - Re-analyze after implementation to show improvement

8. **PDF Reports**
   - Downloadable comprehensive report
   - Include: score breakdown, issues, recommendations, layouts, Claude reasoning
   - Shareable with stakeholders/team

9. **6 Layout Options**
   - Generate 3 initially
   - "Show 3 More" button
   - User can see 6 total options
   - Track which layouts convert best

### Phase 4: Scale & Optimization
10. **Template Performance Tracking**
    - Track which templates users select most
    - Track conversion rate by template
    - A/B test variations
    - Auto-recommend best-performing templates per industry

11. **Advanced Features**
    - User editing capability (optional - controlled modifications only)
    - Team collaboration (share analyses with team)
    - White-label version for agencies
    - API access for bulk analysis

---

## Deployment Strategy

### Netlify Configuration

1. **Build Settings**
   - Build command: `pnpm build`
   - Publish directory: `.next`
   - Node version: 20.x

2. **Environment Variables**
   - Add all `.env.local` variables to Netlify dashboard
   - Mark API keys as "Secret"

3. **Netlify Functions**
   - API routes → serverless functions
   - Configure timeout: 90s (for analysis)

4. **Netlify Blobs**
   - Create Blobs store for screenshots/assets
   - Add `NETLIFY_BLOBS_TOKEN`

5. **Database**
   - AWS RDS PostgreSQL
   - Connection pooling (max 10)
   - Set `DATABASE_URL`

### Deployment Checklist

- [ ] Set up AWS RDS PostgreSQL
- [ ] Run `prisma migrate deploy`
- [ ] Run seed script (industries + templates + rubric)
- [ ] Configure Netlify environment variables
- [ ] Set up Netlify Blobs
- [ ] Deploy to Netlify
- [ ] Test end-to-end on production
- [ ] Monitor error logs
- [ ] Set up API cost alerts

---

## Next Steps

1. Create Next.js project
2. Set up Prisma + AWS RDS
3. Install shadcn/ui
4. Import 20 templates
5. Create 20 industry scoring criteria
6. Create universal scoring rubric (8 dimensions × 5 ranges)
7. Build screenshot service
8. Build asset extractor
9. Build SEO auditor
10. Integrate Claude Vision + Text APIs
11. **Build 0-100 scoring engine** (critical new component)
12. Build layout generator + copy refresher
13. Build frontend UI (landing + results + toggle)
14. Test end-to-end
15. Deploy to Netlify

---

## Key Differences from Original Plan

### What Changed
1. **Scoring System**: Pass/fail → 0-100 quantified scoring
2. **Presentation**: Generic issues → Tangible comparisons ("you underindex on X")
3. **Copy Handling**: Added Design vs Design+Copy toggle
4. **Layout Count**: 6 options → 3 for MVP (6 in v2)
5. **Monetization**: Export download → Request Quote/Install forms (payment in v2)
6. **Simplifications**: No peer benchmarking, no category weighting, no history/exports/reports in MVP

### What Stayed the Same
- Tech stack (Next.js, TypeScript, Tailwind, PostgreSQL, Netlify)
- AI pipeline (Claude Vision + Text, OpenAI GPT-4)
- Template system (20 templates from brand-builder)
- 20 industries
- Gamified progress indicators
- 3 layout proposals

### Critical New Components
1. **Scoring Engine** (`lib/scoring/scorer.ts`) - 0-100 algorithm for 8 dimensions
2. **Scoring Rubric** (`ScoringRubric` table) - Criteria for each dimension/range
3. **Copy Refresher** (`lib/templates/copy-refresher.ts`) - AI copy generation
4. **Design/Copy Toggle** (`DesignCopyToggle` component) - Instant switching
5. **Lead Capture Forms** (Request Quote + Request Install)

---

**End of Plan**