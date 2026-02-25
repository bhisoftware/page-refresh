# pagerefresh.ai

**"Paste your website and get a $50,000 quality refresh in 5 minutes. Pay only if you love it."**

AI-powered website analysis and redesign tool for SMB businesses. Scores any homepage across 8 quality dimensions (0-100), then generates 3 distinct redesign options using AI Creative Agents with the site's real brand assets.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS, shadcn/ui |
| Database | PostgreSQL on AWS RDS, Prisma 6 |
| Storage | AWS S3 (screenshots, brand assets) |
| AI | Anthropic Claude Sonnet (all pipeline calls) |
| Hosting | Vercel |

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
| `SCREENSHOTONE_API_KEY` | No | Cloud screenshot service. Falls back to HTML-only analysis if unset. |
| `OPENAI_API_KEY` | No | Reserved for future use (disconnected from pipeline) |

S3 is optional for local dev — when unconfigured, assets fall back to data URIs.

## Architecture

### Analysis Pipeline

The pipeline runs 6 AI calls across 4 sequential windows (~75s total):

```
Step 0: URL normalization, UrlProfile find-or-create
        HTML fetch + cloud screenshot (parallel)
        Create preliminary Refresh record

Step 1: 3 parallel operations
        - Screenshot Analysis Agent   [1 Claude call]
        - Industry & SEO Agent        [1 Claude call]
        - Asset extraction + S3 upload (no AI)

Step 2: Score Agent                    [1 Claude call]
        Receives Step 1 outputs + benchmark data from DB

Step 3: 3 Creative Agents (sequential, 2s delay between each)
        - Creative Agent Modern        [1 Claude call]
        - Creative Agent Classy        [1 Claude call]
        - Creative Agent Unique        [1 Claude call]

Step 4: Save scores, layouts, rationale to Refresh
        Update UrlProfile (analysisCount, latestScore, lastAnalyzedAt)
```

Progress is streamed to the client via Server-Sent Events (SSE) with steps: `started` → `analyzing` → `scoring` → `generating` → `done`.

Creative agents run sequentially (not parallel) with a 2-second delay between calls to avoid Anthropic rate limits (429s). Each agent's progress is emitted to keep the SSE stream alive within Vercel's idle timeout.

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

Creative agents output HTML wrapped in XML tags (`<layout_html>` / `<rationale>`), which is more reliable than JSON-encoded HTML for avoiding parse failures.

### Database Models

| Model | Purpose |
|---|---|
| `Refresh` | Single analysis run — scores, layouts, assets, SEO audit |
| `UrlProfile` | Persistent URL data across analyses (brand assets, score history) |
| `UrlAsset` | Downloaded brand assets stored in S3 |
| `AgentSkill` | Configurable AI agent prompts with versioning |
| `AgentSkillHistory` | Agent prompt version history (rollback support) |
| `ApiConfig` | DB-stored API keys with AES-256-GCM encryption |
| `Benchmark` | Competitor sites scored for industry comparison |
| `BenchmarkNote` | Admin notes on benchmarks |
| `Industry` | 21 industries with dimension-specific scoring criteria |
| `Template` | Legacy template definitions (retained for reference) |
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
| `POST /api/analyze/preflight` | Validate URL before analysis |
| `GET /api/analyze/[id]` | Get analysis status/results |
| `GET /api/blob/[key]` | Serve S3 assets via signed URL redirect |
| `GET /api/export` | Export analysis as downloadable archive |
| `POST /api/request-quote` | Submit quote request (lead capture) |
| `POST /api/request-install` | Submit install request (lead capture) |
| `/` | Landing page with URL input |
| `/results/[id]` | Public results page |

### Admin

| Route | Description |
|---|---|
| `/admin` | Analyses list with pagination |
| `/admin/analysis/[id]` | Analysis detail — prompt logs, notes, score breakdown |
| `/admin/settings` | API key management + Agent Skills Editor |
| `/admin/benchmarks` | Benchmark list — add URLs, score, filter by industry |
| `/admin/benchmark/[id]` | Benchmark detail — scores, notes |
| `/admin/profile/[id]` | URL Profile — brand assets, analysis history, score trend |

## Project Structure

```
app/
  page.tsx              Landing page with URL input
  api/analyze/          Main analysis endpoint (SSE) + preflight
  api/admin/            Admin API routes (settings, skills, configs, benchmarks, profiles)
  api/blob/[key]/       S3 signed URL redirect for assets
  api/export/           Analysis export
  api/request-quote/    Lead capture
  api/request-install/  Lead capture
  results/[id]/         Public results page
  admin/                Admin dashboard, settings, benchmarks, analysis detail, profiles
components/             UI components (score breakdown, layout cards, forms, admin)
lib/
  pipeline/
    analyze.ts          Main pipeline orchestration (5-step agent flow)
    agents/             Individual agent runners (screenshot, industry-seo, score, creative)
    url-profile.ts      URL normalization + UrlProfile management
    asset-extraction.ts Asset download + S3 upload
  ai/                   Claude client, retry logic, prompt logging, JSON repair, token estimation
  config/               API key resolution (DB-first, env-fallback), encryption, agent skill loading
  scoring/              Scoring engine
  scraping/             HTML fetch, CSS extraction, asset extraction, tech detection, cloud screenshot
  templates/            Legacy template system (retained, disconnected from pipeline)
  storage/
    blobs.ts            Storage abstraction (uploadBlob, screenshotKey, profileAssetKey)
    s3.ts               AWS S3 implementation (upload, signed URLs)
prisma/
  schema.prisma         13 models
  seed.ts               Industries, templates, scoring rubric
scripts/
  seed-agent-skills.ts  Seed 6 agent skills
  seed-benchmarks.ts    Seed benchmark URLs by industry
```

## npm Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:migrate` | Run pending migrations |
| `npm run db:push` | Push schema changes (no migration file) |
| `npm run db:seed` | Seed industries, templates, scoring rubric |
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
