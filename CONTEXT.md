# Ask-Me Dynamic Portfolio

Noah's portfolio site where an LLM composes the UI as JSON specs rendered from a component catalog, answering visitor questions about Noah.

## Language

**Corpus**:
The markdown knowledge base about Noah (`content/about-me/`) that grounds every generated answer.
_Avoid_: Knowledge base, content files

**Spec**:
A JSON tree of catalog components the renderer turns into UI — either the home spec or a generated answer.
_Avoid_: Layout, response JSON

**Catalog**:
The registry of components the LLM is allowed to compose specs from.
_Avoid_: Component library (that's the broader React code)

**Story**:
A generated answer presented as a narrative composition rather than a flat card dump.
_Avoid_: Answer view, result page

**Scene**:
One full-height chapter of a story, choreographed with scroll-triggered motion. Short answers use a rich static composition instead of scenes.
_Avoid_: Section (that's the existing full-width layout primitive), slide

**Backdrop**:
The single full-screen shader canvas behind all content, steerable per answer.
_Avoid_: Background, lava lamp (retired)

**Preset**:
An allowlisted Backdrop configuration (shader + palette + speed) a spec may select; specs never set free-form shader parameters.
_Avoid_: Shader config, mood

**Theme**:
A locale- or calendar-driven styling overlay (e.g. Christmas, Halloween) that modulates Preset and scene accents for a visitor.
_Avoid_: Skin, seasonal mode
