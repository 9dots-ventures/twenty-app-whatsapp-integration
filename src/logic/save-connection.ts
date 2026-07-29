import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';
import { CoreApiClient } from 'twenty-client-sdk/core';

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

    const twentyApiKey = process.env.WORKSPACE_API_KEY ?? null;
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

  const twentyApiKey = process.env.WORKSPACE_API_KEY ?? null;
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
