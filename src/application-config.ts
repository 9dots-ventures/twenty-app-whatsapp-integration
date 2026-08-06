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
  logo: 'public/logo.svg',
  galleryImages: ['public/people_list.png'],['public/dashboard.png'],['public/Timeline.png']
  applicationVariables: {
    WORKSPACE_API_KEY: {
      universalIdentifier: 'd3a1b2c4-8e5f-4a9b-b1c2-3d4e5f6a7b8c',
      description: 'Twenty workspace API key — saved to Supabase after each onboarding so the backend can call the CRM',
      value: '',
      isSecret: true,
    },
  },
});
