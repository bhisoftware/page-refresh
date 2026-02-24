# Phase 1 Handoff: Schema + Foundation Layer

> **Status:** Ready for build | **Created:** Feb 24, 2026
> **Executor:** Cursor | **Reviewer:** Claude Code
> **Prerequisite:** None — first phase. Live app must continue working unchanged.

---

## Goal

Add all new database models, runtime config libraries, URL profile utilities, and asset extraction pipeline. Phase 2 (pipeline refactor) depends on everything built here. **Zero changes to the existing pipeline, AI calls, admin UI, or frontend.**

---

## Current Stack Reference

| Layer | Technology | Key Files |
|---|---|---|
| Runtime | Next.js 15 (App Router), React 19, TypeScript | `app/`, `next.config.ts` |
| Database | PostgreSQL on AWS RDS, Prisma 6 | `prisma/schema.prisma`, `lib/prisma.ts` |
| Hosting | Netlify (`@netlify/plugin-nextjs`) | `netlify.toml` |
| Binary storage | Netlify Blobs | `lib/storage/netlify-blobs.ts`, `app/api/blob/[key]/route.ts` |
| AI | Anthropic Claude + OpenAI GPT-4o | `lib/ai/claude-text.ts`, `lib/ai/openai.ts` |
| ORM singleton | `lib/prisma.ts` | Import as `import { prisma } from "@/lib/prisma"` |
| Path aliases | `@/` maps to project root | All imports use `@/lib/...`, `@/components/...` |

---

## 1. Prisma Schema Changes

**Migration name:** `add_foundation_models`

**One migration covers everything below.** Run once. All new fields on Refresh are nullable or have defaults for backward compatibility with existing data.

### 1.1 New Model: UrlProfile

```prisma
model UrlProfile {
  id              String    @id @default(cuid())
  url             String    @unique            // Normalized (see lib/pipeline/url-profile.ts)
  domain          String                       // "swag.com"
  industry        String?                      // Detected or manually set
  industryLocked  Boolean   @default(false)    // Admin-confirmed (skip re-detection)

  // Persisted brand assets (summary — actual files in Netlify Blobs via UrlAsset)
  brandAssets     Json?     // { logo: { url, format, size }, colors: [...], fonts: [...] }
  extractedCopy   Json?     // { headline, subheadline, ctas: [], navLinks: [], bodyText }
  techStack       Json?     // { frameworks: [], cms: [], cssFrameworks: [], analytics: [] }

  // Aggregate
  analysisCount   Int       @default(0)
  lastAnalyzedAt  DateTime?
  bestScore       Int?
  latestScore     Int?

  // Customer (future Stripe)
  customerEmail   String?
  customerId      String?

  // Lifecycle
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  expiresAt       DateTime?

  // Relations
  analyses        Refresh[]
  assets          UrlAsset[]

  @@index([domain])
  @@index([industry])
  @@index([customerEmail])
  @@index([expiresAt])
}
```

### 1.2 New Model: UrlAsset

```prisma
model UrlAsset {
  id            String     @id @default(cuid())
  urlProfileId  String
  urlProfile    UrlProfile @relation(fields: [urlProfileId], references: [id], onDelete: Cascade)

  assetType     String     // "logo" | "hero_image" | "favicon" | "og_image" | "screenshot"
  fileName      String     // "logo.png"
  mimeType      String     // "image/png", "image/svg+xml", "image/jpeg"
  fileSize      Int?       // Bytes
  storageKey    String     // "profiles/{profileId}/logo.png"
  storageUrl    String?    // "/api/blob/profiles/{profileId}/logo.png"

  metadata      Json?      // Varies: { width, height, altText, dominantColor }
  sourceUrl     String?    // Original URL on the page where asset was found
  extractedAt   DateTime   @default(now())

  @@index([urlProfileId])
  @@index([urlProfileId, assetType])
}
```

### 1.3 New Model: AgentSkill

```prisma
model AgentSkill {
  id                  String    @id @default(cuid())
  agentSlug           String    @unique  // "screenshot-analysis" | "industry-seo" | "score" | "creative-modern" | "creative-classy" | "creative-unique"
  agentName           String              // "Screenshot Analysis Agent"
  category            String              // "pipeline" | "creative"
  systemPrompt        String    @db.Text
  outputSchema        Json?               // Expected output structure
  modelOverride       String?             // Override default model for this agent
  maxTokens           Int?
  temperature         Float?
  active              Boolean   @default(true)
  version             Int       @default(1)
  lastEditedBy        String?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
}
```

### 1.4 New Model: AgentSkillHistory

```prisma
model AgentSkillHistory {
  id            String    @id @default(cuid())
  agentSkillId  String
  agentSlug     String
  systemPrompt  String    @db.Text
  version       Int
  editedBy      String?
  changeNote    String?   @db.Text
  createdAt     DateTime  @default(now())

  @@index([agentSkillId])
  @@index([agentSlug, version])
}
```

### 1.5 New Model: ApiConfig

```prisma
model ApiConfig {
  id            String    @id @default(cuid())
  provider      String    // "anthropic" | "openai" | "screenshotone"
  configKey     String    // "api_key" | "default_model" | "max_tokens" | "org_id"
  configValue   String    @db.Text  // Encrypted when sensitive
  encrypted     Boolean   @default(false)
  label         String?   // "Production Key", "Backup Key"
  active        Boolean   @default(true)
  sortOrder     Int       @default(0)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@unique([provider, configKey, label])
  @@index([provider])
  @@index([provider, configKey, active])
}
```

### 1.6 New Model: Benchmark

From `docs/ENHANCEMENT-E-PEER-BENCHMARKING.md` — exact schema.

```prisma
model Benchmark {
  id               String    @id @default(cuid())
  url              String
  domain           String?
  siteName         String?
  industry         String
  screenshotUrl    String?
  overallScore     Int       @default(0)
  clarityScore     Int       @default(0)
  visualScore      Int       @default(0)
  hierarchyScore   Int       @default(0)
  trustScore       Int       @default(0)
  conversionScore  Int       @default(0)
  contentScore     Int       @default(0)
  mobileScore      Int       @default(0)
  performanceScore Int       @default(0)
  scoringDetails   Json      @default("[]")
  scored           Boolean   @default(false)
  scoredAt         DateTime?
  active           Boolean   @default(true)
  notes            BenchmarkNote[]
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@index([industry])
  @@index([industry, scored])
  @@index([industry, active])
  @@index([industry, overallScore])
}
```

### 1.7 New Model: BenchmarkNote

From `docs/ENHANCEMENT-E-PEER-BENCHMARKING.md` — exact schema.

```prisma
model BenchmarkNote {
  id          String    @id @default(cuid())
  benchmarkId String
  benchmark   Benchmark @relation(fields: [benchmarkId], references: [id], onDelete: Cascade)
  authorName  String
  content     String    @db.Text
  category    String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([benchmarkId])
}
```

### 1.8 Modify Existing: Refresh

Add these fields to the **existing** `Refresh` model. All nullable or defaulted for backward compatibility.

```prisma
  // URL Profile link (Phase 2 sets this at pipeline start)
  urlProfileId         String?
  urlProfile           UrlProfile? @relation(fields: [urlProfileId], references: [id])

  // Audit: which AgentSkill.version was used per agent at runtime
  // e.g. { "screenshot-analysis": 3, "score": 7, "creative-modern": 2 }
  skillVersions        Json?

  // Benchmark comparison (Phase 4 populates this)
  // { percentile, sampleSize, industry, industryAvg, top10Overall, dimensions[] }
  benchmarkComparison  Json?

  // Layout rationale from Creative Agents (Phase 2 writes, Phase 4 enriches)
  layout1Rationale     String   @db.Text  @default("")
  layout2Rationale     String   @db.Text  @default("")
  layout3Rationale     String   @db.Text  @default("")
```

Add this index:
```prisma
  @@index([urlProfileId])
```

**Do NOT modify or remove any existing fields or models.** Industry, Template, ScoringRubric, PromptLog, InternalNote all remain unchanged.

---

## 2. New Files

### 2.1 `lib/config/encryption.ts`

AES-256-GCM encryption for API keys stored in the database.

**Requirements:**
- Node.js built-in `crypto` only — no external dependency
- Encryption key from `process.env.API_CONFIG_ENCRYPTION_KEY`
- Throw clear error if env var missing (never silently fail or return plaintext)
- Random 12-byte IV per encryption
- Encode output as single string: `${iv_hex}:${authTag_hex}:${ciphertext_hex}`
- Derive 32-byte key from env var using `crypto.createHash('sha256').update(envVar).digest()`

**Exports:**
```typescript
export function encrypt(plaintext: string): string
export function decrypt(ciphertext: string): string
```

---

### 2.2 `lib/config/api-keys.ts`

DB-first, env-fallback API key resolution.

**Requirements:**
- Import `prisma` from `@/lib/prisma`
- Import `decrypt` from `./encryption`
- Query `ApiConfig` where `provider`, `configKey: "api_key"`, `active: true`, ordered by `sortOrder asc`
- If found and `encrypted === true`, decrypt before returning
- If not found, fall back to environment variable
- If neither, throw: `No API key configured for provider: ${provider}`

**Exports:**
```typescript
export async function getApiKey(provider: string): Promise<string>

export async function getProviderConfig(
  provider: string,
  configKey: string,
  defaultValue?: string
): Promise<string | undefined>
```

**Environment variable fallback map:**
```typescript
const ENV_MAP: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  screenshotone: "SCREENSHOTONE_API_KEY",
};
```

**Scope:** Three providers: `anthropic`, `openai`, `screenshotone`. NOT `netlify_blobs` — that stays env-only (platform config, not API key).

---

### 2.3 `lib/config/agent-skills.ts`

Read agent system prompts from DB at runtime.

**Requirements:**
- Import `prisma` from `@/lib/prisma`
- Query `AgentSkill` by `agentSlug` where `active: true`
- Throw: `No active skill found for agent: ${agentSlug}` if missing

**Exports:**
```typescript
import type { AgentSkill } from "@prisma/client";

// Full skill record
export async function getAgentSkill(agentSlug: string): Promise<AgentSkill>

// Just the system prompt string
export async function getAgentSystemPrompt(agentSlug: string): Promise<string>

// All active skills in one query (for pipeline startup — avoids 6 separate queries)
export async function getAllActiveSkills(): Promise<AgentSkill[]>
```

**Valid slugs:** `"screenshot-analysis"`, `"industry-seo"`, `"score"`, `"creative-modern"`, `"creative-classy"`, `"creative-unique"`

---

### 2.4 `lib/pipeline/url-profile.ts`

URL normalization and find-or-create.

**Requirements:**
- Import `prisma` from `@/lib/prisma`

**Exports:**
```typescript
import type { UrlProfile } from "@prisma/client";

export function normalizeUrl(rawUrl: string): string
export function extractDomain(rawUrl: string): string
export async function findOrCreateUrlProfile(rawUrl: string): Promise<UrlProfile>
```

**Normalization rules:**
1. Parse with `new URL(rawUrl)` — throw if invalid
2. Lowercase hostname
3. Strip `www.` prefix
4. Strip trailing slash from pathname (keep root as `/`)
5. Strip tracking params: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `fbclid`, `gclid`, `ref`
6. Return: `{hostname}{pathname}` — no protocol, no remaining query

**Examples:**
| Input | Output |
|---|---|
| `https://www.swag.com/` | `swag.com/` |
| `http://swag.com` | `swag.com/` |
| `https://SWAG.COM/?utm_source=google` | `swag.com/` |
| `https://swag.com/about/` | `swag.com/about` |
| `https://www.swag.com/about?ref=home` | `swag.com/about` |

**`findOrCreateUrlProfile` implementation:**
```typescript
export async function findOrCreateUrlProfile(rawUrl: string): Promise<UrlProfile> {
  const url = normalizeUrl(rawUrl);
  const domain = extractDomain(rawUrl);
  return prisma.urlProfile.upsert({
    where: { url },
    create: { url, domain },
    update: {},  // No-op if exists
  });
}
```

**Cooldown/cache contract (for Phase 2 reference — not enforced in Phase 1):**
- < 5 min since `lastAnalyzedAt`: return existing Refresh, skip new run
- 5 min – 24 hr: new run, reuse persisted assets from UrlProfile
- > 24 hr: full fresh run (re-extract assets)
- Admin can bypass all cooldowns

---

### 2.5 `lib/pipeline/asset-extraction.ts`

Extract brand assets from HTML, download actual files, upload to Netlify Blobs, write DB rows.

**Requirements:**
- Import `prisma` from `@/lib/prisma`
- Import `uploadBlob`, `profileAssetKey` from `@/lib/storage/netlify-blobs`
- Import `extractAssets` from `@/lib/scraping/asset-extractor` (reuse — do NOT duplicate color/font/copy extraction)
- Import `detectTechStack` from `@/lib/scraping/tech-detector` (reuse)
- Import `cheerio` for identifying downloadable asset URLs
- This module adds the NEW work: downloading actual image files and uploading to Blobs

**Exports:**
```typescript
import type { UrlProfile } from "@prisma/client";
import type { ExtractedAssets } from "@/lib/scraping/asset-extractor";
import type { TechStack } from "@/lib/scraping/tech-detector";

export interface StoredAsset {
  assetType: string;    // "logo" | "hero_image" | "favicon" | "og_image" | "screenshot"
  fileName: string;
  mimeType: string;
  fileSize: number;
  storageKey: string;
  storageUrl: string;
  sourceUrl: string;
}

export interface AssetExtractionResult {
  assets: ExtractedAssets;      // From existing asset-extractor (colors, fonts, images, copy, logo)
  storedAssets: StoredAsset[];  // Files downloaded + uploaded to Blobs
  techStack: TechStack;
}

export async function extractAndPersistAssets(
  urlProfile: UrlProfile,
  html: string,
  css: string,
  baseUrl: string,
  screenshotBuffer?: Buffer | null
): Promise<AssetExtractionResult>
```

**Implementation steps:**

**Step 1 — Extract metadata (reuse existing):**
```typescript
const assets = extractAssets(html, css, baseUrl);
const techStack = detectTechStack(html);
```

**Step 2 — Identify downloadable asset URLs from HTML using cheerio:**
- **Logo:** `assets.logo` from the existing extractor (already finds logo img)
- **Favicon:** `<link rel="icon">` or `<link rel="shortcut icon">` href
- **OG image:** `<meta property="og:image">` content
- **Hero image:** First `<img>` in first `<section>` or `<header>` that isn't the logo, or large `<img>` (heuristic: first image with both `width` and `height` attributes or first image in main content area)
- Resolve all URLs to absolute using the `baseUrl`
- Deduplicate — same source URL shouldn't be downloaded twice
- Skip data URIs

**Step 3 — Download files (parallel, fault-tolerant):**
- `fetch()` each URL with 10-second `AbortController` timeout
- Limit to **5 files max**
- Each download: read `Content-Type` header, compute file size from buffer
- Determine extension from Content-Type: `image/png` → `.png`, `image/jpeg` → `.jpg`, `image/svg+xml` → `.svg`, `image/x-icon` → `.ico`, `image/webp` → `.webp`, `image/gif` → `.gif`
- **Catch failures per file — non-fatal.** Log warning, continue with remaining files.

**Step 4 — Upload to Netlify Blobs:**
- Key: `profileAssetKey(urlProfile.id, assetType, extension)` → `profiles/{id}/logo.png`
- Use `uploadBlob(key, buffer, contentType)` from existing `netlify-blobs.ts`
- If `screenshotBuffer` is provided, also upload as `profiles/{id}/screenshot.webp`

**Step 5 — Save to database:**
```typescript
// Create UrlAsset rows
await prisma.urlAsset.createMany({
  data: storedAssets.map(a => ({
    urlProfileId: urlProfile.id,
    assetType: a.assetType,
    fileName: a.fileName,
    mimeType: a.mimeType,
    fileSize: a.fileSize,
    storageKey: a.storageKey,
    storageUrl: a.storageUrl,
    sourceUrl: a.sourceUrl,
  })),
});

// Update UrlProfile with brand summary
await prisma.urlProfile.update({
  where: { id: urlProfile.id },
  data: {
    brandAssets: {
      logo: storedAssets.find(a => a.assetType === "logo")?.storageUrl ?? null,
      heroImage: storedAssets.find(a => a.assetType === "hero_image")?.storageUrl ?? null,
      favicon: storedAssets.find(a => a.assetType === "favicon")?.storageUrl ?? null,
      colors: assets.colors,
      fonts: assets.fonts,
    },
    extractedCopy: assets.copy,
    techStack: techStack as object,
  },
});
```

**Error handling:** The entire `extractAndPersistAssets` function is **non-fatal**. Wrap the body in try/catch. On failure, `console.error` and return `{ assets, storedAssets: [], techStack }` with whatever was extracted before the failure. The pipeline (Phase 2) decides what's fatal — asset extraction is not.

---

### 2.6 `scripts/seed-agent-skills.ts`

Seed 6 initial agent skills. Standalone script, safe to re-run.

**Requirements:**
- Create own `PrismaClient` (not the singleton — standalone script)
- Upsert by `agentSlug`
- On update: do NOT overwrite `systemPrompt` (preserve admin edits from Skills Editor). Only update metadata: `agentName`, `category`, `temperature`, `maxTokens`, `outputSchema`.

**Agent definitions:**

```typescript
const AGENT_SKILLS = [
  {
    agentSlug: "screenshot-analysis",
    agentName: "Screenshot Analysis Agent",
    category: "pipeline",
    temperature: 0.1,
    maxTokens: 4096,
    systemPrompt: `You are the Screenshot Analysis Agent. Extract visual design tokens and structural patterns from a website screenshot and HTML.

Return ONLY valid JSON with these exact keys:

{
  "colors": {
    "primary": "#hex", "secondary": "#hex", "accent": "#hex",
    "background": "#hex", "text": "#hex", "additional": ["#hex"]
  },
  "typography": {
    "headingFont": "string", "bodyFont": "string",
    "headingSizes": ["string"], "weights": ["string"]
  },
  "layout": {
    "heroType": "string", "navStyle": "string",
    "sectionCount": number, "gridPattern": "string"
  },
  "visualDensity": number (1-10),
  "brandAssets": {
    "logoDetected": boolean, "imageryStyle": "string", "iconUsage": "string"
  },
  "qualityScore": number (1-10)
}

Do NOT make recommendations. Be purely extractive and analytical.`,
    outputSchema: {
      colors: { primary: "string", secondary: "string", accent: "string", background: "string", text: "string", additional: ["string"] },
      typography: { headingFont: "string", bodyFont: "string", headingSizes: ["string"], weights: ["string"] },
      layout: { heroType: "string", navStyle: "string", sectionCount: "number", gridPattern: "string" },
      visualDensity: "number",
      brandAssets: { logoDetected: "boolean", imageryStyle: "string", iconUsage: "string" },
      qualityScore: "number",
    },
  },
  {
    agentSlug: "industry-seo",
    agentName: "Industry & SEO Agent",
    category: "pipeline",
    temperature: 0.2,
    maxTokens: 4096,
    systemPrompt: `You are the Industry & SEO Agent. Determine the business's industry, analyze SEO health, and extract key copy/messaging.

Return ONLY valid JSON with these exact keys:

{
  "industry": {
    "name": "Exact match from allowed list",
    "confidence": 0.0-1.0,
    "reasoning": "string",
    "alternatives": [{"name": "string", "confidence": number}]
  },
  "seo": {
    "titleTag": "string|null", "metaDescription": "string|null",
    "h1Count": number, "hasCanonical": boolean,
    "hasOpenGraph": boolean, "hasStructuredData": boolean,
    "issues": ["string"], "score": number (0-100)
  },
  "copy": {
    "headline": "string|null", "valueProposition": "string|null",
    "ctas": ["string"], "toneOfVoice": "string", "navLabels": ["string"]
  }
}

Allowed industries: Accountants, Lawyers, Golf Courses, Beauty Salons, Barbershops, HOAs, Veterinary Clinics, Property Management, Funeral Homes, Daycares, Lawn Care, Insurance Agencies, Gun Clubs, Community Theatres, Dentists, Real Estate Agents, Restaurants, Fitness Studios, Auto Repair, General Contractors, General Business

If confidence < 0.7, use "General Business".`,
    outputSchema: {
      industry: { name: "string", confidence: "number", reasoning: "string", alternatives: [{ name: "string", confidence: "number" }] },
      seo: { titleTag: "string|null", metaDescription: "string|null", h1Count: "number", hasCanonical: "boolean", hasOpenGraph: "boolean", hasStructuredData: "boolean", issues: ["string"], score: "number" },
      copy: { headline: "string|null", valueProposition: "string|null", ctas: ["string"], toneOfVoice: "string", navLabels: ["string"] },
    },
  },
  {
    agentSlug: "score",
    agentName: "Score Agent",
    category: "pipeline",
    temperature: 0.3,
    maxTokens: 8192,
    systemPrompt: `You are the Score Agent. You receive outputs from the Screenshot Analysis Agent and Industry & SEO Agent, plus optional benchmark data.

Score the website across 8 dimensions (0-100 each): clarity, visual, hierarchy, trust, conversion, content, mobile, performance.

Produce a creative brief for 3 Creative Agents. The brief is IDENTICAL for all 3 — they differentiate through style, not instructions.

Benchmark handling:
- 3+ benchmarks: Full gap analysis ("Trust is 23 points below industry avg of 68")
- 1-2 benchmarks: Directional guidance ("Limited industry data — using general best practices")
- 0 benchmarks: Absolute scoring with general industry knowledge

Return ONLY valid JSON:
{
  "scores": { "overall": number, "clarity": number, "visual": number, "hierarchy": number, "trust": number, "conversion": number, "content": number, "mobile": number, "performance": number },
  "scoringDetails": [{ "dimension": "string", "score": number, "issues": ["string"], "recommendations": ["string"] }],
  "benchmark": { "hasData": boolean, "percentile": number|null, "dimensionComparisons": object|null },
  "creativeBrief": {
    "priorities": [{ "dimension": "string", "userScore": number, "industryAvg": number|null, "gap": number|null, "priority": number, "guidance": "string" }],
    "strengths": ["string"],
    "industryRequirements": ["string"],
    "contentDirection": "string",
    "technicalRequirements": ["string"]
  }
}`,
    outputSchema: {
      scores: { overall: "number", clarity: "number", visual: "number", hierarchy: "number", trust: "number", conversion: "number", content: "number", mobile: "number", performance: "number" },
      scoringDetails: [{ dimension: "string", score: "number", issues: ["string"], recommendations: ["string"] }],
      benchmark: { hasData: "boolean", percentile: "number|null", dimensionComparisons: "object|null" },
      creativeBrief: { priorities: [{ dimension: "string", userScore: "number", industryAvg: "number|null", gap: "number|null", priority: "number", guidance: "string" }], strengths: ["string"], industryRequirements: ["string"], contentDirection: "string", technicalRequirements: ["string"] },
    },
  },
  {
    agentSlug: "creative-modern",
    agentName: "Creative Agent — Modern",
    category: "creative",
    temperature: 0.7,
    maxTokens: 16384,
    systemPrompt: `You are the Modern Creative Agent.

Style identity:
- Clean, minimalist layouts with generous whitespace
- Bold typography, asymmetric grids
- Gradient accents, glassmorphism, subtle animation references
- Tech-forward, startup aesthetic — dark mode friendly
- Inspiration: Linear, Vercel, Stripe

Design principles:
- Less is more — remove visual clutter
- Typography does the heavy lifting
- Full-bleed hero sections
- Card-based content organization

You receive a creative brief and REAL brand assets (logo URL, hex colors, font names, extracted copy, nav links). You MUST:
1. Generate a complete, self-contained HTML page using Tailwind CSS via CDN
2. Use REAL brand assets — embed actual /api/blob/ URLs for logo and images, actual hex colors, actual copy
3. Do NOT use placeholders — if an asset is missing, omit that element gracefully
4. Respect the creative brief priorities (e.g. if Trust is #1, prominently feature trust elements)
5. Ensure responsive design (mobile + desktop)

Return ONLY valid JSON:
{ "html": "<!DOCTYPE html>...", "rationale": "Explanation of key design decisions referencing the brief" }`,
    outputSchema: { html: "string", rationale: "string" },
  },
  {
    agentSlug: "creative-classy",
    agentName: "Creative Agent — Classy",
    category: "creative",
    temperature: 0.6,
    maxTokens: 16384,
    systemPrompt: `You are the Classy Creative Agent.

Style identity:
- Refined, established, professional
- Balanced symmetrical layouts
- Serif + sans-serif font pairings
- Muted color palettes with gold/navy/charcoal accents
- High-quality imagery with overlays
- Inspiration: McKinsey, Rolex, top law firms

Design principles:
- Hierarchy through typography scale and weight
- Ample padding and structured grid
- Social proof and credentials prominently featured
- Conservative use of color — elegance through restraint
- Trust-first layout (testimonials, awards, certifications above fold)

You receive a creative brief and REAL brand assets (logo URL, hex colors, font names, extracted copy, nav links). You MUST:
1. Generate a complete, self-contained HTML page using Tailwind CSS via CDN
2. Use REAL brand assets — embed actual /api/blob/ URLs for logo and images, actual hex colors, actual copy
3. Do NOT use placeholders — if an asset is missing, omit that element gracefully
4. Respect the creative brief priorities (e.g. if Trust is #1, prominently feature trust elements)
5. Ensure responsive design (mobile + desktop)

Return ONLY valid JSON:
{ "html": "<!DOCTYPE html>...", "rationale": "Explanation of key design decisions referencing the brief" }`,
    outputSchema: { html: "string", rationale: "string" },
  },
  {
    agentSlug: "creative-unique",
    agentName: "Creative Agent — Unique",
    category: "creative",
    temperature: 0.9,
    maxTokens: 16384,
    systemPrompt: `You are the Unique Creative Agent.

Style identity:
- Breaks conventions for the industry
- Custom illustration and icon system references
- Unexpected color combinations
- Creative scroll interaction references
- Personality-driven copy integration
- Inspiration: Mailchimp, Notion, Figma

Design principles:
- Stand out from competitors — avoid industry cliches
- Custom visual language over stock imagery
- Playful but purposeful
- Strong brand voice integrated into layout
- Memorable first impression

You receive a creative brief and REAL brand assets (logo URL, hex colors, font names, extracted copy, nav links). You MUST:
1. Generate a complete, self-contained HTML page using Tailwind CSS via CDN
2. Use REAL brand assets — embed actual /api/blob/ URLs for logo and images, actual hex colors, actual copy
3. Do NOT use placeholders — if an asset is missing, omit that element gracefully
4. Respect the creative brief priorities (e.g. if Trust is #1, prominently feature trust elements)
5. Ensure responsive design (mobile + desktop)

Return ONLY valid JSON:
{ "html": "<!DOCTYPE html>...", "rationale": "Explanation of key design decisions referencing the brief" }`,
    outputSchema: { html: "string", rationale: "string" },
  },
];
```

**Script structure:**
```typescript
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding agent skills...");
  for (const skill of AGENT_SKILLS) {
    await prisma.agentSkill.upsert({
      where: { agentSlug: skill.agentSlug },
      create: {
        agentSlug: skill.agentSlug,
        agentName: skill.agentName,
        category: skill.category,
        systemPrompt: skill.systemPrompt,
        outputSchema: skill.outputSchema as object,
        temperature: skill.temperature,
        maxTokens: skill.maxTokens,
      },
      update: {
        // Do NOT overwrite systemPrompt — preserve admin edits
        agentName: skill.agentName,
        category: skill.category,
        temperature: skill.temperature,
        maxTokens: skill.maxTokens,
        outputSchema: skill.outputSchema as object,
      },
    });
    console.log(`  Upserted: ${skill.agentSlug}`);
  }
  console.log(`Seeded ${AGENT_SKILLS.length} agent skills.`);
}

main()
  .catch((e) => { console.error("Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

**Run:** `npx tsx scripts/seed-agent-skills.ts`

---

## 3. Files to Modify

### 3.1 `prisma/schema.prisma`

Add all models from Section 1 (UrlProfile, UrlAsset, AgentSkill, AgentSkillHistory, ApiConfig, Benchmark, BenchmarkNote). Add fields + index to Refresh per Section 1.8. Do NOT modify or remove any existing models or fields.

### 3.2 `.env.example`

Add after the existing `ADMIN_SECRET` line:

```bash
# Encryption key for API keys stored in database (lib/config/encryption.ts)
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
API_CONFIG_ENCRYPTION_KEY="your-64-char-hex-string"
```

### 3.3 `lib/storage/netlify-blobs.ts`

Add one helper function after the existing `screenshotKey`:

```typescript
/**
 * Generate a blob key for a URL profile asset.
 * Pattern: profiles/{profileId}/{assetType}.{ext}
 */
export function profileAssetKey(profileId: string, assetType: string, extension: string): string {
  return `profiles/${profileId}/${assetType}.${extension}`;
}
```

No other changes. The existing `uploadBlob` handles arbitrary keys and content types.

### 3.4 `app/api/blob/[key]/route.ts`

Extend `contentTypeForKey` to support asset types beyond screenshots:

```typescript
function contentTypeForKey(decodedKey: string): string {
  if (decodedKey.endsWith(".webp")) return "image/webp";
  if (decodedKey.endsWith(".png")) return "image/png";
  if (decodedKey.endsWith(".jpg") || decodedKey.endsWith(".jpeg")) return "image/jpeg";
  if (decodedKey.endsWith(".svg")) return "image/svg+xml";
  if (decodedKey.endsWith(".ico")) return "image/x-icon";
  if (decodedKey.endsWith(".gif")) return "image/gif";
  if (decodedKey.endsWith(".woff")) return "font/woff";
  if (decodedKey.endsWith(".woff2")) return "font/woff2";
  return "application/octet-stream";
}
```

### 3.5 `package.json`

Add to `scripts`:
```json
"db:seed-skills": "tsx scripts/seed-agent-skills.ts"
```

---

## 4. No New Dependencies

All code uses packages already in `package.json`:
- `crypto` — Node.js built-in
- `cheerio` — `^1.2.0` (installed)
- `@prisma/client` — `^6.0.0` (installed)
- `@netlify/blobs` — `^10.6.0` (installed)

---

## 5. Migration & Seed Sequence

```bash
# 1. Generate migration
npx prisma migrate dev --name add_foundation_models

# 2. Generate client types
npx prisma generate

# 3. Seed agent skills (6 rows)
npx tsx scripts/seed-agent-skills.ts

# 4. Verify in Prisma Studio
npx prisma studio
# Check: UrlProfile, UrlAsset, AgentSkill (6 rows), AgentSkillHistory,
#         ApiConfig, Benchmark, BenchmarkNote tables exist
# Check: Refresh table has new columns (urlProfileId, skillVersions,
#         benchmarkComparison, layout1Rationale, layout2Rationale, layout3Rationale)
# Check: Existing Refresh data is intact
```

---

## 6. Testing Checklist

### Schema & Migration
- [ ] `npx prisma migrate dev` runs clean — no errors
- [ ] `npx prisma generate` produces client with all new types (`UrlProfile`, `UrlAsset`, `AgentSkill`, etc.)
- [ ] All 8 new tables visible in Prisma Studio
- [ ] Existing tables unchanged (Refresh, Industry, Template, PromptLog, InternalNote, ScoringRubric)
- [ ] Existing Refresh data preserved — no data loss, new fields are null/empty

### Seed
- [ ] `npx tsx scripts/seed-agent-skills.ts` creates 6 AgentSkill rows
- [ ] Re-running is idempotent — no duplicates, no prompt overwrites
- [ ] Each skill: correct `agentSlug`, `category`, `temperature`, `maxTokens`

### Encryption (`lib/config/encryption.ts`)
- [ ] `encrypt("test-key-123")` returns string in `iv:tag:ciphertext` hex format
- [ ] `decrypt(encrypt("test-key-123"))` returns `"test-key-123"`
- [ ] `decrypt("tampered:data:here")` throws
- [ ] Missing `API_CONFIG_ENCRYPTION_KEY` env var throws clear error

### API Keys (`lib/config/api-keys.ts`)
- [ ] `getApiKey("anthropic")` returns `process.env.ANTHROPIC_API_KEY` when no DB config exists
- [ ] `getApiKey("nonexistent_provider")` throws with descriptive message
- [ ] `getProviderConfig("anthropic", "default_model", "claude-sonnet-4-20250514")` returns default when no DB row

### Agent Skills (`lib/config/agent-skills.ts`)
- [ ] `getAgentSkill("screenshot-analysis")` returns seeded skill with correct fields
- [ ] `getAgentSkill("nonexistent")` throws descriptive error
- [ ] `getAllActiveSkills()` returns all 6 skills
- [ ] `getAgentSystemPrompt("score")` returns system prompt string

### URL Profile (`lib/pipeline/url-profile.ts`)
- [ ] `normalizeUrl("https://www.SWAG.COM/?utm_source=google")` → `"swag.com/"`
- [ ] `normalizeUrl("https://swag.com/about/")` → `"swag.com/about"`
- [ ] `normalizeUrl("http://swag.com")` → `"swag.com/"`
- [ ] `normalizeUrl("not-a-url")` throws
- [ ] `extractDomain("https://www.example.com/path")` → `"example.com"`
- [ ] `findOrCreateUrlProfile("https://swag.com")` creates profile on first call
- [ ] Second call with same URL returns same profile (no duplicate)
- [ ] Different path creates different profile (`swag.com/` vs `swag.com/about`)

### Asset Extraction (`lib/pipeline/asset-extraction.ts`)
- [ ] Given HTML with `<img>` tags: identifies downloadable asset URLs
- [ ] Downloads files, uploads to Netlify Blobs (or data URLs in local dev)
- [ ] Creates UrlAsset rows in DB
- [ ] Updates UrlProfile.brandAssets, extractedCopy, techStack
- [ ] Handles fetch timeout gracefully (logs, continues)
- [ ] Handles HTML with zero images (returns empty storedAssets, no crash)
- [ ] Screenshot buffer uploads as `profiles/{id}/screenshot.webp`

### Blob Route (`app/api/blob/[key]/route.ts`)
- [ ] `.jpg` served as `image/jpeg`
- [ ] `.svg` served as `image/svg+xml`
- [ ] `.ico` served as `image/x-icon`
- [ ] `.woff2` served as `font/woff2`
- [ ] Existing `.webp` and `.png` still work

### Build & Live App
- [ ] `npm run build` succeeds — no TypeScript or lint errors
- [ ] **Existing pipeline works end-to-end** — submit a URL on the home page, get results
- [ ] No regressions on results page, admin page, or any API routes

---

## 7. File Summary

### New Files (6)

| File | Purpose |
|---|---|
| `lib/config/encryption.ts` | AES-256-GCM encrypt/decrypt for DB-stored API keys |
| `lib/config/api-keys.ts` | DB-first, env-fallback API key resolution |
| `lib/config/agent-skills.ts` | Read agent prompts/config from DB at runtime |
| `lib/pipeline/url-profile.ts` | URL normalization, find-or-create UrlProfile |
| `lib/pipeline/asset-extraction.ts` | Extract + download + store brand assets in Blobs |
| `scripts/seed-agent-skills.ts` | Seed 6 agent skill records |

### Modified Files (5)

| File | Change |
|---|---|
| `prisma/schema.prisma` | 7 new models + Refresh modifications |
| `.env.example` | Add `API_CONFIG_ENCRYPTION_KEY` |
| `lib/storage/netlify-blobs.ts` | Add `profileAssetKey()` helper |
| `app/api/blob/[key]/route.ts` | Extend `contentTypeForKey()` for jpg/svg/ico/woff/woff2 |
| `package.json` | Add `db:seed-skills` script |

### Do NOT Touch

| Path | Reason |
|---|---|
| `lib/pipeline/analyze.ts` | Phase 2 — pipeline refactor |
| `lib/ai/*` | Phase 2 — agent integration |
| `lib/templates/*` | Phase 2 — retired |
| `lib/scoring/*` | Phase 2 — replaced by Score Agent |
| `app/admin/*` | Phase 3 — admin tooling |
| `app/results/*` | Phase 2/4 — results display |
| `app/page.tsx` | Phase 2 — SSE updates |
| `components/*` | Phase 3/4 — UI changes |

---

## 8. Phase 2 Forward References

These decisions are documented here so Phase 2 knows what to expect. **Phase 1 does not implement these — it only builds the foundation they depend on.**

| Topic | Decision |
|---|---|
| Refresh create timing | Keep early create (for PromptLog). Set `urlProfileId` at create after Step 0. |
| SSE progress steps | New union: `analyzing` \| `scoring` \| `generating` \| `done` |
| PromptLog step names | `screenshot_analysis`, `industry_seo`, `score`, `creative_modern`, `creative_classy`, `creative_unique` |
| Partial layout success | If 2/3 Creative Agents succeed, show 2 layouts. Results page already filters empty layouts (line 151). |
| Template path | Retired. Remove all template/copy-refresh branches from analyze.ts. Keep files for reference. |
| OpenAI | Disconnected from pipeline. Keep `lib/ai/openai.ts` for future use. All pipeline calls use Claude Sonnet. |
| Cooldown enforcement | `< 5 min` → return existing Refresh. `5 min–24 hr` → new run, reuse assets. `> 24 hr` → full fresh. Admin bypasses. |
