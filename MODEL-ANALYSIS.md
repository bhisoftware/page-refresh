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
