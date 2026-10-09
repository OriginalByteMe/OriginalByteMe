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

**Art Piece**:
A hand-made SVG illustration, some animated, with a stable id and a one-line description the generator picks from.
_Avoid_: Generated SVG, stock image, Motion Asset (retired)

**Media Asset**:
A personal photo or video associated with the Corpus facts, projects, places, or periods it depicts.
_Avoid_: Stock image, decorative portrait

**Story**:
A generated answer presented as a one-page Site that takes over the screen, rather than a flat card dump.
_Avoid_: Answer view, result page

**Site**:
The generated website inside a Story: a Layout, a Palette, a nav, a hero, Sections, Related Questions and a footer.
_Avoid_: Spec (that's the home json-render tree), page

**Layout**:
One of the whole-page arrangements a Site can take, such as bento, editorial, landing, dossier or cascade.
_Avoid_: Template, theme

**Section**:
One block of a Site with its own heading, cited Evidence and visual kind (cards, split, list, timeline, quote or banner).
_Avoid_: Scene (retired), card

**Boundary Story**:
A Story that honestly communicates that the Corpus cannot ground the requested answer.
_Avoid_: Refusal card, best-effort answer

**Related Question**:
A grounded follow-up prompt that continues a visitor's exploration of the Corpus.
_Avoid_: Generic call to action, suggested prompt

**Backdrop**:
The ambient visual field behind content, shaped by a Preset.
_Avoid_: Background, lava lamp (retired)

**Tableau**:
The illustrative home composition layered over the Backdrop, using motifs such as the ark, waves, and logo.
_Avoid_: Site (that's a generated answer), Background

**Preset**:
A named visual identity for a Backdrop, combining its shader family, palette, and motion character.
_Avoid_: Shader config, mood

**Theme**:
A locale- or calendar-driven styling overlay (e.g. Christmas, Halloween) that modulates the Preset and accents for a visitor.
_Avoid_: Skin, seasonal mode
