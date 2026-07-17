// vitest.setup.ts
import "@testing-library/jest-dom/vitest";

// jsdom has no IntersectionObserver; framer-motion's `whileInView` needs one
// to mount. A no-op stub keeps in-view-revealed content renderable in tests
// (elements simply stay in their initial state).
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
const globals = globalThis as unknown as Record<string, unknown>;
if (typeof globals.IntersectionObserver === "undefined") {
  globals.IntersectionObserver = IntersectionObserverStub;
}
