import type { ReactNode } from "react";

export type MotionPlaybackState = "playing" | "paused" | "static";

type MotionSvgProps = {
  playbackState: MotionPlaybackState;
};

type PosterFrameProps = MotionSvgProps & {
  viewBox: string;
  children: ReactNode;
};

const NOCTURNE = {
  ink: "hsl(var(--story-ink))",
  muted: "hsl(var(--story-muted))",
  accent: "hsl(var(--story-accent))",
  accentSoft: "hsl(var(--story-accent-soft))",
  border: "hsl(var(--story-border))",
  surface: "hsl(var(--story-surface))",
  raised: "hsl(var(--story-surface-raised))",
} as const;

function PosterFrame({
  viewBox,
  playbackState,
  children,
}: PosterFrameProps) {
  return (
    <svg
      viewBox={viewBox}
      data-motion-poster-state={playbackState}
      className="size-full"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function PrinterForgePoster({
  playbackState = "static",
}: Partial<MotionSvgProps> = {}) {
  return (
    <PosterFrame viewBox="0 0 260 332" playbackState={playbackState}>
      <rect
        x="35"
        y="39"
        width="190"
        height="246"
        rx="18"
        fill={NOCTURNE.raised}
        stroke={NOCTURNE.border}
        strokeWidth="5"
      />
      <path
        d="M63 78H197M76 78V205M184 78V205"
        fill="none"
        stroke={NOCTURNE.ink}
        strokeLinecap="round"
        strokeWidth="7"
      />
      <path
        d="M101 103H159L150 132H110Z"
        fill={NOCTURNE.accentSoft}
        stroke={NOCTURNE.accent}
        strokeLinejoin="round"
        strokeWidth="5"
      />
      <path
        d="M130 132V157"
        stroke={NOCTURNE.accent}
        strokeLinecap="round"
        strokeWidth="6"
      />
      <path
        d="M103 212H157L151 178H109Z"
        fill={NOCTURNE.accentSoft}
        stroke={NOCTURNE.ink}
        strokeLinejoin="round"
        strokeWidth="5"
      />
      <path
        d="M109 190H151M106 201H154"
        stroke={NOCTURNE.accent}
        strokeLinecap="round"
        strokeWidth="4"
      />
      <path
        d="M70 229H190L203 250H57Z"
        fill={NOCTURNE.surface}
        stroke={NOCTURNE.ink}
        strokeLinejoin="round"
        strokeWidth="6"
      />
      <circle cx="65" cy="267" r="5" fill={NOCTURNE.accent} />
      <path
        d="M81 267H117"
        stroke={NOCTURNE.muted}
        strokeLinecap="round"
        strokeWidth="5"
      />
    </PosterFrame>
  );
}

export function PrintLayersPoster({
  playbackState = "static",
}: Partial<MotionSvgProps> = {}) {
  const layers = [
    { y: 118, inset: 86, opacity: 0.34 },
    { y: 178, inset: 70, opacity: 0.52 },
    { y: 238, inset: 54, opacity: 0.72 },
    { y: 298, inset: 38, opacity: 1 },
  ] as const;

  return (
    <PosterFrame viewBox="0 0 500 500" playbackState={playbackState}>
      {layers.map(({ y, inset, opacity }) => (
        <path
          key={y}
          d={`M${inset} ${y}L250 ${y - 62}L${500 - inset} ${y}L250 ${y + 62}Z`}
          fill={NOCTURNE.accentSoft}
          stroke={NOCTURNE.accent}
          strokeLinejoin="round"
          strokeWidth="6"
          opacity={opacity}
        />
      ))}
      <path
        d="M138 366L250 410L362 366"
        fill="none"
        stroke={NOCTURNE.ink}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="7"
        opacity="0.7"
      />
    </PosterFrame>
  );
}

export function CircuitMindPoster({
  playbackState = "static",
}: Partial<MotionSvgProps> = {}) {
  return (
    <PosterFrame viewBox="0 0 928 888" playbackState={playbackState}>
      <path
        d="M464 154C375 82 235 142 238 260C143 295 137 438 229 481C197 591 311 677 406 623C438 694 555 698 593 624C698 664 789 566 741 473C829 400 778 270 677 267C669 151 542 91 464 154Z"
        fill={NOCTURNE.raised}
        stroke={NOCTURNE.ink}
        strokeLinejoin="round"
        strokeWidth="14"
      />
      <g
        fill="none"
        stroke={NOCTURNE.accent}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="11"
      >
        <path d="M304 315H407L464 258V505L529 570H642" />
        <path d="M286 446H371L426 501V592" />
        <path d="M464 365H596L649 312" />
      </g>
      <g fill={NOCTURNE.accentSoft} stroke={NOCTURNE.accent} strokeWidth="9">
        <circle cx="304" cy="315" r="24" />
        <circle cx="286" cy="446" r="24" />
        <circle cx="649" cy="312" r="24" />
        <circle cx="642" cy="570" r="24" />
        <circle cx="426" cy="592" r="24" />
        <circle cx="464" cy="365" r="31" />
      </g>
      <path
        d="M358 718H570"
        stroke={NOCTURNE.border}
        strokeLinecap="round"
        strokeWidth="12"
      />
    </PosterFrame>
  );
}

export function SparkLoaderPoster({
  playbackState = "static",
}: Partial<MotionSvgProps> = {}) {
  return (
    <PosterFrame viewBox="0 0 512 512" playbackState={playbackState}>
      <circle
        cx="256"
        cy="256"
        r="156"
        fill={NOCTURNE.surface}
        stroke={NOCTURNE.border}
        strokeWidth="6"
      />
      <g
        fill={NOCTURNE.accentSoft}
        stroke={NOCTURNE.accent}
        strokeLinejoin="round"
        strokeWidth="7"
      >
        <path d="M256 132C266 198 280 212 346 222C280 232 266 246 256 312C246 246 232 232 166 222C232 212 246 198 256 132Z" />
        <path d="M359 276C365 313 373 321 410 327C373 333 365 341 359 378C353 341 345 333 308 327C345 321 353 313 359 276Z" />
        <path d="M155 286C160 316 167 323 197 328C167 333 160 340 155 370C150 340 143 333 113 328C143 323 150 316 155 286Z" />
      </g>
    </PosterFrame>
  );
}

export function DataCenterPoster({
  playbackState = "static",
}: Partial<MotionSvgProps> = {}) {
  const racks = [132, 356, 580] as const;
  const shelves = [222, 326, 430, 534] as const;

  return (
    <PosterFrame viewBox="0 0 912 824" playbackState={playbackState}>
      {racks.map((x, rackIndex) => (
        <g key={x}>
          <rect
            x={x}
            y="132"
            width="200"
            height="544"
            rx="20"
            fill={rackIndex === 1 ? NOCTURNE.accentSoft : NOCTURNE.raised}
            stroke={NOCTURNE.ink}
            strokeWidth="9"
          />
          {shelves.map((y, shelfIndex) => (
            <g key={y}>
              <rect
                x={x + 24}
                y={y}
                width="152"
                height="66"
                rx="10"
                fill={NOCTURNE.surface}
                stroke={NOCTURNE.border}
                strokeWidth="6"
              />
              <circle
                cx={x + 146}
                cy={y + 33}
                r="8"
                fill={(rackIndex + shelfIndex) % 2 === 0 ? NOCTURNE.accent : NOCTURNE.muted}
              />
              <path
                d={`M${x + 48} ${y + 33}H${x + 108}`}
                stroke={NOCTURNE.muted}
                strokeLinecap="round"
                strokeWidth="7"
              />
            </g>
          ))}
        </g>
      ))}
      <path
        d="M204 716H708"
        stroke={NOCTURNE.border}
        strokeLinecap="round"
        strokeWidth="12"
      />
    </PosterFrame>
  );
}

export function ServerSweepPoster({
  playbackState = "static",
}: Partial<MotionSvgProps> = {}) {
  return (
    <PosterFrame viewBox="0 0 512 512" playbackState={playbackState}>
      <rect
        x="112"
        y="94"
        width="288"
        height="324"
        rx="24"
        fill={NOCTURNE.raised}
        stroke={NOCTURNE.ink}
        strokeWidth="8"
      />
      {[142, 218, 294].map((y) => (
        <g key={y}>
          <rect
            x="146"
            y={y}
            width="220"
            height="54"
            rx="10"
            fill={NOCTURNE.surface}
            stroke={NOCTURNE.border}
            strokeWidth="5"
          />
          <path
            d={`M172 ${y + 27}H264`}
            stroke={NOCTURNE.muted}
            strokeLinecap="round"
            strokeWidth="6"
          />
          <circle cx="336" cy={y + 27} r="7" fill={NOCTURNE.accent} />
        </g>
      ))}
      <path
        d="M82 386C183 423 320 409 426 322"
        fill="none"
        stroke={NOCTURNE.accent}
        strokeLinecap="round"
        strokeWidth="14"
      />
      <path
        d="M404 294L438 312L426 350"
        fill={NOCTURNE.accentSoft}
        stroke={NOCTURNE.accent}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="9"
      />
    </PosterFrame>
  );
}

export function ContainerStackPoster({
  playbackState = "static",
}: Partial<MotionSvgProps> = {}) {
  const containers = [
    { x: 160, y: 154, width: 530 },
    { x: 102, y: 334, width: 530 },
    { x: 218, y: 514, width: 530 },
  ] as const;

  return (
    <PosterFrame viewBox="0 0 850 832" playbackState={playbackState}>
      {containers.map(({ x, y, width }, index) => (
        <g key={y}>
          <rect
            x={x}
            y={y}
            width={width}
            height="140"
            rx="22"
            fill={index === 1 ? NOCTURNE.accentSoft : NOCTURNE.raised}
            stroke={NOCTURNE.ink}
            strokeWidth="10"
          />
          <path
            d={`M${x + 56} ${y + 42}V${y + 98}M${x + 100} ${y + 42}V${y + 98}M${x + 144} ${y + 42}V${y + 98}`}
            stroke={NOCTURNE.border}
            strokeLinecap="round"
            strokeWidth="7"
          />
          <circle cx={x + width - 62} cy={y + 70} r="14" fill={NOCTURNE.accent} />
        </g>
      ))}
      <path
        d="M304 704H546"
        stroke={NOCTURNE.border}
        strokeLinecap="round"
        strokeWidth="12"
      />
    </PosterFrame>
  );
}

export function MorningCoffeePoster({
  playbackState = "static",
}: Partial<MotionSvgProps> = {}) {
  return (
    <PosterFrame viewBox="0 0 500 500" playbackState={playbackState}>
      <path
        d="M178 124C142 166 216 177 179 222M269 102C229 149 309 167 267 216"
        fill="none"
        stroke={NOCTURNE.accent}
        strokeLinecap="round"
        strokeWidth="10"
      />
      <path
        d="M118 238H341V337C341 394 296 430 230 430C163 430 118 394 118 337Z"
        fill={NOCTURNE.raised}
        stroke={NOCTURNE.ink}
        strokeLinejoin="round"
        strokeWidth="9"
      />
      <path
        d="M341 272H374C417 272 421 347 374 352H341"
        fill="none"
        stroke={NOCTURNE.ink}
        strokeWidth="9"
      />
      <path
        d="M87 438H385"
        stroke={NOCTURNE.border}
        strokeLinecap="round"
        strokeWidth="12"
      />
      <path
        d="M146 271C195 293 269 293 318 271"
        fill="none"
        stroke={NOCTURNE.accentSoft}
        strokeLinecap="round"
        strokeWidth="18"
      />
    </PosterFrame>
  );
}

export const MOTION_SVG_RENDERERS = {
  "printer-forge": PrinterForgePoster,
  "print-layers": PrintLayersPoster,
  "circuit-mind": CircuitMindPoster,
  "spark-loader": SparkLoaderPoster,
  "data-center": DataCenterPoster,
  "server-sweep": ServerSweepPoster,
  "container-stack": ContainerStackPoster,
  "morning-coffee": MorningCoffeePoster,
} as const;

export const MOTION_STATIC_RENDERERS = MOTION_SVG_RENDERERS;
