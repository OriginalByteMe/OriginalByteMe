import { Frame, type ArtPiece } from "./frame";

const point = (cx: number, cy: number, r: number, degrees: number) => {
  const a = (degrees * Math.PI) / 180;
  return `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
};

/** Ten-tooth gear outline; `offset` turns it by degrees so two gears can mesh. */
const gearPath = (cx: number, cy: number, offset: number) =>
  `M${Array.from({ length: 10 }, (_, k) =>
    [[32, -13], [42, -7], [42, 7], [32, 13]].map(([r, d]) => point(cx, cy, r, offset + k * 36 + d)).join("L"),
  ).join("L")}z`;

const burst = `M${Array.from({ length: 16 }, (_, k) => point(120, 89, k % 2 ? 22 : 29, k * 22.5)).join("L")}z`;

/** A price or data tag pointing left from its tip at (x, y). */
const tagPath = (x: number, y: number) => `M${x} ${y}l12-12h30a5 5 0 0 1 5 5v14a5 5 0 0 1-5 5h-30z`;

function RobotHead({ body }: { body: string }) {
  return (
    <>
      <path d="M58 52V36" />
      <circle cx="58" cy="31" r="6" fill="var(--site-accent-2)" strokeWidth={3} />
      <path d="M32 158v-10a14 14 0 0 1 14-14h24a14 14 0 0 1 14 14v10" fill="var(--site-paper)" />
      <rect x="48" y="116" width="20" height="18" fill="var(--site-soft)" strokeWidth={3} />
      <rect x="26" y="52" width="64" height="66" rx="14" fill={body} />
      {[46, 72].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="78" r="9" fill="var(--site-paper)" strokeWidth={3} />
          <circle cx={cx + 3} cy="78" r="4" fill="var(--site-ink)" stroke="none" />
        </g>
      ))}
      <rect x="40" y="96" width="36" height="12" rx="4" fill="var(--site-paper)" strokeWidth={3} />
      <path d="M52 96v12M64 96v12" strokeWidth={3} />
    </>
  );
}

export const TECH_PIECES = {
  "code-editor": {
    description: "A code editor window with lines of code typing in",
    animated: true,
    Svg: () => (
      <Frame>
        <ellipse cx="120" cy="92" rx="100" ry="58" fill="var(--site-soft)" stroke="none" />
        <rect x="36" y="28" width="168" height="128" rx="12" fill="var(--site-paper)" />
        <path d="M48 28h144a12 12 0 0 1 12 12v14H36V40a12 12 0 0 1 12-12z" fill="var(--site-accent)" />
        {[52, 66, 80].map((cx) => (
          <circle key={cx} cx={cx} cy="41" r="4" fill="var(--site-paper)" strokeWidth={3} />
        ))}
        {[
          { y: 72, segments: [[52, 80, "var(--site-accent)"], [90, 132, "var(--site-ink)"]] },
          { y: 88, segments: [[68, 96, "var(--site-accent-2)"], [106, 164, "var(--site-ink)"]] },
          { y: 104, segments: [[68, 90, "var(--site-accent)"], [100, 126, "var(--site-accent-2)"], [136, 152, "var(--site-ink)"]] },
          { y: 120, segments: [[84, 144, "var(--site-ink)"]] },
          { y: 136, segments: [[52, 72, "var(--site-accent)"]] },
        ].map(({ y, segments }, index) => (
          <g key={y} className="a-type" style={{ animationDelay: `${index * 0.3}s` }}>
            {segments.map(([x1, x2, color]) => (
              <path key={x1} d={`M${x1} ${y}H${x2}`} stroke={color as string} strokeWidth={6} />
            ))}
          </g>
        ))}
        <rect x="82" y="129" width="7" height="14" fill="var(--site-ink)" stroke="none" className="a-blink" />
      </Frame>
    ),
  },
  terminal: {
    description: "A terminal window with a command prompt and a blinking cursor",
    animated: true,
    Svg: () => (
      <Frame>
        <circle cx="120" cy="92" r="72" fill="var(--site-soft)" stroke="none" />
        <rect x="36" y="30" width="168" height="124" rx="12" fill="var(--site-paper)" />
        <path d="M48 30h144a12 12 0 0 1 12 12v12H36V42a12 12 0 0 1 12-12z" fill="var(--site-accent-2)" />
        {[52, 66, 80].map((cx) => (
          <circle key={cx} cx={cx} cy="42" r="4" fill="var(--site-paper)" strokeWidth={3} />
        ))}
        <path d="M54 70l10 8-10 8" stroke="var(--site-accent)" strokeWidth={5} />
        <path d="M74 78h60" strokeWidth={5} />
        <path d="M54 98h96M54 112h64" strokeWidth={4} opacity="0.45" />
        <path d="M52 124l16 12-16 12" stroke="var(--site-accent)" strokeWidth={7} />
        <rect x="78" y="128" width="18" height="18" rx="2" fill="var(--site-accent-2)" strokeWidth={3} className="a-blink" />
      </Frame>
    ),
  },
  "shipping-containers": {
    description: "Stacked shipping containers, the usual picture for Docker",
    animated: true,
    Svg: () => (
      <Frame>
        <circle cx="120" cy="100" r="68" fill="var(--site-soft)" stroke="none" />
        {[
          { x: 38, fill: "var(--site-accent)" },
          { x: 122, fill: "var(--site-accent-2)" },
        ].map(({ x, fill }) => (
          <g key={x}>
            <rect x={x} y="112" width="80" height="46" rx="4" fill={fill} />
            <path d={[14, 26, 38, 50, 62].map((dx) => `M${x + dx} 120v30`).join("")} strokeWidth={3} />
          </g>
        ))}
        <g className="a-bob">
          <path d="M120 16v20" />
          <path d="M120 36l-30 32M120 36l30 32" strokeWidth={3} />
          <circle cx="120" cy="36" r="5" fill="var(--site-paper)" strokeWidth={3} />
          <rect x="80" y="66" width="80" height="46" rx="4" fill="var(--site-paper)" />
          <path d={[14, 26, 38, 50, 62].map((dx) => `M${80 + dx} 74v30`).join("")} stroke="var(--site-accent)" strokeWidth={4} />
        </g>
      </Frame>
    ),
  },
  database: {
    description: "Stacked database cylinders",
    animated: false,
    Svg: () => (
      <Frame>
        <circle cx="120" cy="96" r="70" fill="var(--site-soft)" stroke="none" />
        {[108, 74, 40].map((y, index) => (
          <g key={y}>
            <path
              d={`M66 ${y}v34a54 14 0 0 0 108 0v-34a54 14 0 0 0-108 0z`}
              fill={index === 1 ? "var(--site-accent-2)" : "var(--site-paper)"}
            />
            <circle cx="150" cy={y + 22} r="5" fill={index === 1 ? "var(--site-paper)" : "var(--site-accent)"} strokeWidth={3} />
            <path d={`M84 ${y + 22}h34`} strokeWidth={3} />
          </g>
        ))}
        <ellipse cx="120" cy="40" rx="54" ry="14" fill="var(--site-accent)" />
      </Frame>
    ),
  },
  "cloud-sync": {
    description: "A cloud with arrows syncing data up and down",
    animated: true,
    Svg: () => (
      <Frame>
        <circle cx="120" cy="92" r="70" fill="var(--site-soft)" stroke="none" />
        <path
          d="M84 90a22 22 0 0 1-2-44a30 30 0 0 1 56-10a24 24 0 0 1 40 18a18 18 0 0 1-4 36z"
          fill="var(--site-paper)"
        />
        <circle cx="122" cy="64" r="20" fill="var(--site-accent)" stroke="none" />
        <g className="a-spin" stroke="var(--site-paper)" strokeWidth={4}>
          <path d="M110 64a12 12 0 0 1 20-9M134 64a12 12 0 0 1-20 9" />
          <path d="M124 53l7 2-1-7M120 75l-7-2 1 7" />
        </g>
        <path d="M100 132V100" stroke="var(--site-accent-2)" strokeWidth={6} className="a-flow" />
        <path d="M90 108l10-12 10 12" stroke="var(--site-accent-2)" strokeWidth={6} />
        <path d="M140 98v32" stroke="var(--site-accent)" strokeWidth={6} className="a-flow" style={{ animationDelay: "0.6s" }} />
        <path d="M130 122l10 12 10-12" stroke="var(--site-accent)" strokeWidth={6} />
        <rect x="72" y="138" width="96" height="20" rx="6" fill="var(--site-paper)" />
        <circle cx="86" cy="148" r="4" fill="var(--site-accent-2)" stroke="none" />
        <path d="M98 148h56" strokeWidth={3} />
      </Frame>
    ),
  },
  "network-graph": {
    description: "Connected network nodes with data pulses travelling between them",
    animated: true,
    Svg: () => {
      const center = [120, 94] as const;
      const nodes = [
        [52, 62, "var(--site-paper)"],
        [62, 140, "var(--site-accent-2)"],
        [116, 30, "var(--site-accent-2)"],
        [186, 54, "var(--site-paper)"],
        [182, 138, "var(--site-accent-2)"],
      ] as const;
      const edges = [
        ...nodes.map(([x, y]) => `M${center[0]} ${center[1]}L${x} ${y}`),
        "M52 62L116 30",
        "M116 30L186 54",
        "M62 140L182 138",
      ];
      return (
        <Frame>
          <circle cx="120" cy="92" r="70" fill="var(--site-soft)" stroke="none" />
          {edges.map((d) => (
            <path key={d} d={d} />
          ))}
          {edges.map((d, index) => (
            <path
              key={`pulse-${d}`}
              d={d}
              stroke="var(--site-accent)"
              strokeWidth={5}
              className="a-flow"
              style={{ animationDelay: `${index * 0.2}s` }}
            />
          ))}
          <circle cx={center[0]} cy={center[1]} r="26" stroke="var(--site-accent)" strokeWidth={3} className="a-pulse" />
          <circle cx={center[0]} cy={center[1]} r="18" fill="var(--site-accent)" />
          <circle cx={center[0]} cy={center[1]} r="6" fill="var(--site-paper)" strokeWidth={3} />
          {nodes.map(([x, y, fill]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="12" fill={fill} />
          ))}
        </Frame>
      );
    },
  },
  "neural-net": {
    description: "A layered neural network with signals firing",
    animated: true,
    Svg: () => {
      const inputs = [58, 94, 130];
      const hidden = [40, 76, 112, 148];
      const outputs = [76, 112];
      return (
        <Frame>
          <circle cx="120" cy="94" r="70" fill="var(--site-soft)" stroke="none" />
          <g strokeWidth={3} opacity="0.7">
            {inputs.flatMap((a) => hidden.map((b) => <path key={`i${a}-${b}`} d={`M52 ${a}L120 ${b}`} />))}
            {hidden.flatMap((a) => outputs.map((b) => <path key={`h${a}-${b}`} d={`M120 ${a}L188 ${b}`} />))}
          </g>
          {["M52 94L120 76L188 76", "M52 130L120 112L188 112", "M52 58L120 40L188 76"].map((d, index) => (
            <path
              key={d}
              d={d}
              stroke="var(--site-accent)"
              strokeWidth={5}
              className="a-flow"
              style={{ animationDelay: `${index * 0.4}s` }}
            />
          ))}
          {inputs.map((y) => (
            <circle key={y} cx="52" cy={y} r="11" fill="var(--site-paper)" />
          ))}
          {hidden.map((y, index) => (
            <g key={y}>
              <circle cx="120" cy={y} r="11" fill="var(--site-paper)" />
              <circle
                cx="120"
                cy={y}
                r="9"
                fill="var(--site-accent)"
                stroke="none"
                className="a-glow"
                style={{ animationDelay: `${index * 0.35}s` }}
              />
            </g>
          ))}
          {outputs.map((y) => (
            <circle key={y} cx="188" cy={y} r="13" fill="var(--site-accent-2)" />
          ))}
        </Frame>
      );
    },
  },
  "chat-bubbles": {
    description: "Two chat bubbles, one with typing dots, like talking to an LLM",
    animated: true,
    Svg: () => (
      <Frame>
        <circle cx="120" cy="92" r="70" fill="var(--site-soft)" stroke="none" />
        <path
          d="M50 30h76a18 18 0 0 1 18 18v14a18 18 0 0 1-18 18H66l-22 16 6-16a18 18 0 0 1-18-18V48a18 18 0 0 1 18-18z"
          fill="var(--site-paper)"
        />
        <path d="M52 50h68" strokeWidth={5} />
        <path d="M52 64h40" stroke="var(--site-accent-2)" strokeWidth={5} />
        <path
          d="M116 94h72a20 20 0 0 1 20 20v26l6 18-20-12H116a20 20 0 0 1-20-20v-12a20 20 0 0 1 20-20z"
          fill="var(--site-accent)"
        />
        {[128, 152, 176].map((cx, index) => (
          <circle
            key={cx}
            cx={cx}
            cy="120"
            r="7"
            fill="var(--site-paper)"
            stroke="none"
            className="a-bob"
            style={{ animationDelay: `${index * 0.25}s` }}
          />
        ))}
      </Frame>
    ),
  },
  "robot-versus": {
    description: "Two robot heads facing off with a VS badge, comparing two AI models",
    animated: false,
    Svg: () => (
      <Frame>
        <ellipse cx="120" cy="96" rx="100" ry="62" fill="var(--site-soft)" stroke="none" />
        <RobotHead body="var(--site-accent)" />
        <g transform="translate(240 0) scale(-1 1)">
          <RobotHead body="var(--site-accent-2)" />
        </g>
        <path d={burst} fill="var(--site-ink)" strokeWidth={3} />
        <g stroke="var(--site-paper)" strokeWidth={4}>
          <path d="M105 81l7 17 7-17" />
          <path d="M136 82c-3-3-12-3-12 3c0 6 12 3 12 9c0 6-9 6-12 3" />
        </g>
      </Frame>
    ),
  },
  "data-labels": {
    description: "Photos with tag labels and check marks, like labelling training data",
    animated: false,
    Svg: () => (
      <Frame>
        <circle cx="120" cy="94" r="70" fill="var(--site-soft)" stroke="none" />
        <g transform="rotate(-10 80 100)">
          <rect x="30" y="56" width="92" height="78" rx="8" fill="var(--site-paper)" />
          <rect x="40" y="66" width="72" height="46" rx="4" fill="var(--site-soft)" strokeWidth={3} />
          <circle cx="76" cy="86" r="12" fill="var(--site-accent)" strokeWidth={3} />
          <path d="M40 122h34" strokeWidth={3} />
        </g>
        <path d={tagPath(22, 140)} fill="var(--site-accent-2)" strokeWidth={3} />
        <circle cx="34" cy="140" r="3" fill="var(--site-paper)" strokeWidth={2} />
        <rect x="86" y="44" width="112" height="90" rx="8" fill="var(--site-paper)" />
        <rect x="96" y="54" width="92" height="56" rx="4" fill="var(--site-soft)" strokeWidth={3} />
        <path d="M96 110l28-32 20 20 14-12 30 24z" fill="var(--site-accent-2)" strokeWidth={3} />
        <circle cx="166" cy="70" r="7" fill="var(--site-accent)" stroke="none" />
        <path d="M96 122h40" strokeWidth={3} />
        <path d={tagPath(150, 136)} fill="var(--site-accent)" />
        <circle cx="163" cy="136" r="3.5" fill="var(--site-paper)" strokeWidth={2} />
        <path d="M174 136h20" stroke="var(--site-paper)" strokeWidth={4} />
        <circle cx="196" cy="46" r="16" fill="var(--site-accent-2)" />
        <path d="M188 46l6 6 10-12" stroke="var(--site-paper)" strokeWidth={4} />
      </Frame>
    ),
  },
  "analytics-dashboard": {
    description: "An analytics dashboard with growing bar and line charts",
    animated: true,
    Svg: () => (
      <Frame>
        <ellipse cx="120" cy="92" rx="102" ry="60" fill="var(--site-soft)" stroke="none" />
        <rect x="28" y="28" width="184" height="128" rx="12" fill="var(--site-paper)" />
        <circle cx="44" cy="44" r="6" fill="var(--site-accent)" stroke="none" />
        <path d="M58 44h44" strokeWidth={4} />
        <rect x="150" y="38" width="48" height="12" rx="6" fill="var(--site-soft)" strokeWidth={3} />
        {[34, 58, 46, 76].map((h, index) => (
          <rect
            key={index}
            x={42 + index * 19}
            y={140 - h}
            width="14"
            height={h}
            rx="3"
            fill={index % 2 ? "var(--site-accent-2)" : "var(--site-accent)"}
            strokeWidth={3}
            className="a-grow"
            style={{ animationDelay: `${index * 0.25}s` }}
          />
        ))}
        <path d="M38 140h82" strokeWidth={3} />
        <rect x="126" y="60" width="74" height="84" rx="8" fill="var(--site-soft)" strokeWidth={3} />
        <path d="M134 128L148 110L162 116L176 92L190 76" stroke="var(--site-accent)" strokeWidth={5} />
        {[
          [134, 128],
          [148, 110],
          [162, 116],
          [176, 92],
        ].map(([cx, cy]) => (
          <circle key={cx} cx={cx} cy={cy} r="4" fill="var(--site-paper)" strokeWidth={3} />
        ))}
        <circle cx="190" cy="76" r="10" stroke="var(--site-accent-2)" strokeWidth={3} className="a-pulse" />
        <circle cx="190" cy="76" r="6" fill="var(--site-accent-2)" strokeWidth={3} />
      </Frame>
    ),
  },
  "shopping-cart": {
    description: "A shopping cart with price tags, for e-commerce and marketplaces",
    animated: false,
    Svg: () => (
      <Frame>
        <circle cx="122" cy="94" r="70" fill="var(--site-soft)" stroke="none" />
        <rect x="78" y="28" width="40" height="34" rx="4" fill="var(--site-accent-2)" />
        <rect x="124" y="38" width="36" height="24" rx="4" fill="var(--site-accent)" />
        <path d="M47 56H196L180 114H63z" fill="var(--site-paper)" />
        <path d="M51 74H191M56 94H186M90 56l4 58M128 56v58M164 56l-6 58" strokeWidth={3} />
        <path d="M22 36h20l26 96h104" />
        <path d="M82 132v4M160 132v4" />
        {[82, 160].map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy="146" r="10" fill="var(--site-ink)" />
            <circle cx={cx} cy="146" r="3.5" fill="var(--site-paper)" stroke="none" />
          </g>
        ))}
        <path d="M188 92l8 18" strokeWidth={3} />
        <g transform="rotate(100 196 110)">
          <path d={tagPath(196, 110)} fill="var(--site-accent-2)" />
          <path d="M218 110h16" stroke="var(--site-paper)" strokeWidth={4} />
        </g>
        <g transform="rotate(62 196 110)">
          <path d={tagPath(196, 110)} fill="var(--site-accent)" />
          <circle cx="208" cy="110" r="3" fill="var(--site-paper)" strokeWidth={2} />
          <path d="M218 110h16" stroke="var(--site-paper)" strokeWidth={4} />
        </g>
      </Frame>
    ),
  },
  "data-pipeline": {
    description: "Pipes carrying data packets from a source to a destination",
    animated: true,
    Svg: () => {
      const pipe = "M66 120H94V64H146V120H170";
      return (
        <Frame>
          <circle cx="120" cy="96" r="70" fill="var(--site-soft)" stroke="none" />
          <path d={pipe} strokeWidth={22} strokeLinejoin="miter" strokeLinecap="butt" />
          <path d={pipe} stroke="var(--site-paper)" strokeWidth={14} strokeLinejoin="miter" strokeLinecap="butt" />
          <path d={pipe} stroke="var(--site-accent)" strokeWidth={8} strokeLinecap="butt" className="a-flow" />
          <path d="M120 53V46" />
          <g className="a-spin">
            <circle cx="120" cy="32" r="14" fill="var(--site-accent-2)" />
            <path d="M120 18v28M106 32h28" strokeWidth={4} />
            <circle cx="120" cy="32" r="4" fill="var(--site-paper)" strokeWidth={3} />
          </g>
          <path d="M22 98v44a22 8 0 0 0 44 0V98" fill="var(--site-paper)" />
          <ellipse cx="44" cy="98" rx="22" ry="8" fill="var(--site-accent)" />
          <path d="M22 120a22 8 0 0 0 44 0" strokeWidth={3} />
          <path d="M170 104l24-10 24 10v40l-24 12-24-12z" fill="var(--site-accent-2)" />
          <path d="M170 104l24 12 24-12M194 116v40" strokeWidth={3} />
        </Frame>
      );
    },
  },
  "cpu-chip": {
    description: "A microchip with circuit traces",
    animated: false,
    Svg: () => {
      const pins = [-30, -10, 10, 30];
      return (
        <Frame>
          <circle cx="120" cy="90" r="70" fill="var(--site-soft)" stroke="none" />
          <path
            d="M84 50V30H58M156 50V22M64 110H36V136M176 70H204V44M176 110H196V150M136 130V152H96"
            strokeWidth={3}
          />
          {[
            [58, 30],
            [156, 22],
            [36, 136],
            [204, 44],
            [196, 150],
            [96, 152],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="5" fill="var(--site-accent-2)" strokeWidth={3} />
          ))}
          {pins.map((d) => (
            <path key={d} d={`M${120 + d} 50v-12M${120 + d} 130v12M76 ${90 + d}h-12M164 ${90 + d}h12`} />
          ))}
          <rect x="76" y="46" width="88" height="88" rx="10" fill="var(--site-paper)" />
          <rect x="94" y="64" width="52" height="52" rx="6" fill="var(--site-accent)" />
          <circle cx="88" cy="58" r="4" fill="var(--site-accent-2)" stroke="none" />
          <path d="M106 90h28M120 76v28" stroke="var(--site-paper)" strokeWidth={3} />
        </Frame>
      );
    },
  },
  "git-branches": {
    description: "A git commit graph with branches merging",
    animated: false,
    Svg: () => (
      <Frame>
        <ellipse cx="120" cy="96" rx="100" ry="62" fill="var(--site-soft)" stroke="none" />
        <path d="M56 96C56 66 70 46 98 46H144C170 46 184 66 184 96" stroke="var(--site-accent)" strokeWidth={7} />
        <path d="M110 96C110 126 122 146 148 146H200" stroke="var(--site-accent-2)" strokeWidth={7} />
        <path d="M24 96H216" strokeWidth={7} />
        {[30, 56, 110, 210].map((cx) => (
          <circle key={cx} cx={cx} cy="96" r="9" fill="var(--site-paper)" />
        ))}
        <circle cx="184" cy="96" r="13" fill="var(--site-accent)" />
        <circle cx="184" cy="96" r="5" fill="var(--site-paper)" stroke="none" />
        {[100, 142].map((cx) => (
          <circle key={cx} cx={cx} cy="46" r="10" fill="var(--site-accent)" />
        ))}
        {[154, 198].map((cx) => (
          <circle key={cx} cx={cx} cy="146" r="10" fill="var(--site-accent-2)" />
        ))}
      </Frame>
    ),
  },
  gears: {
    description: "Two interlocking gears turning",
    animated: true,
    Svg: () => (
      <Frame>
        <circle cx="120" cy="98" r="70" fill="var(--site-soft)" stroke="none" />
        {[
          { cx: 81, offset: 0, fill: "var(--site-accent)", className: "a-spin" },
          { cx: 159, offset: 18, fill: "var(--site-accent-2)", className: "a-spin-rev" },
        ].map(({ cx, offset, fill, className }) => (
          <g key={cx} className={className}>
            <path d={gearPath(cx, 100, offset)} fill={fill} />
            <circle cx={cx} cy="100" r="14" fill="var(--site-paper)" />
            <circle cx={cx} cy="100" r="5" fill="var(--site-ink)" stroke="none" />
          </g>
        ))}
      </Frame>
    ),
  },
  stopwatch: {
    description: "A stopwatch with a sweeping hand, for speed and benchmarks",
    animated: true,
    Svg: () => (
      <Frame>
        <circle cx="120" cy="100" r="70" fill="var(--site-soft)" stroke="none" />
        <rect x="113" y="40" width="14" height="14" fill="var(--site-paper)" strokeWidth={3} />
        <rect x="102" y="26" width="36" height="14" rx="4" fill="var(--site-accent)" />
        <rect x="114" y="42" width="12" height="12" rx="2" fill="var(--site-accent-2)" strokeWidth={3} transform="rotate(45 120 104)" />
        <circle cx="120" cy="104" r="54" fill="var(--site-paper)" />
        <path d="M120 104L120 68A36 36 0 0 1 151.2 122z" fill="var(--site-accent-2)" stroke="none" />
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d={`M${point(120, 104, 40, i * 30)}L${point(120, 104, 47, i * 30)}`} strokeWidth={3} />
        ))}
        <g className="a-spin-fast">
          <path d="M120 104L149.4 121" strokeWidth={5} />
          <path d="M120 104L90.6 87" stroke="none" />
          <circle cx="120" cy="104" r="6" fill="var(--site-accent)" strokeWidth={3} />
        </g>
      </Frame>
    ),
  },
  "tech-stack": {
    description: "Stacked isometric layers, like a technology stack",
    animated: false,
    Svg: () => (
      <Frame>
        <circle cx="120" cy="94" r="70" fill="var(--site-soft)" stroke="none" />
        {[
          { y: 122, top: "var(--site-accent-2)" },
          { y: 88, top: "var(--site-paper)" },
          { y: 54, top: "var(--site-accent)" },
        ].map(({ y, top }) => (
          <g key={y}>
            <path d={`M54 ${y}v12l66 26 66-26v-12l-66 26z`} fill={top} />
            <path d={`M54 ${y}v12l66 26 66-26v-12l-66 26z`} fill="var(--site-ink)" opacity="0.28" stroke="none" />
            <path d={`M54 ${y}l66-26 66 26-66 26z`} fill={top} />
            <path d={`M120 ${y + 26}v12`} strokeWidth={3} />
          </g>
        ))}
        {[98, 120, 142].map((cx) => (
          <circle key={cx} cx={cx} cy="54" r="5" fill="var(--site-paper)" strokeWidth={3} />
        ))}
      </Frame>
    ),
  },
  "browser-window": {
    description: "A browser window showing a website layout",
    animated: false,
    Svg: () => (
      <Frame>
        <ellipse cx="120" cy="92" rx="102" ry="60" fill="var(--site-soft)" stroke="none" />
        <rect x="28" y="28" width="184" height="128" rx="12" fill="var(--site-paper)" />
        <path d="M40 28h160a12 12 0 0 1 12 12v12H28V40a12 12 0 0 1 12-12z" fill="var(--site-soft)" />
        {["var(--site-accent)", "var(--site-accent-2)", "var(--site-paper)"].map((fill, index) => (
          <circle key={fill} cx={42 + index * 12} cy="40" r="4" fill={fill} strokeWidth={2.5} />
        ))}
        <rect x="84" y="34" width="116" height="12" rx="6" fill="var(--site-paper)" strokeWidth={3} />
        <rect x="40" y="62" width="96" height="50" rx="6" fill="var(--site-accent)" />
        <path d="M52 78h56M52 92h36" stroke="var(--site-paper)" strokeWidth={6} />
        <rect x="144" y="62" width="56" height="50" rx="6" fill="var(--site-accent-2)" />
        <path d="M148 108l16-18 12 12 8-6 14 12" stroke="var(--site-paper)" strokeWidth={4} />
        <circle cx="186" cy="76" r="5" fill="var(--site-paper)" stroke="none" />
        {[40, 96, 152].map((x) => (
          <g key={x}>
            <rect x={x} y="122" width="48" height="24" rx="5" fill="var(--site-paper)" strokeWidth={3} />
            <path d={`M${x + 9} 134h26`} strokeWidth={3} />
          </g>
        ))}
      </Frame>
    ),
  },
  "json-braces": {
    description: "Curly braces holding building blocks, like a JSON spec",
    animated: false,
    Svg: () => {
      const braces = [
        "M78 38c-14 0-18 6-18 18v20c0 10-6 16-14 18c8 2 14 8 14 18v20c0 12 4 18 18 18",
        "M162 38c14 0 18 6 18 18v20c0 10 6 16 14 18c-8 2-14 8-14 18v20c0 12-4 18-18 18",
      ];
      const bricks = [
        { x: 80, y: 122, w: 80, fill: "var(--site-accent-2)" },
        { x: 90, y: 90, w: 60, fill: "var(--site-accent)" },
        { x: 100, y: 58, w: 40, fill: "var(--site-paper)" },
      ];
      return (
        <Frame>
          <circle cx="120" cy="94" r="70" fill="var(--site-soft)" stroke="none" />
          {braces.map((d) => (
            <g key={d}>
              <path d={d} strokeWidth={15} />
              <path d={d} stroke="var(--site-accent)" strokeWidth={7} />
            </g>
          ))}
          {bricks.map(({ x, y, w, fill }) => (
            <g key={y}>
              {Array.from({ length: w / 20 }, (_, i) => (
                <rect key={i} x={x + 6 + i * 20} y={y - 7} width="12" height="9" rx="2" fill={fill} strokeWidth={3} />
              ))}
              <rect x={x} y={y} width={w} height="30" rx="4" fill={fill} />
            </g>
          ))}
        </Frame>
      );
    },
  },
  "plug-socket": {
    description: "A plug about to connect to a socket, for APIs and integrations",
    animated: false,
    Svg: () => (
      <Frame>
        <circle cx="120" cy="94" r="70" fill="var(--site-soft)" stroke="none" />
        <path d="M54 96c-22 0-30 18-30 40v20" strokeWidth={6} />
        <path d="M188 96c20 0 26 18 26 40v20" strokeWidth={6} />
        <rect x="98" y="83" width="22" height="8" rx="2" fill="var(--site-paper)" strokeWidth={3} />
        <rect x="98" y="101" width="22" height="8" rx="2" fill="var(--site-paper)" strokeWidth={3} />
        <rect x="52" y="68" width="48" height="56" rx="12" fill="var(--site-accent-2)" />
        <path d="M66 82v28M78 82v28" stroke="var(--site-paper)" strokeWidth={3} />
        <path d="M148 64h28a14 14 0 0 1 14 14v36a14 14 0 0 1-14 14h-28z" fill="var(--site-accent)" />
        <path d="M148 87h12M148 105h12" strokeWidth={6} />
        <path d="M130 72l4-10M138 96h6M130 120l4 10" stroke="var(--site-accent)" strokeWidth={4} />
      </Frame>
    ),
  },
} satisfies Record<string, ArtPiece>;
