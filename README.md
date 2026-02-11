# pagerefresh.ai

**"Paste your website and get a $50,000 quality refresh in 5 minutes. Pay only if you love it."**

AI-powered website analysis and redesign tool for SMB businesses.

## 📋 Quick Start

1. **Review the plan**: Read `MVP-PLAN.md` for complete technical specification
2. **Check prerequisites**: Review `PRE-LAUNCH-CHECKLIST.md` for required API keys and assets
3. **Agent guides**: See `docs/` for agent-specific instructions

## 📁 Documentation Structure

### Implementation Plans
- **`MVP-PLAN.md`** - Complete technical specification for MVP build
  - Database schema
  - 5-phase implementation plan
  - 0-100 scoring system across 8 dimensions
  - Tech stack: Next.js, TypeScript, Tailwind, PostgreSQL, Claude API, OpenAI API

- **`PRE-LAUNCH-CHECKLIST.md`** - Required assets, API keys, and setup instructions
  - API credentials (Anthropic, OpenAI, AWS RDS, Netlify)
  - Template files (20 needed)
  - Industry guidelines (20 industries)
  - Development environment setup

### Agent Guides
- **`docs/CLAUDE-CODE-AGENT.md`** - Instructions for technical oversight agent
  - Quality assurance responsibilities
  - Architecture validation
  - Testing protocol
  - Success metrics

- **`docs/CURSOR-AGENT.md`** - Instructions for implementation agent
  - Step-by-step build guide
  - Critical components explained
  - Tech stack and file structure
  - Common pitfalls to avoid

### Library Resources
- **`library/bhi-claude-skills/`** - Industry-specific guidelines and scoring criteria
  - Reference for creating 20 industry scoring rubrics
  - Examples: accountants, lawyers, golf courses, beauty salons, barbershops, HOAs
  - Used to build universal quality framework

### Original Design Documents (v2 Roadmap)
- **`combined-flowchart.md`** - Original flowcharts (5 diagrams)
- **`user-flow.mmd`** - User journey flowchart
- **`technical-architecture.mmd`** - System architecture
- **`claude-integration.mmd`** - AI integration sequence
- **`industry-guidelines.mmd`** - Guidelines system
- **`data-evolution.mmd`** - Storage evolution plan

## 🎯 MVP vs Full Vision

### MVP Scope (Building Now)
- ✅ 0-100 scoring across 8 universal quality dimensions
- ✅ 3 layout proposals with Design/Copy toggle
- ✅ Basic SEO audit
- ✅ Simple lead capture (Request Quote/Install forms)
- ✅ 60-90 second analysis time

### v2 Features (Documented in .mmd files)
- 📋 Peer benchmarking (200 best sites per category)
- 📋 Category-specific dimension weighting
- 📋 6 layout options (3 + "Show 3 More")
- 📋 Payment integration (Stripe)
- 📋 Installation scheduling (Calendly)
- 📋 Analysis history
- 📋 Platform exports (Squarespace, WordPress, Wix)
- 📋 PDF reports with AI reasoning

**The .mmd flowcharts represent the full product vision.** Keep them as reference for v2 development.

## 🏗️ Tech Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API routes (serverless on Netlify), Prisma ORM
- **Database**: PostgreSQL on AWS RDS
- **Storage**: Netlify Blobs (screenshots, assets)
- **AI**: Claude API (Vision + Text), OpenAI API (GPT-4)
- **Hosting**: Netlify

## 🚀 Development Phases

1. **Phase 1**: Setup & Foundation (project, database, templates, rubric)
2. **Phase 2**: Core Analysis Pipeline (screenshot → scoring → layouts)
3. **Phase 3**: Frontend UI (landing, results, toggle, forms)
4. **Phase 4**: Error Handling & Fallbacks
5. **Phase 5**: Performance Optimization

## 📊 8 Universal Quality Dimensions

1. **Clarity** - What is it, who is it for, what do I do?
2. **Visual Quality** - Modern, intentional, trustworthy
3. **Information Hierarchy** - Logical flow, scannable
4. **Trust & Credibility** - Social proof, legitimacy signals
5. **Conversion & Actionability** - Easy next step, clear CTA
6. **Content Quality** - Written for humans, no buzzwords
7. **Mobile Experience** - Designed for phones
8. **Performance & Technical** - Fast, secure, not broken

Each dimension scored 0-100 with specific issues and recommendations.

## 📞 Support

For questions or issues during development, refer to:
- Implementation plan: `MVP-PLAN.md`
- Agent guides: `docs/CLAUDE-CODE-AGENT.md` and `docs/CURSOR-AGENT.md`
- Pre-launch checklist: `PRE-LAUNCH-CHECKLIST.md`
