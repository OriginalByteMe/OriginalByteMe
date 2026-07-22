import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { readFileSync, writeFileSync } from "node:fs";

const inputCss = readFileSync("app/globals.css", "utf8");
const result = await postcss([tailwind()]).process(inputCss, {
  from: "app/globals.css",
  to: ".design-sync/support/compiled.css",
});
writeFileSync(".design-sync/support/compiled.css", result.css);
console.log("compiled bytes:", result.css.length);
