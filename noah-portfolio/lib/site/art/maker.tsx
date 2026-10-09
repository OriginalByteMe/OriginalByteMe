import { Frame, type ArtPiece } from "./frame";

const sparkle = (x: number, y: number, s: number) =>
  `M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}z`;

export const MAKER_PIECES = {
  "3d-printer": {
    description: "An FDM 3D printer whose nozzle moves while a part grows layer by layer",
    animated: true,
    Svg: () => (
      <Frame>
        <circle cx="120" cy="90" r="70" fill="var(--site-soft)" stroke="none" />
        <rect x="50" y="22" width="140" height="138" rx="12" fill="var(--site-accent)" />
        <rect x="64" y="36" width="112" height="100" rx="6" fill="var(--site-paper)" />
        <path d="M64 54h112" strokeWidth={3} />
        <g className="a-slide">
          <rect x="102" y="44" width="36" height="20" rx="4" fill="var(--site-accent-2)" />
          <path d="M112 64h16l-8 10z" fill="var(--site-ink)" strokeWidth={3} />
        </g>
        <g className="a-grow">
          <rect x="98" y="94" width="44" height="30" rx="3" fill="var(--site-accent-2)" />
          <path d="M98 104h44M98 114h44" strokeWidth={3} />
        </g>
        <rect x="74" y="124" width="92" height="8" rx="3" fill="var(--site-soft)" />
        <rect x="70" y="142" width="34" height="11" rx="3" fill="var(--site-paper)" strokeWidth={3} />
        <circle cx="160" cy="148" r="6" fill="var(--site-paper)" strokeWidth={3} />
      </Frame>
    ),
  },
  "filament-spool": {
    description: "A spool of 3D printing filament",
    animated: false,
    Svg: () => (
      <Frame>
        <circle cx="124" cy="90" r="70" fill="var(--site-soft)" stroke="none" />
        <circle cx="132" cy="96" r="60" fill="var(--site-accent-2)" />
        <circle cx="116" cy="96" r="60" fill="var(--site-paper)" />
        <circle cx="116" cy="96" r="46" fill="var(--site-accent)" />
        <circle cx="116" cy="96" r="37" strokeWidth={2.5} opacity="0.45" />
        <circle cx="116" cy="96" r="28" strokeWidth={2.5} opacity="0.45" />
        <circle cx="116" cy="96" r="17" fill="var(--site-paper)" />
        <circle cx="116" cy="96" r="6" fill="var(--site-soft)" strokeWidth={3} />
        <path d="M154 120c18 4 14 26 30 28s16-16 30-2" strokeWidth={9} />
        <path d="M154 120c18 4 14 26 30 28s16-16 30-2" stroke="var(--site-accent)" strokeWidth={4} />
      </Frame>
    ),
  },
  "cad-model": {
    description: "A wireframe CAD part with dimension lines",
    animated: true,
    Svg: () => (
      <Frame>
        <circle cx="114" cy="90" r="68" fill="var(--site-soft)" stroke="none" />
        <path d="M110 40l38 22v52l-38 22-38-22V62z" fill="var(--site-paper)" />
        <path d="M110 40l38 22-38 22-38-22z" fill="var(--site-accent)" />
        <path d="M110 84l38-22v52l-38 22z" fill="var(--site-soft)" />
        <ellipse cx="110" cy="62" rx="15" ry="8" fill="var(--site-paper)" strokeWidth={3} />
        <path
          d="M110 92V64M110 92l-38 22M110 92l38 22"
          stroke="var(--site-accent-2)"
          strokeWidth={3}
          className="a-flow"
        />
        <path d="M152 62h30M152 114h30M72 118v40M148 118v40" strokeWidth={2.5} strokeDasharray="3 6" />
        <path
          d="M176 66v44M76 152h68M176 66l-5 8h10zM176 110l-5-8h10zM76 152l8-5v10zM144 152l-8-5v10z"
          stroke="var(--site-accent-2)"
          fill="var(--site-accent-2)"
          strokeWidth={3}
        />
        {[
          [110, 40],
          [72, 62],
          [148, 62],
        ].map(([x, y], index) => (
          <rect
            key={x}
            x={x - 5}
            y={y - 5}
            width="10"
            height="10"
            rx="2"
            fill="var(--site-accent-2)"
            strokeWidth={2.5}
            className="a-blink"
            style={{ animationDelay: `${index * 0.4}s` }}
          />
        ))}
      </Frame>
    ),
  },
  calipers: {
    description: "Measuring calipers gripping a printed part",
    animated: false,
    Svg: () => (
      <Frame>
        <circle cx="120" cy="100" r="66" fill="var(--site-soft)" stroke="none" />
        <rect x="24" y="58" width="192" height="24" rx="5" fill="var(--site-paper)" />
        <path d="M66 82v-8M76 82v-12M86 82v-8M96 82v-12M174 82v-8M184 82v-12M194 82v-8M204 82v-12" strokeWidth={2.5} />
        <path d="M24 58h32v90q0 10-10 10H34q-10 0-10-10z" fill="var(--site-paper)" />
        <rect x="56" y="100" width="56" height="58" rx="4" fill="var(--site-accent)" />
        <path d="M56 114h56M56 129h56M56 144h56" strokeWidth={3} />
        <path d="M112 48h50v42h-20v58q0 10-10 10h-10q-10 0-10-10z" fill="var(--site-accent-2)" />
        <rect x="120" y="56" width="34" height="16" rx="3" fill="var(--site-paper)" strokeWidth={3} />
        <circle cx="152" cy="96" r="6" fill="var(--site-soft)" strokeWidth={3} />
      </Frame>
    ),
  },
  "city-skyline": {
    description: "The Kuala Lumpur skyline with the twin towers",
    animated: false,
    Svg: () => (
      <Frame>
        <circle cx="120" cy="92" r="70" fill="var(--site-soft)" stroke="none" />
        <circle cx="52" cy="48" r="12" fill="var(--site-accent-2)" stroke="none" />
        <rect x="26" y="110" width="26" height="48" rx="2" fill="var(--site-paper)" />
        <rect x="50" y="94" width="30" height="64" rx="2" fill="var(--site-soft)" />
        <path d="M58 106h14M58 120h14M58 134h14M33 122h12M33 136h12" strokeWidth={3} />
        <rect x="158" y="116" width="28" height="42" rx="2" fill="var(--site-paper)" />
        <rect x="206" y="126" width="18" height="32" rx="2" fill="var(--site-soft)" />
        <path d="M165 128h14M165 142h14" strokeWidth={3} />
        <rect x="196" y="70" width="8" height="88" fill="var(--site-paper)" />
        <path d="M200 58V26" />
        <ellipse cx="200" cy="66" rx="13" ry="8" fill="var(--site-accent-2)" />
        {[98, 142].map((cx) => (
          <g key={cx}>
            <path
              d={`M${cx - 14} 158V72l4-8V50l4-6V34l6-20 6 20v10l4 6v14l4 8v86z`}
              fill="var(--site-accent)"
            />
            <path d={`M${cx - 5} 80v66M${cx + 5} 80v66`} stroke="var(--site-paper)" strokeWidth={3} />
          </g>
        ))}
        <rect x="112" y="88" width="16" height="7" fill="var(--site-paper)" strokeWidth={3} />
        <path d="M112 112l8-17 8 17" strokeWidth={3} />
        <path d="M18 158h204" />
      </Frame>
    ),
  },
  "map-pin": {
    description: "A folded map with a pulsing location pin",
    animated: true,
    Svg: () => (
      <Frame>
        <circle cx="120" cy="92" r="68" fill="var(--site-soft)" stroke="none" />
        <path d="M44 66l48-12v92l-48 12z" fill="var(--site-paper)" />
        <path d="M92 54l52 14v92l-52-14z" fill="var(--site-soft)" />
        <path d="M144 68l52-12v92l-52 12z" fill="var(--site-paper)" />
        <path
          d="M62 138c18-16 34-4 48-18s28-6 44-6"
          stroke="var(--site-accent-2)"
          strokeWidth={4}
          className="a-flow"
        />
        <ellipse cx="154" cy="116" rx="16" ry="6" stroke="var(--site-accent)" strokeWidth={3} className="a-pulse" />
        <g className="a-bob">
          <path d="M154 116c-14-16-22-28-22-40a22 22 0 0 1 44 0c0 12-8 24-22 40z" fill="var(--site-accent)" />
          <circle cx="154" cy="76" r="8" fill="var(--site-paper)" strokeWidth={3} />
        </g>
      </Frame>
    ),
  },
  globe: {
    description: "A globe with a dot orbiting it",
    animated: true,
    Svg: () => (
      <Frame>
        <circle cx="120" cy="84" r="70" fill="var(--site-soft)" stroke="none" />
        <circle cx="120" cy="84" r="64" stroke="var(--site-accent)" strokeWidth={2.5} strokeDasharray="4 10" />
        <path d="M70 84a50 50 0 0 0 100 0" />
        <path d="M120 134v14" />
        <path d="M90 160q30-18 60 0z" fill="var(--site-accent)" />
        <circle cx="120" cy="84" r="42" fill="var(--site-accent-2)" />
        <path
          d="M92 62c10-8 22-6 26 2s-4 14-12 16-6 12-14 12-10-10-8-18zM132 96c8-6 20-2 20 6s-8 16-16 16-12-14-4-22zM132 52c8 0 14 4 16 10-8 2-14 0-16-10z"
          fill="var(--site-paper)"
          strokeWidth={3}
        />
        <ellipse cx="120" cy="84" rx="18" ry="42" strokeWidth={2.5} opacity="0.4" />
        <path d="M78 84h84" strokeWidth={2.5} opacity="0.4" />
        <g className="a-spin">
          <circle cx="120" cy="84" r="72" stroke="none" />
          <circle cx="120" cy="20" r="8" fill="var(--site-accent)" strokeWidth={3} />
        </g>
      </Frame>
    ),
  },
  "vinyl-record": {
    description: "A spinning vinyl record whose label is a colour palette",
    animated: true,
    Svg: () => (
      <Frame>
        <circle cx="120" cy="90" r="70" fill="var(--site-soft)" stroke="none" />
        <g className="a-spin">
          <circle cx="108" cy="92" r="64" fill="var(--site-ink)" />
          {[54, 45, 36].map((r) => (
            <circle key={r} cx="108" cy="92" r={r} stroke="var(--site-paper)" strokeWidth={2} opacity="0.4" />
          ))}
          {[
            ["M108 92V68a24 24 0 0 1 24 24z", "var(--site-accent)"],
            ["M108 92h24a24 24 0 0 1-24 24z", "var(--site-accent-2)"],
            ["M108 92v24a24 24 0 0 1-24-24z", "var(--site-soft)"],
            ["M108 92H84a24 24 0 0 1 24-24z", "var(--site-paper)"],
          ].map(([d, fill]) => (
            <path key={d} d={d} fill={fill} stroke="var(--site-ink)" strokeWidth={3} />
          ))}
          <circle cx="108" cy="92" r="4" fill="var(--site-ink)" stroke="none" />
        </g>
        <circle cx="196" cy="36" r="10" fill="var(--site-paper)" />
        <path d="M196 36l2 66-26 22" strokeWidth={6} />
        <rect x="160" y="116" width="18" height="14" rx="3" fill="var(--site-accent)" transform="rotate(-40 169 123)" />
      </Frame>
    ),
  },
  "colour-swatches": {
    description: "Fanned paint swatch cards in several colours",
    animated: false,
    Svg: () => (
      <Frame>
        <circle cx="120" cy="96" r="68" fill="var(--site-soft)" stroke="none" />
        {(
          [
            [-44, "var(--site-accent)"],
            [-22, "var(--site-soft)"],
            [0, "var(--site-accent-2)"],
            [22, "var(--site-ink)"],
            [44, "var(--site-accent)"],
          ] as const
        ).map(([angle, fill]) => (
          <g key={angle} transform={`rotate(${angle} 122 136)`}>
            <rect x="106" y="26" width="32" height="126" rx="7" fill="var(--site-paper)" />
            <path d="M106 94V33a7 7 0 0 1 7-7h18a7 7 0 0 1 7 7v61z" fill={fill} />
            <path d="M114 108h16M114 120h10" strokeWidth={3} />
          </g>
        ))}
        <circle cx="122" cy="136" r="5" fill="var(--site-soft)" strokeWidth={3} />
      </Frame>
    ),
  },
  "scissors-cutout": {
    description: "Scissors cutting a figure out of a photo, like an image cutout tool",
    animated: false,
    Svg: () => (
      <Frame>
        <circle cx="120" cy="92" r="68" fill="var(--site-soft)" stroke="none" />
        <rect x="24" y="40" width="120" height="118" rx="6" fill="var(--site-paper)" />
        <rect x="34" y="50" width="100" height="98" rx="3" fill="var(--site-soft)" strokeWidth={3} />
        <circle cx="118" cy="68" r="9" fill="var(--site-accent-2)" stroke="none" />
        <circle cx="80" cy="88" r="15" fill="var(--site-accent)" />
        <path d="M52 148q0-38 28-38t28 38" fill="var(--site-accent)" />
        <path
          d="M44 148c0-28 12-36 22-40a24 24 0 1 1 28 0c10 4 22 12 22 40"
          strokeWidth={3}
          strokeDasharray="6 7"
        />
        <path d="M160 114l37 15M160 114l37-15" strokeWidth={7} />
        <path d="M112 94l50.7 13.5-5.4 13z" fill="var(--site-paper)" strokeWidth={3} />
        <path d="M114 132l48.5-11.5-5-13z" fill="var(--site-paper)" strokeWidth={3} />
        {[99, 129].map((cy) => (
          <g key={cy}>
            <circle cx="198" cy={cy} r="14" fill="var(--site-accent-2)" />
            <circle cx="198" cy={cy} r="5.5" fill="var(--site-paper)" strokeWidth={3} />
          </g>
        ))}
        <circle cx="160" cy="114" r="4" fill="var(--site-ink)" stroke="none" />
      </Frame>
    ),
  },
  "sticker-sheet": {
    description: "A sheet of stickers with one peeling off",
    animated: false,
    Svg: () => (
      <Frame>
        <circle cx="120" cy="92" r="68" fill="var(--site-soft)" stroke="none" />
        <rect x="52" y="26" width="136" height="132" rx="8" fill="var(--site-paper)" />
        <circle cx="90" cy="64" r="22" fill="var(--site-accent-2)" />
        <path d="M82 58v4M98 58v4M80 70q10 10 20 0" strokeWidth={3} />
        <path
          d="M150 42L155.3 56.7L170.9 57.2L158.6 66.8L162.9 81.8L150 73L137.1 81.8L141.4 66.8L129.1 57.2L144.7 56.7z"
          fill="var(--site-accent)"
        />
        <path
          d="M90 144C70 130 66 118 74 110C80 104 88 106 90 114C92 106 100 104 106 110C114 118 110 130 90 144z"
          fill="var(--site-accent)"
        />
        <path d="M128 102h24l20 20v22a6 6 0 0 1-6 6h-38a6 6 0 0 1-6-6v-36a6 6 0 0 1 6-6z" fill="var(--site-accent-2)" />
        <path d="M152 102c14-10 26-14 34-12-2 10-8 22-14 32z" fill="var(--site-soft)" />
      </Frame>
    ),
  },
  rocket: {
    description: "A rocket lifting off with a flickering flame",
    animated: true,
    Svg: () => (
      <Frame>
        <circle cx="120" cy="88" r="70" fill="var(--site-soft)" stroke="none" />
        <path d="M66 46v22M176 58v24M58 92v14" strokeWidth={3} />
        <g className="a-bob">
          <path d="M108 120q12 40 24 0z" fill="var(--site-accent-2)" className="a-flicker" />
          <path d="M96 92l-20 24v12l18-10zM144 92l20 24v12l-18-10z" fill="var(--site-accent)" />
          <path d="M120 22c22 18 28 48 26 90H94c-2-42 4-72 26-90z" fill="var(--site-paper)" />
          <path d="M120 22c12 10 18 20 21 30H99c3-10 9-20 21-30z" fill="var(--site-accent)" />
          <circle cx="120" cy="78" r="11" fill="var(--site-accent-2)" />
          <rect x="106" y="112" width="28" height="8" rx="2" fill="var(--site-soft)" />
        </g>
        {[
          [80, 152, 12],
          [100, 156, 10],
          [140, 156, 10],
          [160, 152, 12],
        ].map(([cx, cy, r]) => (
          <circle key={cx} cx={cx} cy={cy} r={r} fill="var(--site-paper)" strokeWidth={3} />
        ))}
      </Frame>
    ),
  },
  lightbulb: {
    description: "A glowing lightbulb, for ideas",
    animated: true,
    Svg: () => (
      <Frame>
        <circle cx="120" cy="88" r="68" fill="var(--site-soft)" stroke="none" />
        <circle cx="120" cy="74" r="50" fill="var(--site-accent)" stroke="none" opacity="0.3" className="a-glow" />
        {["M120 28v-10", "M86 40l-6-8", "M154 40l6-8", "M74 74H62", "M166 74h12"].map((d, index) => (
          <path
            key={d}
            d={d}
            stroke="var(--site-accent)"
            strokeWidth={5}
            className="a-glow"
            style={{ animationDelay: `${index * 0.3}s` }}
          />
        ))}
        <path
          d="M120 36a38 38 0 0 1 22 68c-5 5-6 9-6 14h-32c0-5-1-9-6-14a38 38 0 0 1 22-68z"
          fill="var(--site-paper)"
        />
        <path d="M110 118V96M130 118V96" strokeWidth={3} />
        <path d="M110 96l5-8 5 8 5-8 5 8" stroke="var(--site-accent)" strokeWidth={4} />
        <rect x="102" y="118" width="36" height="24" rx="4" fill="var(--site-accent-2)" />
        <path d="M102 126h36M102 134h36" strokeWidth={3} />
        <path d="M110 142h20l-4 10h-12z" fill="var(--site-ink)" />
      </Frame>
    ),
  },
  "laptop-desk": {
    description: "A laptop on a desk next to a small plant",
    animated: false,
    Svg: () => (
      <Frame>
        <circle cx="120" cy="90" r="68" fill="var(--site-soft)" stroke="none" />
        <path d="M36 150v12M204 150v12" />
        <rect x="20" y="140" width="200" height="10" rx="4" fill="var(--site-paper)" />
        <rect x="46" y="54" width="104" height="72" rx="6" fill="var(--site-paper)" />
        <rect x="54" y="62" width="88" height="56" rx="3" fill="var(--site-accent)" strokeWidth={3} />
        <path d="M62 74h30M62 104h36" stroke="var(--site-paper)" strokeWidth={4} />
        <path d="M70 84h40M70 94h24" stroke="var(--site-accent-2)" strokeWidth={4} />
        <path d="M34 126h128l-6 14H40z" fill="var(--site-soft)" />
        <path
          d="M188 112c-12-14-16-26-14-40 12 8 18 22 14 40zM188 112c8-16 18-24 28-26-2 14-12 24-28 26zM188 112c-4-18 0-34 8-46 6 14 4 30-8 46z"
          fill="var(--site-accent-2)"
          strokeWidth={3}
        />
        <path d="M170 110h36l-5 30h-26z" fill="var(--site-accent)" />
      </Frame>
    ),
  },
  "notebook-pen": {
    description: "An open notebook and a pen, for writing and blogging",
    animated: false,
    Svg: () => (
      <Frame>
        <circle cx="120" cy="90" r="68" fill="var(--site-soft)" stroke="none" />
        <path d="M24 58q48-8 96 4 48-12 96-4v96q-48-8-96 4-48-12-96-4z" fill="var(--site-accent)" />
        <path d="M32 52q44-8 88 4v94q-44-12-88-4z" fill="var(--site-paper)" />
        <path d="M120 56q44-12 88-4v94q-44-8-88 4z" fill="var(--site-paper)" />
        <path d="M46 74h60M46 88h60M46 102h60M46 116h40M134 74h60M134 88h44" strokeWidth={3} />
        <path d="M132 120q4-8 8 0t8 0" stroke="var(--site-accent)" strokeWidth={3} />
        <g transform="rotate(40 170 90)">
          <rect x="163" y="46" width="14" height="66" rx="4" fill="var(--site-accent-2)" />
          <path d="M163 112h14l-7 16z" fill="var(--site-paper)" strokeWidth={3} />
          <path d="M163 60h14" strokeWidth={3} />
        </g>
      </Frame>
    ),
  },
  envelope: {
    description: "An envelope with a letter rising out of it, for contact",
    animated: true,
    Svg: () => (
      <Frame>
        <circle cx="120" cy="92" r="68" fill="var(--site-soft)" stroke="none" />
        <path d="M48 84l72-52 72 52z" fill="var(--site-accent-2)" />
        <rect x="48" y="80" width="144" height="80" rx="8" fill="var(--site-soft)" />
        <g className="a-bob">
          <rect x="64" y="34" width="112" height="96" rx="4" fill="var(--site-paper)" />
          <path d="M80 54h44M80 68h80M80 82h64M80 96h72" strokeWidth={3} />
          <rect x="144" y="44" width="20" height="22" rx="2" fill="var(--site-accent-2)" strokeWidth={3} />
        </g>
        <path d="M48 96l72 40 72-40v56a8 8 0 0 1-8 8H56a8 8 0 0 1-8-8z" fill="var(--site-accent)" />
        <path d="M52 156l52-34M188 156l-52-34" strokeWidth={3} />
        {[
          [34, 60],
          [206, 52],
        ].map(([x, y], index) => (
          <path
            key={x}
            d={sparkle(x, y, 9)}
            fill="var(--site-accent)"
            strokeWidth={2.5}
            className="a-blink"
            style={{ animationDelay: `${index * 0.6}s` }}
          />
        ))}
      </Frame>
    ),
  },
  handshake: {
    description: "Two hands shaking, for collaboration and teams",
    animated: false,
    Svg: () => (
      <Frame>
        <circle cx="120" cy="92" r="68" fill="var(--site-soft)" stroke="none" />
        <path d="M16 118l42-30 22 30-42 30z" fill="var(--site-accent)" />
        <path d="M224 118l-42-30-22 30 42 30z" fill="var(--site-accent-2)" />
        <path d="M58 88l9-6 22 30-9 6zM182 88l-9-6-22 30 9 6z" fill="var(--site-paper)" strokeWidth={3} />
        <path d="M76 86c20-10 44-14 66-6l12 22c-16 10-36 18-58 20l-14-8z" fill="var(--site-paper)" />
        <path d="M166 86c-16-8-38-10-56-2-8 4-10 12-4 16 6 3 14 0 20-3l30 30 16-12z" fill="var(--site-paper)" />
        {[
          "M154 108l-14 18",
          "M146 104l-18 22",
          "M136 100l-20 22",
          "M126 96l-20 20",
        ].map((d) => (
          <g key={d}>
            <path d={d} strokeWidth={15} />
            <path d={d} stroke="var(--site-paper)" strokeWidth={7} />
          </g>
        ))}
        <path d="M92 98l30-14" strokeWidth={15} />
        <path d="M92 98l30-14" stroke="var(--site-paper)" strokeWidth={7} />
      </Frame>
    ),
  },
  trophy: {
    description: "A trophy cup with sparkles",
    animated: false,
    Svg: () => (
      <Frame>
        <circle cx="120" cy="88" r="68" fill="var(--site-soft)" stroke="none" />
        <path d="M80 46H66c-8 0-10 10-8 18 4 14 16 22 28 24M160 46h14c8 0 10 10 8 18-4 14-16 22-28 24" strokeWidth={6} />
        <path d="M80 34h80v28c0 30-18 46-40 46s-40-16-40-46z" fill="var(--site-accent)" />
        <rect x="74" y="26" width="92" height="12" rx="5" fill="var(--site-accent)" />
        <path
          d="M120 52L123.5 61.1L133.3 61.7L125.7 67.9L128.2 77.3L120 72L111.8 77.3L114.3 67.9L106.7 61.7L116.5 61.1z"
          fill="var(--site-paper)"
          strokeWidth={3}
        />
        <rect x="112" y="108" width="16" height="18" fill="var(--site-soft)" />
        <rect x="92" y="126" width="56" height="12" rx="3" fill="var(--site-paper)" />
        <rect x="82" y="138" width="76" height="20" rx="4" fill="var(--site-accent-2)" />
        <rect x="106" y="143" width="28" height="10" rx="2" fill="var(--site-paper)" strokeWidth={3} />
        {[
          [48, 40, 11],
          [192, 32, 9],
          [196, 104, 12],
          [44, 112, 8],
        ].map(([x, y, s]) => (
          <path key={x} d={sparkle(x, y, s)} fill="var(--site-accent-2)" strokeWidth={2.5} />
        ))}
      </Frame>
    ),
  },
  calendar: {
    description: "A calendar page with marked dates, for timelines",
    animated: false,
    Svg: () => (
      <Frame>
        <circle cx="120" cy="92" r="68" fill="var(--site-soft)" stroke="none" />
        <rect x="48" y="30" width="144" height="128" rx="10" fill="var(--site-paper)" />
        <path d="M48 62V40a10 10 0 0 1 10-10h124a10 10 0 0 1 10 10v22z" fill="var(--site-accent)" />
        <rect x="76" y="20" width="10" height="22" rx="5" fill="var(--site-soft)" strokeWidth={3} />
        <rect x="154" y="20" width="10" height="22" rx="5" fill="var(--site-soft)" strokeWidth={3} />
        <rect x="83" y="94" width="74" height="16" rx="8" fill="var(--site-accent-2)" />
        {[80, 102, 124, 146].flatMap((cy) =>
          [70, 95, 120, 145, 170].map((cx) => (
            <rect key={`${cx}-${cy}`} x={cx - 7} y={cy - 5} width="14" height="10" rx="3" fill="var(--site-soft)" stroke="none" />
          )),
        )}
        <circle cx="170" cy="80" r="12" stroke="var(--site-accent)" strokeWidth={4} />
        <path d="M62 116l16 16M78 116l-16 16" stroke="var(--site-accent)" strokeWidth={4} />
        <rect x="136" y="138" width="18" height="16" rx="4" fill="var(--site-accent)" />
      </Frame>
    ),
  },
  "toy-bricks": {
    description: "Toy building bricks stacking up",
    animated: true,
    Svg: () => (
      <Frame>
        <circle cx="120" cy="92" r="68" fill="var(--site-soft)" stroke="none" />
        {[
          { x: 52, y: 126, w: 68, fill: "var(--site-accent)" },
          { x: 120, y: 126, w: 68, fill: "var(--site-accent-2)" },
          { x: 84, y: 94, w: 72, fill: "var(--site-paper)" },
        ].map(({ x, y, w, fill }) => (
          <g key={`${x}-${y}`}>
            <rect x={x + 10} y={y - 8} width="16" height="10" rx="2" fill={fill} strokeWidth={3} />
            <rect x={x + w - 26} y={y - 8} width="16" height="10" rx="2" fill={fill} strokeWidth={3} />
            <rect x={x} y={y} width={w} height="32" rx="4" fill={fill} />
          </g>
        ))}
        <rect x="29" y="132" width="14" height="9" rx="2" fill="var(--site-accent-2)" strokeWidth={3} />
        <rect x="24" y="138" width="24" height="20" rx="3" fill="var(--site-accent-2)" />
        <g className="a-bob">
          <rect x="106" y="40" width="16" height="10" rx="2" fill="var(--site-accent)" strokeWidth={3} />
          <rect x="128" y="40" width="16" height="10" rx="2" fill="var(--site-accent)" strokeWidth={3} />
          <rect x="98" y="48" width="54" height="30" rx="4" fill="var(--site-accent)" />
        </g>
        <path d="M84 52v14M168 52v14" strokeWidth={3} />
      </Frame>
    ),
  },
  magnifier: {
    description: "A magnifying glass searching over a page",
    animated: true,
    Svg: () => (
      <Frame>
        <circle cx="116" cy="90" r="68" fill="var(--site-soft)" stroke="none" />
        <path d="M56 34a6 6 0 0 1 6-6h70l28 28v94a6 6 0 0 1-6 6H62a6 6 0 0 1-6-6z" fill="var(--site-paper)" />
        <path d="M132 28v22a6 6 0 0 0 6 6h22" fill="var(--site-soft)" />
        <rect x="98" y="99" width="34" height="14" rx="4" fill="var(--site-accent)" stroke="none" />
        <path d="M72 64h44M72 78h70M72 92h60M72 106h70M72 120h48M72 134h62" strokeWidth={3} />
        <g className="a-slide">
          <path d="M138 122l30 30" strokeWidth={18} />
          <path d="M138 122l30 30" stroke="var(--site-accent-2)" strokeWidth={10} />
          <circle cx="118" cy="102" r="30" fill="var(--site-soft)" fillOpacity="0.55" strokeWidth={14} />
          <circle cx="118" cy="102" r="30" stroke="var(--site-accent)" strokeWidth={7} />
          <path d="M102 92a18 18 0 0 1 12-10" stroke="var(--site-paper)" strokeWidth={4} />
        </g>
      </Frame>
    ),
  },
  "mountain-flag": {
    description: "A mountain peak with a flag, for milestones",
    animated: false,
    Svg: () => (
      <Frame>
        <circle cx="120" cy="96" r="68" fill="var(--site-soft)" stroke="none" />
        <circle cx="188" cy="46" r="13" fill="var(--site-accent-2)" stroke="none" />
        <path d="M18 158l48-62 48 62zM128 158l48-70 46 70z" fill="var(--site-paper)" />
        <path d="M44 158l76-106 76 106z" fill="var(--site-accent)" />
        <path d="M120 52l23 32-11-4-10 10-12-10-13 4z" fill="var(--site-paper)" />
        <path d="M104 152l14-22-8-14 12-16" stroke="var(--site-paper)" strokeWidth={3} strokeDasharray="2 8" />
        <path d="M120 52V20" />
        <path d="M120 22l32 9-32 9z" fill="var(--site-accent-2)" />
      </Frame>
    ),
  },
} satisfies Record<string, ArtPiece>;
