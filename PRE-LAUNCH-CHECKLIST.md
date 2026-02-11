# pagerefresh.ai MVP - Pre-Launch Checklist

This document lists all assets, files, API keys, credentials, and resources you need to have prepared before starting development to streamline MVP testing and deployment.

---

## ✅ API Keys & Credentials

### Required for MVP

- [ ] **Anthropic API Key** (Claude API)
  - Get from: https://console.anthropic.com/
  - Need: Vision API + Text API access
  - Format: `sk-ant-api03-...`
  - Add to: `.env.local` as `ANTHROPIC_API_KEY`

- [ ] **OpenAI API Key** (GPT-4)
  - Get from: https://platform.openai.com/api-keys
  - Need: GPT-4 access
  - Format: `sk-...`
  - Add to: `.env.local` as `OPENAI_API_KEY`

- [ ] **AWS RDS PostgreSQL Database**
  - Set up: AWS RDS Console
  - Need: PostgreSQL 14+ instance
  - Note: Connection string, username, password
  - Add to: `.env.local` as `DATABASE_URL`
  - Format: `postgresql://user:password@endpoint:5432/pagerefresh`

- [ ] **Netlify Account**
  - Sign up: https://www.netlify.com/
  - Need: Netlify Blobs access
  - Get Netlify Blobs token from: Netlify dashboard
  - Add to: `.env.local` as `NETLIFY_BLOBS_TOKEN`

### Optional (for v2)

- [ ] **Stripe API Keys** (for payment integration in v2)
  - Test mode + Live mode keys
  - Format: `sk_test_...` and `sk_live_...`

- [ ] **Calendly API Key** (for installation scheduling in v2)
  - Get from: Calendly developer settings

---

## 📁 Required Files & Assets

### Templates (20 needed for MVP)

**Existing (8 templates):**
- [ ] `/Users/dovidthomas/dev/brand-builder/web-design-and-development/dual-hero-navattic-template.md`
- [ ] `/Users/dovidthomas/dev/brand-builder/web-design-and-development/logo-marquee-template.md`
- [ ] `/Users/dovidthomas/dev/brand-builder/web-design-and-development/ios-card-fan-template.md`
- [ ] `/Users/dovidthomas/dev/brand-builder/web-design-and-development/dual-demo-screenshots-template.md`
- [ ] `/Users/dovidthomas/dev/brand-builder/web-design-and-development/switch-provider-cta-template.md`
- [ ] `/Users/dovidthomas/dev/brand-builder/web-design-and-development/testimonials-carousel-template.md`
- [ ] `/Users/dovidthomas/dev/brand-builder/web-design-and-development/saas-about-page-template.md`
- [ ] `/Users/dovidthomas/dev/brand-builder/web-design-and-development/features-grid-template.md`

**Needed (12 more templates):**
- [ ] Source from: `/Users/dovidthomas/dev/brand-builder/web-design-and-development/phase-guides/`
- [ ] OR create 12 new templates based on brand-builder patterns

**Action**: Ensure all 20 templates are accessible in markdown format with HTML + CSS code blocks

### Industry Guidelines (20 industries)

**Existing (6 industries):**
- [ ] Accountants - Reference: `/Users/dovidthomas/dev/bhi-claude-skills/` (ensure available)
- [ ] Lawyers - Reference: `/Users/dovidthomas/dev/bhi-claude-skills/`
- [ ] Golf Courses - Reference: `/Users/dovidthomas/dev/bhi-claude-skills/`
- [ ] Beauty Salons - Reference: `/Users/dovidthomas/dev/bhi-claude-skills/`
- [ ] Barbershops - Reference: `/Users/dovidthomas/dev/bhi-claude-skills/`
- [ ] Homeowner Associations (HOAs) - Reference: `/Users/dovidthomas/dev/bhi-claude-skills/`

**Needed (14 more industries):**
- [ ] Veterinary Clinics
- [ ] Property Management Companies
- [ ] Funeral Homes
- [ ] Daycares
- [ ] Lawn Care & Landscaping
- [ ] Insurance Agencies
- [ ] Gun Clubs
- [ ] Community Theatres
- [ ] Dentists
- [ ] Real Estate Agents
- [ ] Restaurants
- [ ] Fitness Studios
- [ ] Auto Repair
- [ ] General Contractors

**Action**:
1. Confirm `/Users/dovidthomas/dev/bhi-claude-skills/` is accessible
2. Agent will create 14 additional industry guideline structures based on existing pattern

### Design Brief Generator (Reference)

- [ ] `/Users/dovidthomas/dev/brand-builder/web-design-and-development/design-brief-generator (1).html`
  - Use as: Reference for common design guidelines and scoring criteria

### System Documentation (Reference)

- [ ] `/Users/dovidthomas/dev/brand-builder/web-design-and-development/brand-building-system-readme.md`
- [ ] `/Users/dovidthomas/dev/brand-builder/web-design-and-development/phase-guides/` (directory)

**Action**: Ensure these paths are accessible for agents to reference during development

---

## 🗂️ File Structure Preparation

### Create Project Directory

- [ ] Directory: `/Users/dovidthomas/dev/pagerefresh/` (or desired location)
- [ ] Ensure parent directory has write permissions
- [ ] Ensure sufficient disk space (~500MB for project + dependencies)

---

## 🛠️ Development Environment

### Required Software

- [ ] **Node.js 20.x or higher**
  - Check: `node --version`
  - Install from: https://nodejs.org/

- [ ] **pnpm** (package manager)
  - Check: `pnpm --version`
  - Install: `npm install -g pnpm`

- [ ] **Git**
  - Check: `git --version`
  - For version control and deployment

- [ ] **Cursor IDE** (for Cursor agent development)
  - Download: https://cursor.sh/

### Optional (Helpful)

- [ ] **Prisma CLI** (auto-installed with project dependencies)
- [ ] **PostgreSQL client** (for database management)
  - pgAdmin, Postico, or CLI tool

---

## 🌐 Hosting & Deployment Setup

### Netlify Setup

- [ ] **Create Netlify account** (if not already)
  - Sign up: https://www.netlify.com/

- [ ] **Install Netlify CLI** (optional, for local testing)
  - Install: `npm install -g netlify-cli`
  - Login: `netlify login`

- [ ] **Enable Netlify Blobs**
  - Dashboard → Storage → Create Blobs store
  - Get token: Dashboard → Site settings → Blobs

### AWS RDS Setup

- [ ] **Create PostgreSQL database on AWS RDS**
  - Steps:
    1. Go to AWS RDS Console
    2. Create Database → PostgreSQL
    3. Choose instance size (t3.micro for MVP testing)
    4. Set database name: `pagerefresh`
    5. Set master username & password (save these!)
    6. Configure security group (allow inbound on port 5432 from your IP + Netlify IPs)
    7. Note endpoint URL

- [ ] **Test connection**
  - Use database client to connect
  - Verify you can create tables

---

## 📋 Testing Assets (Optional but Recommended)

### Test Websites (for MVP validation)

Prepare 5-10 test URLs across different industries:

- [ ] Accountant website (e.g., small CPA firm)
- [ ] Restaurant website (e.g., local eatery)
- [ ] Lawyer website (e.g., solo practitioner or small firm)
- [ ] Medical/Dentist website
- [ ] Fitness studio website
- [ ] E-commerce/retail website
- [ ] Service business (plumber, electrician, etc.)

**Criteria**: Mix of good and bad websites (stale designs, poor conversion, etc.)

---

## 📝 Environment Variables Template

Create `.env.local` file with this template (fill in actual values):

```env
# Database
DATABASE_URL="postgresql://username:password@endpoint:5432/pagerefresh"

# AI APIs
ANTHROPIC_API_KEY="sk-ant-api03-..."
OPENAI_API_KEY="sk-..."

# Netlify
NETLIFY_BLOBS_TOKEN="..."

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Optional (for v2)
# STRIPE_SECRET_KEY="sk_test_..."
# STRIPE_PUBLISHABLE_KEY="pk_test_..."
# CALENDLY_API_KEY="..."
```

---

## ✅ Pre-Development Validation Checklist

Before starting development, verify:

- [ ] All API keys are valid and working
  - Test Anthropic: Make a simple Claude API call
  - Test OpenAI: Make a simple GPT-4 API call
- [ ] Database connection works
  - Can connect to AWS RDS from local machine
- [ ] Netlify Blobs access works
  - Can upload/download a test file
- [ ] Template files are accessible
  - Can read markdown files from brand-builder directory
- [ ] Industry guideline files are accessible
  - Can read files from bhi-claude-skills directory
- [ ] Node.js and pnpm are installed
- [ ] Directory for project exists with write permissions

---

## 🚀 Quick Start Commands (Once Setup Complete)

```bash
# 1. Create project
pnpm create next-app@latest pagerefresh --typescript --tailwind --app --eslint

# 2. Navigate to project
cd pagerefresh

# 3. Install dependencies
pnpm add prisma @prisma/client puppeteer @sparticuz/chromium

# 4. Set up environment variables
cp .env.example .env.local
# (Edit .env.local with actual values)

# 5. Set up database
pnpm prisma migrate dev --name init

# 6. Seed database
pnpm prisma db seed

# 7. Run development server
pnpm dev
```

---

## 📞 Support Resources

If you encounter issues:

- **Anthropic API**: https://docs.anthropic.com/
- **OpenAI API**: https://platform.openai.com/docs
- **Netlify Docs**: https://docs.netlify.com/
- **AWS RDS Docs**: https://docs.aws.amazon.com/rds/
- **Next.js Docs**: https://nextjs.org/docs
- **Prisma Docs**: https://www.prisma.io/docs

---

## 🎯 Ready to Build?

Once all items above are checked off:
1. ✅ API keys obtained and tested
2. ✅ Database created and accessible
3. ✅ Template and guideline files accessible
4. ✅ Development environment set up
5. ✅ .env.local file configured

**You're ready to start development!** Proceed with Phase 1 of the implementation plan.