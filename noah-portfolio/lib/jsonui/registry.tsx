import { defineRegistry } from "@json-render/react";
import { catalog } from "./catalog";
import { primitiveComponents } from "./components/primitives";
import { factComponents } from "./components/facts";
import { extraComponents } from "./components/extras";
import { storyComponents } from "./components/story";

export const { registry } = defineRegistry(catalog, {
  components: {
    ...primitiveComponents,
    ...factComponents,
    ...extraComponents,
    ...storyComponents,
  },
});
