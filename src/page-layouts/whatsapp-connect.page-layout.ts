import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';

import {
  WHATSAPP_CONNECT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  WHATSAPP_CONNECT_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
  WHATSAPP_CONNECT_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  WHATSAPP_CONNECT_PAGE_WIDGET_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default definePageLayout({
  universalIdentifier: WHATSAPP_CONNECT_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  name: 'WhatsApp Business',
  type: 'STANDALONE_PAGE',
  tabs: [
    {
      universalIdentifier: WHATSAPP_CONNECT_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
      title: 'Connect',
      position: 0,
      icon: 'IconBrandWhatsapp',
      layoutMode: PageLayoutTabLayoutMode.CANVAS,
      widgets: [
        {
          universalIdentifier: WHATSAPP_CONNECT_PAGE_WIDGET_UNIVERSAL_IDENTIFIER,
          title: 'WhatsApp Connect',
          type: 'FRONT_COMPONENT',
          gridPosition: { row: 0, column: 0, rowSpan: 12, columnSpan: 12 },
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier: WHATSAPP_CONNECT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
          },
        },
      ],
    },
  ],
});
