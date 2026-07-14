import { z } from "zod";

const nonEmptyText = z.string().trim().min(1);
const localComponentSource = z.string().refine(
  (source) => source.startsWith("@/lib/motion-assets/"),
  "Motion SVG sources must be project-owned modules under @/lib/motion-assets/",
);
const localPublicSource = z.string().refine(
  (source) => source.startsWith("/motion/") && !source.startsWith("//"),
  "dotLottie sources must be local files under /motion/",
);
const reviewedDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO review date");

const licenseSchema = z
  .object({
    name: nonEmptyText,
    identifier: nonEmptyText,
    notice: nonEmptyText,
  })
  .strict();

const provenanceSchema = z
  .object({
    sourceKind: z.literal("project-authored"),
    creator: nonEmptyText,
    source: nonEmptyText,
    revision: nonEmptyText,
    notices: z.array(nonEmptyText).min(1),
    reviewedOn: reviewedDate,
  })
  .strict();

const accessibilitySchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("meaningful"),
      defaultLabel: nonEmptyText,
      staticEquivalent: nonEmptyText,
    })
    .strict(),
  z
    .object({
      kind: z.literal("decorative"),
      defaultLabel: z.null(),
      staticEquivalent: nonEmptyText,
    })
    .strict(),
]);

const scenePatternSchema = z.enum([
  "hero-statement",
  "project-spotlight",
  "evidence-ledger",
  "timeline",
  "capability-map",
  "system-diagram",
  "closing-synthesis",
]);

const staticRendererSchema = z.enum([
  "printer-forge",
  "print-layers",
  "circuit-mind",
  "spark-loader",
  "data-center",
  "server-sweep",
  "container-stack",
  "morning-coffee",
]);

const motionSvgRendererSchema = z
  .object({
    kind: z.literal("motion-svg"),
    component: staticRendererSchema,
    localSource: localComponentSource,
  })
  .strict();

const dotLottieRendererSchema = z
  .object({
    kind: z.literal("dotlottie"),
    src: localPublicSource.refine((source) => source.endsWith(".lottie"), "Expected a .lottie package"),
    animationId: nonEmptyText,
    localSource: localPublicSource.refine(
      (source) => source.endsWith(".lottie"),
      "Expected a local .lottie package",
    ),
    embeddedResources: z
      .object({
        images: z.boolean(),
        fonts: z.literal(false),
        audio: z.literal(false),
      })
      .strict(),
  })
  .strict();

export const motionAssetRecordSchema = z
  .object({
    id: nonEmptyText,
    status: z.literal("active"),
    generatorEligible: z.boolean(),
    description: nonEmptyText,
    semanticTags: z.array(nonEmptyText).min(2),
    eligibleScenePatterns: z.array(scenePatternSchema),
    renderer: z.discriminatedUnion("kind", [motionSvgRendererSchema, dotLottieRendererSchema]),
    intrinsic: z
      .object({
        width: z.number().positive(),
        height: z.number().positive(),
        viewBox: nonEmptyText,
      })
      .strict(),
    bounds: z
      .object({
        minWidth: z.number().positive(),
        maxWidth: z.number().positive(),
        aspectRatio: z.number().positive(),
      })
      .strict()
      .refine(({ minWidth, maxWidth }) => minWidth <= maxWidth, {
        message: "Responsive bounds require minWidth <= maxWidth",
      }),
    playback: z
      .object({
        trigger: z.literal("viewport"),
        replay: z.enum(["once", "loop"]),
        offscreen: z.literal("pause"),
      })
      .strict(),
    reducedMotion: z
      .object({
        strategy: z.literal("curated-static"),
        staticRenderer: staticRendererSchema,
      })
      .strict(),
    accessibility: accessibilitySchema,
    provenance: provenanceSchema,
    licenses: z
      .object({
        runtime: licenseSchema,
        choreography: licenseSchema,
      })
      .strict(),
  })
  .strict()
  .superRefine((record, context) => {
    const expectedAspectRatio = record.intrinsic.width / record.intrinsic.height;
    if (Math.abs(record.bounds.aspectRatio - expectedAspectRatio) > 0.0001) {
      context.addIssue({
        code: "custom",
        path: ["bounds", "aspectRatio"],
        message: "Responsive aspect ratio must match intrinsic dimensions",
      });
    }
    if (
      record.generatorEligible &&
      record.accessibility.kind !== "meaningful"
    ) {
      context.addIssue({
        code: "custom",
        path: ["accessibility", "kind"],
        message: "Generator-eligible Motion Assets must be meaningful",
      });
    }
    if (record.generatorEligible && record.eligibleScenePatterns.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["eligibleScenePatterns"],
        message: "Generator-eligible Motion Assets need at least one Scene Pattern",
      });
    }
    if (
      record.accessibility.kind === "decorative" &&
      record.eligibleScenePatterns.length > 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["eligibleScenePatterns"],
        message: "Decorative Motion Assets cannot be generator-visible",
      });
    }
  });

export type MotionAssetRecord = z.infer<typeof motionAssetRecordSchema>;

export const MOTION_ASSET_IDS = [
  "printer-forge",
  "print-layers",
  "circuit-mind",
  "spark-loader",
  "data-center",
  "server-sweep",
  "container-stack",
  "morning-coffee",
] as const;

export type MotionAssetId = (typeof MOTION_ASSET_IDS)[number];

const DOTLOTTIE_RUNTIME_LICENSE = {
  name: "dotLottie React",
  identifier: "MIT",
  notice: "@lottiefiles/dotlottie-react is distributed under the MIT License.",
} as const;

const LOTTIEFILES_CREATOR =
  "LottieFiles community creator (page attribution to confirm)";
const SHARED_PLAYBACK = {
  trigger: "viewport",
  replay: "loop",
  offscreen: "pause",
} as const;

function dotLottieRenderer(
  id: MotionAssetId,
  images = false,
) {
  const source = `/motion/${id}.lottie`;
  return {
    kind: "dotlottie",
    src: source,
    animationId: id,
    localSource: source,
    embeddedResources: { images, fonts: false, audio: false },
  } as const;
}

function intakeProvenance(
  id: MotionAssetId,
  revision: string,
  ...assetNotices: string[]
) {
  return {
    sourceKind: "project-authored",
    creator: LOTTIEFILES_CREATOR,
    source: "https://lottiefiles.com",
    revision,
    notices: [
      `Intake provenance and license review are recorded in /motion/${id}.provenance.json.`,
      "The LottieFiles creator page and attribution are pending confirmation.",
      ...assetNotices,
    ],
    reviewedOn: "2026-07-14",
  } as const;
}

function intakeLicenses(name: string, notice: string) {
  return {
    runtime: DOTLOTTIE_RUNTIME_LICENSE,
    choreography: {
      name,
      identifier: "Lottie Simple License (FL 9.13.21)",
      notice,
    },
  } as const;
}

const catalogInputs: Record<MotionAssetId, unknown> = {
  "printer-forge": {
    id: "printer-forge",
    status: "active",
    generatorEligible: true,
    description: "A working 3D printer turns digital intent into a physical object, one layer at a time.",
    semanticTags: ["3d-printing", "fabrication", "making", "delivery"],
    eligibleScenePatterns: [
      "project-spotlight",
      "capability-map",
      "closing-synthesis",
    ],
    renderer: dotLottieRenderer("printer-forge"),
    intrinsic: { width: 260, height: 332, viewBox: "0 0 260 332" },
    bounds: { minWidth: 180, maxWidth: 360, aspectRatio: 260 / 332 },
    playback: SHARED_PLAYBACK,
    reducedMotion: { strategy: "curated-static", staticRenderer: "printer-forge" },
    accessibility: {
      kind: "meaningful",
      defaultLabel: "A 3D printer builds an object layer by layer",
      staticEquivalent: "A printer gantry sits above a layered object on the print bed.",
    },
    provenance: intakeProvenance(
      "printer-forge",
      "sha256:ac4b7ee5d702839e536c41b4c51b7dc994aaa778441e99cdbab3437b31a0e4a5",
    ),
    licenses: intakeLicenses(
      "3D printer at work",
      "Downloaded from lottiefiles.com by Noah Rijkaard on 2026-07-14 (file: 3D printer.lottie); per-asset page URL and creator attribution to confirm.",
    ),
  },
  "print-layers": {
    id: "print-layers",
    status: "active",
    generatorEligible: true,
    description: "A 3D form emerges from precise stacked layers, making iterative construction visible.",
    semanticTags: ["3d-printing", "layers", "evidence", "iteration"],
    eligibleScenePatterns: ["evidence-ledger", "timeline", "project-spotlight"],
    renderer: dotLottieRenderer("print-layers"),
    intrinsic: { width: 500, height: 500, viewBox: "0 0 500 500" },
    bounds: { minWidth: 200, maxWidth: 560, aspectRatio: 1 },
    playback: SHARED_PLAYBACK,
    reducedMotion: { strategy: "curated-static", staticRenderer: "print-layers" },
    accessibility: {
      kind: "meaningful",
      defaultLabel: "A layered 3D print assembles from stacked slices",
      staticEquivalent: "Four offset material slices stack into a complete printed form.",
    },
    provenance: intakeProvenance(
      "print-layers",
      "sha256:256f036581d3a08712cdb5afc2f81ec21607688ed01ec027b52d93a67d51773c",
    ),
    licenses: intakeLicenses(
      "Layered 3D print",
      "Downloaded from lottiefiles.com by Noah Rijkaard on 2026-07-14 (file: 3d print.lottie); per-asset page URL and creator attribution to confirm.",
    ),
  },
  "circuit-mind": {
    id: "circuit-mind",
    status: "active",
    generatorEligible: true,
    description: "An isometric robot brain joins circuit paths into a clear model of technical reasoning.",
    semanticTags: ["ai", "systems", "reasoning", "architecture"],
    eligibleScenePatterns: ["hero-statement", "system-diagram", "capability-map"],
    renderer: dotLottieRenderer("circuit-mind"),
    intrinsic: { width: 928, height: 888, viewBox: "0 0 928 888" },
    bounds: { minWidth: 220, maxWidth: 640, aspectRatio: 928 / 888 },
    playback: SHARED_PLAYBACK,
    reducedMotion: { strategy: "curated-static", staticRenderer: "circuit-mind" },
    accessibility: {
      kind: "meaningful",
      defaultLabel: "Circuit paths animate through an isometric robot brain",
      staticEquivalent: "A brain-shaped circuit network links several processing nodes.",
    },
    provenance: intakeProvenance(
      "circuit-mind",
      "sha256:d6052554fe53aa778e63414efb549ff803b1b32d4922d83af89f7e39d18fc975",
    ),
    licenses: intakeLicenses(
      "Isometric AI robot brain",
      "Downloaded from lottiefiles.com by Noah Rijkaard on 2026-07-14 (file: Technology isometric ai robot brain.lottie); per-asset page URL and creator attribution to confirm.",
    ),
  },
  "spark-loader": {
    id: "spark-loader",
    status: "active",
    generatorEligible: false,
    description: "A compact sparkle loop for ambient loading feedback outside generated Story Scenes.",
    semanticTags: ["loading", "sparkles", "ambient", "decorative"],
    eligibleScenePatterns: [],
    renderer: dotLottieRenderer("spark-loader"),
    intrinsic: { width: 512, height: 512, viewBox: "0 0 512 512" },
    bounds: { minWidth: 120, maxWidth: 320, aspectRatio: 1 },
    playback: SHARED_PLAYBACK,
    reducedMotion: { strategy: "curated-static", staticRenderer: "spark-loader" },
    accessibility: {
      kind: "decorative",
      defaultLabel: null,
      staticEquivalent: "Small sparkle marks provide atmosphere; adjacent status text carries all meaning.",
    },
    provenance: intakeProvenance(
      "spark-loader",
      "sha256:2449093a911387f96bce14c8af18b4e3fdbf336e0028fc7b1e244ffa5e2183bd",
    ),
    licenses: intakeLicenses(
      "AI sparkles loader",
      "Downloaded from lottiefiles.com by Noah Rijkaard on 2026-07-14 (file: Sparkles Loop Loader ai.lottie); per-asset page URL and creator attribution to confirm.",
    ),
  },
  "data-center": {
    id: "data-center",
    status: "active",
    generatorEligible: true,
    description: "Data center racks expose the dependable infrastructure behind a working product.",
    semanticTags: ["infrastructure", "servers", "operations", "evidence"],
    eligibleScenePatterns: ["system-diagram", "evidence-ledger", "capability-map"],
    renderer: dotLottieRenderer("data-center"),
    intrinsic: { width: 912, height: 824, viewBox: "0 0 912 824" },
    bounds: { minWidth: 240, maxWidth: 680, aspectRatio: 912 / 824 },
    playback: SHARED_PLAYBACK,
    reducedMotion: { strategy: "curated-static", staticRenderer: "data-center" },
    accessibility: {
      kind: "meaningful",
      defaultLabel: "Rows of data center racks pulse with network activity",
      staticEquivalent: "Three populated server racks stand together with active status lights.",
    },
    provenance: intakeProvenance(
      "data-center",
      "sha256:4245a0ff0becc3963f9abd4981fa1643d31a9fdabc6f41ef2b2dd19268ca9bcf",
    ),
    licenses: intakeLicenses(
      "Data center racks",
      "Downloaded from lottiefiles.com by Noah Rijkaard on 2026-07-14 (file: Data Center Blue Orange.lottie); per-asset page URL and creator attribution to confirm.",
    ),
  },
  "server-sweep": {
    id: "server-sweep",
    status: "active",
    generatorEligible: true,
    description: "A server maintenance sweep turns operational cleanup into a visible, ordered process.",
    semanticTags: ["servers", "maintenance", "operations", "timeline"],
    eligibleScenePatterns: ["system-diagram", "timeline", "evidence-ledger"],
    renderer: dotLottieRenderer("server-sweep"),
    intrinsic: { width: 512, height: 512, viewBox: "0 0 512 512" },
    bounds: { minWidth: 200, maxWidth: 520, aspectRatio: 1 },
    playback: SHARED_PLAYBACK,
    reducedMotion: { strategy: "curated-static", staticRenderer: "server-sweep" },
    accessibility: {
      kind: "meaningful",
      defaultLabel: "A maintenance sweep clears a server rack",
      staticEquivalent: "A clean sweep passes across an orderly stack of server trays.",
    },
    provenance: intakeProvenance(
      "server-sweep",
      "sha256:8a3ad7566a0999bcbfd7c13336d50bccb9169d1235d186d1b3bf5ab111b6c056",
    ),
    licenses: intakeLicenses(
      "Server maintenance sweep",
      "Downloaded from lottiefiles.com by Noah Rijkaard on 2026-07-14 (file: ServerDeleting.lottie); per-asset page URL and creator attribution to confirm.",
    ),
  },
  "container-stack": {
    id: "container-stack",
    status: "active",
    generatorEligible: true,
    description: "A container stack makes deployable infrastructure and composable services tangible.",
    semanticTags: ["containers", "docker", "infrastructure", "deployment"],
    eligibleScenePatterns: ["system-diagram", "capability-map", "project-spotlight"],
    renderer: dotLottieRenderer("container-stack", true),
    intrinsic: { width: 850, height: 832, viewBox: "0 0 850 832" },
    bounds: { minWidth: 220, maxWidth: 640, aspectRatio: 850 / 832 },
    playback: SHARED_PLAYBACK,
    reducedMotion: { strategy: "curated-static", staticRenderer: "container-stack" },
    accessibility: {
      kind: "meaningful",
      defaultLabel: "Software containers assemble into an infrastructure stack",
      staticEquivalent: "Three deployable containers interlock into one stable stack.",
    },
    provenance: intakeProvenance(
      "container-stack",
      "sha256:377f07f1912fe7ce20b7aa1f9597cbb426d294d86355ac2f9d34a671d58d41b9",
      "The reviewed package contains inlined raster image resources and no remote references.",
    ),
    licenses: intakeLicenses(
      "Docker container stack",
      "Downloaded from lottiefiles.com by Noah Rijkaard on 2026-07-14 (file: docker.lottie); per-asset page URL and creator attribution to confirm.",
    ),
  },
  "morning-coffee": {
    id: "morning-coffee",
    status: "active",
    generatorEligible: true,
    description: "A warm coffee ritual grounds technical craft in a recognizably human working rhythm.",
    semanticTags: ["coffee", "ritual", "craft", "synthesis"],
    eligibleScenePatterns: ["hero-statement", "closing-synthesis"],
    renderer: dotLottieRenderer("morning-coffee"),
    intrinsic: { width: 500, height: 500, viewBox: "0 0 500 500" },
    bounds: { minWidth: 180, maxWidth: 480, aspectRatio: 1 },
    playback: SHARED_PLAYBACK,
    reducedMotion: { strategy: "curated-static", staticRenderer: "morning-coffee" },
    accessibility: {
      kind: "meaningful",
      defaultLabel: "A steaming cup completes a morning coffee ritual",
      staticEquivalent: "A warm cup and saucer sit beneath two calm curls of steam.",
    },
    provenance: intakeProvenance(
      "morning-coffee",
      "sha256:0a8bbd33262484f2b18eefb431e77e955a7b6c5df3c39e8f43b5e123ae831d8d",
    ),
    licenses: intakeLicenses(
      "Morning coffee ritual",
      "Downloaded from lottiefiles.com by Noah Rijkaard on 2026-07-14 (file: Morning Coffee.lottie); per-asset page URL and creator attribution to confirm.",
    ),
  },
};

const motionAssets = Object.freeze(
  Object.fromEntries(
    MOTION_ASSET_IDS.map((id) => [id, motionAssetRecordSchema.parse(catalogInputs[id])]),
  ) as Record<MotionAssetId, MotionAssetRecord>,
);

export function isMotionAssetId(value: unknown): value is MotionAssetId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(motionAssets, value);
}

export function getMotionAsset(assetId: string): MotionAssetRecord | undefined {
  return isMotionAssetId(assetId) ? motionAssets[assetId] : undefined;
}

export const motionAssetPromptCatalog = Object.freeze(
  MOTION_ASSET_IDS.filter(
    (id) => motionAssets[id].generatorEligible,
  ).map((id) => {
    const asset = motionAssets[id];
    return Object.freeze({
      id,
      description: asset.description,
      semanticTags: Object.freeze([...asset.semanticTags]),
      eligibleScenePatterns: Object.freeze([...asset.eligibleScenePatterns]),
    });
  }),
);
