# WhatsApp Business App — Implementation Reference

Twenty SDK v2.23.0 · TypeScript + React 19

---

## Architecture Overview

```
User (9dots.twenty.com)
        │
        ▼
Front Component (whatsapp-connect.tsx)
  ├─ calls GET /s/whatsapp/config  →  get-config logic function
  ├─ collects a WhatsApp phone number (free text, not persisted)
  └─ "Connect" opens a new window →
       https://whatsapp-embeddedsignup.onrender.com?twentyUrl=<encoded>&phone=<encoded>
                              │
                              ▼
                   Facebook Embedded Signup (popup)
                              │
                   Render server (/api/flow-event)
                              │
                              ▼
                   POST /s/whatsapp/save-connection  →  save-connection logic function
                              │
                  ┌───────────┴───────────────────┐
                  ▼                               ▼
  whatsappConnection record           Twenty API key created
  created/updated in Twenty           (MetadataApiClient)
                              │
                   Render server: saveToSupabase()
                              │
                              ▼
                   whatsapp_connections row upserted in Supabase
                   (waba_id, twenty_url, twenty_api_key, ...)
```

---

## File Map

| File | Purpose |
|---|---|
| `src/application-config.ts` | App metadata + `APP_API_KEY` configurable setting |
| `src/constants/universal-identifiers.ts` | All stable UUIDs + `SIGNUP_SERVER_URL` constant |
| `src/default-role.ts` | App role granting CRUD on `whatsappConnection` |
| `src/objects/whatsapp-connection.ts` | `whatsappConnection` object definition |
| `src/views/connections-view.ts` | "All WhatsApp Connections" index view |
| `src/navigation-menu-items/whatsapp-connections.navigation-menu-item.ts` | "WhatsApp Connections" sidebar item → object view |
| `src/page-layouts/whatsapp-connect.page-layout.ts` | Standalone page hosting the front component |
| `src/front-components/whatsapp-connect.tsx` | React connect UI — calls get-config, opens signup tab, polls for new connections |
| `src/command-menu/connect-command.ts` | Pinned Cmd+K action "Connect WhatsApp Business" |
| `src/logic/get-config.ts` | Logic function: GET `/whatsapp/config` |
| `src/logic/save-connection.ts` | Logic function: POST `/whatsapp/save-connection` |

---

## Logic Functions

### `get-config` — GET `/whatsapp/config`

| Property | Value |
|---|---|
| Universal ID | `a0427cbf-2ede-4123-929b-a3e0064c4387` |
| Path | `/s/whatsapp/config` |
| Method | GET |
| Auth required | Yes (Twenty user session) |
| Timeout | 5 s |

**Response**

```json
{
  "signupServerUrl": "https://whatsapp-embeddedsignup.onrender.com",
  "twentyBaseUrl": "https://9dots.twenty.com",
  "connections": [
    { "id": "...", "name": "...", "wabaId": "...", "phoneNumber": "...", "businessName": "...", "status": "CONNECTED" }
  ]
}
```

- `signupServerUrl` — hardcoded constant `SIGNUP_SERVER_URL` from `universal-identifiers.ts`. Never comes from app settings.
- `twentyBaseUrl` — derived from the HTTP request's `origin` header (browser always sends this), falling back to `x-forwarded-host`/`host` headers, then `process.env.SERVER_URL`. This is passed to the Render server so it knows where to call back.

---

### `save-connection` — POST `/whatsapp/save-connection`

| Property | Value |
|---|---|
| Universal ID | `62e930f6-f439-4f1d-812a-4909e9a5b568` |
| Path | `/s/whatsapp/save-connection` |
| Method | POST |
| Auth required | No (but validates `x-app-api-key` header if `APP_API_KEY` setting is configured) |
| Timeout | 10 s |

**Request body**

```json
{
  "wabaId": "string (required)",
  "phoneNumberId": "string | null",
  "businessId": "string | null",
  "phoneNumber": "string | null",
  "businessName": "string | null",
  "accessToken": "string | null",
  "adAccountIds": "string[] | null",
  "pageIds": "string[] | null"
}
```

**Response**

```json
{
  "success": true,
  "recordId": "<uuid>",
  "wabaId": "...",
  "action": "created" | "updated",
  "twentyApiKey": "<token or null>"
}
```

**Behaviour**
- If `APP_API_KEY` is set in app settings, incoming `x-app-api-key` header must match or the function returns `{ success: false, error: "Unauthorized" }`.
- Looks up existing record by `wabaId`. Updates if found, creates if not.
- Sets `status: "CONNECTED"` on every upsert.
- After saving the record, uses `MetadataApiClient` to create a workspace API key named `"WhatsApp — <wabaId>"` (1-year expiry) assigned to the first role with `canBeAssignedToApiKeys: true` (prefers "Member"). Returns the token as `twentyApiKey`. Returns `null` if key creation fails — the connection record is still saved.

---

## Twenty Entity Reference

### Object — `whatsappConnection`

Universal ID: `0f9f83c6-3493-4156-a704-6fce0dd5d9b3`

| Field | Type | UUID | Notes |
|---|---|---|---|
| `name` | TEXT | `1ec00c93-58a6-4ec5-b620-c7ef52453e98` | Auto-set to `"BusinessName — WABA ID"` |
| `wabaId` | TEXT | `22ff6e05-ca34-40d0-8747-dc4692ca6251` | Meta WABA ID — used as unique key for upsert |
| `phoneNumberId` | TEXT | `926fb057-fd05-4a78-a8e9-ad1b30c48165` | Meta's internal phone number ID |
| `phoneNumber` | TEXT | `7411910e-6b59-4dc0-ab40-a04cc28502a5` | Display phone number |
| `businessId` | TEXT | `e6450815-2973-4ef1-8ae2-3d7658f68a32` | Meta Business ID |
| `businessName` | TEXT | `fe781495-c5e1-4d2f-8782-e9027be9777c` | Business display name |
| `accessToken` | TEXT | `fcfd5502-0dac-41d6-b37e-147e4cc88b36` | Meta access token (nullable, treat as sensitive) |
| `adAccountIds` | TEXT | `b196846f-1504-454f-a9e7-d82fecb85940` | JSON array string of ad account IDs |
| `pageIds` | TEXT | `d45cfab1-f22b-4d82-964d-3c21fe71219c` | JSON array string of Facebook page IDs |
| `status` | SELECT | `5fc760c3-cf97-41e9-b42b-0530084d1cb4` | `CONNECTED` / `PENDING` / `DISCONNECTED` |

---

### View — "All WhatsApp Connections"

Universal ID: `50dbe568-adca-4da6-88e1-8ac667d1a734`

Index view (`ViewKey.INDEX`) on `whatsappConnection`. Visible columns: Name, Phone Number, Business Name, Status, WABA ID.

---

### Navigation Menu Items

| Name | UUID | Type | Target |
|---|---|---|---|
| WhatsApp Connections | `e2d5c8b0-4a7f-4e9d-8b3a-1c6f2e4d8a9b` | OBJECT | `whatsappConnection` object view |

The connect UI (front component) is accessible via Cmd+K → "Connect WhatsApp Business" rather than a sidebar nav item.

---

### Front Component — `whatsapp-connect`

Universal ID: `f4f1daaf-94f5-4dac-bc41-3ea3c63bb42b`

On mount calls `GET /s/whatsapp/config`.

**UI** — mirrors `whatsapp_signup/public/index.html`: dark radial/linear gradient stage, glassmorphic card (blur + saturate, 24 px radius), WhatsApp → Twenty logo row with a gradient connector arrow, gradient-clipped heading, and status banners using the same `success` / `error` / `info` palettes. The `@keyframes wa-spin` rule is injected via an inline `<style>` element since inline styles cannot declare keyframes.

**Assets** — all images are served by the signup server and referenced by absolute URL against its origin (`SIGNUP_SERVER_URL`, falling back from the `signupServerUrl` in the config response):

| Asset | Used for |
|---|---|
| `/whatsapp-logo.png` | Logo row (left) + the flying chat bubble on the canvas |
| `/Twenty_logo.png` | Logo row (right) |
| `/9dots-logo.jpg` | Footer branding |

The two logo-row images fall back to inline SVG if they fail to load (`logosBroken` state).

**Background canvas** (`ParticleFlow`) — a port of the particle animation in `index.html`. Chat bubbles drift in from the left and land as rows in a mock CRM contacts table (Name / Phone / Source) drawn on the right, flashing green on arrival. Differences from the original:

- Sized to its parent element via `ResizeObserver`, not `window.innerWidth/innerHeight`, so it works inside the side panel.
- The bubble is the WhatsApp logo image once loaded; falls back to the 💬 emoji glyph. `crossOrigin` is deliberately not set — the canvas is never read back, so tainting is harmless and CORS headers are not required.
- Honours `prefers-reduced-motion: reduce` by drawing the populated table once with no animation loop.
- `cancelAnimationFrame` + `ResizeObserver.disconnect()` on unmount.

Layered with `zIndex`: canvas `1` (opacity 0.85, `pointerEvents: none`), card content `3`, footer `4`. The stage is `overflow: hidden` and the card scrolls internally via `maxHeight: 100%`.

**Footer branding** (`FooterBranding`) — 9dots logo + "made with ❤️ from 9dots" linking to `9dots.co` with the `utm_source=twenty` campaign params, absolutely positioned at the bottom of the stage. Rendered in all three states (loaded, loading, error).

**Phone number field** — a required free-text `tel` input. Any country code is accepted and **no validation is applied**. The value is passed to the signup server as `?phone=<encoded>` and is **not persisted** by any backend. The Connect button is disabled while the field is empty.

**Connect CTA** — there is no "Login with Facebook" button in this component; Facebook auth happens inside the signup page. The green "Connect" button calls `window.open(<signupUrl>?twentyUrl=…&phone=…, 'whatsapp-embedded-signup', 'width=720,height=860')`. If the popup is blocked, an error status banner is shown and polling does not start.

**Polling** — while the signup window is open, polls `GET /s/whatsapp/config` every 3 s (5-minute deadline) watching for `connections.length` to increase; on success it shows a success banner plus a snackbar. Shows an "N accounts connected" badge and "Connect another account" once at least one connection exists.

`twentyBaseUrl` is derived from `self.location.origin` (web worker origin) as a fallback when the server response returns an empty string.

---

### Page Layout — "WhatsApp Business"

Universal ID: `99bf6ead-4429-4239-8696-3286515dc0c1`

Standalone page, single tab ("Connect"), full-canvas widget hosting the `whatsapp-connect` front component.

---

### Command Menu Item — "Connect WhatsApp Business"

Universal ID: `1e53042c-1b10-4819-ba89-fbfe8dbb0ef6`

Pinned global Cmd+K action. Short label: "Connect WA". Opens the `whatsapp-connect` front component.

---

### Application Role

Universal ID: `dd84a55b-ab59-4b14-9125-2ba8a01879f7`

Grants the app's logic functions permission to read, update, and soft-delete `whatsappConnection` records. Not assignable to users or API keys.

---

## Application Settings

Configured in Twenty workspace: Settings → Apps → WhatsApp Business → Configure.

| Variable | Secret | Purpose |
|---|---|---|
| `APP_API_KEY` | Yes | Optional shared secret. If set, Render server must send it in `x-app-api-key` header when calling `save-connection`. If not set, the endpoint is open. |

`SIGNUP_SERVER_URL` is **not** a configurable setting — it is hardcoded as a constant in `universal-identifiers.ts` and ships with the app package.

---

## Signup Server (Render — `whatsapp_signup/`)

Not part of the Twenty app package. Deployed separately at `https://whatsapp-embeddedsignup.onrender.com`.

**Relevant env vars on Render:**

| Variable | Purpose |
|---|---|
| `APP_ID` | Meta Facebook App ID |
| `APP_SECRET` | Meta App Secret (for auth code → token exchange) |
| `CONFIGURATION_ID` | Meta embedded signup configuration ID |
| `GRAPH_API_VERSION` | Meta Graph API version (e.g. `v21.0`) |
| `TWENTY_APP_API_KEY` | Must match `APP_API_KEY` in Twenty app settings |
| `TWENTY_APP_URL` | Fallback Twenty URL — used if `twentyUrl` query param is missing |
| `PERMANENT_ACCESS_TOKEN` | Long-lived token for WABA sync endpoints |
| `BUSINESS_ID` | Meta Business Manager ID |
| `DATABASE_URL` | Supabase PostgreSQL connection string — enables `saveToSupabase()` |
| `WEBHOOK_VERIFY_TOKEN` | Arbitrary secret set when registering the webhook in Meta Business Manager — verified on `GET /api/webhook` |

**Flow after signup completes:**
1. `WA_EMBEDDED_SIGNUP` postMessage → `handleSuccessfulFlow(data.data)`
2. `sendFlowDataToBackend('SUCCESS', flowData)` → POST `/api/flow-event` with `{ eventType, flowData, twentyUrl }`
3. Server: `storeSuccessfulSignup` → `saveToCRM(flowData, twentyUrl)`
4. `saveToCRM` → POST `<twentyUrl>/s/whatsapp/save-connection` → returns `{ twentyApiKey, ... }`
5. Server: `saveToSupabase({ twentyApiKey, twentyUrl, wabaId, phoneNumberId, businessId })` → upserts into Supabase

**Supabase schema** (`whatsapp_connections` table):

```sql
CREATE TABLE whatsapp_connections (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  waba_id         TEXT        NOT NULL UNIQUE,
  phone_number_id TEXT,
  business_id     TEXT,
  twenty_url      TEXT        NOT NULL,
  twenty_api_key  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_connections_waba_id ON whatsapp_connections (waba_id);
```

Upserts on `waba_id` — reconnecting the same WABA refreshes `twenty_api_key` and `updated_at`.

---

## Incoming-Message Webhook

Render handles WhatsApp Cloud API webhooks at `/api/webhook`.

### Registration (one-time in Meta Business Manager)

1. Set **Callback URL** to `https://whatsapp-embeddedsignup.onrender.com/api/webhook`
2. Set **Verify token** to the value of `WEBHOOK_VERIFY_TOKEN` (any secret string)
3. Subscribe to the **messages** field

### GET `/api/webhook` — verification

Meta calls this when the webhook is first registered. The server echoes back `hub.challenge` if `hub.verify_token` matches `WEBHOOK_VERIFY_TOKEN`.

### POST `/api/webhook` — message handler

Flow for each incoming message event:

1. Respond `200 OK` immediately (Meta requires a reply within 5 s)
2. Extract `entry[].id` → WABA ID
3. Skip if `entry.changes[].field !== "messages"` or no contacts/messages in the payload
4. Look up `twenty_url` + `twenty_api_key` from Supabase `whatsapp_connections` by `waba_id`
5. Parse contact: `wa_id` → phone (prepend `+`), `profile.name` → firstName + lastName
6. Call `GET /api` (Twenty GraphQL) — search for a person with matching `primaryPhoneNumber`
7. If found: skip (log). If not: call `createPerson` mutation to save the contact
8. Log result; any error is non-fatal and does not affect the `200 OK` already sent

### Twenty People fields written

| Field | Value |
|---|---|
| `name.firstName` | First word of WhatsApp `profile.name`; falls back to full phone |
| `name.lastName` | Remaining words of the display name |
| `phones.primaryPhoneNumber` | `wa_id` with `+` prepended (e.g. `+15550000000`) |

---

## Local UI Preview

`yarn preview` serves `src/front-components/whatsapp-connect.tsx` as a plain React
app on **http://localhost:4001** — no Twenty server, no Docker. Use it to iterate
on the connect UI before syncing.

| File | Purpose |
|---|---|
| `preview/vite.config.ts` | Vite config — port 4001, aliases Twenty imports to stubs, maps `src/*` |
| `preview/index.html` | Host page; `#stage` mimics the widget box |
| `preview/main.tsx` | Mounts `whatsappConnect.component`; `?frame=panel` for side-panel width |
| `preview/stubs/define.ts` | `defineFrontComponent` → identity |
| `preview/stubs/front-component.tsx` | `enqueueSnackbar` → DOM toast |
| `preview/stubs/rest.ts` | Fakes `GET /s/whatsapp/config`; intercepts `window.open` |
| `preview/README.md` | Query-param reference and common check URLs |

State is driven by query params — `state=loading|error`, `connections=N`,
`delay=ms`, `autoconnect=seconds`, `popup=real|blocked`, `frame=panel`.

**Scope**: UI only. The manifest, logic functions, permissions, and the
front-component sandbox are not exercised — validate those with `yarn twenty dev`
against a real instance before deploying.

---

## Deployment

### Syncing to a Twenty instance

```bash
cd twenty-app-new

# Add a remote
yarn twenty remote:add --as <name> --url <https://your-twenty-url>

# Set as active
yarn twenty remote:use <name>

# Sync
yarn twenty apply
```

Configured remotes:
- `local` — `http://localhost:2020` (Docker dev container)
- `cloud` — `https://9dots.twenty.com` (production)
