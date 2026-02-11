# Phase 4: Error Handling & Fallbacks Checklist

**Goal**: Robust error handling throughout the analysis pipeline and UI.

Reference: `MVP-PLAN.md` § Phase 4, `docs/CURSOR-AGENT.md`, `docs/CLAUDE-CODE-AGENT.md`

---

## 4.1 Screenshot Blocking & Fallback Chain

**File**: `lib/scraping/fallback-scrapers.ts` (new)

- [ ] **Create fallback-scrapers module**
  - Primary: Puppeteer (existing `captureScreenshotAndHtml` in `puppeteer.ts`)
  - Fallback 1: Playwright (if Puppeteer fails)
  - Fallback 2: Screenshot API service (if both fail)
  - Fallback 3: User-friendly error message

- [ ] **Integrate fallback chain into pipeline**
  - Update `lib/pipeline/analyze.ts` to use fallback chain instead of direct Puppeteer call
  - On all failures: surface message: *"This website blocks automated access. Please try a different URL or contact us."*

- [ ] **Verification**
  - [ ] Test with a URL known to block headless browsers (e.g., Cloudflare-protected)
  - [ ] Verify fallback chain attempts in correct order
  - [ ] Verify user sees helpful message, not raw stack trace

---

## 4.2 API Rate Limiting

**Files**: `lib/ai/claude-text.ts`, `lib/ai/claude-vision.ts`, `lib/ai/openai.ts`, `lib/pipeline/analyze.ts`

- [ ] **Detect rate limit responses**
  - Claude: 429 status or specific rate-limit error codes
  - OpenAI: 429 status

- [ ] **Retry logic with exponential backoff**
  - On rate limit: save progress (where possible)
  - Show user: *"Analysis paused due to API limits. Retrying in 10 seconds..."*
  - Auto-retry after delay (e.g., 10s, then 30s)
  - Max retries: 2–3 attempts

- [ ] **Persist/stream retry status**
  - Emit progress event during retry so UI can show "Retrying..." state

- [ ] **Verification**
  - [ ] Simulate rate limit (if possible) or document manual test
  - [ ] Verify retry happens and analysis eventually completes or fails gracefully
  - [ ] Verify user sees retry message, not generic error

---

## 4.3 Industry Detection Fallback

**Files**: `lib/ai/claude-text.ts`, `lib/pipeline/analyze.ts`, results UI (for low-confidence flow)

- [ ] **Low-confidence handling** (confidence < 0.7)
  - Return top 3 industry options instead of single choice
  - Store `industryOptions: string[]` or similar in Analysis if schema supports it
  - UI: Show "Select your industry" with 3 options for user to pick

- [ ] **No-match fallback** (confidence = 0 or no valid industry)
  - Use `"General Business"` category with generic scoring
  - Continue pipeline; do not block analysis

- [ ] **Verification**
  - [ ] Test with ambiguous URL (e.g., multi-industry site)
  - [ ] Verify low-confidence triggers industry picker (if implemented) or General Business
  - [ ] Verify analysis completes when industry is unclear

---

## 4.4 Layout Generation Fallback

**Files**: `lib/templates/selector.ts`, `lib/templates/injector.ts`, `lib/templates/copy-refresher.ts`, `lib/pipeline/analyze.ts`

- [ ] **OpenAI template selection fallback**
  - If `selectTemplates` (OpenAI) fails: use rule-based selection (industry → templates)
  - File: add `selectTemplatesFallback(industry: string)` or similar

- [ ] **Asset injection fallback**
  - If `injectAssets` fails for a layout: use template with placeholders
  - Add warning to UI or scoring details: *"Some assets could not be injected; using placeholders"*

- [ ] **Copy refresh fallback**
  - If `refreshCopy` fails for a layout: keep original placeholder text
  - Continue with other layouts; don’t fail entire pipeline

- [ ] **Verification**
  - [ ] Simulate OpenAI failure (invalid key or rate limit) and verify rule-based templates used
  - [ ] Verify malformed assets don’t crash injector; placeholders used instead
  - [ ] Verify partial copy refresh failure doesn’t block completion

---

## 4.5 Global Error Boundary

**File**: `app/error.tsx` (new)

- [ ] **Create Next.js error boundary**
  - Catch-all for unhandled errors in app
  - Friendly message: *"Something went wrong. Please try again."*
  - "Try Again" button (resets/redirects appropriately)
  - Optional: "Go Home" link to `/`

- [ ] **Error logging**
  - Log error to console (or external service) for debugging
  - Optional: persist to database (e.g., `ErrorLog` model) for post-launch analysis

- [ ] **Verification**
  - [ ] Trigger an unhandled error (e.g., throw in a page)
  - [ ] Verify error boundary catches it and shows friendly UI
  - [ ] Verify "Try Again" / "Go Home" works
  - [ ] Verify no sensitive stack traces exposed to user

---

## 4.6 API & Form Error Handling (Existing – Review)

**Files**: `app/api/analyze/route.ts`, `app/page.tsx`, `components/RequestQuoteForm.tsx`, `components/RequestInstallForm.tsx`

- [ ] **Analyze API**
  - [ ] Confirm SSE stream emits `type: "error"` with clear `message`
  - [ ] Confirm non-streaming POST returns `{ error: string }` with appropriate status codes
  - [ ] Confirm URL validation errors return 400 with actionable message

- [ ] **Request Quote / Request Install**
  - [ ] Confirm validation errors (missing fields) show toast with specific message
  - [ ] Confirm 404 (analysis not found) handled gracefully
  - [ ] Confirm network errors show generic "Something went wrong" and don’t crash UI

---

## Verification Summary (Post Phase 4)

From `docs/CLAUDE-CODE-AGENT.md`:

- [ ] Blocked sites show helpful error message (not stack trace)
- [ ] API rate limits trigger retry logic
- [ ] Low-confidence industry detection shows options or uses General Business
- [ ] Failed layout generation falls back gracefully
- [ ] Global error boundary catches unhandled errors and shows friendly UI
- [ ] No raw errors or stack traces exposed to end users

---

## Quick Reference

| Area           | Primary Behavior                        | Fallback / Error Message                                      |
|----------------|------------------------------------------|---------------------------------------------------------------|
| Screenshot     | Puppeteer → Playwright → Screenshot API  | "This website blocks automated access. Please try a different URL or contact us." |
| Rate limit     | Retry after delay (10s, 30s)             | "Analysis paused due to API limits. Retrying in 10 seconds..." |
| Industry       | Single industry if confidence ≥ 0.7      | Top 3 options or "General Business"                           |
| Layout select  | OpenAI template selection                | Rule-based (industry → templates)                             |
| Asset inject   | Inject extracted assets                  | Placeholders + warning                                        |
| Copy refresh   | AI-refreshed copy per layout             | Original placeholders if API fails                            |
| Unhandled      | Normal render                            | Error boundary: "Something went wrong. Please try again."     |
