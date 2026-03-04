# Image & Creative Pipeline — Open Issues

Identified during the broken-images investigation (blob URL fix shipped in `2686f41`, March 4 2026).

---

## 1. Creative Agent Image Hallucination

**Problem**: When `heroImageUrl` or `logoUrl` is null (or when the agent decides provided images don't fit), creative agents invent image URLs and alt text instead of following prompt guidance. Example from newenglandautomotive.com: agents generated `<img alt="Auto repair service illustration">` — the site has no "illustrations," only photos of the real shop.

**Current prompt says**: "If no hero image is available at all, use a full-width gradient" and "Do NOT use placeholder images, generate fake image URLs." But agents still hallucinate.

**Potential fix**: Strengthen the IMAGE USAGE section in `scripts/seed-agent-skills.ts` (version bump to 9). Be more explicit:
- If `logoUrl` is null → use business name as styled text, never an `<img>` tag
- If `heroImageUrl` is null → gradient hero using brand colors, never an `<img>` with invented URL
- Every `<img src>` must use a URL verbatim from the brandAssets JSON — if not in the input, the image does not exist

**Effort**: Small (prompt edit + seed). **Risk**: Low. **Impact**: Prevents broken image placeholders when assets fail to extract.

---

## 2. Two-Tier Image Storage (Fragile Original URLs)

**Problem**: The pipeline provides two kinds of image URLs to creative agents:
- **S3-backed** (reliable): `logoUrl`, `heroImageUrl`, `additionalImageUrls` — downloaded, stored in S3, served via `/api/blob/`
- **Original domain** (fragile): `siteImageUrls`, `teamPhotos`, `trustBadges`, `eventPhotos` — raw URLs from the scraped HTML, never downloaded

Original domain URLs can break if the site rate-limits, blocks non-browser requests, uses CDN auth tokens, or goes down. The creative agents embed these URLs directly in the layout HTML.

**Potential fix**: Download and store the top N `siteImageUrls` in S3 during asset extraction, converting them to reliable `/api/blob/` URLs before passing to agents. This extends the existing `extractAndPersistAssets` flow in `lib/pipeline/asset-extraction.ts`.

**Effort**: Medium (extend download loop, increase `MAX_DOWNLOADS`). **Risk**: Increases S3 storage and extraction time. **Impact**: All images in creative layouts become self-hosted and reliable.

---

## 3. Silent Asset Extraction Failures

**Problem**: `extractAndPersistAssets()` wraps everything in `try/catch` and silently logs errors. If image downloads fail (timeout, 403, etc.), `storedAssets` is just shorter — no indication is passed to creative agents about what's missing. The agents receive `logoUrl: null` with no explanation, leading to hallucination (issue #1).

**Potential fix**:
- Add a `missingAssets` or `extractionNotes` field to `CreativeAgentInput` listing what failed (e.g., "logo download timed out", "no hero image found in HTML")
- Agents can then make informed fallback decisions
- Also: log which assets succeeded/failed for debugging

**Effort**: Small-medium. **Risk**: Low. **Impact**: Better agent decisions + easier debugging.

---

## 4. No Post-Generation URL Validation

**Problem**: After a creative agent generates HTML, there's no check that the image URLs in the output match the URLs that were provided. The agent could hallucinate entirely new URLs and they'd be stored as-is.

**Potential fix**: After parsing the creative output, scan the HTML for `<img src>` URLs. Warn (or strip) any `src` that doesn't match a known provided URL (blob URLs, siteImageUrls, etc.). Could replace unknown images with a transparent pixel or remove the `<img>` tag entirely.

**Effort**: Medium. **Risk**: Medium (must not accidentally strip valid URLs). **Impact**: Guarantees no hallucinated images reach the user.

---

## 5. S3 Presigned URL Expiry

**Problem**: The `/api/blob/[key]` route generates S3 presigned URLs with a 1-hour expiry, then 302-redirects the browser. If someone opens results hours later and the browser cache is cold, the presigned URL may have expired in cached redirects.

**Current behavior**: Each request to `/api/blob/[key]` generates a fresh presigned URL, so this should work fine for direct loads. The risk is if browser-cached 302 redirects reuse a stale presigned URL.

**Severity**: Low — likely not causing real issues since the 302 is re-fetched on each page load. Worth monitoring but probably not worth fixing now.

---

## 6. `sandbox="allow-scripts"` Without `allow-same-origin`

**Problem**: Layout iframes use `sandbox="allow-scripts"` but not `allow-same-origin`. This gives the iframe a unique opaque origin, meaning it can't access cookies, localStorage, or make same-origin requests to the parent app. For image loading this is fine (images load via standard HTTP), but it could cause issues for future features (e.g., interactive layouts that call back to the app).

**Current impact**: None — the blob URL rewriting fix handles image loading. But this is a design decision worth being aware of.

**Note**: Adding `allow-same-origin` would let the iframe's scripts access the parent page's origin, which is a security consideration since the HTML is AI-generated.

---

## Summary by Priority

| # | Issue | Effort | Impact | Recommend |
|---|-------|--------|--------|-----------|
| 1 | Agent hallucination | Small | High | Yes — next |
| 2 | Store siteImageUrls in S3 | Medium | High | Yes — soon |
| 3 | Silent extraction failures | Small | Medium | Yes — with #1 |
| 4 | Post-generation URL validation | Medium | Medium | Consider |
| 5 | S3 presigned URL expiry | Low | Low | Monitor |
| 6 | Iframe sandbox restrictions | None | Low | Awareness only |
