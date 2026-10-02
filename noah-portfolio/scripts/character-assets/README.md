# Rebuild runtime asset

The editable V5 original is intentionally not duplicated in this repo. Supply the original `Good_Vibes_Character.glb` from the approved V5 portable archive.

```sh
cd scripts/character-assets
npm ci
node optimize.mjs /absolute/path/to/Good_Vibes_Character.glb ../../public/models/good-vibes-hero.glb
```

The isolated tools dependencies are not shipped in the site bundle. The script emits metrics plus a decoded QA copy for Blender; these are build artifacts. Validate the compressed and decoded output, preserve all 10 clips / 84 morphs / 54 joint nodes, and compare actual idle and wave renders before replacing the shipped copy. Keep the metadata checksum current. The immutable original remains unchanged.

## Check the live facial pose pipeline

From `noah-portfolio`, run:

```sh
node --import tsx scripts/character-assets/validate-face.ts /tmp/good-vibes-face-qa
```

This loads the exact shipped compressed GLB with Three.js, runs its animation mixer and the runtime face layer, and records actual indexed vertex geometry plus complete influence vectors. It includes the previous speech attenuation for comparison, strong speech, open/closed phonemes, full blink, and baseline restoration. Texture decoding is intentionally replaced for this geometry-only check.

For optional offline image evidence, use Blender with the matching decoded QA GLB produced by `optimize.mjs`:

```sh
blender -b -t 4 -P scripts/character-assets/render-face.py -- /absolute/path/to/matching-decoded.glb /tmp/good-vibes-face-qa/face-validation.json
```

These renders inspect the same morph poses but use Blender lighting/materials. They do not validate the website's Three.js renderer, layout, or browser performance. Run the Playwright suite and inspect the site separately before production use.
