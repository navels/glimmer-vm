import type { Helper, HelperDefinitionState, Owner } from '../../runtime';
import type { HelperManager } from '../helper';

export interface InternalHelperManager<TOwner extends Owner> {
  getDelegateFor(owner: TOwner | undefined): HelperManager<unknown>;

  getHelper(definition: HelperDefinitionState): Helper;
}
