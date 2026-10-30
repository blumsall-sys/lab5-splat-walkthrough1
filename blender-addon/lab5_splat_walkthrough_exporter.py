bl_info = {
    "name": "Lab5 - Splat Walkthrough Exporter",
    "author": "Lab5 / Barrett Creek Multimedia",
    "version": (1, 0, 0),
    "blender": (4, 2, 0),
    "location": "3D View > Sidebar > Lab5 Walkthrough",
    "description": "Export depth geometry, static collision and annotation JSON to a GitHub Pages PlayCanvas project",
    "category": "Import-Export",
}

import bpy
import json
import shutil
from pathlib import Path
from mathutils import Vector
from bpy.props import StringProperty, FloatVectorProperty, PointerProperty

PREFIX_BOTH = "PCW_BOTH_"
PREFIX_COLLISION = "PCW_COLLIDER_"
PREFIX_DEPTH = "PCW_DEPTH_"
PREFIX_NOTE = "PCW_NOTE_"
SPAWN_NAME = "PCW_SPAWN"


def as_web_pos(vec):
    """Blender Z-up to glTF/PlayCanvas Y-up for annotation and spawn JSON."""
    return [round(float(vec.x), 5), round(float(vec.z), 5), round(float(-vec.y), 5)]


def add_box(context, prefix, size):
    bpy.ops.mesh.primitive_cube_add(size=1, location=context.scene.cursor.location)
    obj = context.object
    obj.name = prefix + ("Floor" if size[2] < 0.2 else "Wall")
    obj.dimensions = size
    return obj


class PCW_OT_add_floor(bpy.types.Operator):
    bl_idname = "pcw.add_floor"
    bl_label = "Add Floor (Both)"
    bl_description = "Create a box usable for physics collision and depth-of-field depth"

    def execute(self, context):
        add_box(context, PREFIX_BOTH, (6.0, 6.0, 0.2))
        self.report({'INFO'}, "Floor created. Move top surface to actual splat floor.")
        return {'FINISHED'}


class PCW_OT_add_wall(bpy.types.Operator):
    bl_idname = "pcw.add_wall"
    bl_label = "Add Wall (Both)"
    bl_description = "Create a wall usable for physics collision and depth-of-field depth"

    def execute(self, context):
        add_box(context, PREFIX_BOTH, (4.0, 0.15, 2.5))
        self.report({'INFO'}, "Wall created. Edit its geometry to match your scene.")
        return {'FINISHED'}


class PCW_OT_add_depth(bpy.types.Operator):
    bl_idname = "pcw.add_depth"
    bl_label = "Add Depth-Only Geometry"
    bl_description = "Create a depth proxy that does not block walking"

    def execute(self, context):
        add_box(context, PREFIX_DEPTH, (2.0, 2.0, 2.0))
        return {'FINISHED'}


class PCW_OT_add_note(bpy.types.Operator):
    bl_idname = "pcw.add_note"
    bl_label = "Add Annotation"
    bl_description = "Create an empty whose location becomes a web annotation"

    def execute(self, context):
        bpy.ops.object.empty_add(type='SPHERE', location=context.scene.cursor.location)
        obj = context.object
        obj.name = PREFIX_NOTE + "New"
        obj.empty_display_size = 0.25
        obj.pcw_title = "New annotation"
        obj.pcw_text = "Edit this text under the Lab5 panel."
        return {'FINISHED'}


class PCW_OT_add_spawn(bpy.types.Operator):
    bl_idname = "pcw.add_spawn"
    bl_label = "Set Player Spawn"
    bl_description = "Place the player's capsule centre at the 3D cursor"

    def execute(self, context):
        obj = bpy.data.objects.get(SPAWN_NAME)
        if obj:
            obj.location = context.scene.cursor.location
            context.view_layer.objects.active = obj
            obj.select_set(True)
        else:
            bpy.ops.object.empty_add(type='PLAIN_AXES', location=context.scene.cursor.location)
            obj = context.object
            obj.name = SPAWN_NAME
            obj.empty_display_size = 0.75
        return {'FINISHED'}


def export_gltf_selected(context, objs, filepath):
    if not objs:
        return False
    previous_selection = list(context.selected_objects)
    previous_active = context.view_layer.objects.active
    try:
        if context.object and context.object.mode != 'OBJECT':
            bpy.ops.object.mode_set(mode='OBJECT')
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objs:
            obj.hide_set(False)
            obj.select_set(True)
        context.view_layer.objects.active = objs[0]
        # glTF exporter converts Blender Z-up into Web +Y-up by default.
        bpy.ops.export_scene.gltf(
            filepath=str(filepath), export_format='GLB', use_selection=True,
            export_yup=True, export_extras=False,
        )
    finally:
        bpy.ops.object.select_all(action='DESELECT')
        for obj in previous_selection:
            if obj.name in bpy.data.objects:
                obj.select_set(True)
        if previous_active and previous_active.name in bpy.data.objects:
            context.view_layer.objects.active = previous_active
    return True


class PCW_OT_export(bpy.types.Operator):
    bl_idname = "pcw.export_walkthrough"
    bl_label = "Export to Web Project"
    bl_description = "Write .glb, .json and optional .sog directly into the unpacked GitHub Pages folder"

    def execute(self, context):
        props = context.scene.pcw_settings
        root = Path(bpy.path.abspath(props.output_dir)).resolve()
        if not (root / 'index.html').is_file() or not (root / 'main.js').is_file():
            self.report({'ERROR'}, "Select the UNZIPPED Lab5 package folder containing index.html and main.js")
            return {'CANCELLED'}
        asset_dir = root / 'assets'
        asset_dir.mkdir(parents=True, exist_ok=True)
        config_path = asset_dir / 'scene-config.json'
        try:
            config = json.loads(config_path.read_text(encoding='utf-8')) if config_path.exists() else {}
        except Exception as ex:
            self.report({'ERROR'}, f"Could not parse scene-config.json: {ex}")
            return {'CANCELLED'}

        meshes = [o for o in context.scene.objects if o.type == 'MESH']
        collision = [o for o in meshes if o.name.startswith((PREFIX_BOTH, PREFIX_COLLISION))]
        depth = [o for o in meshes if o.name.startswith((PREFIX_BOTH, PREFIX_DEPTH))]

        try:
            has_collision = export_gltf_selected(context, collision, asset_dir / 'collision.glb')
            has_depth = export_gltf_selected(context, depth, asset_dir / 'depth-proxy.glb')
        except Exception as ex:
            self.report({'ERROR'}, f"Blender glTF export error: {ex}")
            return {'CANCELLED'}

        config['projectName'] = props.project_title
        config['collisionMesh'] = {
            'url': './assets/collision.glb' if has_collision else None,
            'position': [0, 0, 0], 'rotation': [0, 0, 0], 'scale': [1, 1, 1]
        }
        config['depthMesh'] = {
            'url': './assets/depth-proxy.glb' if has_depth else None,
            'position': [0, 0, 0], 'rotation': [0, 0, 0], 'scale': [1, 1, 1]
        }
        if not has_collision:
            self.report({'WARNING'}, "No PCW_BOTH_/PCW_COLLIDER_ meshes: walkthrough won't have solid ground")
        if not has_depth:
            self.report({'WARNING'}, "No PCW_BOTH_/PCW_DEPTH_ meshes: DOF will be disabled")

        # Export an SOG or PLY unchanged; splats are NOT glTF geometry and must not be converted.
        raw_source = bpy.path.abspath(props.splat_file).strip()
        if raw_source:
            source = Path(raw_source)
            if not source.is_file():
                self.report({'ERROR'}, "Splat source does not exist")
                return {'CANCELLED'}
            if source.suffix.lower() not in ('.sog', '.ply'):
                self.report({'ERROR'}, "Export a bundled .sog or Gaussian .ply from SuperSplat")
                return {'CANCELLED'}
            dest = asset_dir / ('scene' + source.suffix.lower())
            if source.resolve() != dest.resolve():
                shutil.copyfile(source, dest)
            config['splat'] = {
                'url': './assets/' + dest.name,
                'position': [0, 0, 0],
                'rotation': [round(float(a), 4) for a in props.splat_rotation],
                'scale': [1, 1, 1]
            }
            if dest.stat().st_size > 100 * 1024 * 1024:
                self.report({'WARNING'}, "Splat >100 MiB: GitHub rejects single files above 100 MB. Use an external asset host.")

        spawn = bpy.data.objects.get(SPAWN_NAME)
        if spawn:
            config['spawn'] = {
                'position': as_web_pos(spawn.matrix_world.translation),
                'eyeHeight': 0.9, 'pitch': 0, 'yaw': 0
            }

        notes = []
        for obj in context.scene.objects:
            if not obj.name.startswith(PREFIX_NOTE):
                continue
            notes.append({
                'id': f'blender-{len(notes) + 1}',
                'position': as_web_pos(obj.matrix_world.translation),
                'title': obj.pcw_title or obj.name[len(PREFIX_NOTE):],
                'text': obj.pcw_text
            })
        (asset_dir / 'annotations.json').write_text(json.dumps(notes, indent=2) + '\n', encoding='utf-8')
        config['annotationsUrl'] = './assets/annotations.json'
        config_path.write_text(json.dumps(config, indent=2) + '\n', encoding='utf-8')
        self.report({'INFO'}, f"Lab5 exported: {len(collision)} collider(s), {len(depth)} depth object(s), {len(notes)} note(s)")
        return {'FINISHED'}


class PCW_Settings(bpy.types.PropertyGroup):
    output_dir: StringProperty(name="Unzipped Web Project", subtype='DIR_PATH', description="Folder with index.html / main.js")
    project_title: StringProperty(name="Project name", default="Lab5 · My Splat Walkthrough")
    splat_file: StringProperty(name="SuperSplat .sog / .ply", subtype='FILE_PATH')
    splat_rotation: FloatVectorProperty(
        name="Splat rotation XYZ (degrees)", size=3,
        description="Splat's rotation only; match this visually to Blender's exported GLB (often Z=180 for PLY)",
        default=(0, 0, 180)
    )


class PCW_PT_panel(bpy.types.Panel):
    bl_label = "Lab5 Splat Walkthrough"
    bl_idname = "PCW_PT_panel"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = 'Lab5 Walkthrough'

    def draw(self, context):
        layout = self.layout
        props = context.scene.pcw_settings
        layout.label(text="1. Author proxy + collision")
        layout.operator('pcw.add_floor')
        layout.operator('pcw.add_wall')
        layout.operator('pcw.add_depth')
        layout.separator()
        layout.label(text="2. Author annotations + start")
        layout.operator('pcw.add_note')
        layout.operator('pcw.add_spawn')
        active = context.active_object
        if active and active.name.startswith(PREFIX_NOTE):
            layout.prop(active, 'pcw_title')
            layout.prop(active, 'pcw_text')
        layout.separator()
        layout.label(text="3. Export to Github project")
        layout.prop(props, 'output_dir')
        layout.prop(props, 'project_title')
        layout.prop(props, 'splat_file')
        layout.prop(props, 'splat_rotation')
        layout.operator('pcw.export_walkthrough', icon='EXPORT')
        layout.separator()
        layout.label(text="Names:")
        layout.label(text="PCW_BOTH_ = depth + collision")
        layout.label(text="PCW_DEPTH_ = depth only")
        layout.label(text="PCW_COLLIDER_ = physics only")
        layout.label(text="PCW_NOTE_ = clickable hotspot")


CLASSES = (PCW_OT_add_floor, PCW_OT_add_wall, PCW_OT_add_depth,
           PCW_OT_add_note, PCW_OT_add_spawn, PCW_OT_export, PCW_Settings, PCW_PT_panel)


def register():
    for cls in CLASSES:
        bpy.utils.register_class(cls)
    bpy.types.Scene.pcw_settings = PointerProperty(type=PCW_Settings)
    bpy.types.Object.pcw_title = StringProperty(name="Annotation title", default="New annotation")
    bpy.types.Object.pcw_text = StringProperty(name="Annotation body", default="Describe this feature")


def unregister():
    del bpy.types.Object.pcw_text
    del bpy.types.Object.pcw_title
    del bpy.types.Scene.pcw_settings
    for cls in reversed(CLASSES):
        bpy.utils.unregister_class(cls)


if __name__ == '__main__':
    register()