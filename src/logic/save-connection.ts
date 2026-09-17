import { randomBytes, createCipheriv, publicEncrypt, verify as verifySignature, constants as cryptoConstants } from 'crypto';

import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { LOGIC_SAVE_CONNECTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const AES_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const SESSION_KEY_LENGTH = 32;

// Public half of a keypair generated once and controlled by the signup server operator.
// Safe to ship in this app's public npm package — a public key only lets you encrypt,
// never decrypt. The matching private key lives solely in the signup server's env and is
// never committed anywhere. This is identical for every install; nothing to configure.
const SIGNUP_SERVER_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuzavrMK7WtO+j+whYsQ9
fHbLRkboRFeHVlCAQfkCHC+xzt+WuBUxSZORJSbQoye5mc4kd5prm87iLJJA3Mkt
Vz0Bhogwy+pnJWmPAhAQ1cJNKwk1MSf1UYSubzcBOs93sKSSNTRdqzito4XMsXOR
xnp/sG8Qxr+zFqf27B0xpMH9kum0T8p8MaqnGFPk681zAohAReZS5+79m5bjh1Ui
Q8kusXgFUyIQoaBp3npdDa7zwwpUs73mtmy842pRA03eoE7pe0br+6wabMrPBc88
nZ2meaty3+V8yjWFekfsYgWDD4ZjbjAvI1KvFmS8iCLBOaqXQCVna5IdBpEQVLhi
OwIDAQAB
-----END PUBLIC KEY-----`;

// Public half of a separate signing keypair, same hardcode-is-safe reasoning as above but for
// authentication instead of confidentiality: only the signup server's private key can produce
// a signature that verifies against this, so a request can be trusted as genuinely coming from
// it even though this endpoint has no other auth (the app installs into arbitrary workspaces,
// so no static per-workspace secret could validate the caller).
const SIGNUP_SERVER_SIGNING_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAs6MJmO4ZZwqOgSMtfJKpUMS//xcU4/RHKbGd3h15T5k=
-----END PUBLIC KEY-----`;

const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;

// Rejects anything not freshly signed by the signup server's private key — blocks both forged
// requests (no valid signature possible without the private key) and replay of a captured
// request past the freshness window.
const isRequestAuthentic = (wabaId: string, timestamp: unknown, signature: unknown): boolean => {
  if (typeof timestamp !== 'number' || typeof signature !== 'string') return false;
  if (Math.abs(Date.now() - timestamp) > SIGNATURE_MAX_AGE_MS) return false;

  try {
    const message = Buffer.from(`${wabaId}.${timestamp}`, 'utf8');
    return verifySignature(null, message, SIGNUP_SERVER_SIGNING_PUBLIC_KEY, Buffer.from(signature, 'base64'));
  } catch {
    return false;
  }
};

interface EncryptedApiKey {
  encryptedSessionKey: string;
  iv: string;
  authTag: string;
  ciphertext: string;
}

// save-connection has no incoming auth check (see AGENTS.md), so the workspace API key must
// never leave this function in the clear. RSA-OAEP can't encrypt an arbitrarily long API key
// directly, so we wrap it: a one-time AES-256-GCM key encrypts the payload, and that one-time
// key is itself encrypted with the hardcoded public key. Only the signup server's private key
// can recover it.
const encryptApiKey = (plaintext: string): EncryptedApiKey | null => {
  try {
    const sessionKey = randomBytes(SESSION_KEY_LENGTH);
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(AES_ALGORITHM, sessionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const encryptedSessionKey = publicEncrypt(
      {
        key: SIGNUP_SERVER_PUBLIC_KEY,
        oaepHash: 'sha256',
        padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING,
      },
      sessionKey,
    );

    return {
      encryptedSessionKey: encryptedSessionKey.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    };
  } catch {
    return null;
  }
};

interface SaveConnectionBody {
  wabaId: string;
  timestamp?: number;
  signature?: string;
  phoneNumberId?: string;
  businessId?: string;
  phoneNumber?: string;
  businessName?: string;
  adAccountIds?: string[];
  pageIds?: string[];
}

const handler = async (params: RoutePayload) => {
  const body = (params.body ?? {}) as SaveConnectionBody;

  if (!body.wabaId) {
    return { success: false, error: 'wabaId is required' };
  }

  if (!isRequestAuthentic(body.wabaId, body.timestamp, body.signature)) {
    return { success: false, error: 'invalid or missing signature' };
  }

  const client = new CoreApiClient();

  const name = body.businessName
    ? `${body.businessName} — ${body.wabaId}`
    : body.wabaId;

  const existing = await client.query({
    whatsappConnections: {
      __args: { filter: { wabaId: { eq: body.wabaId } } },
      edges: { node: { id: true } },
    },
  });

  const existingId: string | undefined =
    existing?.whatsappConnections?.edges?.[0]?.node?.id;

  if (existingId) {
    const updated = await client.mutation({
      updateWhatsappConnection: {
        __args: {
          id: existingId,
          data: {
            name,
            phoneNumberId: body.phoneNumberId  ?? null,
            phoneNumber:   body.phoneNumber    ?? null,
            businessId:    body.businessId     ?? null,
            businessName:  body.businessName   ?? null,
            adAccountIds:  body.adAccountIds   ? JSON.stringify(body.adAccountIds) : null,
            pageIds:       body.pageIds        ? JSON.stringify(body.pageIds)       : null,
            status:        'CONNECTED',
          },
        },
        id: true,
        wabaId: true,
      },
    });

    const workspaceApiKey = process.env.WORKSPACE_API_KEY ?? null;
    const encryptedApiKey = workspaceApiKey ? encryptApiKey(workspaceApiKey) : null;
    return { success: true, recordId: updated?.updateWhatsappConnection?.id, wabaId: body.wabaId, action: 'updated', encryptedApiKey };
  }

  const created = await client.mutation({
    createWhatsappConnection: {
      __args: {
        data: {
          name,
          wabaId:        body.wabaId,
          phoneNumberId: body.phoneNumberId  ?? null,
          phoneNumber:   body.phoneNumber    ?? null,
          businessId:    body.businessId     ?? null,
          businessName:  body.businessName   ?? null,
          adAccountIds:  body.adAccountIds   ? JSON.stringify(body.adAccountIds) : null,
          pageIds:       body.pageIds        ? JSON.stringify(body.pageIds)       : null,
          status:        'CONNECTED',
        },
      },
      id: true,
      wabaId: true,
    },
  });

  const workspaceApiKey = process.env.WORKSPACE_API_KEY ?? null;
  const encryptedApiKey = workspaceApiKey ? encryptApiKey(workspaceApiKey) : null;
  return { success: true, recordId: created?.createWhatsappConnection?.id, wabaId: body.wabaId, action: 'created', encryptedApiKey };
};

export default defineLogicFunction({
  universalIdentifier: LOGIC_SAVE_CONNECTION_UNIVERSAL_IDENTIFIER,
  name: 'save-whatsapp-connection',
  timeoutSeconds: 10,
  handler,
  httpRouteTriggerSettings: {
    path: '/whatsapp/save-connection',
    httpMethod: 'POST',
    isAuthRequired: false,
  },
});
