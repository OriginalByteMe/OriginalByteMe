import { Frame, type ArtPiece } from "./frame";

export const CORE_PIECES = {
  "server-rack": {
    description: "A homelab server rack with blinking status lights",
    animated: true,
    Svg: () => (
      <Frame>
        <circle cx="120" cy="88" r="70" fill="var(--site-soft)" stroke="none" />
        <rect x="74" y="18" width="92" height="142" rx="12" fill="var(--site-paper)" />
        {[32, 72, 112].map((y, index) => (
          <g key={y}>
            <rect x="86" y={y} width="68" height="30" rx="6" fill="var(--site-soft)" strokeWidth={3} />
            <circle
              cx="99"
              cy={y + 15}
              r="4.5"
              fill={index === 1 ? "var(--site-accent-2)" : "var(--site-accent)"}
              stroke="none"
              className="a-blink"
              style={{ animationDelay: `${index * 0.45}s` }}
            />
            <path d={`M114 ${y + 10}h28M114 ${y + 20}h20`} strokeWidth={3} />
          </g>
        ))}
        <path d="M86 160v6M154 160v6" />
      </Frame>
    ),
  },
  "coffee-cup": {
    description: "A steaming mug of coffee on a saucer",
    animated: false,
    Svg: () => (
      <Frame>
        <circle cx="120" cy="96" r="66" fill="var(--site-soft)" stroke="none" />
        <path d="M84 40c-8 10 8 16 0 26M112 32c-8 12 8 18 0 30M140 40c-8 10 8 16 0 26" strokeWidth={3.5} />
        <path d="M70 78h96v34a40 40 0 0 1-40 40h-16a40 40 0 0 1-40-40z" fill="var(--site-paper)" />
        <path d="M166 88h8a16 16 0 0 1 0 32h-10" />
        <path d="M78 92h80" stroke="var(--site-accent)" strokeWidth={6} />
        <path d="M52 158h136" />
      </Frame>
    ),
  },
} satisfies Record<string, ArtPiece>;
