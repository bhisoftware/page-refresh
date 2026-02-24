# Incident Report: Creative Layout Generation Failures

**Document purpose:** Handoff for another agent to review. The intent is that **subagents (the 3 Creative Agents) operate within API parameters and still produce the required layouts** — i.e. improve reliability and output format so all 3 layouts are consistently visible to users.

---

## 1. Summary

Users run a “refresh” (analyze a URL and get scores + 3 AI-generated layout options). The pipeline often completed analysis (scores, SEO audit, benchmarks) but **the 3 layout previews did not appear**. In the worst case, the entire run failed with no results saved. Root cause: the 3 Creative Agents (Claude API calls that generate HTML layouts) were failing; the pipeline then either threw and discarded all work, or saved analysis but left layout slots empty.

---

## 2. Impact

- **User-visible:** Results page shows “Layout proposals are not available” or “Layout generation was unable to complete” instead of 3 selectable layout cards.
- **Product:** The core value (3 homepage refresh options) is missing when creative agents fail.
- **Data:** Previously, when all 3 creative agents failed, the pipeline threw and **no** results were saved (scores, SEO, benchmarks lost). That behavior has been changed so analysis is always saved even when layouts fail.

---

## 3. Pipeline Overview

| Step | What it does | Output used by |
|------|----------------|----------------|
| 0 | Fetch URL, create UrlProfile, get HTML + optional screenshot | All |
| 1 | Screenshot analysis + Industry/SEO agent + asset extraction (parallel) | Step 2, 3 |
| 2 | Score agent (dimensions + creative brief) | Step 3, DB |
| **3** | **3 Creative Agents** (Modern, Classy, Unique) — **each returns `{ html, rationale }`** | DB, results page |
| 4 | Save Refresh row (scores, SEO, layouts, etc.) | Results page |

The **subagents** in scope for this incident are the **3 Creative Agents** in Step 3. They must return valid, non-empty HTML so the app can render 3 layout previews.

---

## 4. API and Subagent Constraints (for follow-up agent)

These are the boundaries the Creative subagents must work within while still producing the required layout.

### 4.1 Anthropic API usage

- **Model:** `claude-sonnet-4-20250514` (or skill override from DB).
- **Max tokens (response):** 16_384 per creative call (from `AgentSkill.maxTokens`).
- **Rate limits:** 3 creative calls run **sequentially** with a 2s delay between them to reduce 429s. Retry: `withRetry` in `lib/ai/retry.ts` (exponential backoff 10s, 30s; max 2 retries; 429 and 5xx are retryable).
- **Input:** Single user message = `JSON.stringify(creativeInput, null, 2)`. `creativeInput` contains `creativeBrief`, `industry`, and `brandAssets` (logoUrl, heroImageUrl, colors, fonts, navLinks, copy). No image blocks in the request.

### 4.2 Required output contract (subagent → pipeline)

Each Creative Agent must produce:

1. **Format:** Valid JSON.
2. **Shape:** `{ "html": "<string>", "rationale": "<string>" }`.
3. **Content:**  
   - `html`: Non-empty string; must be a full HTML document or fragment (Tailwind CDN is allowed in the page).  
   - `rationale`: Optional string.

If the agent returns invalid JSON, malformed JSON, or empty/whitespace-only `html`, the pipeline treats that agent run as a **failure** for that slot (logs and continues; layout slot is empty). The pipeline does **not** retry with a different prompt for that slot.

### 4.3 Current parsing and validation

- **Parsing:** `lib/ai/json-repair.ts` — `safeParseJSON(text)` with fallbacks: strip markdown code fences, trim to first `{` / last `}`, basic repair (trailing commas, unquoted keys). **No** HTML-specific escaping or extraction (e.g. no handling of unescaped quotes/newlines inside the `html` string that could break `JSON.parse`).
- **Validation (creative agent):** In `lib/pipeline/agents/creative.ts`, after parse: `html` must be a non-empty string after trim, else throw `Creative Agent ${slug} returned empty HTML`.

### 4.4 System prompts (Creative Agents)

Stored in DB; seeded by `scripts/seed-agent-skills.ts`. Slugs: `creative-modern`, `creative-classy`, `creative-unique`. Each prompt instructs:

- Generate a complete, self-contained HTML page using Tailwind via CDN.
- Use real brand assets (e.g. `/api/blob/` URLs, hex colors, copy).
- Return **only** valid JSON: `{ "html": "<!DOCTYPE html>...", "rationale": "..." }`.

Prompts do **not** currently specify escaping rules for HTML inside JSON (e.g. newlines, `"`, `\`), which can cause parse failures when the model embeds raw HTML.

---

## 5. Root Causes (why layouts were missing)

1. **Pipeline behavior (fixed):** When all 3 creative agents failed, the pipeline threw and never ran `prisma.refresh.update`, so no results were saved. **Change applied:** Pipeline no longer throws; it saves scores/SEO/benchmarks and empty layout slots, and logs failures.
2. **Missing or inactive AgentSkill rows:** If `creative-modern`, `creative-classy`, or `creative-unique` are missing or `active = false`, the agent throws immediately. **Mitigation:** Run `npx tsx scripts/seed-agent-skills.ts` to upsert skills.
3. **JSON parse failures:** Model returns HTML inside JSON; unescaped characters (quotes, newlines, backslashes) in the `html` value can break `JSON.parse` and the current repair logic may not recover. **Intent for follow-up:** Have subagents produce output that stays within API/JSON constraints (e.g. prompt or post-process so the response is valid JSON with a non-empty `html` string).
4. **Rate limits (429):** Three calls in sequence with 2s delay and retries reduce but do not eliminate 429s. **Intent:** Operate within rate limits (e.g. keep sequential + delay, or tune retries) while still producing 3 layouts.
5. **Empty HTML:** Model sometimes returned valid JSON with `html: ""`. **Change applied:** Pipeline now treats empty/whitespace `html` as a failure (throw in creative agent).
6. **Template names:** Layout template names (Modern/Classy/Unique) are only set when the corresponding layout HTML is non-empty; otherwise stored as `"pending"`.

---

## 6. Fixes Already Applied (no need to redo)

- **Pipeline:** Save full Refresh (scores, SEO, benchmarks, layout slots) even when all 3 creative agents fail. No throw; progress message and log only.
- **Creative agents:** Run **sequentially** with 2s delay between calls.
- **Creative agent validation:** Reject empty or whitespace-only `html` (throw so it’s logged as failure).
- **DB:** Layout template names set to `"Modern"` / `"Classy"` / `"Unique"` only when that slot has content; otherwise `"pending"`.
- **Results page:** Conditional summary and “layout unavailable” message when no layouts; error boundary around layout section so one bad layout doesn’t crash the page.

---

## 7. Intent for Follow-Up Agent

**Goal:** The Creative **subagents** should **operate within the existing API parameters** and **still produce the required layout** (all 3 layouts visible on the results page).

Concretely, consider:

1. **Output format:** Ensure the model’s response is valid JSON with a non-empty `html` string every time (e.g. prompt instructions for escaping HTML in JSON, or ask for HTML in a code block and extract into `html` before parsing).
2. **Parsing robustness:** If helpful, extend `safeParseJSON` or add a creative-specific extraction (e.g. extract `html` from a markdown code block when JSON parse fails) so that valid HTML is not lost due to escaping issues.
3. **Rate limits:** Keep working within Anthropic’s limits; current design is sequential + delay + retry. If needed, adjust delay or retry policy without changing the “3 layouts” contract.
4. **Prompts:** Refine system prompts in seed and/or DB so the model consistently returns the exact `{ "html": "...", "rationale": "..." }` shape with valid JSON and no empty `html`, while still using the same API (single user message, no image blocks, same `creativeInput`).

Do **not** change the pipeline contract: Step 3 still expects three separate Creative Agent calls (one per slug), each returning `{ html: string, rationale: string }` with non-empty `html`. The follow-up work is to make the subagents satisfy that contract reliably within the current API and parsing stack.

---

## 8. Relevant Files and Logs

| Area | Path |
|------|------|
| Pipeline (Step 3 + save) | `lib/pipeline/analyze.ts` |
| Creative agent runner | `lib/pipeline/agents/creative.ts` |
| Creative input types | `lib/pipeline/agents/types.ts` |
| JSON parsing | `lib/ai/json-repair.ts` |
| Retry logic | `lib/ai/retry.ts` |
| Agent skills (DB seed) | `scripts/seed-agent-skills.ts` |
| Results page (layouts + no-layout message) | `app/results/[id]/page.tsx` |

**Logs to check when a layout fails:**

- `[pipeline] Creative agent creative-modern failed:` (and `creative-classy`, `creative-unique`) — reason will be the thrown error (e.g. invalid JSON, empty HTML, or API error).
- `[pipeline] All 3 Creative Agents failed. Saving scores/SEO/benchmarks without layouts.` — indicates zero of three succeeded.

**DB:** Ensure `AgentSkill` has active rows for `creative-modern`, `creative-classy`, `creative-unique` (run seed script if unsure).

---

## 9. Success Criteria for Resolution

- Refreshes consistently produce **3 visible layout options** on the results page when the rest of the pipeline succeeds.
- Creative subagents remain within current API usage (model, tokens, sequential calls, retries).
- Output continues to satisfy the contract: valid JSON, non-empty `html`, stored in the same Refresh layout slots and rendered in the same UI.
