import { defineApplication } from 'twenty-sdk/define';

import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: APP_DISPLAY_NAME,
  description: APP_DESCRIPTION,
  author: '9dots',
  category: 'Integrations',
  emailSupport: 'support@9dots.io',
  applicationVariables: {
    SIGNUP_SERVER_URL: {
      universalIdentifier: '275d14a0-f042-4643-bf8e-5e1749f2b293',
      description: 'URL of the WhatsApp embedded signup server',
      value: 'https://nontabular-barristerial-jasmin.ngrok-free.dev',
      isSecret: false,
    },
    META_APP_ID: {
      universalIdentifier: 'a20eadb6-1be8-4f4d-982b-a55ca5f03938',
      description: 'Your Meta/Facebook App ID',
      value: '',
      isSecret: false,
    },
    META_CONFIGURATION_ID: {
      universalIdentifier: '433c3e30-b17f-473c-9b83-af8306578666',
      description: 'Meta embedded signup Configuration ID',
      value: '',
      isSecret: false,
    },
    META_GRAPH_API_VERSION: {
      universalIdentifier: '241f97f1-f07f-4198-9645-9b3a6da10db8',
      description: 'Meta Graph API version (e.g. v21.0)',
      value: 'v21.0',
      isSecret: false,
    },
    META_APP_SECRET: {
      universalIdentifier: 'c2ebd46e-50c7-41c0-9e26-b28e343aaa65',
      description: 'Meta App Secret — used only in logic functions',
      value: '',
      isSecret: true,
    },
    APP_API_KEY: {
      universalIdentifier: 'c24ff7a7-79f9-43fd-bb4a-ead062091232',
      description: 'Shared secret between signup server and save-connection endpoint',
      value: '',
      isSecret: true,
    },
  },
});
