# Replacing Sunnyvale with your own SuperSplat scene

This workflow keeps the **existing, working viewer** and replaces only the scene-specific assets.

## Step 1: Prepare the splat

- In SuperSplat, clean up the splat, remove outliers and orient the scene upright.
- Export a **bundled .sog** (preferred) or Gaussian .ply, not just an .ssproj.
- In Blender, open the source geometry/reference mesh if available. You do **not** need to convert the splat to glTF or import the .sog into Blender.

## Step 2: Build collision in Blender

- Download/clone this repository.
- Blender → Preferences → Add-ons → Install from Disk: `blender-addon/lab5_splat_walkthrough_exporter.py`.
- 3D View → N sidebar → Lab5 Walkthrough.
- Use **Add Floor (Both)** for floor surfaces; **Add Wall (Both)** for non-traversable walls.
- Edit the cube meshes into low-polygon colliders. Keep openings/doors clear.
- Use **Add Depth-Only Geometry** where you need more accurate near/far blur boundaries without collision.
- For custom meshes, name the mesh objects `PCW_BOTH_...`, `PCW_COLLIDER_...` or `PCW_DEPTH_...` as appropriate.
- Use **Add Annotation** and edit title/body.
- Use **Set Player Spawn** (the spawn is the capsule centre, not camera eye).

## Step 3: Export

- Set addon **Unzipped Web Project** to your checked-out repository folder.
- Select your SuperSplat .sog source; set a matching orientation.
- Click **Export to Web Project**.

Expected files:

```
assets/
  scene.sog
  collision.glb
  depth-proxy.glb
  annotations.json
  scene-config.json
```

Keep `splat.url`, `collisionMesh.url`, and `depthMesh.url` aligned with these paths. The Blender addon handles Blender Z-up to PlayCanvas Y-up conversion for its mesh exports; **verify the SOG rotation manually**.

## Step 4: Test locally before pushing

In the root of the repository, run:

```powershell
python -m http.server 8080
```

Then open http://localhost:8080 and verify:

- The splat appears and is right-side-up.
- Toggling **Show depth proxy** shows geometry that lines up with the visible scan.
- You can walk on the floor, not through walls.
- Autofocus raycasts against geometry and blur changes when moving your view.
- Annotations remain anchored to the intended parts of the scene.

To isolate a bad asset, temporarily swap `scene-config.json` back to the Sunnyvale sample URLs.

## Step 5: Commit and publish

Use GitHub Desktop or Git:

```bash
git add assets
git commit -m "Replace Sunnyvale with custom scan, collision, depth proxy and annotations"
git push origin main
```

The Pages site redeploys from the main branch after the push. Do not commit private client scans to a public repository. Prefer an external, access-controlled asset host for confidential assets or files too large for GitHub's hard per-file limits.

## Debug information

Use **Settings → Download test diagnostics** and inspect the browser DevTools Console → Network for missing SOG/GLB URLs, CORS, Ammo or Draco loading errors. Open a GitHub issue with the diagnostic JSON (but do not include confidential client geometry).
