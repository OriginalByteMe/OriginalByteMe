import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MOTION_ASSET_IDS,
  getMotionAsset,
  isMotionAssetId,
  motionAssetPromptCatalog,
  motionAssetRecordSchema,
} from "@/lib/motion-assets/catalog";

const EXPECTED_ASSETS = {
  "printer-forge": {
    width: 260,
    height: 332,
    patterns: ["project-spotlight", "capability-map", "closing-synthesis"],
  },
  "print-layers": {
    width: 500,
    height: 500,
    patterns: ["evidence-ledger", "timeline", "project-spotlight"],
  },
  "circuit-mind": {
    width: 928,
    height: 888,
    patterns: ["hero-statement", "system-diagram", "capability-map"],
  },
  "spark-loader": {
    width: 512,
    height: 512,
    patterns: [],
  },
  "data-center": {
    width: 912,
    height: 824,
    patterns: ["system-diagram", "evidence-ledger", "capability-map"],
  },
  "server-sweep": {
    width: 512,
    height: 512,
    patterns: ["system-diagram", "timeline", "evidence-ledger"],
  },
  "container-stack": {
    width: 850,
    height: 832,
    patterns: ["system-diagram", "capability-map", "project-spotlight"],
  },
  "morning-coffee": {
    width: 500,
    height: 500,
    patterns: ["hero-statement", "closing-synthesis"],
  },
} as const;

const CANONICAL_SCENE_PATTERNS = [
  "hero-statement",
  "project-spotlight",
  "evidence-ledger",
  "timeline",
  "capability-map",
  "system-diagram",
  "closing-synthesis",
] as const;

const RETIRED_ASSET_IDS = [
  "system-orbit",
  "evidence-thread",
  "delivery-path",
  "craft-layers",
  "signal-lantern",
] as const;

describe("Motion Asset Catalog", () => {
  it("exposes exactly the eight active intake IDs and retires the original catalog", () => {
    expect(MOTION_ASSET_IDS).toEqual(Object.keys(EXPECTED_ASSETS));
    expect(new Set(MOTION_ASSET_IDS).size).toBe(8);

    for (const retiredId of RETIRED_ASSET_IDS) {
      expect(isMotionAssetId(retiredId)).toBe(false);
      expect(getMotionAsset(retiredId)).toBeUndefined();
    }
    expect(isMotionAssetId("StaticComposition")).toBe(false);
    expect(getMotionAsset("unknown-remote-animation")).toBeUndefined();
  });

  it("records real intrinsic geometry, stable bounds, and exact pattern eligibility", () => {
    for (const assetId of MOTION_ASSET_IDS) {
      const expected = EXPECTED_ASSETS[assetId];
      const asset = getMotionAsset(assetId);
      expect(asset).toBeDefined();
      expect(motionAssetRecordSchema.safeParse(asset).success).toBe(true);
      expect(asset?.intrinsic).toEqual({
        width: expected.width,
        height: expected.height,
        viewBox: `0 0 ${expected.width} ${expected.height}`,
      });
      expect(asset?.bounds.aspectRatio).toBeCloseTo(
        expected.width / expected.height,
        8,
      );
      expect(asset?.bounds.minWidth).toBeLessThanOrEqual(
        asset?.bounds.maxWidth ?? 0,
      );
      expect(asset?.eligibleScenePatterns).toEqual(expected.patterns);
      expect(asset?.playback).toEqual({
        trigger: "viewport",
        replay: "loop",
        offscreen: "pause",
      });
      expect(asset?.reducedMotion).toEqual({
        strategy: "curated-static",
        staticRenderer: assetId,
      });
    }
  });

  it("keeps every runtime package local and matches each reviewed intake provenance", () => {
    for (const assetId of MOTION_ASSET_IDS) {
      const asset = getMotionAsset(assetId);
      expect(asset?.renderer.kind).toBe("dotlottie");
      if (!asset || asset.renderer.kind !== "dotlottie") continue;

      expect(asset.renderer.src).toBe(`/motion/${assetId}.lottie`);
      expect(asset.renderer.localSource).toBe(asset.renderer.src);
      expect(asset.renderer.animationId).toBe(assetId);
      expect(JSON.stringify(asset.renderer)).not.toMatch(/https?:|\/\//i);
      expect(asset.provenance.notices).toContain(
        `Intake provenance and license review are recorded in /motion/${assetId}.provenance.json.`,
      );

      const packageBytes = readFileSync(
        join(process.cwd(), `public/motion/${assetId}.lottie`),
      );
      expect(packageBytes.subarray(0, 2).toString()).toBe("PK");

      const intakeProvenance = JSON.parse(
        readFileSync(
          join(process.cwd(), `public/motion/${assetId}.provenance.json`),
          "utf8",
        ),
      );
      expect(asset.provenance).toMatchObject({
        sourceKind: intakeProvenance.sourceKind,
        creator: intakeProvenance.creator,
        source: intakeProvenance.source,
        revision: intakeProvenance.revision,
        reviewedOn: intakeProvenance.reviewedOn,
      });
      expect(asset.renderer.embeddedResources).toEqual({
        images: intakeProvenance.embeddedResources.images,
        fonts: intakeProvenance.embeddedResources.fonts,
        audio: intakeProvenance.embeddedResources.audio,
      });
      expect(asset.licenses).toEqual({
        runtime: intakeProvenance.runtimeLicense,
        choreography: intakeProvenance.choreographyLicense,
      });
      expect(asset.licenses.choreography.identifier).toBe(
        "Lottie Simple License (FL 9.13.21)",
      );
      expect(asset.licenses.choreography.notice).toContain(
        "creator attribution to confirm",
      );
    }
  });

  it("records the container raster resource without permitting remote runtime sources", () => {
    expect(getMotionAsset("container-stack")?.renderer).toMatchObject({
      kind: "dotlottie",
      embeddedResources: { images: true, fonts: false, audio: false },
    });
    expect(getMotionAsset("data-center")?.renderer).toMatchObject({
      embeddedResources: { images: false, fonts: false, audio: false },
    });

    const localAsset = getMotionAsset("circuit-mind");
    expect(localAsset?.renderer.kind).toBe("dotlottie");
    if (!localAsset || localAsset.renderer.kind !== "dotlottie") return;

    expect(
      motionAssetRecordSchema.safeParse({
        ...localAsset,
        renderer: {
          ...localAsset.renderer,
          src: "https://animations.example/circuit-mind.lottie",
        },
      }).success,
    ).toBe(false);
    expect(
      motionAssetRecordSchema.safeParse({
        ...localAsset,
        renderer: {
          ...localAsset.renderer,
          localSource: "//animations.example/circuit-mind.lottie",
        },
      }).success,
    ).toBe(false);
  });

  it("rejects incomplete policies, unknown posters, and unstable bounds", () => {
    const asset = getMotionAsset("circuit-mind");
    expect(asset).toBeDefined();
    if (!asset) return;

    const invalidRecords = [
      {
        ...asset,
        accessibility: { ...asset.accessibility, defaultLabel: "" },
      },
      {
        ...asset,
        provenance: { ...asset.provenance, notices: [] },
      },
      {
        ...asset,
        licenses: {
          ...asset.licenses,
          runtime: { ...asset.licenses.runtime, notice: "" },
        },
      },
      {
        ...asset,
        reducedMotion: {
          ...asset.reducedMotion,
          staticRenderer: "unreviewed-static-renderer",
        },
      },
      {
        ...asset,
        eligibleScenePatterns: [],
      },
      {
        ...asset,
        bounds: { ...asset.bounds, aspectRatio: 1 },
      },
      {
        ...asset,
        bounds: { ...asset.bounds, minWidth: 900, maxWidth: 720 },
      },
    ];

    for (const invalidRecord of invalidRecords) {
      expect(motionAssetRecordSchema.safeParse(invalidRecord).success).toBe(false);
    }
  });

  it("keeps decorative spark-loader renderer-only and aria-hidden", () => {
    const decorativeAsset = getMotionAsset("spark-loader");
    expect(decorativeAsset).toMatchObject({
      generatorEligible: false,
      eligibleScenePatterns: [],
      accessibility: {
        kind: "decorative",
        defaultLabel: null,
      },
    });
    if (!decorativeAsset) return;

    expect(
      motionAssetPromptCatalog.some(({ id }) => id === "spark-loader"),
    ).toBe(false);
    expect(
      motionAssetRecordSchema.safeParse({
        ...decorativeAsset,
        generatorEligible: true,
      }).success,
    ).toBe(false);
    expect(
      motionAssetRecordSchema.safeParse({
        ...decorativeAsset,
        eligibleScenePatterns: ["hero-statement"],
      }).success,
    ).toBe(false);
  });

  it("keeps every canonical Scene Pattern selectable by at least two eligible assets", () => {
    for (const pattern of CANONICAL_SCENE_PATTERNS) {
      const eligibleAssets = motionAssetPromptCatalog.filter((asset) =>
        asset.eligibleScenePatterns.includes(pattern),
      );
      expect(
        eligibleAssets.length,
        `${pattern} needs at least two generator-eligible Motion Assets`,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it("exposes only reviewed semantic metadata to the generator", () => {
    expect(motionAssetPromptCatalog.map(({ id }) => id)).toEqual([
      "printer-forge",
      "print-layers",
      "circuit-mind",
      "data-center",
      "server-sweep",
      "container-stack",
      "morning-coffee",
    ]);
    for (const promptAsset of motionAssetPromptCatalog) {
      expect(promptAsset).toEqual({
        id: promptAsset.id,
        description: expect.any(String),
        semanticTags: expect.any(Array),
        eligibleScenePatterns: expect.any(Array),
      });
      expect(promptAsset).not.toHaveProperty("renderer");
      expect(promptAsset).not.toHaveProperty("src");
      expect(promptAsset).not.toHaveProperty("playback");
    }
  });

  it("removes the retired signal-lantern package and source directory", () => {
    expect(
      existsSync(join(process.cwd(), "public/motion/signal-lantern.lottie")),
    ).toBe(false);
    expect(
      existsSync(
        join(process.cwd(), "public/motion/signal-lantern.provenance.json"),
      ),
    ).toBe(false);
    expect(
      existsSync(join(process.cwd(), "lib/motion-assets/dotlottie/signal-lantern")),
    ).toBe(false);
  });
});
