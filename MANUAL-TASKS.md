# Manual Tasks — Owner Actions Required

> Tasks that cannot be automated by Cursor or Claude Code. These require your access to external dashboards, accounts, or manual judgment.

---

## Phase 1 — Before or During Build

### Environment Variables

- [ ] **Generate encryption key** and add to `.env.local`:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
  Copy output to `.env.local` as `API_CONFIG_ENCRYPTION_KEY="<value>"`

- [ ] **Add to Vercel env vars:** Go to Vercel dashboard → Project Settings → Environment Variables → Add `API_CONFIG_ENCRYPTION_KEY` with the same value

### Database

- [ ] **Run migration against production DB** after Phase 1 code is deployed:
  ```bash
  npx prisma migrate deploy
  ```
  (Netlify build command already does this — verify it runs on next deploy)

- [ ] **Run agent skills seed against production:**
  ```bash
  DATABASE_URL="<production-url>" npx tsx scripts/seed-agent-skills.ts
  ```
  Or SSH/connect to production and run there. The seed script must reach the production database.

---

## Phase 2 — Before or During Build

### Testing

- [ ] **Test the full pipeline end-to-end on staging/preview deploy** before merging to main. Submit 3-5 different URLs across different industries. Verify:
  - All 3 layouts render with real brand assets (not placeholders)
  - Scores are reasonable (not all 0s or all 100s)
  - PromptLog entries show correct agent step names
  - Processing time is within Netlify's 120s limit

- [ ] **Verify existing Refresh records still display correctly.** Old records have template-based layouts and no `urlProfileId`. The results page must not break for these.

---

## Phase 3 — During Build

### API Key Management

- [ ] **Decide which API keys to store in DB vs keep as env vars.** Recommendation:
  - Move to DB: `ANTHROPIC_API_KEY` (rotatable via admin UI)
  - Keep as env: `OPENAI_API_KEY` (not used in pipeline anymore), `DATABASE_URL` (infrastructure), `ADMIN_SECRET`, S3 credentials

- [ ] **Test the key rotation flow:** Add Anthropic key via admin Settings → verify pipeline uses it → deactivate → verify pipeline falls back to env var

### Agent Prompts

- [ ] **Review and refine the 6 agent system prompts** via the Skills Editor after it's built. The Phase 1 seeds are functional starting points, not production-tuned prompts. Iterate by:
  1. Running an analysis
  2. Checking PromptLog in admin detail for the agent's response
  3. Editing the prompt in Skills Editor
  4. Running another analysis
  5. Comparing output quality

  Priority order for prompt refinement:
  1. Score Agent (drives creative brief quality)
  2. Creative Agents (drives layout quality)
  3. Screenshot Analysis Agent
  4. Industry & SEO Agent

---

## Phase 4 — During Build

### Benchmark Curation

- [ ] **Add 5-10 benchmark URLs per industry** via the admin Benchmarks page. These are the "what good looks like" reference sites. Choose sites that:
  - Are genuinely well-designed for their industry
  - Have functioning URLs (not behind auth walls)
  - Represent a range of quality (some excellent, some merely good)

- [ ] **Score all benchmarks** via the admin "Score All Unscored" button. This triggers Claude API calls for each benchmark (~14 calls each using the existing scoring pipeline). Budget ~$0.30-0.50 per benchmark. With 100 benchmarks across 21 industries: ~$30-50 one-time cost.

- [ ] **Review benchmark scores for sanity.** Are top firms actually scoring higher than mediocre ones? If not, the scoring rubric or prompts may need tuning.

### Optional: Seed Script

- [ ] **Run benchmark seed script** if created:
  ```bash
  npx tsx scripts/seed-benchmarks.ts
  ```
  This adds starter URLs — you still need to score them via the admin UI.

---

## Ongoing / Post-Launch

### Scaling

- [ ] **Request rate limit increase from Anthropic** (when needed for scale, not MVP). The pipeline makes 6 Claude calls per analysis. At 10 concurrent users = 60 simultaneous calls. Contact Anthropic support with:
  - Use case: automated website analysis tool
  - Expected volume: 50-200 analyses/day initially
  - Calls per analysis: 6
  - Model: claude-sonnet-4-20250514
  - Average tokens per call: ~3-5K input, ~2-4K output

### Monitoring

- [ ] **Set up Anthropic usage monitoring.** Check the Anthropic console periodically for:
  - Token usage trends
  - Rate limit proximity
  - Cost per day/week

- [ ] **Monitor Vercel function duration.** If pipeline approaches the function timeout limit, consider:
  - Increasing the function timeout in `vercel.json` (Pro plan: up to 300s)
  - Or reducing token budgets in agent skill configs

### Cost

- [ ] **Track per-analysis cost.** Target: $0.20-0.45 per analysis. If significantly higher, check:
  - Are Creative Agent responses too long? (Reduce `maxTokens`)
  - Is the Score Agent prompt too verbose? (Trim input context)
  - Consider enabling Anthropic prompt caching for system prompts

### Data Retention

- [ ] **Decide URL Profile retention policy.** Current schema has `expiresAt` field but no cleanup job. Options:
  - 30 days for non-paying profiles (future Stripe integration sets this)
  - Indefinite for now (storage costs are negligible at low volume)
  - Build cleanup job when approaching 1000+ profiles

### S3 Storage

- [ ] **Check S3 storage usage** periodically. At ~3-5 MB per URL profile:
  - 100 profiles ≈ 300-500 MB (~$0.01/mo)
  - 1000 profiles ≈ 3-5 GB (~$0.07/mo)
  - Consider S3 lifecycle rules to expire old screenshots after 90 days if costs grow
