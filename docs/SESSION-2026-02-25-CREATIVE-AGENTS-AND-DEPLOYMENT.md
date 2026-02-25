# Session Summary: Creative Agent Fix & Deployment Timeout

**Date:** 2026-02-25
**Scope:** Creative layout generation reliability + production deployment failure

---

## 1. Problem Addressed

The 3 Creative Agents (Modern, Classy, Unique) were intermittently failing to produce HTML layouts. When they failed, users saw "Layout proposals are not available" on the results page. The root cause was documented in `docs/INCIDENT-CREATIVE-LAYOUTS.md`.

---

## 2. Decision: Switch Output Format from JSON to XML Tags

### What changed

The creative agent prompts previously asked the model to return HTML embedded inside a JSON string:

```json
{ "html": "<!DOCTYPE html>...", "rationale": "..." }
```

This was structurally fragile. Every unescaped `"`, `\n`, or `\` inside the HTML broke `JSON.parse`. The `json-repair.ts` fallbacks could not reliably fix these because distinguishing structural JSON delimiters from HTML content requires full parser context.

**New format:** The prompts now instruct the model to use XML-style delimiters:

```
<layout_html>
<!DOCTYPE html>...
</layout_html>
<rationale>
Explanation...
</rationale>
```

### Why

- HTML naturally contains characters that conflict with JSON string encoding
- XML tags let the model write raw HTML without any escaping
- The model is much more reliable at placing content between delimiters than producing valid JSON-encoded HTML
- No change to the API call structure, token usage, or cost

### Files modified

| File | Change |
|------|--------|
| `lib/pipeline/agents/creative.ts` | Added `extractFromTags()` as primary parser; JSON parsing retained as fallback |
| `scripts/seed-agent-skills.ts` | Updated all 3 creative agent prompts to use XML tags |

### Pipeline contract preserved

`runCreativeAgent()` still returns `{ html: string, rationale: string }`. Nothing upstream or downstream changed.

---

## 3. Decision: Version-Gated Prompt Updates in Seed Script

### What changed

The seed script previously never overwrote `systemPrompt` on update (to preserve admin edits in the DB). This made it impossible to deploy prompt changes from code.

**New behavior:** Each skill now has a `version` number in the seed data. On seed:

| Condition | Behavior |
|-----------|----------|
| Skill doesn't exist in DB | Create with prompt + version |
| Seed version > DB version | Archive old prompt to `AgentSkillHistory`, overwrite `systemPrompt`, bump version |
| Seed version = DB version | Update metadata only, prompt preserved (admin edits survive) |

### Why

- Provides a clear mechanism for intentional prompt upgrades via code
- Preserves the existing protection for admin edits between version bumps
- Archives old prompts for auditability (uses existing `AgentSkillHistory` table)

### Version state after this session

| Agent | Version |
|-------|---------|
| screenshot-analysis | 1 (unchanged) |
| industry-seo | 1 (unchanged) |
| score | 1 (unchanged) |
| creative-modern | 1 → 2 |
| creative-classy | 1 → 2 |
| creative-unique | 1 → 2 |

---

## 4. Verification: Local Testing

Seed script was run against the production database (AWS RDS). Multiple refreshes completed successfully with all 3 layouts populated:

| URL | Layout 1 | Layout 2 | Layout 3 |
|-----|----------|----------|----------|
| stripe.com | 15,591 chars | 18,230 chars | 18,066 chars |
| example.com | 18,224 chars | 21,335 chars | 19,418 chars |
| pnwx.com | 17,937 chars | 21,528 chars | 27,630 chars |

All templates correctly labeled Modern / Classy / Unique (not "pending"). Zero JSON parse failures.

---

## 5. Blocking Issue: Netlify Function Timeout

### Discovery

After confirming the fix works locally, testing on production (pagerefresh.ai and pagerefresh.netlify.app) showed "Refresh ended without result." The pipeline progressed through analysis and scoring but was killed during creative agent generation.

### Root cause

The pipeline takes ~230 seconds end-to-end. **Netlify's synchronous function timeout is capped at 26 seconds on all plans, including Pro.** There is no setting to increase this. The `maxDuration = 120` in the route file is a Next.js/Vercel setting that Netlify ignores.

When the function is killed mid-pipeline:
1. The SSE stream closes without sending a `"done"` event
2. The client-side reader exits the loop
3. Falls through to `throw new Error("Refresh ended without result")`

### Why this worked locally

The local Next.js dev server runs as a standard Node.js process with no timeout enforcement. It will run for as long as the pipeline needs.

### Current state

The code fix is deployed and working. The deployment platform cannot execute it within its timeout constraints.

---

## 6. Open Decision: Deployment Platform

Netlify cannot run the pipeline as a synchronous function. Options evaluated:

| Option | Timeout | Trade-off |
|--------|---------|-----------|
| **Vercel Pro** | 300s (`maxDuration` already in code) | Requires platform migration; minimal code changes |
| **AWS Lambda** (via API Gateway) | 15 min | Deploy only `/api/analyze` as Lambda; Netlify serves frontend. DB already on AWS RDS us-east-2. Requires extracting route to Lambda handler + pointing frontend to Lambda URL |
| **AWS Lambda + polling** | 15 min | Lambda runs pipeline async; client polls a status endpoint. More resilient but more code |
| **Netlify Background Functions** | 15 min | Can't stream SSE; would need polling pattern. More code to write |
| **AWS ECS/Fargate** | No limit | Overkill for MVP |
| **AWS App Runner** | 120s max | Not enough for 230s pipeline |

**No decision made yet.** This requires a follow-up session.

---

## 7. Security Note

The production database password was exposed during this session (visible in `.env` file read). **Rotate the RDS credentials.**
