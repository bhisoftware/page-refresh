# Session Summary: Pipeline Resilience & Scalability

## What Happened

Two analyses failed on 3/4/2026 with different symptoms but the same root cause pattern:

**Failure 1: midtownautowerks.com (10:42 AM)**
- Status stuck at `fetching`, score 0, industry "Unknown", empty `htmlSnapshot`
- The pipeline created the Refresh row, then crashed during `fetchHtml()` — likely a network/timeout issue
- No try/catch around the fetch phase → error never persisted → status stayed "fetching" forever
- Results page rendered a broken score-0 page because it doesn't check status

**Failure 2: anderson-repair.com (11:35 AM)**
- Status stuck at `generating`, score 28, industry "Auto Repair"
- Screenshot analysis, industry/SEO, and scoring all completed successfully (3 prompt logs)
- Zero creative agent prompt logs — all 3 Sonnet API calls failed before completing
- **ziaauto.com completed 3 Sonnet creative calls at 11:26 AM** — just 9 minutes before
- The creative agents almost certainly hit API rate limits from the prior analysis
- Pipeline crashed during creative phase → no safety net → status stayed "generating" forever

**The common pattern:** When any pipeline phase crashes, the status stays in a transient state (`fetching`, `analyzing`, `scoring`, `generating`) because there was no top-level error handler to clean up.

---

## What We Changed (already implemented)

### 1. Fetch phase: try/catch + auto-retry (`lib/pipeline/analyze.ts`)
- Wraps `fetchHtml` + `captureScreenshotCloud` in try/catch
- On failure: waits 3s, retries `fetchHtml` once (transparent to user)
- If retry also fails: persists `status: "failed"`, `errorStep: "fetching"`, error message to DB
- Tracks retry count on UrlProfile (`lastFetchRetries` field) for admin visibility

### 2. Top-level pipeline safety net (`lib/pipeline/analyze.ts`)
- All pipeline code after refresh creation is wrapped in try/catch
- On any uncaught crash: reads current status, if transient → marks as `"failed"` with error details
- Ensures status **never** stays stuck in a transient state regardless of where the crash happens

### 3. Results page: failed-state detection (`app/results/[id]/page.tsx`)
- Checks `status` + `errorStep` + `overallScore` to detect fetch-failed analyses
- First visit to a failed analysis: renders `<FailedAnalysisRedirect>` → auto-redirects to homepage
- After retry (`?retried=1`): renders static "couldn't analyze" page with manual "Try Again" button

### 4. FailedAnalysisRedirect component (`components/FailedAnalysisRedirect.tsx`)
- Client component showing "Retrying your analysis..." message
- Auto-redirects to `/?retry=<url>` after 2.5s via `router.replace()`

### 5. Homepage: retry support (`app/page.tsx`)
- `?retry=<url>`: auto-populates URL input and programmatically submits the form
- `?url=<url>`: pre-fills input only (for manual "Try Again" button)
- Tracks retry attempts to append `&retried=1` on polling fallback (prevents redirect loops)
- 3-layer loop prevention: one-shot param, retried flag, errors stay on homepage

### 6. Schema change (`prisma/schema.prisma`)
- Added `lastFetchRetries Int @default(0)` to `UrlProfile`
- Applied via `prisma db push`

---

## The Core Scalability Problem

The pipeline runs **3 concurrent Claude Sonnet API calls** per analysis for creative layout generation. Each takes ~100 seconds. This creates a hard constraint:

- **Anthropic API rate limits** (requests/min, tokens/min) mean running 2 analyses within ~10 minutes of each other can exhaust the quota
- **We cannot confidently run back-to-back analyses** — there's an undefined cooldown window between analyses where the second one will fail
- **Concurrent users are impossible** — if 2 users submit URLs at the same time, at least one will likely fail
- **The 3-second stagger between creative agents** helps avoid spiking the API within a single analysis, but does nothing for cross-analysis rate limiting

This is a **blocking issue for scaling beyond single-user testing**.

---

## Recommendations

### Immediate (before launch)

**A. Job queue with concurrency control**
Replace the current "run everything in the SSE request" architecture with a queue:
- User submits URL → preflight + create Refresh row → enqueue job → return immediately
- Background worker processes jobs with controlled concurrency (max 1 creative batch at a time)
- Client polls `/api/analyze/[id]/status` for progress (already exists as fallback)
- Eliminates SSE timeout issues, rate limit collisions, and stale status bugs
- Options: BullMQ + Redis, or a simple DB-based queue (poll `status = "queued"` rows)

**B. Cross-analysis rate limit awareness**
Before starting creative agents, check when the last creative batch completed:
```
If last creative batch finished < N minutes ago → delay start or queue
```
This prevents the exact failure we saw (ziaauto → anderson-repair).

**C. Retry creative agents independently**
Currently if all 3 fail, the pipeline logs the error but doesn't retry. The creative phase should:
- Retry each failed agent once after a longer backoff (30-60s)
- If 2/3 succeed, finalize with partial layouts (already supported by the results page)

### Medium-term (scaling)

**D. Model flexibility for creative agents**
- Consider Claude Haiku for creative agents — faster, cheaper, higher rate limits
- Or use a tiered approach: Haiku for first draft, Sonnet for refinement only if needed
- Make this configurable per-agent via the `modelOverride` field on `AgentSkill`

**E. API key rotation / pooling**
- Multiple Anthropic API keys spread across creative agent calls
- Round-robin or least-recently-used selection
- Effectively multiplies rate limit capacity

**F. Async delivery with notifications**
- Don't make users wait 2-5 minutes on a loading screen
- Submit → "We're working on your analysis, we'll email you when it's ready"
- Background processing with email notification on completion
- Much better UX and eliminates all SSE/timeout concerns

### Long-term

**G. Pre-generation / caching layer**
- For common industries, pre-generate layout templates
- Creative agents customize rather than generate from scratch
- Dramatically reduces API calls and processing time

---

## Files Changed in This Session

| File | Change | Status |
|------|--------|--------|
| `lib/pipeline/analyze.ts` | Fetch retry, top-level safety net | Done |
| `prisma/schema.prisma` | `lastFetchRetries` on UrlProfile | Done |
| `app/results/[id]/page.tsx` | Failed-state detection + redirect | Done |
| `components/FailedAnalysisRedirect.tsx` | Auto-retry redirect component | Done |
| `app/page.tsx` | `?retry=` auto-submit, `?url=` pre-fill, Suspense wrapper | Done |
