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
  emailSupport: 'hello@9dots.co',
  applicationVariables: {
    APP_API_KEY: {
      universalIdentifier: 'c24ff7a7-79f9-43fd-bb4a-ead062091232',
      description: 'Shared secret between signup server and save-connection endpoint',
      value: '',
      isSecret: true,
    },
  },
});
