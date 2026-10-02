/** Ending a touch contact emits pointerleave even though its tap destination persists. */
export const shouldCancelOnPointerLeave = (pointerType: string) => pointerType !== 'touch';

/** Fits full skinned run/wave extents at the stage's maximum allowed travel. */
export const characterCameraDistance = (aspect: number) => Math.max(11.5, 8.8 / Math.max(.2, aspect));
