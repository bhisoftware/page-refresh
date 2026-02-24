# Phase 3 Handoff: Admin Tooling

> **Status:** Waiting for Phase 1 | **Created:** Feb 24, 2026
> **Executor:** Cursor | **Reviewer:** Claude Code
> **Prerequisite:** Phase 1 complete. Can run in parallel with Phase 2 (admin-only, no pipeline changes).

---

## Goal

Give admins the tools to manage API keys, edit agent system prompts, paginate data, and view URL profiles — all without redeploying. No user-facing changes.

---

## 1. Admin Tab Navigation

### `components/admin/AdminTabNav.tsx`

Horizontal tab bar at the top of all admin pages.

**Tabs:**
| Label | Route | Active When |
|---|---|---|
| Analyses | `/admin` | pathname === `/admin` |
| Benchmarks | `/admin/benchmarks` | pathname starts with `/admin/benchmark` |
| Settings | `/admin/settings` | pathname starts with `/admin/settings` |

**Implementation:**
- Use `usePathname()` from `next/navigation` for active state
- Style: underline active tab, muted text for inactive
- Match existing admin page styling (dark theme, muted foreground)
- Render in admin layout so it appears on all admin pages

**Modify:** `app/admin/layout.tsx` (or create one if it doesn't exist) to include `<AdminTabNav />` above the page content.

---

## 2. Admin Pagination

### `components/admin/AdminPagination.tsx`

Reusable pagination component for all admin tables.

**Props:**
```typescript
interface AdminPaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  pageSizeOptions?: number[];  // default [50, 100]
  basePath: string;            // e.g. "/admin" — builds URLs like "/admin?page=2&pageSize=100"
}
```

**UI:**
- Top-right: page size dropdown (50 / 100)
- Bottom: "Page 1 of 7" with Previous / Next buttons
- Previous disabled on page 1, Next disabled on last page
- Page and pageSize stored as URL search params (survive refresh)

### Apply to `/admin` (Analyses table)

**Current:** `app/admin/page.tsx` uses `PAGE_SIZE = 30` with no pagination.

**Change to:**
```typescript
const page = Number(searchParams?.page ?? 1);
const pageSize = Number(searchParams?.pageSize ?? 50);

const [items, total] = await Promise.all([
  prisma.refresh.findMany({
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    // ... existing select
  }),
  prisma.refresh.count(),
]);
```

Use server-side pagination with `searchParams`. Render `<AdminPagination>` at bottom of table.

---

## 3. API Settings Page

### Route: `app/admin/settings/page.tsx`

### 3.1 Provider Cards

Each API provider gets a card section. Initial providers:

**Anthropic (Claude)**
| Config Key | Type | Description |
|---|---|---|
| `api_key` | encrypted | sk-ant-... |
| `default_model` | text | claude-sonnet-4-20250514 |

**OpenAI**
| Config Key | Type | Description |
|---|---|---|
| `api_key` | encrypted | sk-... |
| `default_model` | text | gpt-4o |

**ScreenshotOne**
| Config Key | Type | Description |
|---|---|---|
| `api_key` | encrypted | ... |

### Provider Card UI

```
┌─────────────────────────────────────────────────┐
│ ● Anthropic — Claude                     [Test] │
│                                                  │
│ API Key:    sk-ant-...xK7f       [Edit] [Copy]  │
│ Model:      claude-sonnet-4-20250514     [Edit]  │
│ Status:     Connected ✓                          │
│ Last tested: 2 minutes ago                       │
│                                                  │
│ [View Agent Skills →]                            │
└─────────────────────────────────────────────────┘
```

- Green dot: key configured + test passed
- Yellow dot: key configured, not tested or test failed
- Gray dot: not configured (using env fallback)
- `[Test]` calls test endpoint
- Keys always masked: show only last 4 chars (`sk-ant-...xK7f`)
- Key fully visible only during initial entry

### Security Rules
- Never display full API key after save — server masks before sending to client
- Confirm dialog before delete or deactivate
- Rate limit test endpoint (max 5 tests/minute)

### 3.2 "View Agent Skills" Entry Point

Single button on the Anthropic card opens the Skills Editor. NOT per-provider — all 6 skills are Claude-based and listed in one editor.

---

## 4. API Routes for Settings

All routes use `isAdminAuthenticated()` from `lib/admin-auth.ts`.

### `app/api/admin/settings/configs/route.ts` — GET + POST

**GET:** List all configs grouped by provider.
- Mask encrypted values: `sk-ant-...{last4}`
- Include: provider metadata, active status, last updated

**POST:** Create/update config.
```typescript
Body: { provider: string, configKey: string, configValue: string, label?: string, encrypted?: boolean }
```
- If `encrypted: true`, call `encrypt(configValue)` before storing
- Validate `provider` is in `["anthropic", "openai", "screenshotone"]`

### `app/api/admin/settings/configs/[id]/route.ts` — PUT + DELETE

**PUT:** Update value, label, or active status. Re-encrypt if `encrypted`.
**DELETE:** Remove config. Confirm required on client.

### `app/api/admin/settings/configs/test/route.ts` — POST

```typescript
Body: { provider: string }
```

**Behavior per provider:**
- `anthropic`: `client.messages.create()` with minimal prompt, verify 200 response
- `openai`: `client.models.list()`, verify response
- `screenshotone`: `fetch("https://api.screenshotone.com/take?access_key=...")` with minimal params

**Response:** `{ success: boolean, error?: string, latency?: number }`

### `app/api/admin/settings/skills/route.ts` — GET

List all agent skills (no full prompt — too large for list).
Return: `agentSlug`, `agentName`, `category`, `active`, `version`, `updatedAt`

### `app/api/admin/settings/skills/[slug]/route.ts` — GET + PUT

**GET:** Full skill detail including `systemPrompt`, `outputSchema`, `modelOverride`, `maxTokens`, `temperature`.

**PUT:** Update skill.
```typescript
Body: { systemPrompt?: string, outputSchema?: object, modelOverride?: string, maxTokens?: number, temperature?: number, active?: boolean, editedBy?: string, changeNote?: string }
```
- Auto-increment `version`
- Archive current version to `AgentSkillHistory` before updating
- Set `lastEditedBy`
- Return updated skill

### `app/api/admin/settings/skills/[slug]/history/route.ts` — GET

Return all historical versions for this skill, newest first.

### `app/api/admin/settings/skills/[slug]/rollback/route.ts` — POST

```typescript
Body: { version: number }
```
- Load historical version
- Archive current to history
- Replace current with historical
- Increment version (rollback = new version)

---

## 5. Skills Editor

Full-screen modal or dedicated panel opened from Anthropic provider card.

### Layout

**Left panel:** Agent list grouped by category
- **Pipeline Agents:** Screenshot Analysis, Industry & SEO, Score
- **Creative Agents:** Modern, Classy, Unique
- Active agent: filled indicator. Inactive: dimmed.
- Click to load in right panel.

**Right panel:** Editor for selected skill
- **Header:** Agent name, version number, last edited date
- **Model Override:** Dropdown — `claude-sonnet-4-20250514`, `claude-opus-4-20250514`, or empty (use provider default)
- **Max Tokens:** Number input
- **Temperature:** Number input (0.0–1.0, step 0.1)
- **System Prompt:** Large monospace textarea. Show character count.
- **Output Schema:** JSON editor (monospace textarea) showing expected output structure
- **History dropdown:** Previous versions with timestamps. Click to view read-only. "Rollback to this version" button.
- **[Save Changes]:** Saves, increments version, archives previous
- **[Cancel]:** Discards unsaved changes, closes modal

---

## 6. URL Profile Admin Views

### 6.1 Analyses Table Enhancement

Add to existing `/admin` Analyses table:

- **New column: "Profile"** — if `urlProfileId` exists, show analysis count badge (e.g., "3 runs") linking to `/admin/profile/[urlProfileId]`
- If `urlProfileId` is null (old records), show "—"

### 6.2 New Page: `/admin/profile/[id]/page.tsx`

**Header:** URL, domain, industry (with locked badge if `industryLocked`)

**Brand Assets Panel (`components/admin/BrandAssetsPanel.tsx`):**
- Logo preview (actual image from Netlify Blobs via storageUrl)
- Color palette swatches (hex values from `brandAssets.colors`)
- Font list
- Hero image preview
- Favicon

**Analysis History:** Table of all Refresh records for this URL profile
- Columns: Date, Score, Processing Time, View
- Score trend visible (did score improve between analyses?)
- Each row links to existing `/admin/analysis/[refreshId]`

**Profile Metadata:**
- `analysisCount`, `bestScore`, `latestScore`, `lastAnalyzedAt`
- `customerEmail` (if set)
- `expiresAt` (if set)
- `createdAt`

---

## Files to Create

| File | Purpose |
|---|---|
| `components/admin/AdminTabNav.tsx` | Tab navigation |
| `components/admin/AdminPagination.tsx` | Reusable pagination |
| `components/admin/BrandAssetsPanel.tsx` | URL Profile asset previews |
| `app/admin/settings/page.tsx` | API Settings + Skills Editor |
| `app/admin/profile/[id]/page.tsx` | URL Profile detail |
| `app/api/admin/settings/configs/route.ts` | List + create configs |
| `app/api/admin/settings/configs/[id]/route.ts` | Update + delete config |
| `app/api/admin/settings/configs/test/route.ts` | Test provider connection |
| `app/api/admin/settings/skills/route.ts` | List skills |
| `app/api/admin/settings/skills/[slug]/route.ts` | Get + update skill |
| `app/api/admin/settings/skills/[slug]/history/route.ts` | Version history |
| `app/api/admin/settings/skills/[slug]/rollback/route.ts` | Rollback to version |
| `app/api/admin/profiles/route.ts` | List URL profiles (for admin) |
| `app/api/admin/profile/[id]/route.ts` | Get URL profile detail |

## Files to Modify

| File | Change |
|---|---|
| `app/admin/page.tsx` | Add pagination (server-side searchParams), add Profile column |
| `app/admin/layout.tsx` | Add `<AdminTabNav />` |

## Do NOT Touch

| Path | Reason |
|---|---|
| `lib/pipeline/*` | Phase 2 handles pipeline changes |
| `app/results/*` | Phase 4 adds rationale display |
| `prisma/schema.prisma` | Phase 1 migration is complete |

---

## Testing Checklist

- [ ] Tab navigation visible on all admin pages, active state correct
- [ ] Analyses table defaults to 50 items per page
- [ ] Page size selector toggles between 50 and 100
- [ ] Previous/Next buttons work, disabled at boundaries
- [ ] Page params survive browser refresh (`/admin?page=2&pageSize=100`)
- [ ] API Settings page shows provider cards
- [ ] Admin can add an Anthropic API key → stored encrypted in DB
- [ ] Key masked in UI (last 4 chars only)
- [ ] Test button validates key against provider API → success/failure indicator
- [ ] Delete key → confirmation dialog → key removed
- [ ] Pipeline falls back to env var when no DB key exists
- [ ] Pipeline uses DB key when active DB config exists
- [ ] Skills Editor opens → shows all 6 agents grouped correctly
- [ ] Admin can edit system prompt → save → version increments
- [ ] Previous version appears in history dropdown
- [ ] Rollback restores old prompt, creates new version
- [ ] URL Profile detail page shows brand assets, analysis history, score trend
- [ ] Analyses table shows "Profile" column with analysis count + link
- [ ] `npm run build` passes
