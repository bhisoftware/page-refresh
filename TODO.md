# Page Refresh — Go-to-Market Todo

## Infrastructure & API Keys

- [ ] **EXA API** — Sign up at https://dashboard.exa.ai/api-keys (free tier available). Add `EXA_API_KEY` to `.env.local` and Vercel env vars (Production + Preview). Powers industry benchmark context in scoring and competitor discovery in admin.
- [ ] **ScreenshotOne** — Confirm production key is set (`SCREENSHOTONE_API_KEY`). Free tier: 100/month. Needed for benchmark scoring screenshots.
- [ ] **Firecrawl** — Confirm production key is set (`FIRECRAWL_API_KEY`). Needed for bot-protected and SPA sites.
- [ ] **Stripe** — Verify `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` are production keys (not test). Confirm webhook endpoint is registered in Stripe dashboard.
- [ ] **Resend** — Verify `RESEND_API_KEY` is production. Confirm sending domain is verified.
- [ ] **Upstash Redis** — Confirm `KV_REST_API_URL` + `KV_REST_API_TOKEN` are set in Vercel. Used for rate limiting + EXA benchmark cache.

## Benchmark Seeding

- [ ] Use admin "Discover Competitors" to seed 5-10 sites per target industry
- [ ] Run "Score All Unscored" to populate numeric benchmark data
- [ ] Verify score agent receives benchmark context (check logs for `[EXA]` and `benchmarkNote` in payloads)
- [ ] Target industries to seed first: Accounting, Legal, Dental, Medical, Real Estate

## Pipeline Validation

- [ ] End-to-end test: run analysis on a known site, verify scores include industry comparison language
- [ ] Graceful degradation: remove `EXA_API_KEY`, confirm pipeline completes without errors
- [ ] Rate limit test: run 2 analyses back-to-back, confirm staggering prevents API failures
- [ ] Mobile preview: currently desktop-only — decide if mobile iframe is needed for launch

## Payments & Delivery

- [ ] Test full purchase flow: analyze → select layout → pay → delivery
- [ ] Verify Stripe webhook processes payment confirmation
- [ ] Confirm delivery email sends with correct layout assets
- [ ] Test with real card (Stripe live mode)

## Domain & Hosting

- [ ] Custom domain configured in Vercel
- [ ] SSL certificate active
- [ ] DNS propagation confirmed
- [ ] Vercel environment variables set for all environments

## Content & Polish

- [ ] Landing page copy finalized
- [ ] How It Works section accurate
- [ ] Pricing page reflects actual Stripe price
- [ ] Legal: Terms of Service, Privacy Policy
- [ ] Favicon and OG image set

## Monitoring

- [ ] Error tracking (Sentry or similar) configured
- [ ] Uptime monitoring on critical endpoints
- [ ] Anthropic API usage dashboard bookmarked (watch for rate limits)
- [ ] EXA API usage dashboard bookmarked
