/**
 * Isolated WebGL2 capability probe.
 *
 * Kept in its own module so tests can mock it cheaply (the `@paper-design`
 * shaders require WebGL2 and throw inside an async effect when it is missing).
 */
export function supportsWebGL2(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    return document.createElement('canvas').getContext('webgl2') != null;
  } catch {
    return false;
  }
}
