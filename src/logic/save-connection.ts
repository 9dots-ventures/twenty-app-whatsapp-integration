import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';

import { LOGIC_SAVE_CONNECTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

interface SaveConnectionBody {
  wabaId: string;
  phoneNumberId?: string;
  businessId?: string;
  phoneNumber?: string;
  businessName?: string;
  accessToken?: string;
  adAccountIds?: string[];
  pageIds?: string[];
}

async function createTwentyApiKey(wabaId: string): Promise<string | null> {
  try {
    const metaClient = new MetadataApiClient();

    const rolesResult = await metaClient.query({
      roles: {
        id: true,
        label: true,
        canBeAssignedToApiKeys: true,
      },
    });

    const roles = (rolesResult?.roles ?? []) as { id: string; label: string; canBeAssignedToApiKeys: boolean }[];
    const assignable = roles.filter((r) => r.canBeAssignedToApiKeys);
    if (assignable.length === 0) return null;

    const role =
      assignable.find((r) => r.label.toLowerCase() === 'member') ?? assignable[0];

    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const created = await metaClient.mutation({
      createApiKey: {
        __args: {
          input: { name: `WhatsApp — ${wabaId}`, expiresAt, roleId: role.id },
        },
        id: true,
      },
    });

    const apiKeyId = created?.createApiKey?.id;
    if (!apiKeyId) return null;

    const tokenResult = await metaClient.mutation({
      generateApiKeyToken: {
        __args: { apiKeyId, expiresAt },
        token: true,
      },
    });

    return tokenResult?.generateApiKeyToken?.token ?? null;
  } catch {
    return null;
  }
}

const handler = async (params: RoutePayload) => {
  const apiKey = process.env.APP_API_KEY;
  const requestKey = (params.headers as Record<string, string>)?.['x-app-api-key'];

  if (apiKey && requestKey !== apiKey) {
    return { success: false, error: 'Unauthorized' };
  }

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
            accessToken:   body.accessToken    ?? null,
            adAccountIds:  body.adAccountIds   ? JSON.stringify(body.adAccountIds) : null,
            pageIds:       body.pageIds        ? JSON.stringify(body.pageIds)       : null,
            status:        'CONNECTED',
          },
        },
        id: true,
        wabaId: true,
      },
    });

    const twentyApiKey = await createTwentyApiKey(body.wabaId);
    return { success: true, recordId: updated?.updateWhatsappConnection?.id, wabaId: body.wabaId, action: 'updated', twentyApiKey };
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
          accessToken:   body.accessToken    ?? null,
          adAccountIds:  body.adAccountIds   ? JSON.stringify(body.adAccountIds) : null,
          pageIds:       body.pageIds        ? JSON.stringify(body.pageIds)       : null,
          status:        'CONNECTED',
        },
      },
      id: true,
      wabaId: true,
    },
  });

  const twentyApiKey = await createTwentyApiKey(body.wabaId);
  return { success: true, recordId: created?.createWhatsappConnection?.id, wabaId: body.wabaId, action: 'created', twentyApiKey };
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
