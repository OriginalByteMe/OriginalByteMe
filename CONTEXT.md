# Ask-Me Dynamic Portfolio

Noah's portfolio site where an LLM composes the UI as JSON specs rendered from a component catalog, answering visitor questions about Noah.

## Language

**Corpus**:
The markdown knowledge base about Noah (`content/about-me/`) that grounds every generated answer.
_Avoid_: Knowledge base, content files

**Evidence Ref**:
The relationship tying a factual claim in a Story to supporting Corpus material or a Media Asset.
_Avoid_: Repository path, visible citation chip

**Spec**:
A JSON tree of catalog components the renderer turns into UI — either the home spec or a generated answer.
_Avoid_: Layout, response JSON

**Catalog**:
The registry of components the LLM is allowed to compose specs from.
_Avoid_: Component library (that's the broader React code)

**Motion Asset**:
A curated animated icon, SVG illustration, or diagram available for visual storytelling.
_Avoid_: Generated SVG, animation prompt

**Media Asset**:
A personal photo or video associated with the Corpus facts, projects, places, or periods it depicts.
_Avoid_: Stock image, decorative portrait

**Story**:
A generated answer presented as an ordered narrative composition of Scenes rather than a flat card dump.
_Avoid_: Answer view, result page

**Boundary Story**:
A Story that honestly communicates that the Corpus cannot ground the requested answer.
_Avoid_: Refusal card, best-effort answer

**Related Question**:
A grounded follow-up prompt that continues a visitor's exploration of the Corpus.
_Avoid_: Generic call to action, suggested prompt

**Story Plan**:
The intended narrative arc for a Story, identifying its ordered Scenes and supporting evidence.
_Avoid_: Draft Story, chain-of-thought

**Story Prelude**:
The transitional experience between asking a question and entering the first Scene.
_Avoid_: Loading screen, spinner

**Scene**:
One full-height chapter of a Story, choreographed with scroll-triggered motion.
_Avoid_: Section (that's the existing full-width layout primitive), slide

**Story Rail**:
The navigation model that presents a Story's ordered Scenes and the visitor's current position among them.
_Avoid_: Progress bar, table of contents

**Scene Pattern**:
A reusable narrative composition with a distinct information shape and visual hierarchy.
_Avoid_: Template, free-form component tree

**Fallback Scene**:
A Scene that preserves an intended narrative role and evidence when its preferred Scene Pattern cannot be presented.
_Avoid_: Error card, replacement Story

**Backdrop**:
The ambient visual field behind content, shaped by a Preset and Scene Cues.
_Avoid_: Background, lava lamp (retired)

**Tableau**:
The illustrative home composition layered over the Backdrop, using motifs such as the ark, waves, and logo.
_Avoid_: Scene (that's a Story chapter), Background

**Preset**:
A named visual identity for a Backdrop, combining its shader family, palette, and motion character.
_Avoid_: Shader config, mood

**Scene Cue**:
A Scene's intended evolution of the Story's Backdrop within its chosen Preset.
_Avoid_: Preset switch, shader parameters

**Nocturne**:
The core visual language of generated Stories: dithered and halftone texture, deep matte hierarchy, and restrained ink accents, expressed through coordinated light and dark counterparts.
_Avoid_: Theme (that's a contextual overlay), dark mode

**Register**:
One of Nocturne's controlled composition modes: Editorial for narrative and media, Dense for evidence and metrics, or Diagrammatic for processes and relationships.
_Avoid_: Theme, per-pattern style

**Theme**:
A locale- or calendar-driven styling overlay (e.g. Christmas, Halloween) that modulates Preset and scene accents for a visitor.
_Avoid_: Skin, seasonal mode
