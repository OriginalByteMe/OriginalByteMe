import type { Study } from './core';
import { silk, tide } from './pieces/canvas2d';
import { contours } from './pieces/contours';
import { fluid } from './pieces/fluid';
import { forms } from './pieces/forms';
import { lattice } from './pieces/lattice';
import { vase } from './pieces/vase';

/** The collection, in viewing order. */
export const STUDIES: Study[] = [fluid, lattice, tide, contours, vase, forms, silk];
