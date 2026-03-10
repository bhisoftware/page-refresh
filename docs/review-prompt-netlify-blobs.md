# Prompt: Review whether Netlify Blobs is still active in this codebase

I'm reviewing our PageRefresh codebase and want to know definitively whether Netlify Blobs is still being used as an active, production dependency — or whether it should be removed or replaced.

## Background

A previous Claude Code session described Netlify Blobs as the screenshot storage layer. I want to independently verify whether that's accurate, whether the code is live and wired into the pipeline, and whether there's any plan or signal in the codebase suggesting it should be migrated away from.

## What to investigate

1. **Is `@netlify/blobs` actively used?**
   - Check `package.json` for the dependency
   - Check `lib/storage/netlify-blobs.ts` for the implementation
   - Check `lib/pipeline/analyze.ts` to see if `uploadBlob` is called and under what conditions

2. **Is it gated or always-on?**
   - Does it require a `NETLIFY_BLOBS_TOKEN` env var? What happens if it's not set?
   - Is there a fallback path? If so, what does it fall back to?

3. **Is there any sign it's being replaced or is deprecated?**
   - Any comments, TODOs, or `.env.example` notes suggesting migration away from it?
   - Any references to alternative storage (S3, Supabase Storage, Cloudflare R2, etc.)?

4. **Is the stored screenshot ever actually retrieved and displayed?**
   - Check `/api/blob/` route to see if the blob is served back to the client
   - Check the results page to see if `screenshotUrl` from the `Refresh` record is rendered

## Answer I'm looking for

- "Yes, Netlify Blobs is actively wired in and used in production" — or —
- "It's present in the code but gated/inactive" — or —
- "It appears to be a legacy dependency that should be cleaned up"

Please read the relevant files directly and give me a clear, evidence-based answer with file:line references.
