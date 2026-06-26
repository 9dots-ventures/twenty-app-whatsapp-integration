import { defineCommandMenuItem } from 'twenty-sdk/define';

import {
  COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  WHATSAPP_CONNECT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineCommandMenuItem({
  universalIdentifier: COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  label: 'Connect WhatsApp Business',
  shortLabel: 'Connect WA',
  isPinned: true,
  availabilityType: 'GLOBAL',
  frontComponentUniversalIdentifier: WHATSAPP_CONNECT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
