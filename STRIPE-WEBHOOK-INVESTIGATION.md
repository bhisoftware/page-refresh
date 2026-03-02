# Stripe Webhook Investigation Plan

## Symptom

After successful Stripe Checkout payment, the `/refreshed-layout` page shows "Verifying your payment..." spinner for 30 seconds, then times out with "Taking longer than expected." The layout never loads.

## Evidence

- **DB record** (`cmm8ucogy0003dl6ruxhl4pr3`): `stripeSessionId` is set (checkout worked), but `stripePaymentStatus` is still `"pending"`, `paidAt` is null. **The webhook never updated this record.**
- **Webhook endpoint is reachable**: `POST /api/webhooks/stripe` with a fake signature returns `400 "Invalid signature"` — the route works, Stripe just isn't hitting it (or the signature is mismatched).
- **No `stripeSessionId` index**: The payment-status polling queries `findFirst({ where: { stripeSessionId } })` without an index, making polls slower than needed.

## Root Causes to Verify (in priority order)

### 1. Stripe Dashboard Webhook Configuration
**Most likely cause.** Check if a webhook endpoint is configured in Stripe Dashboard:
- Go to **Developers > Webhooks**
- Confirm an endpoint exists for `https://pagerefresh.ai/api/webhooks/stripe`
- Confirm it listens for `checkout.session.completed` and `checkout.session.expired`
- Check the **Attempts** tab — are there failed deliveries? What status codes?

### 2. STRIPE_WEBHOOK_SECRET Mismatch
If the webhook IS configured but deliveries fail with signature errors:
- Each webhook endpoint in Stripe has its own signing secret (`whsec_...`)
- The `STRIPE_WEBHOOK_SECRET` on Vercel must match the signing secret shown on the webhook endpoint page
- If you created the endpoint, then changed or recreated it, the secret changes

### 3. Missing Database Index on stripeSessionId
**File:** `prisma/schema.prisma`
The `stripeSessionId` field has no `@@index`. The payment-status polling endpoint uses `findFirst({ where: { stripeSessionId } })` which does a sequential scan. Not the root cause of the webhook failure, but contributes to slow polling.

**Fix:** Add `@@index([stripeSessionId])` to the Refresh model and run a migration.

### 4. NEXT_PUBLIC_APP_URL Previously Broken
The `NEXT_PUBLIC_APP_URL` was missing `https://` which broke checkout URLs. This is now fixed with a fallback in `app/api/checkout/route.ts`. However, the webhook route itself doesn't use this var, so it's not the webhook issue.

## Action Items

### Immediate (fix the webhook)
1. [ ] Verify webhook endpoint exists in Stripe Dashboard at `https://pagerefresh.ai/api/webhooks/stripe`
2. [ ] If not configured: create it, listening for `checkout.session.completed` + `checkout.session.expired`
3. [ ] Copy the signing secret and verify it matches `STRIPE_WEBHOOK_SECRET` on Vercel
4. [ ] If the secret was wrong: update it on Vercel and redeploy
5. [ ] Manually mark the test payment as paid in DB (or refund and retry)

### Performance (add index)
6. [ ] Add `@@index([stripeSessionId])` to Refresh model in `prisma/schema.prisma`
7. [ ] Run `npx prisma migrate dev --name add-stripe-session-index`

### Verification
8. [ ] Trigger a new test payment and confirm:
   - Stripe Dashboard shows successful webhook delivery (200)
   - DB record updates to `stripePaymentStatus: "paid"`
   - `/refreshed-layout` page loads the layout + scheduling modal

## Quick Manual Fix for the Stuck Payment

To unblock the test payment that already went through, run:
```sql
UPDATE "Refresh"
SET "stripePaymentStatus" = 'paid',
    "paidAt" = NOW(),
    "paidEmail" = 'test@example.com'
WHERE id = 'cmm8ucogy0003dl6ruxhl4pr3';
```
Then reload `/refreshed-layout?session_id=cs_test_a1M3nRDhpPcZnqMS1vlQkDN8k2UIRSJZPIFC2EHxSnanpRN6srRXNtWNQk` to verify the page renders correctly.
