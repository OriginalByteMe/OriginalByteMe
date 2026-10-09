import { CORE_PIECES } from "./core";
import { MAKER_PIECES } from "./maker";
import { TECH_PIECES } from "./tech";

const ART = { ...CORE_PIECES, ...TECH_PIECES, ...MAKER_PIECES };

export type ArtId = keyof typeof ART;
export const ART_IDS = Object.keys(ART) as [ArtId, ...ArtId[]];

/** Model-visible picture vocabulary, one `id: description` line per piece. */
export const artPromptCatalog = ART_IDS.map((id) => `${id}: ${ART[id].description}`).join("\n");

/** Renders one library piece; decorative uses skip the accessible name. */
export function Art({
  id,
  className,
  decorative = false,
}: {
  id: ArtId;
  className?: string;
  decorative?: boolean;
}) {
  const { Svg, description } = ART[id];
  return (
    <span
      className={className ? `art ${className}` : "art"}
      data-art={id}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": description })}
    >
      <Svg />
    </span>
  );
}
