import { createShell } from './town';
import type { AreaBuilder } from './types';

/** Lot 4, "The toolbox" (#toolbox). A placeholder shell until its own ticket builds the toolshed. */
export const createToolshed: AreaBuilder = (origin) => createShell(origin, {
  id: 'toolshed', name: 'The toolbox',
  palette: { floor: 0xd9c19b, wall: 0x9cc59a, trim: 0x5c7f5a, accent: 0xeb9a84, sign: 0xf6efdf, ink: '#3d5a3b' },
});
