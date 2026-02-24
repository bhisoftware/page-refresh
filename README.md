# pagerefresh.ai

**"Paste your website and get a $50,000 quality refresh in 5 minutes. Pay only if you love it."**

AI-powered website analysis and redesign tool for SMB businesses. Scores any homepage across 8 quality dimensions (0-100), then generates 3 distinct redesign options using AI Creative Agents with the site's real brand assets.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS, shadcn/ui |
| Database | PostgreSQL on AWS RDS, Prisma 6 |
| Storage | Netlify Blobs (screenshots, brand assets) |
| AI | Anthropic Claude Sonnet (all pipeline calls) |
| Hosting | Netlify with `@netlify/plugin-nextjs` |

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
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `NETLIFY_BLOBS_TOKEN` | Yes | Netlify Blobs access token |
| `NEXT_PUBLIC_APP_URL` | Yes | App URL (e.g. `http://localhost:3000`) |
| `ADMIN_SECRET` | Yes | Shared secret for `/admin` gate |
| `API_CONFIG_ENCRYPTION_KEY` | Yes | 64-char hex for encrypting DB-stored API keys |
| `SCREENSHOTONE_API_KEY` | No | Cloud screenshot service (falls back to HTML analysis) |
| `OPENAI_API_KEY` | No | Reserved for future use (disconnected from pipeline) |

## Architecture

### Analysis Pipeline

The pipeline runs 6 AI calls in 3 sequential windows (~75s total):

```
Step 0: URL normalization + UrlProfile find-or-create + HTML fetch + screenshot
        (parallel)

Step 1: Promise.all (3 parallel)
        - Screenshot Analysis Agent   [1 Claude call]
        - Industry & SEO Agent        [1 Claude call]
        - Asset extraction + Blob upload (no AI)

Step 2: Score Agent                    [1 Claude call]
        (receives Step 1 outputs + benchmark data)

Step 3: Promise.all (3 parallel)
        - Creative Agent Modern        [1 Claude call]
        - Creative Agent Classy        [1 Claude call]
        - Creative Agent Unique        [1 Claude call]

Step 4: Save results to Refresh + update UrlProfile
```

All agent system prompts are stored in the `AgentSkill` database table and editable via the admin Skills Editor — no redeployment needed.

### Database Models

| Model | Purpose |
|---|---|
| `Refresh` | Single analysis run — scores, layouts, assets, SEO audit |
| `UrlProfile` | Persistent URL data across analyses (brand assets, score history) |
| `UrlAsset` | Downloaded brand assets stored in Netlify Blobs |
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

When 3+ scored benchmarks exist for the detected industry, the Score Agent provides gap analysis with percentiles and dimension-level comparisons.

## Key Routes

| Route | Description |
|---|---|
| `POST /api/analyze` | Start analysis (SSE progress stream) |
| `GET /api/analyze/[id]` | Get analysis status/results |
| `POST /api/analyze/preflight` | Validate URL before analysis |
| `/results/[id]` | Public results page |
| `/admin` | Admin dashboard (analyses list with pagination) |
| `/admin/settings` | API key management + Agent Skills Editor |
| `/admin/benchmarks` | Benchmark CRUD + scoring |
| `/admin/analysis/[id]` | Analysis detail with prompt logs + notes |
| `/admin/profile/[id]` | URL Profile detail with brand assets + history |

## Project Structure

```
app/
  api/analyze/          Main analysis endpoint (SSE)
  api/admin/            Admin API routes (settings, skills, configs, benchmarks)
  api/blob/[key]/       Netlify Blobs proxy
  results/[id]/         Public results page
  admin/                Admin dashboard, settings, benchmarks
components/             UI components (score breakdown, layout cards, forms)
lib/
  pipeline/             Analysis orchestration + agent runners
    analyze.ts          Main pipeline (4-step agent flow)
    agents/             Individual agent runners + types
    url-profile.ts      URL normalization + UrlProfile management
    asset-extraction.ts Asset download + Blob upload
  ai/                   AI client wrappers, retry logic, prompt logging
  config/               API key resolution, encryption, agent skill loading
  scoring/              Scoring engine
  scraping/             HTML fetch, CSS extraction, asset extraction, tech detection
  templates/            Legacy template system (retained, disconnected from pipeline)
  storage/              Netlify Blobs wrapper
prisma/
  schema.prisma         All 13 models
  seed.ts               Industries + templates + scoring rubric
scripts/
  seed-agent-skills.ts  Seed 6 agent skills
docs/                   Enhancement specs + checklists
```

## Development Phases

Architecture and implementation are documented in 4 phase handoff documents:

| Phase | Document | Scope |
|---|---|---|
| 1 | `PHASE-1-HANDOFF.md` | Schema + foundation layer (models, config libs, URL profiles, asset extraction) |
| 2 | `PHASE-2-HANDOFF.md` | Pipeline refactor (3-step agent architecture replacing 14-call sequential pipeline) |
| 3 | `PHASE-3-HANDOFF.md` | Admin tooling (settings, skills editor, pagination, URL profiles) |
| 4 | `PHASE-4-HANDOFF.md` | Benchmarking integration (CRUD, scoring, comparison display, rationale) |

## npm Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:migrate` | Run pending migrations |
| `npm run db:push` | Push schema changes (no migration) |
| `npm run db:seed` | Seed industries, templates, scoring rubric |
| `npm run db:seed-skills` | Seed 6 agent skills |
| `npm run db:studio` | Open Prisma Studio |
