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
  └─ opens new tab →  https://whatsapp-embeddedsignup.onrender.com?twentyUrl=<encoded>
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

On mount calls `GET /s/whatsapp/config`. Displays a "Connect with Facebook" anchor link that opens the signup server in a new tab with `?twentyUrl=<encoded Twenty origin>`. While the tab is open, polls `GET /s/whatsapp/config` every 3 s (5-minute deadline) watching for `connections.length` to increase. Shows "1 account connected" badge and "Connect another account" once at least one connection exists.

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
