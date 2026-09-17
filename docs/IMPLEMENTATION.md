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
  ├─ collects a WhatsApp phone number (free text)
  └─ "Connect" <a target="_blank"> opens signup server in new tab:
       https://whatsappfortwenty.9dots.co?twentyUrl=<encoded>&phone=<encoded>
                              │
                    Two parallel requests fire from the browser:
                    [A] POST /api/flow-event  (WABA IDs, phone)
                    [B] POST /api/auth/callback  (FB auth code → token exchange)
                              │
                    Whichever arrives SECOND triggers runPostSignupSequence():
                    1. Subscribe WABA to app webhook
                    2. Fetch phone numbers from WABA
                    3. Register phone number for Cloud API
                              │
                    Browser polls GET /api/signup-status/:wabaId every 1.5 s
                    Window closes only when done=true (or 45 s timeout)
                              │
                              ▼
                   POST /s/whatsapp/save-connection  →  save-connection logic function
                              │
                  ┌───────────┴───────────────────────┐
                  ▼                                   ▼
  whatsappConnection record           WORKSPACE_API_KEY encrypted with
  created/updated in Twenty           SIGNUP_SERVER_PUBLIC_KEY (hardcoded, RSA-OAEP
                              │        wraps a one-time AES-256-GCM key), returned
                              │        as encryptedApiKey
                   Render server: decryptApiKey() using SIGNUP_SERVER_PRIVATE_KEY → saveToSupabase()
                              │
                              ▼
                   whatsapp_connections row upserted in Supabase
                   (waba_id, phone_number_id, phone_number, twenty_url, twenty_api_key)
```

---

## File Map

| File | Purpose |
|---|---|
| `src/application-config.ts` | App metadata + `WORKSPACE_API_KEY` configurable setting |
| `src/constants/universal-identifiers.ts` | All stable UUIDs + `SIGNUP_SERVER_URL` constant |
| `src/default-role.ts` | App role granting CRUD on `whatsappConnection` |
| `src/objects/whatsapp-connection.ts` | `whatsappConnection` object definition |
| `src/views/connections-view.ts` | "All WhatsApp Connections" index view |
| `src/navigation-menu-items/whatsapp-connections.navigation-menu-item.ts` | "WhatsApp Connections" sidebar item → object view |
| `src/page-layouts/whatsapp-connect.page-layout.ts` | Standalone page hosting the front component |
| `src/front-components/whatsapp-connect.tsx` | React connect UI — collects phone number, opens signup tab, polls for new connections |
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
  "signupServerUrl": "https://whatsappfortwenty.9dots.co",
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
| Auth required | No — reached only via the per-request URL the front component hands to the signup server; no static secret is possible since the app can be installed into any workspace. Because of this, `WORKSPACE_API_KEY` is never returned in the clear — see Behaviour below. |
| Timeout | 10 s |

**Request body**

```json
{
  "wabaId": "string (required)",
  "phoneNumberId": "string | null",
  "phoneNumber": "string | null",
  "businessId": "string | null",
  "businessName": "string | null",
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
  "encryptedApiKey": {
    "encryptedSessionKey": "<base64 RSA-OAEP ciphertext, or the whole field is null>",
    "iv": "<base64>",
    "authTag": "<base64>",
    "ciphertext": "<base64 AES-256-GCM ciphertext of WORKSPACE_API_KEY>"
  }
}
```

**Behaviour**
- Looks up existing record by `wabaId`. Updates if found, creates if not.
- Sets `status: "CONNECTED"` on every upsert.
- `process.env.WORKSPACE_API_KEY` is never returned in the clear, since this endpoint has no auth check and is reachable by anyone who knows the workspace URL. Instead it's hybrid-encrypted: a one-time AES-256-GCM session key encrypts the API key, and that session key is RSA-OAEP encrypted with `SIGNUP_SERVER_PUBLIC_KEY` — a constant hardcoded in `save-connection.ts` (safe to be public; it can only encrypt, not decrypt). `encryptApiKey()` fails closed to `null` if `WORKSPACE_API_KEY` is unset or encryption throws for any reason (the connection record is still saved either way). `whatsapp_signup/server.js`'s `decryptApiKey()` is the counterpart — it holds `SIGNUP_SERVER_PRIVATE_KEY`, the only copy of the matching private key, set once in the signup server's env and never touched by a customer's admin. This scheme is identical for every installation — there is no per-workspace key to configure.

---

## App URL / `twentyBaseUrl` — two valid addressing schemes (investigated 2026-08-06)

Twenty's **App URL** setting (Settings → Apps → WhatsApp Business → Settings → App URL, e.g. `https://9dots.withtwenty.com`) is a per-workspace-installation dedicated domain for this app's HTTP routes. Each function's Triggers tab shows a **Live URL** on that domain, e.g.:

- `https://9dots.withtwenty.com/whatsapp/config`
- `https://9dots.withtwenty.com/whatsapp/save-connection`

This is a **second, independent way** to reach the same functions, distinct from what the code actually uses today:

| | Domain | Path prefix |
|---|---|---|
| **Used today** (`twentyBaseUrl` / `twentyUrl`) | Main workspace domain, e.g. `9dots.twenty.com` | `/s/whatsapp/...` (the `/s/` disambiguates "this is an app route" on the shared workspace domain) |
| **App's own Live URL** (Settings → Triggers tab) | Dedicated App URL, e.g. `9dots.withtwenty.com` | `/whatsapp/...` (no `/s/` — this domain only ever serves this app) |

**Why `twentyBaseUrl` is the main workspace domain, not the App URL:** `get-config.ts` sets it from the incoming request's `Origin` header (`get-config.ts:40`). The front component (`whatsapp-connect.tsx`) calls `/s/whatsapp/config` via the Twenty SDK's `RestApiClient`, which internally resolves `/s/...` paths against `process.env.TWENTY_FUNCTIONS_URL` (the App's dedicated URL) — but a browser's `Origin` header always reflects the *calling page's* origin, not the request's destination. Since the front component's Worker/iframe is loaded from the main workspace app, `Origin` is `9dots.twenty.com`, regardless of what domain `TWENTY_FUNCTIONS_URL` points requests to.

This value (`twentyBaseUrl`) is what gets threaded through the whole flow: `whatsapp-connect.tsx` passes it to the signup server as `?twentyUrl=`, and `whatsapp_signup/server.js`'s `saveToCRM()` later POSTs to `${twentyUrl}/s/whatsapp/save-connection` — i.e. the main workspace domain, with the `/s/` prefix. This works because Twenty's main workspace domain itself proxies `/s/<app>/...` paths to the correct installed app's function (not just the dedicated App URL domain).

**Could `whatsapp_signup` use the App's Live URL instead?** Yes, but not as a drop-in swap:
- It would require `get-config.ts` to explicitly read and return `process.env.TWENTY_FUNCTIONS_URL` as a new response field (it isn't currently exposed anywhere the browser can see, unlike `twentyBaseUrl` which falls out of the `Origin` header for free).
- `whatsapp-connect.tsx` would need to pass that new field instead of `twentyBaseUrl` to the signup server, and drop the `/s/` prefix when building the callback path.

**Decision (2026-08-06): left as-is.** The current `Origin`-header approach costs nothing, needs zero config, and automatically works for any workspace that installs the app. Revisit only if the main-workspace-domain proxy behavior for `/s/<app>/...` ever turns out to be unreliable — see [get-config.ts](../src/logic/get-config.ts), [whatsapp-connect.tsx](../src/front-components/whatsapp-connect.tsx), and `saveToCRM()` in [server.js](../../whatsapp_signup/server.js).

---

## Twenty Entity Reference

### Object — `whatsappConnection`

Universal ID: `0f9f83c6-3493-4156-a704-6fce0dd5d9b3`

| Field | Type | UUID | Notes |
|---|---|---|---|
| `name` | TEXT | `1ec00c93-58a6-4ec5-b620-c7ef52453e98` | Auto-set to `"BusinessName — WABA ID"` |
| `wabaId` | TEXT | `22ff6e05-ca34-40d0-8747-dc4692ca6251` | Meta WABA ID — used as unique key for upsert |
| `phoneNumberId` | TEXT | `926fb057-fd05-4a78-a8e9-ad1b30c48165` | Meta's internal phone number ID |
| `phoneNumber` | TEXT | `7411910e-6b59-4dc0-ab40-a04cc28502a5` | Display phone number (user-entered in front component, or from Meta flowData) |
| `businessId` | TEXT | `e6450815-2973-4ef1-8ae2-3d7658f68a32` | Meta Business ID |
| `businessName` | TEXT | `fe781495-c5e1-4d2f-8782-e9027be9777c` | Business display name |
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

**Design** — dark radial/linear gradient stage (`#06120e → #081a16 → #050b09`), glassmorphic card (blur + saturate, 24 px radius), WhatsApp → Twenty logo row with a gradient connector arrow, gradient-clipped heading, and status banners. The `@keyframes wa-spin` rule is injected via an inline `<style>` element since inline styles cannot declare keyframes.

**Worker sandbox constraints** — Twenty front components run in a sandboxed Web Worker. The following browser APIs are not available and must not be used:
- `window.open` → use `<a target="_blank">` instead
- `new Image()` → not available; use inline SVG or emoji
- `canvas.getContext('2d')` → Canvas API unavailable
- `window.matchMedia` / `window.devicePixelRatio` → guard with `typeof window !== 'undefined'`

**Assets** — served by the signup server, referenced by absolute URL from `SIGNUP_SERVER_URL`:

| Asset | Used for |
|---|---|
| `/whatsapp-logo.png` | Logo row (left) |
| `/Twenty_logo.png` | Logo row (right) |
| `/9dots-logo.jpg` | Footer branding |

The logo images fall back to inline SVG if they fail to load (`logosBroken` state).

**Phone number field** — a required `tel` input. No validation is applied. The value is:
1. Passed to the signup server as `?phone=<encoded>` in the URL
2. Forwarded as `userPhone` in `POST /api/flow-event`
3. Saved to `whatsappConnection.phoneNumber` in Twenty and `phone_number` in Supabase

**Connect CTA** — rendered as `<a target="_blank" rel="opener noreferrer">` (not `window.open`) to comply with the Worker sandbox. The `onClick` handler only manages component state (sets connecting, starts polling); the browser handles navigation via the `href`.

**Polling** — while the signup tab is open, polls `GET /s/whatsapp/config` every 3 s (5-minute deadline) watching for `connections.length` to increase. On success shows a success banner and a snackbar. Displays an "N accounts connected" badge and "Connect another account" once at least one connection exists.

`twentyBaseUrl` falls back to `self.location.origin` when the server response returns an empty string.

**Footer branding** (`FooterBranding`) — 9dots logo + "made with ❤️ from 9dots" linking to `9dots.co`. Absolutely positioned at the bottom of the stage. Rendered in all states.

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
| `WORKSPACE_API_KEY` | Yes | Twenty workspace API key created manually by an admin (Settings → API). Encrypted and returned by `save-connection` so the Render server can store it in Supabase and use it to call the Twenty REST API for incoming-message contact creation. |

There is no per-workspace encryption key to configure — `SIGNUP_SERVER_PUBLIC_KEY` is hardcoded in `save-connection.ts` and identical for every installation. See `save-connection` Behaviour above and the Signup Server section below.

`SIGNUP_SERVER_URL` is **not** a configurable setting — it is hardcoded as a constant in `universal-identifiers.ts` and ships with the app package.

---

## Signup Server (Render — `whatsapp_signup/`)

Not part of the Twenty app package. Deployed separately at `https://whatsappfortwenty.9dots.co`.

**Relevant env vars on Render:**

| Variable | Purpose |
|---|---|
| `APP_ID` | Meta Facebook App ID |
| `APP_SECRET` | Meta App Secret (for auth code → token exchange) |
| `CONFIGURATION_ID` | Meta embedded signup configuration ID |
| `GRAPH_API_VERSION` | Meta Graph API version (e.g. `v21.0`) |
| `PERMANENT_ACCESS_TOKEN` | Long-lived system-user token for WABA sync endpoints (subscribe, phone fetch, register) |
| `BUSINESS_ID` | Meta Business Manager ID |
| `DATABASE_URL` | Supabase PostgreSQL connection pooler URL (port 6543, IPv4) — enables `saveToSupabase()` |
| `WEBHOOK_VERIFY_TOKEN` | Arbitrary secret set when registering the webhook in Meta Developer Portal |
| `WA_2FA_PIN` | Two-factor PIN for the phone number registration call (defaults to `000000`) |

**Flow after signup completes:**

Two requests fire from the browser concurrently — order is not guaranteed:

```
[A] POST /api/flow-event  { eventType: 'SUCCESS', flowData, twentyUrl, userPhone }
[B] POST /api/auth/callback  { code }
```

The server correlates them via `storedTokens` (in-memory Map):

- **If [A] arrives first:** stores WABA entry with no token; sets up `signupProgress` entry. When [B] arrives, finds the WABA entry, merges the token, fires `runPostSignupSequence`.
- **If [B] arrives first (typical):** exchanges code for token, stores as `__pending_token__`. When [A] arrives, finds the pending token, stores it in the WABA entry, fires `runPostSignupSequence`.

`saveToCRM` and `saveToSupabase` always run from [A] (`storeSuccessfulSignup`). `runPostSignupSequence` always runs after both have arrived.

**`runPostSignupSequence(wabaId, phoneNumberId, token)`** — 3-step sequence using `PERMANENT_ACCESS_TOKEN` (falls back to user token):

1. `POST /{version}/{wabaId}/subscribed_apps` — subscribe WABA to app webhook
2. `GET /{version}/{wabaId}/phone_numbers?fields=id,display_phone_number,...` — fetch and log phone numbers
3. `POST /{version}/{phoneNumberId}/register` — register phone number for Cloud API (idempotent)

Progress is tracked in `signupProgress` Map (`wabaId → { done, steps[] }`). Browser polls `GET /api/signup-status/:wabaId` every 1.5 s; window closes when `done: true` or after 45 s timeout.

**`saveToCRM(flowData, twentyUrl, phoneNumber)`** — POSTs to `<twentyUrl>/s/whatsapp/save-connection`:
- `phoneNumber` is `flowData.phone_number` (from Meta) with `userPhone` (from form) as fallback
- Returns `{ encryptedApiKey, recordId, action }`; the caller (`storeSuccessfulSignup`) runs `decryptApiKey(crmResult.encryptedApiKey)` before passing the plaintext key to `saveToSupabase()`. Requires `SIGNUP_SERVER_PRIVATE_KEY` in this server's env — the private half of the keypair whose public half is hardcoded in `save-connection.ts`. Set once, ever; not a per-workspace value.

**`saveToSupabase({ ... })`** — upserts into `whatsapp_connections` by `waba_id`.

**Supabase schema** (`whatsapp_connections` table):

```sql
CREATE TABLE whatsapp_connections (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  waba_id         TEXT        NOT NULL UNIQUE,
  phone_number_id TEXT,
  phone_number    TEXT,
  business_id     TEXT,
  twenty_url      TEXT        NOT NULL,
  twenty_api_key  TEXT,
  status          TEXT        NOT NULL DEFAULT 'CONNECTED',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_connections_waba_id ON whatsapp_connections (waba_id);
```

Migrations (run once in Supabase SQL editor):
```sql
ALTER TABLE whatsapp_connections ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE whatsapp_connections ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'CONNECTED';
```

Upserts on `waba_id` — reconnecting the same WABA refreshes all fields, resets `status` to `'CONNECTED'`, and bumps `updated_at`.

---

## Incoming-Message Webhook

Render handles WhatsApp Cloud API webhooks at `/api/webhook`.

### Registration (one-time in Meta Developer Portal)

1. Set **Callback URL** to `https://whatsappfortwenty.9dots.co/api/webhook`
2. Set **Verify token** to the value of `WEBHOOK_VERIFY_TOKEN` (any secret string)
3. Subscribe to the **messages** and **account_update** fields

### GET `/api/webhook` — verification

Meta calls this when the webhook is first registered. The server echoes back `hub.challenge` if `hub.verify_token` matches `WEBHOOK_VERIFY_TOKEN`.

### POST `/api/webhook` — message handler

Flow for each incoming message event:

1. Respond `200 OK` immediately (Meta requires a reply within 5 s)
2. Extract `entry[].id` → WABA ID
3. Skip if `entry.changes[].field !== "messages"` or no contacts/messages in the payload
4. Look up `twenty_url` + `twenty_api_key` from Supabase `whatsapp_connections` by `waba_id`
5. Parse contact: `wa_id` → phone (prepend `+`), `profile.name` → firstName + lastName
6. `GET https://api.twenty.com/rest/people?filter=phones[primaryPhoneNumber][eq]:<phone>&limit=1` — dedup check
7. If found: skip (log). If not: `POST https://api.twenty.com/rest/people` — create contact
8. Log result; any error is non-fatal and does not affect the `200 OK` already sent

**REST API base URL**: `https://api.twenty.com` for Twenty Cloud workspaces (`*.twenty.com`); `{twentyUrl}/api` for self-hosted instances. Determined by `getTwentyRestBase(twentyUrl)`.

### Twenty People fields written

| Field | Value |
|---|---|
| `name.firstName` | First word of WhatsApp `profile.name`; falls back to full phone |
| `name.lastName` | Remaining words of the display name |
| `phones.primaryPhoneNumber` | `wa_id` with `+` prepended (e.g. `+15550000000`) |
| `phones.primaryPhoneCallingCode` | First 3 chars of the phone number (e.g. `+65`) |

---

## Account Update / Disconnection Tracking

The `account_update` webhook field reports partner/app disconnection events. Must be subscribed to separately in the Meta App Dashboard's webhook field config (alongside `messages`) — subscribing a WABA via `POST /{wabaId}/subscribed_apps` only opts that WABA in to whatever fields the app is configured to receive.

**Important**: for `account_update`, the WABA ID is at `value.waba_info.waba_id` — **not** `entry.id` (which is a different account-level ID on this field, unlike `messages` where `entry.id` is the WABA ID).

Sample payloads:
```json
{
  "entry": [{ "id": "807534291998902", "changes": [{
    "field": "account_update",
    "value": {
      "event": "PARTNER_APP_UNINSTALLED",
      "waba_info": { "waba_id": "862494833091949", "partner_app_id": "793702766889889", "owner_business_id": "1296011579226946" }
    }
  }]}],
  "object": "whatsapp_business_account"
}
```
```json
{
  "entry": [{ "id": "807534291998902", "changes": [{
    "field": "account_update",
    "value": {
      "event": "PARTNER_REMOVED",
      "waba_info": { "waba_id": "1996192277686385", "owner_business_id": "1027403603068939" },
      "disconnection_info": { "reason": "ACCOUNT_DISCONNECTED", "initiated_by": "USER" }
    }
  }]}],
  "object": "whatsapp_business_account"
}
```

**`handleAccountUpdate(value)`** — only acts on `event ∈ {PARTNER_APP_UNINSTALLED, PARTNER_REMOVED}` (other events are logged and ignored). Extracts `wabaId` from `value.waba_info.waba_id`, then calls `markWabaDisconnected(wabaId)`.

**`markWabaDisconnected(wabaId)`**:
1. `UPDATE whatsapp_connections SET status = 'DISCONNECTED', updated_at = NOW() WHERE waba_id = $1` in Supabase.
2. Looks up `twenty_url`/`twenty_api_key` via `getTwentyCredentials(wabaId)`; if absent, logs and stops (can't authenticate to Twenty without a stored API key).
3. `setWhatsappConnectionStatus(twentyUrl, twentyApiKey, wabaId, 'DISCONNECTED')`:
   - `GET {base}/rest/whatsappConnections?filter=wabaId[eq]:"<wabaId>"&limit=1` to find the record
   - `PATCH {base}/rest/whatsappConnections/<id>` with `{ "status": "DISCONNECTED" }`

Reconnecting the same WABA through the normal signup flow resets `status` back to `'CONNECTED'` in both Supabase and Twenty (see `saveToSupabase` and `save-connection.ts`), so no separate "reactivate" path is needed.

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
