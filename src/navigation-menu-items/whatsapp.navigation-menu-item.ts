import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import {
  WHATSAPP_CONNECT_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  WHATSAPP_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier: WHATSAPP_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  name: 'WhatsApp',
  icon: 'IconBrandWhatsapp',
  color: 'green',
  position: 30,
  type: NavigationMenuItemType.PAGE_LAYOUT,
  pageLayoutUniversalIdentifier: WHATSAPP_CONNECT_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
});
