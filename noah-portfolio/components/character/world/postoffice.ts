import { createShell } from './town';
import type { AreaBuilder } from './types';

/** Lot 7, "Say hi" (#say-hi). A placeholder shell until its own ticket builds the post office. */
export const createPostoffice: AreaBuilder = (origin) => createShell(origin, {
  id: 'postoffice', name: 'Say hi',
  palette: { floor: 0xf1e4d8, wall: 0xe97b6d, trim: 0x3b6fb6, accent: 0xf6d365, sign: 0xfffaf0, ink: '#b13c2e' },
});
