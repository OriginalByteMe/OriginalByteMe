# Version Story identities by Corpus and contract

Generated Stories use opaque public IDs backed only by complete validated records; cache lookup uses a non-reversible digest of the normalized question plus the active Corpus revision and Story Contract version. We chose stable IDs over raw-question URLs or session-only history so Stories are reproducible and shareable without exposing question text in URLs or KV key names, but any Corpus revision or incompatible contract revision invalidates every prior ID to prevent stale claims and retired UI from remaining authoritative. An invalidated URL shows an outdated state and can regenerate its stored question into a new current ID; it never silently mutates or replays the old rendition.

## Consequences

Story persistence must retain the display question, version stamps, validated Plan, Scenes, and Evidence Refs while keeping incomplete generations out of the durable store. Contract-version bumps are deliberate compatibility boundaries, and the refresh path is part of the public URL contract rather than an optional error screen.
