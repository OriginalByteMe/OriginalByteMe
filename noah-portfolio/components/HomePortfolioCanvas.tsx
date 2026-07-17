"use client";

import type { Spec } from "@json-render/core";
import { Renderer } from "@json-render/react";

import { registry } from "@/lib/jsonui/registry";

interface HomePortfolioCanvasProps {
  spec: Spec;
}

/** The only client chunk that owns json-render and the home component registry. */
export default function HomePortfolioCanvas({ spec }: HomePortfolioCanvasProps) {
  return <Renderer spec={spec} registry={registry} />;
}
