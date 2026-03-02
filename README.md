# pagerefresh.ai

**"Paste your website and get a $50,000 quality refresh in 5 minutes. Pay only if you love it."**

AI-powered website analysis and redesign tool for SMB businesses. Scores any homepage across 8 quality dimensions (0-100), then generates 3 distinct redesign options using AI Creative Agents with the site's real brand assets.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS, shadcn/ui (Radix UI) |
| Database | PostgreSQL on AWS RDS, Prisma 6 |
| Storage | AWS S3 (screenshots, brand assets) |
| AI | Anthropic Claude Sonnet 4 (all pipeline calls) |
| Rate Limiting | Upstash Redis (production), in-memory sliding window (dev) |
| Hosting | Vercel (Cleveland `cle1`, 300s function timeout) |

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment variables and fill in values
cp .env.example .env.local

# Run database migrations and seed data
npm run db:migrate
npm run db:seed
npm run db:seed-skills

# Start dev server (uses Turbopack)
npm run dev
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (with `?connection_limit=1&connect_timeout=10` for serverless) |
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `AWS_S3_BUCKET` | Yes | S3 bucket name (e.g. `pagerefresh-assets`) |
| `AWS_REGION` | Yes | AWS region (e.g. `us-east-2`) |
| `AWS_ACCESS_KEY_ID` | Yes | AWS IAM access key |
| `AWS_SECRET_ACCESS_KEY` | Yes | AWS IAM secret key |
| `NEXT_PUBLIC_APP_URL` | Yes | App URL (e.g. `http://localhost:3000`) |
| `ADMIN_SECRET` | Yes | Shared secret for `/admin` gate (min 32 chars) |
| `API_CONFIG_ENCRYPTION_KEY` | Yes | 64-char hex string for encrypting DB-stored API keys. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `KV_REST_API_URL` | No | Upstash Redis URL for distributed rate limiting (falls back to in-memory) |
| `KV_REST_API_TOKEN` | No | Upstash Redis token (or use `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`) |
| `SCREENSHOTONE_API_KEY` | No | Cloud screenshot service. Falls back to HTML-only analysis if unset. |
| `OPENAI_API_KEY` | No | Reserved for future use (disconnected from pipeline) |

S3 is optional for local dev — when unconfigured, assets fall back to data URIs.

## Architecture

### Analysis Pipeline

The pipeline runs 6 AI calls across 4 steps plus finalization:

```
Step 0: URL normalization, UrlProfile find-or-create, cooldown check (30 days default, admin-configurable)
        Create Refresh record (so client has an ID for recovery)
        HTML fetch + cloud screenshot (parallel)
        CMS auto-detection, external CSS fetch

Step 1: 3 parallel operations
        - Screenshot Analysis Agent   [1 Claude call — vision + HTML → design tokens]
        - Industry & SEO Agent        [1 Claude call — industry, SEO audit, copy]
        - Asset extraction + S3 upload (no AI — colors, fonts, images, logo)
        Emit SSE tokens: structure → seo → colors → fonts → industry

Step 2: Score Agent                    [1 Claude call]
        Receives Step 1 outputs + benchmark data from DB
        Produces 8-dimension scores + creative brief
        Emit SSE token: scores (overall, top/bottom dimensions)

Step 3: 3 Creative Agents (parallel, 3s stagger between launches)
        - Creative Agent Modern        [1 Claude call]
        - Creative Agent Classy        [1 Claude call]
        - Creative Agent Unique        [1 Claude call]
        Each layout persisted to DB immediately on completion
        Emit SSE token: layouts (incremental, as each finishes)

Step 4: Finalize — compress + upload screenshot to S3
        Update Refresh status → complete, record processingTime
        Update UrlProfile (analysisCount, latestScore, bestScore)
```

Progress is streamed to the client via Server-Sent Events (SSE) with steps: `started` → `analyzing` → `token` (structure, seo, colors, fonts, industry, scores, layouts) → `scoring` → `generating` → `done`. A `retry` event is emitted if an agent retries after a transient failure.

Creative agents run in parallel with a 3-second stagger between launches to avoid overwhelming the Anthropic API (429/529 rate limits). Each layout is persisted to the database immediately on completion and the client is notified via SSE tokens.

### SSE Recovery

If the SSE connection drops (common on mobile WebKit), the client falls back to polling `GET /api/analyze/[id]/status` every 3 seconds. The polling endpoint returns the current pipeline status and layout count. Once all 3 layouts are present (or 90 seconds elapse), the client redirects to the results page.

### Agent System

6 agents power the pipeline, split into two categories:

**Pipeline agents** (extract and score):
- **Screenshot Analysis** — extracts visual design tokens (colors, typography, layout patterns) from screenshot + HTML
- **Industry & SEO** — detects industry, audits SEO health, extracts key copy/messaging
- **Score** — scores 8 dimensions (0-100), produces creative brief for layout generation

**Creative agents** (generate layouts):
- **Modern** — clean, minimalist, tech-forward aesthetic
- **Classy** — refined, professional, trust-first layout
- **Unique** — breaks industry conventions, personality-driven

All agent system prompts are stored in the `AgentSkill` database table and editable via the admin Skills Editor — no redeployment needed. Each edit auto-increments the version and archives the previous prompt for rollback.

Creative agents output HTML wrapped in XML tags (`<layout_html>` / `<rationale>`), which is more reliable than JSON-encoded HTML for avoiding parse failures. A leak detection scanner checks generated HTML for accidentally included scoring data before persisting.

### Database Models

| Model | Purpose |
|---|---|
| `Refresh` | Single analysis run — scores, layouts, assets, SEO audit, lead capture |
| `UrlProfile` | Persistent URL data across analyses (brand assets, score history, CMS, customer email) |
| `UrlAsset` | Downloaded brand assets stored in S3 (logo, hero images) |
| `AgentSkill` | Configurable AI agent prompts with versioning |
| `AgentSkillHistory` | Agent prompt version history (rollback support) |
| `ApiConfig` | DB-stored API keys with AES-256-GCM encryption |
| `AppSetting` | Key-value app settings (e.g. analysis cooldown duration) |
| `Benchmark` | Competitor sites scored for industry comparison |
| `BenchmarkNote` | Admin notes on benchmarks |
| `Industry` | 21 industries with dimension-specific scoring criteria |
| `Template` | Legacy template definitions (retained, not used by pipeline) |
| `ScoringRubric` | Scoring criteria per dimension per score range |
| `PromptLog` | Full prompt/response audit trail for every AI call |
| `InternalNote` | Admin notes on individual analyses |

### Scoring System

Every homepage is scored 0-100 across 8 universal quality dimensions:

1. **Clarity** — What is it, who is it for, what do I do?
2. **Visual Quality** — Modern, intentional, trustworthy
3. **Information Hierarchy** — Logical flow, scannable
4. **Trust & Credibility** — Social proof, legitimacy signals
5. **Conversion & Actionability** — Easy next step, clear CTA
6. **Content Quality** — Written for humans, no buzzwords
7. **Mobile Experience** — Designed for phones
8. **Performance & Technical** — Fast, secure, not broken

When 3+ scored benchmarks exist for the detected industry, the Score Agent provides gap analysis with percentiles and dimension-level comparisons against industry averages and top-10% thresholds.

## Key Routes

### Public

| Route | Description |
|---|---|
| `POST /api/analyze` | Start analysis (SSE progress stream) |
| `POST /api/analyze/preflight` | Validate URL reachability before analysis |
| `GET /api/analyze/[id]` | Get analysis results |
| `GET /api/analyze/[id]/status` | Polling status + layout count (SSE recovery) |
| `GET /api/blob/[key]` | Serve S3 assets via signed URL redirect |
| `POST /api/export` | Export layout as downloadable ZIP (HTML, WordPress, Squarespace, Wix) |
| `POST /api/email-scores` | Capture email for score delivery |
| `POST /api/request-quote` | Submit quote request (lead capture) |
| `POST /api/request-install` | Submit install request (lead capture) |
| `POST /api/checkout` | Stripe checkout (stub — not yet live) |
| `/` | Landing page with URL input |
| `/results/[id]` | Public results page (token-gated) |

### Admin

| Route | Description |
|---|---|
| `/admin` | Analyses list with pagination |
| `/admin/analysis/[id]` | Analysis detail — prompt logs, notes, score breakdown |
| `/admin/settings` | General settings, API key management, Agent Skills Editor |
| `/admin/benchmarks` | Benchmark list — add URLs, score, filter by industry |
| `/admin/benchmark/[id]` | Benchmark detail — scores, notes |
| `/admin/profile/[id]` | URL Profile — brand assets, analysis history, score trend, cooldown reset |

## Project Structure

```
app/
  page.tsx              Landing page with URL input + SSE progress
  api/analyze/          Main analysis endpoint (SSE) + preflight + polling status
  api/admin/            Admin API routes (auth, settings, skills, configs, benchmarks, profiles)
  api/blob/[key]/       S3 signed URL redirect for assets
  api/export/           Layout export (multi-platform ZIP)
  api/email-scores/     Email capture
  api/checkout/         Stripe checkout stub
  api/request-quote/    Lead capture
  api/request-install/  Lead capture
  results/[id]/         Public results page
  admin/                Admin dashboard, settings, benchmarks, analysis detail, profiles
components/             UI components (score breakdown, layout cards, forms, admin)
lib/
  pipeline/
    analyze.ts          Main pipeline orchestration (Steps 0-4)
    agents/             Individual agent runners (screenshot, industry-seo, score, creative)
    url-profile.ts      URL normalization + UrlProfile management
    asset-extraction.ts Asset download + S3 upload
    cms-detect.ts       CMS auto-detection from HTML signatures
  ai/                   Claude client, retry logic, prompt logging, JSON repair, token estimation
  config/               API key resolution (DB-first, env-fallback), encryption, agent skills, app settings
  exports/              Platform exporters (HTML, WordPress, Squarespace, Wix)
  scoring/              Scoring utilities
  scraping/             HTML fetch, CSS extraction, asset extraction, tech detection, cloud screenshot
  storage/
    blobs.ts            Storage abstraction (uploadBlob, screenshotKey, profileAssetKey)
    s3.ts               AWS S3 implementation (upload, signed URLs)
  admin-auth.ts         Cookie-based admin authentication
  rate-limiter.ts       Upstash Redis / in-memory sliding window rate limiter
  prisma.ts             Prisma singleton
prisma/
  schema.prisma         14 models
  seed.ts               Industries, scoring rubric, app settings
scripts/
  seed-agent-skills.ts  Seed 6 agent skills
  seed-benchmarks.ts    Seed benchmark URLs by industry
```

## npm Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build (`prisma generate && next build`) |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:migrate` | Run pending migrations |
| `npm run db:push` | Push schema changes (no migration file) |
| `npm run db:seed` | Seed industries, scoring rubric, app settings |
| `npm run db:seed-skills` | Seed 6 agent skills |
| `npm run db:seed-benchmarks` | Seed benchmark URLs by industry |
| `npm run db:studio` | Open Prisma Studio |

## Documentation

| File | Description |
|---|---|
| `MANUAL-TASKS.md` | Owner action items — env vars, seeding, benchmark curation, monitoring, costs |
| `docs/ENHANCEMENT-E-PEER-BENCHMARKING.md` | Feature spec for peer benchmarking system |
| `docs/INCIDENT-CREATIVE-LAYOUTS.md` | Incident report on creative agent failures — root causes, fixes, follow-up |
| `docs/SESSION-2026-02-25-CREATIVE-AGENTS-AND-DEPLOYMENT.md` | Session notes on XML output format and Vercel deployment |
