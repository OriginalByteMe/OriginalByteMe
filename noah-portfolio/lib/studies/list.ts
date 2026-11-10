import type { Study } from './core';
import { pulsar, silk, tide } from './pieces/canvas2d';
import { contours } from './pieces/contours';
import { fluid } from './pieces/fluid';
import { forms } from './pieces/forms';
import { horizon } from './pieces/horizon';
import { lattice } from './pieces/lattice';
import { vase } from './pieces/vase';

/** The collection, in viewing order. */
export const STUDIES: Study[] = [forms, horizon, fluid, silk, contours, vase, pulsar, lattice, tide];
