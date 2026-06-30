import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { LOGIC_GET_CONFIG_UNIVERSAL_IDENTIFIER, SIGNUP_SERVER_URL } from 'src/constants/universal-identifiers';

interface WhatsAppConnectionRecord {
  id: string;
  name: string;
  wabaId: string;
  phoneNumber: string;
  businessName: string;
  status: string;
}

const handler = async (_params: RoutePayload) => {
  const client = new CoreApiClient();

  const result = await client.query({
    whatsappConnections: {
      edges: {
        node: {
          id: true,
          name: true,
          wabaId: true,
          phoneNumber: true,
          businessName: true,
          status: true,
        },
      },
    },
  });

  const connections: WhatsAppConnectionRecord[] =
    (result?.whatsappConnections?.edges ?? []).map(
      (edge: { node: WhatsAppConnectionRecord }) => edge.node,
    );

  return {
    signupServerUrl: SIGNUP_SERVER_URL,
    twentyBaseUrl:   process.env.SERVER_URL ?? '',
    connections,
  };
};

export default defineLogicFunction({
  universalIdentifier: LOGIC_GET_CONFIG_UNIVERSAL_IDENTIFIER,
  name: 'get-whatsapp-config',
  timeoutSeconds: 5,
  handler,
  httpRouteTriggerSettings: {
    path: '/whatsapp/config',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
