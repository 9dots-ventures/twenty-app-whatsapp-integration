import type { ComponentType } from 'react';

export interface FrontComponentDefinition {
  universalIdentifier: string;
  name: string;
  description?: string;
  component: ComponentType;
}

/** Preview stub — the real one registers the component with Twenty. */
export const defineFrontComponent = (
  definition: FrontComponentDefinition,
): FrontComponentDefinition => definition;

export default { defineFrontComponent };
