/** Buttons, links, forms and the world's DOM panels (`data-character-ui`) never become scene clicks. */
export const CHARACTER_UI_SELECTOR = 'a, button, input, textarea, select, label, [role="button"], [role="dialog"], [contenteditable="true"], [data-character-ui]';
export type PointerSample = { pointerId: number; clientX: number; clientY: number; button: number; isPrimary: boolean };
type Point = { x: number; y: number; z: number };

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

/** Whether a pointer ray (any direction length) passes through a sphere ahead of its origin, e.g. the afro around the head bone. */
export function rayHitsSphere(origin: Point, direction: Point, sphere: { center: Point; radius: number }): boolean {
  const length = Math.hypot(direction.x, direction.y, direction.z);
  if (!length) return false;
  const ox = sphere.center.x - origin.x, oy = sphere.center.y - origin.y, oz = sphere.center.z - origin.z;
  // Distance along the ray to the point closest to the centre; behind the origin only counts from inside.
  const along = Math.max(0, (ox * direction.x + oy * direction.y + oz * direction.z) / length);
  return ox * ox + oy * oy + oz * oz - along * along <= sphere.radius * sphere.radius;
}
