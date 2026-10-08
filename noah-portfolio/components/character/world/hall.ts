import { createShell } from './town';
import type { AreaBuilder } from './types';

/** Lot 2, "Noah, in brief" (#brief). A placeholder shell until its own ticket builds the hall. */
export const createHall: AreaBuilder = (origin) => createShell(origin, {
  id: 'hall', name: 'Noah, in brief',
  palette: { floor: 0xf3dcc0, wall: 0xf7cf7a, trim: 0xe2875f, accent: 0x9b72cf, sign: 0xfff3d6, ink: '#7a3d2a' },
});
