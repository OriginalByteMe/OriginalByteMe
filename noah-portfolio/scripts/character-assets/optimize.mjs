import fs from 'node:fs/promises';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, resample, meshopt, textureCompress, getBounds, weldPrimitive, simplifyPrimitive } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import validator from 'gltf-validator';
if (!process.argv[2] || !process.argv[3]) throw new Error('Usage: node optimize.mjs SOURCE.glb OUTPUT.glb');
const source = path.resolve(process.argv[2]);
const output = path.resolve(process.argv[3]);
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder, 'meshopt.decoder':MeshoptDecoder});
const sourceBytes = await fs.readFile(source);
const doc = await io.read(source);
function metrics(doc, bytes) {
 const r = doc.getRoot();
 return {bytes, rawUnskinnedBounds: getBounds(r.listScenes()[0]), meshes:r.listMeshes().length, primitives:r.listMeshes().reduce((s,m)=>s+m.listPrimitives().length,0), vertices:r.listMeshes().reduce((s,m)=>s+m.listPrimitives().reduce((s,p)=>s+p.getAttribute('POSITION').getCount(),0),0), triangles:r.listMeshes().reduce((s,m)=>s+m.listPrimitives().reduce((s,p)=>s+(p.getIndices()?.getCount()||0)/3,0),0), skins:r.listSkins().length, skinJointCounts:r.listSkins().map(s=>s.listJoints().length),jointNames:[...new Set(r.listSkins().flatMap(s=>s.listJoints().map(j=>j.getName())))].sort(), morphTargetCount:r.listMeshes().reduce((s,m)=>s+m.listPrimitives()[0].listTargets().length,0), morphTargets:r.listMeshes().filter(m=>m.listPrimitives()[0].listTargets().length).map(m=>({mesh:m.getName(),count:m.listPrimitives()[0].listTargets().length,names:m.getExtras().targetNames})), animations:r.listAnimations().map(a=>({name:a.getName(),channels:a.listChannels().length,duration:Math.max(...a.listSamplers().map(s=>s.getInput().getMax([])[0])),samplerSamples:a.listSamplers().reduce((n,s)=>n+s.getInput().getCount(),0)})),textures:r.listTextures().map(t=>({name:t.getName(),mimeType:t.getMimeType(),size:t.getSize(),bytes:t.getImage().byteLength})),extensionsUsed:r.listExtensionsUsed().map(e=>e.extensionName),extensionsRequired:r.listExtensionsRequired().map(e=>e.extensionName)};
}
const before=metrics(doc,sourceBytes.length);
const simplified=[];
for (const mesh of doc.getRoot().listMeshes()) {
 if (mesh.listPrimitives().some(p=>p.listTargets().length)) continue;
 const n0=mesh.listPrimitives().reduce((n,p)=>n+p.getIndices().getCount()/3,0);
 for(const p of mesh.listPrimitives()) {weldPrimitive(p); simplifyPrimitive(p,{simplifier:MeshoptSimplifier,ratio:0.15,error:0.002,lockBorder:true});}
 const n1=mesh.listPrimitives().reduce((n,p)=>n+p.getIndices().getCount()/3,0);
 simplified.push({mesh:mesh.getName(),beforeTriangles:n0,afterTriangles:n1});
}
console.log('Simplified',simplified);
await doc.transform(
  resample({tolerance:0}),
  dedup(),
  textureCompress({encoder:sharp,targetFormat:'webp',resize:[1024,1024],quality:90,effort:90}),
  meshopt({encoder:MeshoptEncoder,level:'medium',quantizePosition:14,quantizeNormal:10,quantizeTexcoord:12,quantizeColor:10,quantizeWeight:12})
);
await fs.mkdir(path.dirname(output),{recursive:true});
await io.write(output,doc);
const optimizedBytes = await fs.readFile(output);
const decoded = await io.read(output);
const after=metrics(decoded,optimizedBytes.length);
const validate=await validator.validateBytes(new Uint8Array(optimizedBytes),{uri:path.basename(output),maxIssues:100});
const report={source,output,before,after,simplified,reductionPercent:100*(1-after.bytes/before.bytes),preservation:{allAnimations:JSON.stringify(before.animations.map(a=>[a.name,a.duration]))===JSON.stringify(after.animations.map(a=>[a.name,a.duration])),allMorphTargets:JSON.stringify(before.morphTargets)===JSON.stringify(after.morphTargets),triangleCount:before.triangles===after.triangles,jointNames:JSON.stringify(before.jointNames)===JSON.stringify(after.jointNames)},validation:validate};
await fs.writeFile(output.replace(/\.glb$/,'.metrics.json'),JSON.stringify(report,null,2));
// A decoded QA-only copy is useful for importers such as Blender that lack Meshopt support.
for(const ext of decoded.getRoot().listExtensionsUsed()) if(ext.extensionName==='EXT_meshopt_compression') ext.dispose();
// Blender can consume quantized geometry but uses standard embedded images for deterministic QA.
await decoded.transform(textureCompress({encoder:sharp,targetFormat:'png'}));
await io.write(path.resolve('Good_Vibes_Character.mobile.qa-decoded.glb'),decoded);
const decodedValidation=await validator.validateBytes(new Uint8Array(await fs.readFile(path.resolve('Good_Vibes_Character.mobile.qa-decoded.glb'))),{uri:'Good_Vibes_Character.mobile.qa-decoded.glb',maxIssues:100});
await fs.writeFile(path.join(path.dirname(output),'Good_Vibes_Character.mobile.qa-decoded.validation.json'),JSON.stringify(decodedValidation,null,2));
if(decodedValidation.issues.numErrors)throw new Error('Decoded GLB validation failed.');
console.log(JSON.stringify({output,bytes:after.bytes,reductionPercent:report.reductionPercent,preservation:report.preservation,extensionsRequired:after.extensionsRequired,validation:{errors:validate.issues.numErrors,warnings:validate.issues.numWarnings,infos:validate.issues.numInfos}},null,2));
