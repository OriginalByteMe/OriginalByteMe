# Rebuild runtime asset

The editable V5 original is intentionally not duplicated in this repo. Supply the original `Good_Vibes_Character.glb` from the approved V5 portable archive.

```sh
cd scripts/character-assets
npm ci
node optimize.mjs /absolute/path/to/Good_Vibes_Character.glb ../../public/models/good-vibes-hero.glb
```

The isolated tools dependencies are not shipped in the site bundle. The script emits metrics plus a decoded QA copy for Blender; these are build artifacts. Validate the compressed and decoded output, preserve all 10 clips / 84 morphs / 54 joint nodes, and compare actual idle and wave renders before replacing the shipped copy. Keep the metadata checksum current. The immutable original remains unchanged.
