"use client";
import * as React from "react";
import { NOAH_ICON } from "./hardcoded-assets";

// Public assets hardcoded in component source → self-contained data URIs, so
// preview cards render them with no network fetch.
const HARDCODED: Record<string, string> = {
  "/Noah Icon FA.svg": NOAH_ICON,
};

// design-sync preview shim for `next/image`.
// The real next/image needs the Next runtime (loader, optimizer). In the
// standalone design-sync bundle we render a plain <img>. Root-relative srcs
// ("/foo.svg" → public/) are rewritten to the repo's committed public assets
// served over the jsdelivr GitHub CDN so preview cards resolve them the same
// way the corpus's remote devicon icons already load. Remote (http/https) and
// data: srcs pass through untouched.
const PUBLIC_BASE =
  "https://cdn.jsdelivr.net/gh/OriginalByteMe/OriginalByteMe@main/noah-portfolio/public";

function resolveSrc(src: unknown): string {
  if (typeof src === "string") {
    if (/^(https?:|data:)/.test(src)) return src;
    if (HARDCODED[src]) return HARDCODED[src];
    if (src.startsWith("/")) return PUBLIC_BASE + encodeURI(src);
    return src;
  }
  // next/image StaticImport ({ src }) — never used by these components, but
  // keep it safe.
  if (src && typeof src === "object" && "src" in (src as Record<string, unknown>)) {
    return String((src as { src: unknown }).src);
  }
  return "";
}

type ImgProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  src?: unknown;
  // next/image-only props we must strip so they don't hit the DOM.
  fill?: boolean;
  priority?: boolean;
  unoptimized?: boolean;
  quality?: number;
  placeholder?: string;
  blurDataURL?: string;
  loader?: unknown;
  sizes?: string;
  onLoadingComplete?: unknown;
};

export default function Image(props: ImgProps) {
  const {
    src,
    alt = "",
    // strip next-only props
    fill,
    priority,
    unoptimized,
    quality,
    placeholder,
    blurDataURL,
    loader,
    onLoadingComplete,
    ...rest
  } = props;
  void (fill ?? priority ?? unoptimized ?? quality ?? placeholder ?? blurDataURL ?? loader ?? onLoadingComplete);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={resolveSrc(src)} alt={alt} {...rest} />;
}
