# Model Performance Analysis — Sonnet 4.0 vs Sonnet 4.6

**Date:** 2026-03-02
**Status:** Reverted to Sonnet 4.0 (`claude-sonnet-4-20250514`)
**Affected commits:** `95f12ea` (introduced regression), fix applied on `main`

---

## Summary

Upgrading the default model from `claude-sonnet-4-20250514` (Sonnet 4.0) to `claude-sonnet-4-6` (Sonnet 4.6) in commit `95f12ea` caused the analysis pipeline to consistently exceed the 280-second timeout. Layout generation failed for most users because the pipeline budget was designed around Sonnet 4.0's response characteristics.

## Regression Timeline

| Time (ET) | Event |
|---|---|
| Mar 1 23:13 | Commit `95f12ea` changes code default to `claude-sonnet-4-6` |
| Mar 2 ~04:05 | Vercel deploy propagates with new model default |
| Mar 2 04:04 | Last fast run (statetire.org, 163s) — still on old deploy using Sonnet 4.0 |
| Mar 2 05:25 | First run on Sonnet 4.6 (leadingandlearning.com, 265s) — barely succeeded |
| Mar 2 05:40+ | All subsequent runs hit 280s timeout, most with 0/3 or partial layouts |

## Comparative Performance Data

### Scoring Step (score agent)

| Model | Avg Response Time | Avg Output Tokens |
|---|---|---|
| `claude-sonnet-4-20250514` | **22s** | ~2,500 |
| `claude-sonnet-4-6` | **64–75s** | ~4,600–5,200 |

Sonnet 4.6 is **3–3.5x slower** for scoring and generates **~2x more tokens**.

### Creative Agents (layout generation)

| Model | Avg Response Time (per agent) | Avg Output Tokens |
|---|---|---|
| `claude-sonnet-4-20250514` | **106–127s** | 12,000–14,500 |
| `claude-sonnet-4-6` | **163–195s** | 17,000–20,500 |

Sonnet 4.6 is **1.5–1.8x slower** and generates **~50% more tokens** per layout.

### Total Pipeline Budget

| Model | Setup + Step 1 | Score | Creative (parallel) | Total | Fits in 280s? |
|---|---|---|---|---|---|
| Sonnet 4.0 | ~10s | ~22s | ~127s | **~160s** | Yes (120s margin) |
| Sonnet 4.6 | ~8s | ~70s | ~195s | **~273s** | Barely / No |

### Impact on Users (Last 10 Runs Post-Regression)

| Outcome | Count |
|---|---|
| Timed out, 0/3 layouts | 3 |
| Timed out, partial layouts (1–2/3) | 3 |
| Timed out, 3/3 layouts (saved by `after()` background) | 3 |
| Completed within budget | 1 |

**90% timeout rate** with Sonnet 4.6 vs **0% timeout rate** with Sonnet 4.0.

## Root Cause

The pipeline has a 280-second SSE timeout (`PIPELINE_TIMEOUT_MS`) constrained by Vercel's 300-second `maxDuration`. This budget was designed around Sonnet 4.0's performance profile. Sonnet 4.6 produces higher quality output but is significantly slower and more verbose, pushing the total pipeline time past the timeout boundary.

The `after()` continuation (commit `b269db1`) partially mitigated this by allowing creative agents to finish in the background after the SSE stream closed. However, this is unreliable — Vercel can GC the function at any time after the response is sent, and users see the "no layouts" fallback on initial page load even when layouts eventually save.

## Fix Applied

Reverted the default model for score and creative agents back to `claude-sonnet-4-20250514`:

- `lib/pipeline/agents/score.ts` — fallback: `"claude-sonnet-4-20250514"`
- `lib/pipeline/agents/creative.ts` — fallback: `"claude-sonnet-4-20250514"`

Extraction agents (screenshot-analysis, industry-seo) remain on `claude-haiku-4-5-20251001` — these are fast (~3–7s) and unaffected.

The `modelOverride` DB field on each `AgentSkill` record still takes precedence, so individual agents can be upgraded to Sonnet 4.6 via the admin UI for testing without a code change.

## Post-Fix Verification

**Test run:** acehardware.com (fresh analysis, not cached) — Mar 2, 2026

### Prompt Log Detail

| Step | Response Time | Output Tokens | Model |
|---|---|---|---|
| screenshot_analysis | 2,527ms | 5,767 | `claude-haiku-4-5-20251001` |
| industry_seo | 6,900ms | 9,987 | `claude-haiku-4-5-20251001` |
| score | **26,053ms** | 2,987 | `claude-sonnet-4-20250514` |
| creative_classy | 95,544ms | 11,584 | `claude-sonnet-4-20250514` |
| creative_modern | 98,564ms | 11,816 | `claude-sonnet-4-20250514` |
| creative_unique | 109,119ms | 12,819 | `claude-sonnet-4-20250514` |

### Results

- **Total pipeline time:** 149s
- **Status:** complete (no errors)
- **Layouts generated:** 3/3
- **Score:** 72/100

### Before vs After Comparison

| Metric | Sonnet 4.6 (broken) | Sonnet 4.0 (fixed) | Improvement |
|---|---|---|---|
| Score step | 64–75s | **26s** | 2.5–3x faster |
| Creative agents (each) | 163–195s | **96–109s** | 1.7–1.8x faster |
| Creative output tokens | 17,000–20,500 | **11,500–12,800** | ~40% fewer tokens |
| Total pipeline | 273–285s (timeout) | **149s** | 46% reduction |
| Layouts generated | 0/3 or partial | **3/3** | 100% success |
| Pipeline timeout rate | 90% | **0%** | Resolved |
| Time margin remaining | -5 to +7s | **+131s** | Comfortable buffer |

### Desktop and Mobile Verification

Tested on deployed production build (`6c0bec4`):

- **Desktop (1280x720):** Homepage loads, cached results render with 3 layout tabs and score tiles, layout iframe renders full page content
- **Mobile (390x844):** Homepage clean and responsive, fresh analysis completed successfully, all 3 layout tabs switch correctly with distinct layout content in each iframe, email CTA and 8 score dimension tiles render correctly with color-coded progress bars
- **Console:** Zero errors on all pages (only expected Tailwind CDN warning in layout iframes)

## Recommendations for Future Model Evaluation

### 1. Establish a Model Test Protocol

Before changing the default model for any agent:

- [ ] Run at least 5 test analyses with the candidate model via the admin `modelOverride` field
- [ ] Compare response times, token counts, and output quality against the current default
- [ ] Verify total pipeline time stays under 200s (70% of the 280s budget) to leave margin

### 2. Add Pipeline Timing Observability

Current gaps that made this hard to diagnose:

- `processingTime` is only set when the pipeline fully completes (null on timeout)
- No per-step timing in the `Refresh` record — must query `PromptLog` separately
- No alerting when timeout rate exceeds a threshold

Suggested improvements:

- Persist per-step elapsed time to the `Refresh` row (e.g., `stepTimings` JSON field)
- Add a `timedOut: Boolean` field to `Refresh` for easy querying
- Log total pipeline time even on timeout (use `startTime` captured at pipeline start)

### 3. Define a Model Performance Budget

| Agent | Max Acceptable Response Time | Rationale |
|---|---|---|
| screenshot-analysis | 15s | Runs in parallel with industry-seo |
| industry-seo | 15s | Runs in parallel with screenshot-analysis |
| score | 40s | Must leave 200s+ for creative agents |
| creative (each) | 120s | 3 agents parallel with 3s stagger ≈ 126s total |
| **Pipeline total** | **200s** | 70% of 280s timeout = safe margin |

### 4. Consider Architecture Changes for Slower Models

If Sonnet 4.6 (or future models) provide meaningfully better layout quality, consider:

- **Increase Vercel timeout** — requires Vercel Pro/Enterprise plan changes
- **Move creative agents to background jobs** — decouple from SSE stream entirely
- **Polling-based results page** — show "layouts generating" state and auto-refresh
- **Reduce creative agent verbosity** — add prompt instructions to limit output length
- **Use faster model for scoring, better model for creative** — split the budget

### 5. Admin UI Model Testing Workflow

The `modelOverride` field on each `AgentSkill` enables per-agent model testing without code deploys:

1. Set `modelOverride` on one creative agent (e.g., `creative-modern`) to the candidate model
2. Run 3–5 analyses and compare that agent's timing vs the other two
3. If acceptable, roll out to remaining creative agents
4. Only change the code default after validating in production

---

## API Call Concurrency: Evolution & Architecture

The creative agent concurrency strategy changed 3 times in 2 days. Each change was a reaction to a real production failure. This section exists so we don't repeat the cycle.

### Timeline

| # | Commit | Strategy | What broke |
|---|--------|----------|------------|
| 1 | `d6d0a96` (Feb 24) | **Fully parallel** — all 3 via `Promise.allSettled` | Nothing yet — initial impl |
| 2 | `cce2939` (Feb 25, ~2:47am) | **Fully sequential** — 2s delay between each | 429 rate limit errors from Anthropic when 3 agents hit the API simultaneously |
| 3 | `94d1d64` (Feb 25, ~10:31am) | **Back to parallel** | Sequential was too slow: 45–80s for Step 3 instead of 15–25s |
| 4 | `3c3a035` (Feb 25, ~10:44am) | **Parallel with 3s stagger** | 529 overload errors from launching all 3 simultaneously |

### Current approach (staggered parallel)

```typescript
// lib/pipeline/analyze.ts — Step 3
const CREATIVE_STAGGER_MS = 3000;

const creativeResults = await Promise.allSettled(
  creativeSlugs.map(async (slug, i) => {
    if (i > 0) await new Promise((r) => setTimeout(r, i * CREATIVE_STAGGER_MS));
    return await runCreativeAgent({ slug, ... });
  })
);
```

- Agent 0 starts at **0s**, Agent 1 at **3s**, Agent 2 at **6s**
- All 3 run concurrently once launched — total wall time ≈ slowest single agent + 6s
- `Promise.allSettled` means partial failure is OK (1 or 2 layouts still get saved)

### Why this is the right tradeoff

| | Fully parallel | Fully sequential | Staggered parallel |
|---|---|---|---|
| Step 3 wall time | 15–25s | 45–80s | 20–30s |
| 429/529 risk | High | None | Low |
| Partial failure handling | Yes (`allSettled`) | Manual | Yes (`allSettled`) |

---

## Pipeline Step Concurrency Map

| Step | What runs | Concurrency | Why |
|------|-----------|-------------|-----|
| 0 | URL fetch + screenshot | `Promise.all` (fully parallel) | Independent I/O, no API calls |
| 1 | Screenshot Analysis + Industry/SEO + Asset Extraction | `Promise.all` (fully parallel) | 3 agents analyzing the same input — no dependency between them |
| 2 | Score Agent | Sequential (waits for Step 1) | Needs analysis results as input |
| 3 | 3 Creative Agents | `Promise.allSettled` with 3s stagger | Balances speed vs. API rate limits |
| 4 | Screenshot compress + finalize | Sequential | Writes final status |

---

## Retry & Error Handling

**File:** `lib/ai/retry.ts`

Every API call is wrapped in `withRetry()`:

```
Attempt 0 → fail → wait 10s → Attempt 1 → fail → wait 30s → Attempt 2 → fail → throw
```

### Retryable errors

| Error | Source |
|-------|--------|
| 429 (rate limited) | Anthropic API |
| 529 (overloaded) | Anthropic API |
| 5xx (server error) | Anthropic API |
| `rate_limit_error` type | Anthropic error body |
| Connection errors (EPIPE, ECONNRESET, socket hang up) | Network |

### Non-retryable errors

| Error | Why |
|-------|-----|
| Quota/billing exceeded | Will never resolve with retries |
| 4xx (except 429) | Client error — retrying won't help |

### Progress during retries

The `onRetry` callback sends a neutral SSE message (`"Still working on your designs..."`) so the user sees activity and the Vercel SSE connection doesn't time out from 60s inactivity.

---

## Rate Limiting (Two Layers)

### Layer 1: Application-level (per-user)

**File:** `lib/rate-limiter.ts`

- **Limit:** 5 requests per 60 seconds per key (IP-based)
- **Production:** Upstash Redis sliding window (shared across all Vercel instances)
- **Local dev:** In-memory sliding window fallback
- **Purpose:** Prevent a single user from overwhelming the pipeline

### Layer 2: API-level (per-provider)

- **Mechanism:** 3s stagger between creative agent launches (`CREATIVE_STAGGER_MS`)
- **Purpose:** Prevent simultaneous API calls from triggering Anthropic rate limits
- **Scope:** Only applies to Step 3 (creative agents) — Step 1 agents are different enough in token size/timing that simultaneous launch hasn't caused issues

These two layers are independent. Layer 1 gates whether a pipeline run starts at all. Layer 2 controls how API calls are spaced within a single pipeline run.

---

## Design Principles for Backend API Calls

Extracted from the production failures documented above. Apply these when adding new agents or modifying the pipeline.

1. **Stagger > simultaneous** for multiple concurrent API calls to the same provider. Even a 2–3s gap between launches dramatically reduces 429/529 risk.

2. **Use `Promise.allSettled`, not `Promise.all`**, when running multiple agents. A single agent failure shouldn't crash the entire pipeline. Persist what you have.

3. **Persist results after every step.** If the pipeline times out or crashes mid-execution, the user still has partial results. Each step writes to the DB before the next step starts.

4. **Stream long-running API calls.** Creative agents use streaming to avoid Vercel/serverless function timeout errors on large `max_tokens` responses.

5. **Keep SSE alive during waits.** Any time the server waits (retries, stagger delays), send a progress message. Vercel's 60s SSE idle timeout will kill the connection otherwise.

6. **Separate retryable from terminal errors.** Don't retry quota/billing errors — they'll never succeed and just burn time. Do retry rate limits and connection errors with backoff.

7. **Don't over-parallelize identical agents.** Step 1's 3 agents are fine in full parallel because they're different types (vision, text, asset extraction) with different token profiles. Step 3's 3 creative agents are identical in shape — launching all 3 simultaneously triggers rate limits.

---

## Short-Term Optimizations

Concrete improvements to creative agent efficiency and output quality. Organized by effort level — DB-tunable changes can be tested immediately via the admin UI, code changes require a deploy.

**Baseline data** (from acehardware.com test run on Sonnet 4.0, see Post-Fix Verification above):

| Agent | Output Tokens | Response Time |
|-------|--------------|---------------|
| creative_classy | 11,584 | 95.5s |
| creative_modern | 11,816 | 98.6s |
| creative_unique | 12,819 | 109.1s |

### DB-Tunable (no code deploy)

**1. Reduce `maxTokens` from 32,768 → 16,000**

- **File:** `lib/pipeline/agents/creative.ts:79` — `skill.maxTokens ?? 32768`
- Current allocation (32K) is 2.5× actual output (11.5K–12.8K). We're paying for headroom we don't use.
- 16K gives ~25% margin above the observed max while halving the per-call allocation.
- **How to test:** Set `maxTokens = 16000` on one creative AgentSkill record. Run 3–5 analyses. Check PromptLog for truncation warnings (`stop_reason: "max_tokens"`). If none, roll out to all 3.

**2. Lower temperature from 0.7 → 0.4–0.5**

- **File:** `lib/pipeline/agents/creative.ts:80` — `skill.temperature ?? 0.7`
- Temperature across agents: screenshot-analysis 0.1, industry-seo 0.2, score 0.3, **creative 0.7**.
- Higher temp = more unpredictable output length, more "hallucinated" HTML structures, wider variance between runs of the same site.
- 0.4–0.5 still produces distinct designs across the 3 agents (Modern/Classy/Unique differentiation comes from the prompt, not temperature) while improving consistency.
- **How to test:** Set `temperature = 0.5` on one creative AgentSkill. Compare output quality and length variance against the 0.7 agents across 5 analyses.

### Code Changes (small, targeted)

**3. Trim `copy` field in creative agent input**

- **File:** `lib/pipeline/analyze.ts:458` — `copy: assetResult.assets.copy`
- The full extracted copy object (hero text, all headlines, body paragraphs, nav items, footer text) is sent to all 3 creative agents. On text-heavy sites, this is 2K–5K input tokens per agent.
- Creative agents need: hero headline, 1–2 value propositions, CTAs, and business name. They don't need full body paragraphs or footer boilerplate.
- **Change:** Build a trimmed copy object before passing to `creativeInput`:
  ```typescript
  copy: {
    businessName: assetResult.assets.copy?.businessName,
    heroHeadline: assetResult.assets.copy?.heroHeadline,
    valueProps: assetResult.assets.copy?.valueProps?.slice(0, 2),
    ctas: assetResult.assets.copy?.ctas,
    navItems: assetResult.assets.copy?.navItems,
  }
  ```
- **Savings:** ~2K–5K input tokens × 3 agents = 6K–15K tokens per refresh.

**4. Reduce `siteImageUrls` from 8 → 3**

- **File:** `lib/pipeline/analyze.ts:448-451`
  ```typescript
  siteImageUrls: assetResult.assets.images
    .map((img) => img.src)
    .filter((src) => isHttpUrl(src))
    .slice(0, 8),  // ← change to .slice(0, 3)
  ```
- 8 image URLs × ~100 chars each × 3 agents ≈ 2K–4K tokens. The generated HTML typically only references the hero image and 1–2 supporting images.
- **Savings:** ~1K–3K tokens per refresh.

**5. Enable Anthropic prompt caching for creative system prompts**

- **File:** `lib/pipeline/agents/creative.ts:89-95`
- All 3 creative agents send the identical system prompt to the API. With the 3s stagger, agents 2 and 3 launch after the system prompt is already processed — ideal for prompt caching.
- **Change:** Add `cache_control` to the system message:
  ```typescript
  const stream = client.messages.stream({
    model,
    max_tokens: maxTokens,
    temperature,
    system: [{ type: "text", text: skill.systemPrompt, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userContent }],
  });
  ```
- **Savings:** ~5–10% reduction in input token cost per refresh. The system prompt is the largest invariant across all 3 calls.

**6. Log output token counts for monitoring**

- **File:** `lib/pipeline/agents/creative.ts:115`
- The Anthropic response includes `response.usage.output_tokens` but the current `createPromptLog()` call doesn't capture it — only `tokensUsed` (which is input + output combined).
- **Change:** Add `outputTokens: response.usage.output_tokens` to the PromptLog entry.
- **Why it matters:** Without per-agent output token counts in the log, we can't validate at scale whether the maxTokens reduction (finding 1) is safe. One test run isn't enough — we need data across diverse sites.

### Priority Order

| # | Finding | Effort | Risk | Impact |
|---|---------|--------|------|--------|
| 6 | Log output tokens | 15 min | None | Enables data-driven decisions for all other changes |
| 1 | Reduce maxTokens | 5 min (DB) | Low | Halves per-call token allocation |
| 2 | Lower temperature | 5 min (DB) | Low | More consistent output quality |
| 4 | Reduce siteImageUrls | 5 min (code) | Low | Saves 1K–3K tokens/refresh |
| 3 | Trim copy field | 30 min (code) | Medium | Saves 6K–15K tokens/refresh |
| 5 | Prompt caching | 1 hr (code) | Low | 5–10% input token cost reduction |
