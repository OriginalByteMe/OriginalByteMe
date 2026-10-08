import { createShell } from './town';
import type { AreaBuilder } from './types';

/** Lot 6, "The rig" (#rig). A placeholder shell until its own ticket builds the garage. */
export const createGarage: AreaBuilder = (origin) => createShell(origin, {
  id: 'garage', name: 'The rig',
  palette: { floor: 0xcfd2db, wall: 0x8fb8de, trim: 0x3f5d8a, accent: 0xf2c14e, sign: 0xfff8e8, ink: '#2f4a72' },
});
