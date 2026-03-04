# Page Refresh — Branding Reference

When the brand changes (logo, colors, name), update everything listed below.

## Brand Identity

| Element | Value |
|---------|-------|
| Name | Page Refresh |
| Domain | pagerefresh.ai |
| Primary color | `#2d5a3d` (forest green) |
| Text color | `#18181b` (near-black) |
| Badge background | `#f5f0eb` (warm beige) |
| Badge hover | `#1e4a2e` (dark green) |
| Icon | Wand SVG (Lucide `wand-2` variant) |

## Logo Assets (code-managed)

| File | Purpose | Notes |
|------|---------|-------|
| `components/Logo.tsx` | React components: `<Logo />`, `<LogoIcon />`, `WAND_SVG_PATH` | Uses `currentColor` — inherits from parent |
| `app/icon.svg` | Favicon | Auto-served by Next.js metadata convention |
| `public/logo-icon.svg` | Standalone icon (64x64) | For marketing, social, external use. Hardcoded `#2d5a3d` stroke |
| `public/logo-full.svg` | Icon + "Page Refresh" text (220x40) | For headers, marketing materials |
| `public/manifest.json` | Web manifest | References `/logo-icon.svg` |

## Code Locations Using Logo/Brand

Update these files if the logo SVG path, colors, or brand name changes:

### Logo icon used directly
| File | What | Details |
|------|------|---------|
| `components/Logo.tsx` | React component | Central source — `WAND_SVG_PATH` constant |
| `app/page.tsx` | Homepage heading | Uses `<LogoIcon size={32} />` |
| `app/results/[id]/page.tsx` | Results page header | Uses `<Logo />` linking to `/` |
| `app/refreshed-layout/page.tsx` | Post-purchase page header | Uses `<Logo />` linking to `/` |
| `components/admin/AdminTabNav.tsx` | Admin nav bar | Uses `<Logo />` linking to `/admin` |
| `lib/email.ts` (~line 52) | Email header | **Inline SVG** — must be updated separately from the React component |
| `lib/layout-badge.ts` | Attribution in customer layouts | HTML comment + tracking pixel (no visible logo currently) |

### Brand name / domain text
| File | What |
|------|------|
| `app/layout.tsx` | Page title, OG metadata |
| `lib/email.ts` | Email sender name, subject lines, footer |
| `lib/zip-builder.ts` | ZIP readme, HTML titles |
| `lib/exports/platform-exporter.ts` | Platform export READMEs, HTML titles, function names |
| `lib/layout-badge.ts` | HTML comment attribution |
| `lib/scraping/fetch-external-css.ts` | User-Agent string: `"pagerefresh/1.0"` |
| `public/manifest.json` | App name |
| `package.json` | Package name |

### Brand colors used directly
| File | Color | Where |
|------|-------|-------|
| `lib/email.ts` | `#2d5a3d` | Email header SVG stroke |
| `public/logo-icon.svg` | `#2d5a3d` | Standalone icon |
| `public/logo-full.svg` | `#2d5a3d`, `#18181b` | Icon stroke, text fill |
| `app/icon.svg` | `#2d5a3d` | Favicon |
| `app/page.tsx` | `#2d5016` | Submit button active state (note: slightly different green) |

## External Services (update manually)

These are NOT managed by code. When the brand changes, log into each service and update:

### Stripe
- **Dashboard → Settings → Business → Branding**: Upload logo, set brand color, accent color
- **Dashboard → Settings → Business → Customer emails**: Logo appears on receipts/invoices
- **Dashboard → Settings → Business → Public details**: Business name, support email, icon
- URL: https://dashboard.stripe.com/settings/branding

### Resend
- **Sender avatar**: Upload logo for email sender identity
- **Domain settings**: Verify `pagerefresh.ai` domain
- URL: https://resend.com/domains

### Vercel
- **Project settings → General**: Project icon
- **OG image**: If using Vercel's automatic OG image generation
- URL: https://vercel.com/dashboard

### Social Profiles
- Twitter/X: Profile picture, header image
- LinkedIn: Company logo, cover image
- Any other profiles using the Page Refresh brand

### Google Search Console / Analytics
- Site icon/favicon is auto-detected
- Verify ownership if domain changes

## SVG Path Data

The wand icon SVG path (for copy-paste into any context):

```
M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4
```

ViewBox: `0 0 24 24` | Stroke-based (no fill) | Stroke-width: 2 | Linecap/linejoin: round
