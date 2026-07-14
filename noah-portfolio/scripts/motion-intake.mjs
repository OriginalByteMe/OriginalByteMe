#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { deflateRawSync, inflateRawSync } from "node:zlib";

const USAGE = `Usage: node scripts/motion-intake.mjs <file.lottie|file.json> --id <kebab-id> --title <t> --creator <c> --source-url <u> --license <spdx-or-name> --notes <n> [--check-only] [--out-dir <dir>]`;
const REQUIRED_FLAGS = ["id", "title", "creator", "source-url", "license", "notes"];
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
const MAX_ENTRY_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 32 * 1024 * 1024;
const MAX_ENTRIES = 256;
const REMOTE_URL = /https?:\/\//i;
const AUDIO_EXTENSION = /\.(?:aac|flac|m4a|mp3|oga|ogg|opus|wav|weba)$/i;
const AUDIO_ENTRY_PATH = /(?:^|\/)(?:audio|audios|sound|sounds)(?:\/|$)/i;
const EXECUTABLE_EXTENSION = /\.(?:cjs|html?|js|mjs)$/i;
const EXPRESSION_KEYS = new Set(["expression", "expressions", "script", "scripts"]);
const AUDIO_KEYS = new Set(["audio", "audios", "audiotracks", "audio-tracks"]);
const IMAGE_ENTRY_PATH = /^(?:i|images)\/.+/;
const IMAGE_EXTENSION = /\.(?:gif|jpe?g|png|webp)$/i;
const IMAGE_MIME_BY_EXTENSION = {
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function fail(message) {
  throw new Error(message);
}

function parseArguments(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(USAGE);
    process.exit(0);
  }

  const positional = [];
  const options = { checkOnly: false, outDir: "public/motion" };
  const valueFlags = new Set([
    "--id",
    "--title",
    "--creator",
    "--source-url",
    "--license",
    "--notes",
    "--out-dir",
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--check-only") {
      options.checkOnly = true;
      continue;
    }
    if (valueFlags.has(argument)) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        fail(`Missing value for ${argument}.`);
      }
      const key = argument.slice(2);
      options[key === "out-dir" ? "outDir" : key] = value;
      index += 1;
      continue;
    }
    if (argument.startsWith("-")) {
      fail(`Unknown option: ${argument}`);
    }
    positional.push(argument);
  }

  if (positional.length !== 1) {
    fail("Expected exactly one .lottie or .json input file.");
  }
  for (const flag of REQUIRED_FLAGS) {
    if (typeof options[flag] !== "string" || options[flag].trim() === "") {
      fail(`Missing required flag --${flag}.`);
    }
    options[flag] = options[flag].trim();
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(options.id)) {
    fail("--id must be a kebab-case identifier containing lowercase letters and digits.");
  }
  let sourceUrl;
  try {
    sourceUrl = new URL(options["source-url"]);
  } catch {
    fail("--source-url must be a valid http:// or https:// URL.");
  }
  if (sourceUrl.protocol !== "http:" && sourceUrl.protocol !== "https:") {
    fail("--source-url must be a valid http:// or https:// URL.");
  }

  return { input: positional[0], ...options };
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseJson(buffer, label) {
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`${label} is not valid JSON: ${error.message}`);
  }
}

function hasValue(value) {
  if (value === null || value === undefined || value === false) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  if (isPlainObject(value)) return Object.keys(value).length > 0;
  return true;
}

function printablePath(parts) {
  return parts
    .map((part) => (typeof part === "number" ? `[${part}]` : part))
    .join(".")
    .replace(/\.\[/g, "[");
}

function isResourcePath(parts) {
  return parts.some(
    (part) =>
      typeof part === "string" &&
      ["assets", "fonts", "images"].includes(part.toLowerCase()),
  );
}

function scanForUnsafeContent(value, parts, label) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForUnsafeContent(item, [...parts, index], label));
    return;
  }
  if (!isPlainObject(value)) return;

  for (const [key, child] of Object.entries(value)) {
    const nextParts = [...parts, key];
    const lowerKey = key.toLowerCase();
    const location = printablePath(nextParts);

    if (
      (lowerKey === "x" && typeof child === "string" && child.trim() !== "") ||
      (EXPRESSION_KEYS.has(lowerKey) && hasValue(child))
    ) {
      fail(`${label} contains an embedded script or expression at ${location}.`);
    }
    if (AUDIO_KEYS.has(lowerKey) && hasValue(child)) {
      fail(`${label} contains audio at ${location}.`);
    }
    if (
      lowerKey === "ty" &&
      child === 6 &&
      parts.some((part) => typeof part === "string" && part.toLowerCase() === "layers")
    ) {
      fail(`${label} contains an audio layer at ${printablePath(parts)}.`);
    }
    if (
      typeof child === "string" &&
      isResourcePath(nextParts) &&
      REMOTE_URL.test(child)
    ) {
      fail(`${label} contains a remote resource URL at ${location}: ${child}`);
    }
    if (typeof child === "string" && /^data:audio\//i.test(child)) {
      fail(`${label} contains embedded audio at ${location}.`);
    }
    if (typeof child === "string" && isResourcePath(nextParts) && AUDIO_EXTENSION.test(child)) {
      fail(`${label} contains audio at ${location}: ${child}`);
    }

    scanForUnsafeContent(child, nextParts, label);
  }
}

function validateLottie(animation, label) {
  if (!isPlainObject(animation)) fail(`${label} must contain a Lottie JSON object.`);
  if (typeof animation.v !== "string" || animation.v.trim() === "") {
    fail(`${label} is missing a Lottie version string (v).`);
  }
  for (const key of ["fr", "ip", "op", "w", "h"]) {
    if (typeof animation[key] !== "number" || !Number.isFinite(animation[key])) {
      fail(`${label} has an invalid numeric ${key} field.`);
    }
  }
  if (animation.fr <= 0 || animation.w <= 0 || animation.h <= 0 || animation.op <= animation.ip) {
    fail(`${label} has invalid frame or intrinsic-dimension bounds.`);
  }
  if (!Array.isArray(animation.layers)) {
    fail(`${label} is missing its layers array.`);
  }
  scanForUnsafeContent(animation, [], label);
  return animation;
}

let crcTable;
function crc32(buffer) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) {
        value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
      }
      crcTable[index] = value >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of buffer) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function safeArchiveName(name) {
  if (
    name === "" ||
    name.includes("\0") ||
    name.includes("\\") ||
    name.startsWith("/") ||
    /^[a-z]:/i.test(name) ||
    name.split("/").some((part) => part === "..")
  ) {
    fail(`dotLottie package contains an unsafe entry path: ${JSON.stringify(name)}.`);
  }
}

function findEndOfCentralDirectory(archive) {
  const minimumOffset = Math.max(0, archive.length - 65_557);
  for (let offset = archive.length - 22; offset >= minimumOffset; offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  fail("Input .lottie is not a readable ZIP package (missing central directory).");
}

function readZipEntries(archive) {
  if (archive.length > MAX_ARCHIVE_BYTES) {
    fail(`Input .lottie exceeds the ${MAX_ARCHIVE_BYTES / 1024 / 1024} MiB intake limit.`);
  }
  const endOffset = findEndOfCentralDirectory(archive);
  const disk = archive.readUInt16LE(endOffset + 4);
  const centralDisk = archive.readUInt16LE(endOffset + 6);
  const entriesOnDisk = archive.readUInt16LE(endOffset + 8);
  const entryCount = archive.readUInt16LE(endOffset + 10);
  const centralSize = archive.readUInt32LE(endOffset + 12);
  const centralOffset = archive.readUInt32LE(endOffset + 16);
  if (
    disk !== 0 ||
    centralDisk !== 0 ||
    entriesOnDisk !== entryCount ||
    entryCount === 0xffff ||
    centralSize === 0xffffffff ||
    centralOffset === 0xffffffff
  ) {
    fail("Multi-disk and ZIP64 dotLottie packages are not supported by this intake tool.");
  }
  if (entryCount > MAX_ENTRIES) {
    fail(`dotLottie package exceeds the ${MAX_ENTRIES}-entry intake limit.`);
  }
  if (centralOffset + centralSize > endOffset) {
    fail("dotLottie central directory is malformed.");
  }

  const entries = new Map();
  let offset = centralOffset;
  let totalUncompressed = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > archive.length || archive.readUInt32LE(offset) !== 0x02014b50) {
      fail("dotLottie central directory contains a malformed entry.");
    }
    const flags = archive.readUInt16LE(offset + 8);
    const compression = archive.readUInt16LE(offset + 10);
    const expectedCrc = archive.readUInt32LE(offset + 16);
    const compressedSize = archive.readUInt32LE(offset + 20);
    const uncompressedSize = archive.readUInt32LE(offset + 24);
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const localOffset = archive.readUInt32LE(offset + 42);
    const entryEnd = offset + 46 + nameLength + extraLength + commentLength;
    if (entryEnd > archive.length) fail("dotLottie central directory is truncated.");
    const name = archive.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    safeArchiveName(name);
    if (entries.has(name)) fail(`dotLottie package contains duplicate entry ${name}.`);
    if ((flags & 1) !== 0) fail(`Encrypted ZIP entry ${name} is not supported.`);
    if (compression !== 0 && compression !== 8) {
      fail(`ZIP entry ${name} uses unsupported compression method ${compression}.`);
    }
    if (uncompressedSize > MAX_ENTRY_BYTES) {
      fail(`ZIP entry ${name} exceeds the ${MAX_ENTRY_BYTES / 1024 / 1024} MiB limit.`);
    }
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED_BYTES) {
      fail(`dotLottie package exceeds the ${MAX_TOTAL_UNCOMPRESSED_BYTES / 1024 / 1024} MiB expanded limit.`);
    }
    if (localOffset + 30 > archive.length || archive.readUInt32LE(localOffset) !== 0x04034b50) {
      fail(`ZIP entry ${name} has a malformed local header.`);
    }
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const localName = archive
      .subarray(localOffset + 30, localOffset + 30 + localNameLength)
      .toString("utf8");
    if (localName !== name) fail(`ZIP entry ${name} does not match its local header.`);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    if (dataOffset + compressedSize > archive.length) fail(`ZIP entry ${name} is truncated.`);
    const compressed = archive.subarray(dataOffset, dataOffset + compressedSize);
    let data;
    try {
      data = compression === 0 ? Buffer.from(compressed) : inflateRawSync(compressed);
    } catch (error) {
      fail(`ZIP entry ${name} could not be decompressed: ${error.message}`);
    }
    if (data.length !== uncompressedSize || crc32(data) !== expectedCrc) {
      fail(`ZIP entry ${name} failed its size or CRC integrity check.`);
    }
    entries.set(name, data);
    offset = entryEnd;
  }
  if (offset !== centralOffset + centralSize) {
    fail("dotLottie central directory size does not match its entries.");
  }
  return entries;
}

function manifestResourcePresent(manifest, key) {
  const value = manifest[key];
  return Array.isArray(value) ? value.length > 0 : hasValue(value);
}

function detectEmbeddedResources(entries, animations, manifest) {
  const names = [...entries.keys()].map((name) => name.toLowerCase());
  const imageInJson = animations.some((animation) =>
    Array.isArray(animation.assets) &&
    animation.assets.some(
      (asset) =>
        isPlainObject(asset) &&
        (typeof asset.p === "string" || typeof asset.u === "string" || asset.e === 1),
    ),
  );
  const fontsInJson = animations.some(
    (animation) =>
      isPlainObject(animation.fonts) &&
      Array.isArray(animation.fonts.list) &&
      animation.fonts.list.length > 0,
  );
  return {
    images:
      imageInJson || names.some((name) => /^(?:i|images)\//.test(name)),
    fonts:
      fontsInJson || names.some((name) => /^(?:f|fonts)\//.test(name)),
    audio: false,
    themes:
      manifestResourcePresent(manifest, "themes") ||
      names.some((name) => /^(?:t|themes)\//.test(name)),
    stateMachines:
      manifestResourcePresent(manifest, "stateMachines") ||
      names.some((name) => /^(?:s|state-machines|statemachines)\//.test(name)),
  };
}

function inspectDotLottie(archive) {
  const entries = readZipEntries(archive);
  for (const name of entries.keys()) {
    if (AUDIO_ENTRY_PATH.test(name) || AUDIO_EXTENSION.test(name)) {
      fail(`dotLottie package contains audio entry ${name}.`);
    }
    if (EXECUTABLE_EXTENSION.test(name)) fail(`dotLottie package contains executable entry ${name}.`);
  }
  const manifestBuffer = entries.get("manifest.json");
  if (!manifestBuffer) fail("dotLottie v2 package is missing manifest.json.");
  const manifest = parseJson(manifestBuffer, "manifest.json");
  if (!isPlainObject(manifest) || manifest.version !== "2") {
    fail('manifest.json must declare dotLottie version "2".');
  }
  if (!Array.isArray(manifest.animations) || manifest.animations.length === 0) {
    fail("manifest.json must list at least one animation.");
  }
  scanForUnsafeContent(manifest, [], "manifest.json");

  const ids = [];
  const seenIds = new Set();
  for (const [index, record] of manifest.animations.entries()) {
    const id = isPlainObject(record) ? record.id : undefined;
    if (typeof id !== "string" || !/^[A-Za-z0-9_-]+$/.test(id)) {
      fail(`manifest.json animations[${index}].id must be a safe non-empty identifier.`);
    }
    if (seenIds.has(id)) fail(`manifest.json contains duplicate animation id ${id}.`);
    seenIds.add(id);
    ids.push(id);
  }

  const initialId = isPlainObject(manifest.initial) ? manifest.initial.animation : undefined;
  if (initialId !== undefined && (typeof initialId !== "string" || !seenIds.has(initialId))) {
    fail("manifest.json initial.animation must reference a listed animation.");
  }
  if (ids.length > 1 && initialId === undefined) {
    fail("A multi-animation dotLottie package must declare initial.animation.");
  }
  const selectedId = initialId ?? ids[0];
  const animations = [];
  let selectedBuffer;
  let selectedAnimation;
  for (const id of ids) {
    const entryName = `a/${id}.json`;
    const buffer = entries.get(entryName);
    if (!buffer) fail(`dotLottie package is missing ${entryName}.`);
    const animation = validateLottie(parseJson(buffer, entryName), entryName);
    animations.push(animation);
    if (id === selectedId) {
      selectedBuffer = buffer;
      selectedAnimation = animation;
    }
  }

  for (const [name, buffer] of entries) {
    if (!name.endsWith(".json") || name === "manifest.json" || /^a\/[^/]+\.json$/.test(name)) continue;
    const json = parseJson(buffer, name);
    scanForUnsafeContent(json, [], name);
  }

  return {
    animation: selectedAnimation,
    animationBuffer: selectedBuffer,
    animationId: selectedId,
    embeddedResources: detectEmbeddedResources(entries, animations, manifest),
  };
}

function zipDateTime(date) {
  const year = Math.max(1980, date.getUTCFullYear());
  return {
    date: ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate(),
    time: (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | (date.getUTCSeconds() >> 1),
  };
}

function createZip(files) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  const timestamp = zipDateTime(new Date());

  for (const [name, data] of files) {
    safeArchiveName(name);
    const nameBuffer = Buffer.from(name, "utf8");
    const compressed = deflateRawSync(data, { level: 9 });
    const checksum = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(timestamp.time, 10);
    localHeader.writeUInt16LE(timestamp.date, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, nameBuffer, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(timestamp.time, 12);
    centralHeader.writeUInt16LE(timestamp.date, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralParts.push(centralHeader, nameBuffer);
    localOffset += localHeader.length + nameBuffer.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function packageBareLottie(animationBuffer, id) {
  const manifest = Buffer.from(
    `${JSON.stringify(
      {
        version: "2",
        generator: "Noah Rijkaard portfolio motion intake",
        initial: { animation: id },
        animations: [{ id }],
      },
      null,
      2,
    )}\n`,
  );
  return createZip([
    ["manifest.json", manifest],
    [`a/${id}.json`, animationBuffer],
  ]);
}

function rejectUnsafeEntryKinds(entries) {
  for (const name of entries.keys()) {
    if (AUDIO_ENTRY_PATH.test(name) || AUDIO_EXTENSION.test(name)) {
      fail(`dotLottie package contains audio entry ${name}.`);
    }
    if (EXECUTABLE_EXTENSION.test(name)) {
      fail(`dotLottie package contains executable entry ${name}.`);
    }
  }
}

/**
 * Accept a dotLottie v1 or v2 archive (LottieFiles downloads are typically v1,
 * sometimes with unsafe animation ids or in-archive raster images) and rebuild
 * it as a canonical single-animation v2 package under our reviewed id. Raster
 * images are inlined as data URIs so the published asset is one self-contained
 * animation JSON; every safety scan still runs on the rebuilt package.
 */
function normalizeDotLottie(archive, targetId) {
  const entries = readZipEntries(archive);
  rejectUnsafeEntryKinds(entries);

  const manifestBuffer = entries.get("manifest.json");
  if (!manifestBuffer) fail("dotLottie package is missing manifest.json.");
  const manifest = parseJson(manifestBuffer, "manifest.json");
  if (!isPlainObject(manifest) || !Array.isArray(manifest.animations) || manifest.animations.length === 0) {
    fail("manifest.json must list at least one animation.");
  }

  const isV2 = manifest.version === "2";
  const animationDir = isV2 ? "a" : "animations";
  const ids = manifest.animations.map((record, index) => {
    const id = isPlainObject(record) ? record.id : undefined;
    if (typeof id !== "string" || id.trim() === "") {
      fail(`manifest.json animations[${index}].id must be a non-empty string.`);
    }
    return id;
  });
  const declaredInitial = isV2
    ? (isPlainObject(manifest.initial) ? manifest.initial.animation : undefined)
    : (typeof manifest.activeAnimationId === "string" ? manifest.activeAnimationId : undefined);
  if (declaredInitial !== undefined && !ids.includes(declaredInitial)) {
    fail("manifest.json declares an initial animation that is not listed.");
  }
  if (ids.length > 1 && declaredInitial === undefined) {
    fail("A multi-animation package must declare its initial animation; split the package instead.");
  }
  const selectedId = declaredInitial ?? ids[0];
  const animationEntryName = `${animationDir}/${selectedId}.json`;
  const animationBuffer = entries.get(animationEntryName);
  if (!animationBuffer) fail(`dotLottie package is missing ${animationEntryName}.`);
  const animation = parseJson(animationBuffer, animationEntryName);
  if (!isPlainObject(animation)) fail(`${animationEntryName} must contain a Lottie JSON object.`);

  const imageEntries = new Map();
  for (const [name, data] of entries) {
    if (!IMAGE_ENTRY_PATH.test(name)) continue;
    if (!IMAGE_EXTENSION.test(name)) {
      fail(`dotLottie package contains a non-raster image entry ${name}; only gif/jpeg/png/webp are accepted.`);
    }
    imageEntries.set(name, data);
  }

  const usedImages = new Set();
  let inlined = false;
  if (Array.isArray(animation.assets)) {
    for (const [index, asset] of animation.assets.entries()) {
      if (!isPlainObject(asset) || typeof asset.p !== "string") continue;
      // LottieFiles marks archive-referenced images with e:1; only a data URI is truly embedded.
      if (asset.p.startsWith("data:")) continue;
      const folder = typeof asset.u === "string" ? asset.u.replace(/^\/+/, "") : "";
      const candidates = [
        `${folder}${asset.p}`.replace(/^\/+/, ""),
        `images/${asset.p}`,
        `i/${asset.p}`,
      ];
      const found = candidates.find((candidate) => imageEntries.has(candidate));
      if (!found) {
        fail(`assets[${index}] references ${asset.p}, which is not present in the package.`);
      }
      const extension = found.split(".").pop().toLowerCase();
      const mime = IMAGE_MIME_BY_EXTENSION[extension];
      asset.p = `data:${mime};base64,${imageEntries.get(found).toString("base64")}`;
      asset.u = "";
      asset.e = 1;
      usedImages.add(found);
      inlined = true;
    }
  }
  for (const name of imageEntries.keys()) {
    if (!usedImages.has(name)) {
      fail(`dotLottie package contains an unreferenced image entry ${name}.`);
    }
  }

  for (const name of entries.keys()) {
    if (name === "manifest.json" || name === animationEntryName || usedImages.has(name)) continue;
    if (new RegExp(`^${animationDir}/[^/]+\\.json$`).test(name) && ids.length > 1) {
      // Non-selected animations are intentionally dropped from the canonical package.
      continue;
    }
    fail(`dotLottie package contains an unsupported entry ${name}; themes, state machines, and extras are not accepted.`);
  }

  const normalizedAnimation = inlined || selectedId !== targetId || !isV2
    ? Buffer.from(`${JSON.stringify(animation)}\n`)
    : animationBuffer;
  return packageBareLottie(normalizedAnimation, targetId);
}

function quote(value) {
  return JSON.stringify(value);
}

function catalogStub(metadata) {
  const tags = [...new Set([...metadata.id.split("-"), "motion"])];
  const minWidth = Math.min(240, metadata.animation.w);
  const maxWidth = Math.max(minWidth, metadata.animation.w);
  const aspectRatio = metadata.animation.w / metadata.animation.h;
  return `{
  id: ${quote(metadata.id)},
  status: "active",
  generatorEligible: false,
  description: ${quote(metadata.title)},
  semanticTags: ${JSON.stringify(tags)},
  eligibleScenePatterns: ["hero-statement"], // TODO: human-review eligible Scene Patterns.
  renderer: {
    kind: "dotlottie",
    src: ${quote(`/motion/${metadata.id}.lottie`)},
    animationId: ${quote(metadata.animationId)},
    localSource: ${quote(`@/lib/motion-assets/dotlottie/${metadata.id}/a/${metadata.animationId}.json`)},
    embeddedResources: ${JSON.stringify({
      images: metadata.embeddedResources.images,
      fonts: metadata.embeddedResources.fonts,
      audio: false,
    })},
  },
  intrinsic: {
    width: ${metadata.animation.w},
    height: ${metadata.animation.h},
    viewBox: ${quote(`0 0 ${metadata.animation.w} ${metadata.animation.h}`)},
  },
  bounds: {
    minWidth: ${minWidth}, // TODO: human-review responsive minimum bound.
    maxWidth: ${maxWidth}, // TODO: human-review responsive maximum bound.
    aspectRatio: ${aspectRatio}, // TODO: human-review intrinsic aspect ratio.
  },
  playback: { trigger: "viewport", replay: "once", offscreen: "pause" },
  reducedMotion: {
    strategy: "curated-static",
    staticRenderer: "signal-lantern", // TODO: create and review an asset-specific static renderer.
  },
  accessibility: {
    kind: "meaningful", // TODO: human-review decorative vs meaningful policy.
    defaultLabel: "TODO: provide a concise accessible label",
    staticEquivalent: "TODO: describe the complete static semantic equivalent",
  },
  provenance: {
    sourceKind: "project-authored",
    creator: ${quote(metadata.creator)},
    source: ${quote(metadata.sourceUrl)},
    revision: ${quote(`sha256:${metadata.sha256}`)},
    notices: [${quote(metadata.notes)}],
    reviewedOn: ${quote(metadata.reviewedOn)},
  },
  licenses: {
    runtime: {
      name: "dotLottie React",
      identifier: "MIT",
      notice: "@lottiefiles/dotlottie-react is distributed under the MIT License.",
    },
    choreography: {
      name: ${quote(metadata.title)},
      identifier: ${quote(metadata.license)},
      notice: ${quote(metadata.notes)},
    },
  },
}`;
}

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const extension = path.extname(options.input).toLowerCase();
  if (extension !== ".lottie" && extension !== ".json") {
    fail("Input must end in .lottie or .json.");
  }

  const inputPath = path.resolve(options.input);
  let inputBuffer;
  try {
    inputBuffer = await readFile(inputPath);
  } catch (error) {
    fail(`Could not read ${options.input}: ${error.message}`);
  }

  let packageBuffer;
  let inspection;
  if (extension === ".lottie") {
    packageBuffer = normalizeDotLottie(inputBuffer, options.id);
    inspection = inspectDotLottie(packageBuffer);
  } else {
    const normalizedAnimationBuffer = Buffer.from(
      `${JSON.stringify(validateLottie(parseJson(inputBuffer, options.input), options.input))}\n`,
    );
    packageBuffer = packageBareLottie(normalizedAnimationBuffer, options.id);
    inspection = inspectDotLottie(packageBuffer);
  }

  const sha256 = createHash("sha256").update(inspection.animationBuffer).digest("hex");
  const reviewedOn = new Date().toISOString().slice(0, 10);
  const metadata = {
    id: options.id,
    title: options.title,
    creator: options.creator,
    sourceUrl: options["source-url"],
    license: options.license,
    notes: options.notes,
    reviewedOn,
    sha256,
    ...inspection,
  };
  const provenance = {
    assetId: options.id,
    format: "dotLottie v2",
    creator: options.creator,
    sourceKind: "project-authored",
    source: options["source-url"],
    revision: `sha256:${sha256}`,
    reviewedOn,
    embeddedResources: inspection.embeddedResources,
    runtimeLicense: {
      name: "dotLottie React",
      identifier: "MIT",
      notice: "@lottiefiles/dotlottie-react is distributed under the MIT License.",
    },
    choreographyLicense: {
      name: options.title,
      identifier: options.license,
      notice: options.notes,
    },
  };

  console.log(`Validated ${options.input} as dotLottie v2 animation ${inspection.animationId}.`);
  console.log(`Animation SHA-256: ${sha256}`);

  if (options.checkOnly) {
    console.log("Check only: no files written.");
  } else {
    const outDir = path.resolve(options.outDir);
    const packagePath = path.join(outDir, `${options.id}.lottie`);
    const provenancePath = path.join(outDir, `${options.id}.provenance.json`);
    await mkdir(outDir, { recursive: true });
    if (await pathExists(packagePath)) fail(`Refusing to overwrite existing ${packagePath}.`);
    if (await pathExists(provenancePath)) fail(`Refusing to overwrite existing ${provenancePath}.`);
    let packageWritten = false;
    try {
      await writeFile(packagePath, packageBuffer, { flag: "wx" });
      packageWritten = true;
      await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`, { flag: "wx" });
    } catch (error) {
      if (packageWritten) await rm(packagePath, { force: true });
      fail(`Could not write intake output: ${error.message}`);
    }
    console.log(`Wrote ${packagePath}`);
    console.log(`Wrote ${provenancePath}`);
  }

  console.log("\nCatalog entry stub — HUMAN REVIEW REQUIRED before cataloging.");
  console.log("Resolve every TODO, verify rights, accessibility, reduced motion, responsive bounds, and Scene eligibility.");
  console.log(catalogStub(metadata));
}

main().catch((error) => {
  console.error(`motion-intake: ${error.message}`);
  console.error(USAGE);
  process.exitCode = 1;
});
