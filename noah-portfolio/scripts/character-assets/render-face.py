"""Offline Blender QA using exact Three.js influence snapshots.

blender -b -t 4 -P scripts/character-assets/render-face.py -- \
  /tmp/decoded-copy-of-shipped.glb /tmp/good-vibes-face-qa/face-validation.json

The decoded asset must be the same shipped GLB, with Meshopt decompressed and
WebP converted to PNG, as in optimize.mjs. Does not prove browser rendering.
"""
import bpy
import json
import os
import sys
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
source, report_path = args
report = json.load(open(report_path))
output = os.path.dirname(report_path)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30
bpy.ops.import_scene.gltf(filepath=source)
for obj in bpy.data.objects:
    for data in [obj, getattr(getattr(obj, 'data', None), 'shape_keys', None)]:
        if not data or not data.animation_data:
            continue
        data.animation_data.action = None
        for track in data.animation_data.nla_tracks:
            track.mute = '01_Idle_Breathe' not in track.name
frame = 1 + report['idleTime'] * scene.render.fps
scene.frame_set(int(frame), subframe=frame % 1)
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.cycles.use_denoising = False
scene.render.resolution_x = scene.render.resolution_y = 480
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new('World')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.85, .85, .85, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .8
bpy.ops.object.camera_add(location=(0, -12, 2.99))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 0, 2.99)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 1.6
scene.camera = camera
for location, power, size in [((-3, -5, 7), 700, 5), ((5, -1, 6), 350, 4)]:
    bpy.ops.object.light_add(type='AREA', location=location)
    light = bpy.context.object
    light.data.energy = power
    light.data.size = size
    light.rotation_euler = (Vector((0, 0, 2.9)) - light.location).to_track_quat('-Z', 'Y').to_euler()
scene.view_settings.view_transform = 'AgX'
scene.render.image_settings.file_format = 'PNG'
for snapshot in report['snapshots']:
    for name, values in snapshot['weights'].items():
        if not name.startswith('FACE2_'):
            continue
        obj = bpy.data.objects.get(name)
        # Blender splits the transform node from skinned face meshes. Three.js
        # binds FACE2_* while Blender names the actual mesh Flat <face part>.
        if obj and obj.type != 'MESH':
            obj = bpy.data.objects.get(name.replace('FACE2_', 'Flat '))
        if not obj or obj.type != 'MESH' or not obj.data.shape_keys:
            raise RuntimeError('Cannot resolve face mesh: ' + name)
        keys = obj.data.shape_keys
        keys.animation_data_clear()
        targets = list(keys.key_blocks)[1:]
        if len(targets) != len(values):
            raise RuntimeError('Incomplete morph vector: ' + name)
        for key, value in zip(targets, values):
            key.value = value
    bpy.context.view_layer.update()
    scene.render.filepath = os.path.join(output, snapshot['name'] + '.png')
    bpy.ops.render.render(write_still=True)
