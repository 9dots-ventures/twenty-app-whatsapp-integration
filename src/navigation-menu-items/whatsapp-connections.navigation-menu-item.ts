import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import {
  WHATSAPP_CONNECTION_OBJECT_UNIVERSAL_IDENTIFIER,
  WHATSAPP_CONNECTIONS_LIST_NAV_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier: WHATSAPP_CONNECTIONS_LIST_NAV_UNIVERSAL_IDENTIFIER,
  name: 'WhatsApp Connections',
  icon: 'IconAddressBook',
  color: 'green',
  position: 31,
  type: NavigationMenuItemType.OBJECT,
  targetObjectUniversalIdentifier: WHATSAPP_CONNECTION_OBJECT_UNIVERSAL_IDENTIFIER,
});
