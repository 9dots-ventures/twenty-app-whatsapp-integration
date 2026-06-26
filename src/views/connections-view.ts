import { defineView, ViewKey } from 'twenty-sdk/define';

import {
  FIELD_BUSINESS_NAME_UNIVERSAL_IDENTIFIER,
  FIELD_NAME_UNIVERSAL_IDENTIFIER,
  FIELD_PHONE_NUMBER_UNIVERSAL_IDENTIFIER,
  FIELD_STATUS_UNIVERSAL_IDENTIFIER,
  FIELD_WABA_ID_UNIVERSAL_IDENTIFIER,
  VIEW_COL_BUSINESS_UNIVERSAL_IDENTIFIER,
  VIEW_COL_NAME_UNIVERSAL_IDENTIFIER,
  VIEW_COL_PHONE_UNIVERSAL_IDENTIFIER,
  VIEW_COL_STATUS_UNIVERSAL_IDENTIFIER,
  VIEW_COL_WABA_UNIVERSAL_IDENTIFIER,
  VIEW_CONNECTIONS_UNIVERSAL_IDENTIFIER,
  WHATSAPP_CONNECTION_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineView({
  universalIdentifier: VIEW_CONNECTIONS_UNIVERSAL_IDENTIFIER,
  name: 'All WhatsApp Connections',
  objectUniversalIdentifier: WHATSAPP_CONNECTION_OBJECT_UNIVERSAL_IDENTIFIER,
  icon: 'IconBrandWhatsapp',
  key: ViewKey.INDEX,
  position: 0,
  fields: [
    { universalIdentifier: VIEW_COL_NAME_UNIVERSAL_IDENTIFIER,     fieldMetadataUniversalIdentifier: FIELD_NAME_UNIVERSAL_IDENTIFIER,          position: 0, isVisible: true, size: 220 },
    { universalIdentifier: VIEW_COL_PHONE_UNIVERSAL_IDENTIFIER,    fieldMetadataUniversalIdentifier: FIELD_PHONE_NUMBER_UNIVERSAL_IDENTIFIER,   position: 1, isVisible: true, size: 180 },
    { universalIdentifier: VIEW_COL_BUSINESS_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: FIELD_BUSINESS_NAME_UNIVERSAL_IDENTIFIER,  position: 2, isVisible: true, size: 200 },
    { universalIdentifier: VIEW_COL_STATUS_UNIVERSAL_IDENTIFIER,   fieldMetadataUniversalIdentifier: FIELD_STATUS_UNIVERSAL_IDENTIFIER,         position: 3, isVisible: true, size: 140 },
    { universalIdentifier: VIEW_COL_WABA_UNIVERSAL_IDENTIFIER,     fieldMetadataUniversalIdentifier: FIELD_WABA_ID_UNIVERSAL_IDENTIFIER,        position: 4, isVisible: true, size: 200 },
  ],
});
