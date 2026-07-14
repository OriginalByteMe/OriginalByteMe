# Plan Stories before progressively composing Scenes

Generated answers use a validated Story Plan before any Scene is composed, then reveal Scene 1 first and append the remaining Scenes in Plan order. We chose this over one atomic full-Story generation or unplanned Scene streaming because the Plan can lock evidence, narrative order, eligible Scene Patterns, Motion Assets, and Backdrop continuity while progressive delivery still targets a useful first answer within six seconds; a later Scene may be repaired or rendered as a deterministic Fallback Scene without discarding earlier valid content.

## Consequences

Generation has separate planning and composition validation boundaries, cancellation must propagate through pending Scene work, and clients need a real-phase Story Prelude plus an inline composing sentinel. Only complete Stories become shareable records, `static` answers are not an emergency path, and deterministic richness checks—not prompt wording or an aesthetic judge—decide whether the Story is publishable.
