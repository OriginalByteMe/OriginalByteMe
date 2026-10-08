import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
const [source, output] = process.argv.slice(2);
if (!source || !output) throw new Error('Usage: node solid-hair.mjs SOURCE.glb OUTPUT.glb');
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(source);
// The afro and beard sample atlas islands packed edge to edge with shirt and skin islands, so mipmaps bled orange along every hair seam.
const hair = doc.getRoot().listMaterials().find((material) => material.getName().startsWith('CLOTHING_SKIN'));
if (!hair) throw new Error('Hair material not found.');
const texture = hair.getBaseColorTexture();
// #221109 is the median sRGB of the hair texels; glTF factors are linear.
hair.setName('Hair • solid dark brown').setBaseColorTexture(null)
  .setBaseColorFactor([...[0x22, 0x11, 0x09].map((value) => (value /= 255) <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4), 1]);
// The root is the texture's last holder once the hair lets go; the shirt keeps its own copy.
if (texture?.listParents().length === 1) texture.dispose();
for (const mesh of doc.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) if (primitive.getMaterial() === hair) primitive.getAttribute('TEXCOORD_0')?.dispose();
await io.write(output, doc);
