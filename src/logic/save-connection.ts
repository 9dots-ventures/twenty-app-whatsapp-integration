import { randomBytes, createCipheriv } from 'crypto';

import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { LOGIC_SAVE_CONNECTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const AES_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

// save-connection has no incoming auth check (see AGENTS.md), so the workspace API key must
// never leave this function in the clear — encrypt it with a secret only the signup server has.
const encryptApiKey = (plaintext: string): string | null => {
  const rawKey = process.env.SIGNUP_ENCRYPTION_KEY;
  if (!rawKey) return null;

  try {
    const key = Buffer.from(rawKey, 'base64');
    if (key.length !== 32) return null;

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(AES_ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
  } catch {
    return null;
  }
};

interface SaveConnectionBody {
  wabaId: string;
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
