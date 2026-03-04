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
| Icon | Custom magic wand SVG with gold sparkles and dust trail |

## Logo Assets (code-managed)

| File | Purpose | Notes |
|------|---------|-------|
| `components/Logo.tsx` | React components: `<Logo />`, `<LogoIcon />`, `wandSvgInner()` | Hardcoded brand colors; static `pr-wand-glow` filter ID |
| `app/icon.svg` | Favicon | Auto-served by Next.js metadata convention |
| `public/logo-icon.svg` | Standalone icon (64x64) | For marketing, social, external use. Hardcoded `#2d5a3d` stroke |
| `public/logo-full.svg` | Icon + "Page Refresh" text (220x40) | For headers, marketing materials |
| `public/manifest.json` | Web manifest | References `/logo-icon.svg` |

## Code Locations Using Logo/Brand

Update these files if the logo SVG path, colors, or brand name changes:

### Logo icon used directly
| File | What | Details |
|------|------|---------|
| `components/Logo.tsx` | React component | Central source — `LogoIcon` component + `wandSvgInner()` helper |
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
| `lib/email.ts` | Multi-color | Email header wand (see SVG design specs) |
| `public/logo-icon.svg` | Multi-color | Standalone wand icon |
| `public/logo-full.svg` | Multi-color, `#18181b` | Wand icon + text fill |
| `app/icon.svg` | Multi-color | Favicon wand |
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

## SVG Design Specs

Custom magic wand with 3-segment body, gold sparkles, and dust trail.

| Element | Details |
|---------|---------|
| ViewBox | `0 0 24 24` |
| Wand base | `(14,9) → (10.5,15.5)` — outline `#1a3d28`/1.1, fill `#2d5a3d`/0.8 |
| Wand mid | `(15.8,5.5) → (14,9)` — outline `#1a3d28`/1.1, fill `#7faa8e`/0.8 |
| Wand tip | `(17.2,2.5) → (15.8,5.5)` — outline `#1a3d28`/1.1, fill `#fff8e7`/0.8 + gaussian blur glow |
| Dust trail | Dashed arc path, `#7faa8e`/0.7, opacity 0.5 |
| Dust particles | 5 circles along arc, `#c9942e`/`#d4a84b`, fading opacity |
| Sparkles | 3 star shapes at tip, `#c9942e`/`#d4a84b`, largest has glow filter |
| Filter | Gaussian blur (stdDeviation=1) + merge for glow effect |

### Brand colors used in wand
| Color | Usage |
|-------|-------|
| `#1a3d28` | Wand outline (darker green) |
| `#2d5a3d` | Wand base fill (primary green) |
| `#7faa8e` | Wand mid fill, dust trail (light green) |
| `#fff8e7` | Wand tip fill (warm white) |
| `#c9942e` | Sparkles, dust particles (dark gold) |
| `#d4a84b` | Sparkles, dust particles (light gold) |
