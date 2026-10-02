/** Fits full skinned run/wave extents at the stage's maximum allowed travel. */
export const characterCameraDistance = (aspect: number) => Math.max(11.5, 10.3 / Math.max(.2, aspect));

export const CHARACTER_UI_SELECTOR = 'a, button, input, textarea, select, label, [role="button"], [role="dialog"], [contenteditable="true"]';
export type PointerSample = { pointerId: number; clientX: number; clientY: number; button: number; isPrimary: boolean };

/** A command is a complete primary click/tap, never a hover, drag, or scroll. */
export class CharacterClickInput {
  private start: PointerSample | null = null;
  down(event: PointerSample, interactive = false): void {
    this.start = !interactive && event.isPrimary && event.button === 0 ? {
      pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY,
      button: event.button, isPrimary: event.isPrimary,
    } : null;
  }
  up(event: PointerSample, interactive = false): boolean {
    const start = this.start;
    this.start = null;
    return !!start && !interactive && event.isPrimary && event.button === 0
      && start.pointerId === event.pointerId
      && Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY) < 12;
  }
  cancel(): void { this.start = null; }
}
