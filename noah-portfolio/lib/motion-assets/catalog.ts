import { z } from "zod";
import circuitMindProvenance from "@/public/motion/circuit-mind.provenance.json";
import containerStackProvenance from "@/public/motion/container-stack.provenance.json";
import dataCenterProvenance from "@/public/motion/data-center.provenance.json";
import morningCoffeeProvenance from "@/public/motion/morning-coffee.provenance.json";
import printLayersProvenance from "@/public/motion/print-layers.provenance.json";
import printerForgeProvenance from "@/public/motion/printer-forge.provenance.json";
import serverSweepProvenance from "@/public/motion/server-sweep.provenance.json";
import sparkLoaderProvenance from "@/public/motion/spark-loader.provenance.json";

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

const nonEmptyText = z.string().trim().min(1);
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

const staticRendererSchema = z.enum(MOTION_ASSET_IDS);

const motionSvgRendererSchema = z
  .object({
    kind: z.literal("motion-svg"),
    component: staticRendererSchema,
  })
  .strict();

const dotLottieRendererSchema = z
  .object({
    kind: z.literal("dotlottie"),
    src: localPublicSource.refine(
      (source) => source.endsWith(".lottie"),
      "Expected a .lottie package",
    ),
    animationId: nonEmptyText,
    embeddedResources: z
      .object({
        images: z.boolean(),
        fonts: z.literal(false),
        audio: z.literal(false),
      })
      .strict(),
  })
  .strict();

const intakeProvenanceFileSchema = z
  .object({
    assetId: staticRendererSchema,
    format: z.literal("dotLottie v2"),
    creator: nonEmptyText,
    sourceKind: z.literal("project-authored"),
    source: nonEmptyText,
    revision: nonEmptyText,
    reviewedOn: reviewedDate,
    embeddedResources: z
      .object({
        images: z.boolean(),
        fonts: z.literal(false),
        audio: z.literal(false),
        themes: z.literal(false),
        stateMachines: z.literal(false),
      })
      .strict(),
    runtimeLicense: licenseSchema,
    choreographyLicense: licenseSchema,
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

const motionAssetProvenanceSchema = z.record(
  staticRendererSchema,
  intakeProvenanceFileSchema,
);
const provenanceByAsset = motionAssetProvenanceSchema.parse({
  "printer-forge": printerForgeProvenance,
  "print-layers": printLayersProvenance,
  "circuit-mind": circuitMindProvenance,
  "spark-loader": sparkLoaderProvenance,
  "data-center": dataCenterProvenance,
  "server-sweep": serverSweepProvenance,
  "container-stack": containerStackProvenance,
  "morning-coffee": morningCoffeeProvenance,
});

const SHARED_PLAYBACK = {
  trigger: "viewport",
  replay: "loop",
  offscreen: "pause",
} as const;

function dotLottieRenderer(id: MotionAssetId) {
  const { embeddedResources } = provenanceByAsset[id];
  return {
    kind: "dotlottie",
    src: `/motion/${id}.lottie`,
    animationId: id,
    embeddedResources: {
      images: embeddedResources.images,
      fonts: embeddedResources.fonts,
      audio: embeddedResources.audio,
    },
  } as const;
}

function intakeMetadata(
  id: MotionAssetId,
): Pick<
  z.input<typeof motionAssetRecordSchema>,
  "provenance" | "licenses"
> {
  const intake = provenanceByAsset[id];
  if (intake.assetId !== id) {
    throw new Error(
      `Motion provenance ${intake.assetId} was registered for catalog asset ${id}.`,
    );
  }

  return {
    provenance: {
      sourceKind: intake.sourceKind,
      creator: intake.creator,
      source: intake.source,
      revision: intake.revision,
      notices: [
        `Intake provenance and license review are recorded in /motion/${id}.provenance.json.`,
        intake.choreographyLicense.notice,
      ],
      reviewedOn: intake.reviewedOn,
    },
    licenses: {
      runtime: intake.runtimeLicense,
      choreography: intake.choreographyLicense,
    },
  };
}

const motionAssetCatalogSchema = z.record(
  staticRendererSchema,
  motionAssetRecordSchema,
);
const catalogInputs: z.input<typeof motionAssetCatalogSchema> = {
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
    ...intakeMetadata("printer-forge"),
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
    ...intakeMetadata("print-layers"),
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
    ...intakeMetadata("circuit-mind"),
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
    ...intakeMetadata("spark-loader"),
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
    ...intakeMetadata("data-center"),
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
    ...intakeMetadata("server-sweep"),
  },
  "container-stack": {
    id: "container-stack",
    status: "active",
    generatorEligible: true,
    description: "A container stack makes deployable infrastructure and composable services tangible.",
    semanticTags: ["containers", "docker", "infrastructure", "deployment"],
    eligibleScenePatterns: ["system-diagram", "capability-map", "project-spotlight"],
    renderer: dotLottieRenderer("container-stack"),
    intrinsic: { width: 850, height: 832, viewBox: "0 0 850 832" },
    bounds: { minWidth: 220, maxWidth: 640, aspectRatio: 850 / 832 },
    playback: SHARED_PLAYBACK,
    reducedMotion: { strategy: "curated-static", staticRenderer: "container-stack" },
    accessibility: {
      kind: "meaningful",
      defaultLabel: "Software containers assemble into an infrastructure stack",
      staticEquivalent: "Three deployable containers interlock into one stable stack.",
    },
    ...intakeMetadata("container-stack"),
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
    ...intakeMetadata("morning-coffee"),
  },
};

const motionAssets = Object.freeze(
  motionAssetCatalogSchema.parse(catalogInputs),
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
