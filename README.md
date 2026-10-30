# Lab5 · PlayCanvas Gaussian Splat Walkthrough

**Deployable, static PlayCanvas walkthrough + optional Blender addon.** Combines the core architecture of the official PlayCanvas **Depth of Field**, **First Person**, and **Annotations** engine demos. No PlayCanvas Editor account or npm build is required to publish the site; Chrome/Edge and an internet connection are required for external engine/physics/Draco assets.

This is an original, editable integration, **not** a byte-for-byte copy of the official demonstrations. The default project references PlayCanvas's public *Sunnyvale* example .sog and .glb assets, which are downloaded at runtime. The ZIP does **not** contain somebody else's Gaussian splat data or a bundled physics engine.

## 1. Quickest test: browser only

1. Unzip the package.
2. On Windows, double-click `start-local.bat` (Python required). Or run `python -m http.server 8080` in the project root and visit `http://localhost:8080`.
3. The page loads PlayCanvas's **Sunnyvale** public example from `code.playcanvas.com`. Click the 3D view to lock the mouse. WASD = move, mouse = look, Space = jump, Shift = sprint, Esc = unlock; gamepad and mobile touch input are handled by the official PlayCanvas FirstPersonController script.
4. Under **Settings**, change depth of field, autofocus, blur strength or show the depth proxy for debugging.
5. Under **Annotations**, place a hotspot at the crosshair. It uses the physics mesh raycast. Edit the title/body and **Download annotations.json**.
6. To test a *different* SOG immediately, use **Settings → Preview local splat**. This loads a local file into browser memory in your own session; it is **not uploaded to GitHub or PlayCanvas**. The starter collision/depth meshes stay tied to Sunnyvale, so DOF switches off for the unrelated preview. Complete steps 2–4 below for a properly aligned walkthrough.

`file://` is not supported; serve the project from HTTP or HTTPS.

## 2. Export a local SOG

1. Go to <https://superspl.at/editor> and import your cleaned Gaussian PLY, or load your existing `.ssproj`.
2. Set the scene upright, at human scale (ideally 1 unit = 1 metre) and clean any floaters.
3. Use **File → Export → SOG**. Choose **bundled `.sog`**, not a standalone `.json` referencing `.webp` files (unless you plan and test the full unbundled asset tree). For very large scenes see [Streamed SOG](https://developer.playcanvas.com/user-manual/supersplat/streaming/).
4. If you **do not want Blender**, copy that SOG into `assets/scene.sog` and edit `assets/scene-config.json` → `splat.url` to `./assets/scene.sog`. You can explore without matching collision, but floor/wall physics and accurate DOF need matching geometry. Set `depthMesh.url` and `collisionMesh.url` to `null` if those assets aren't available.

**Do not try to export your SOG as glTF:** the splat stays SOG; only your hidden depth/collision geometry is GLB.

## 3. Blender authoring workflow (recommended)

Compatible with Blender **4.2+** at source level; it has been syntax-checked but **not executed inside Blender** in this environment. Validate in your installed Blender version before client delivery.

1. In Blender: **Edit → Preferences → Add-ons → Install from Disk** (or Install) and select `blender-addon/lab5_splat_walkthrough_exporter.py`; enable it.
2. Open the **3D View sidebar** (press `N`) → **Lab5 Walkthrough**.
3. Import a matching reference model, original collision mesh or other geometry as needed. Blender doesn't have to load the actual SOG to author proxies; align meshes using your known coordinates and, if available, a reference geometry from the capture application.
4. Click **Add Floor (Both)** for a low-poly floor slab, **Add Wall (Both)** for walls. Move/scale/edit these to align with visible splat surfaces. They are static physics colliders **and** contributors to the DOF depth map. For fine visual details not needed for collision, use **Add Depth-Only Geometry**. Rename existing meshes beginning with `PCW_BOTH_`, `PCW_DEPTH_`, or `PCW_COLLIDER_` to use them in the export.
5. **Add Annotation** places an Empty at the 3D cursor. Select it; edit its **Annotation title** and **Annotation body** in the sidebar. Place as many as needed.
6. **Set Player Spawn** creates/moves `PCW_SPAWN` to the current cursor position. The empty represents the **capsule body's centre**, not the eye position. The camera is 0.9 m above the body; place the body centre about 0.9 m above the floor for a 1.8 m tall controller. The included default settings use these values.
7. In the addon, choose **Unzipped Web Project**, the folder containing `index.html`. Set **Project name**, optionally point **SuperSplat .sog / .ply** to the file to copy, and choose **Splat rotation XYZ** (degrees) to match your export. Hit **Export to Web Project**.
8. The addon writes `assets/collision.glb`, `assets/depth-proxy.glb`, `assets/annotations.json`, and `assets/scene-config.json`, and optionally copies `assets/scene.sog` or `assets/scene.ply`. It converts Blender annotation/spawn coordinates from Blender Z-up to PlayCanvas Y-up.
9. Run `start-local.bat`, open Settings → **Show depth proxy**, and confirm the mesh sits against the visible splat. If it doesn't: adjust the **splat rotation** in the addon or `assets/scene-config.json`, and rerun export.

### Important alignment rule

A splat does not encode a guaranteed coordinate transform. The official PlayCanvas examples flip some SOG scenes by 180°. Your Blender GLBs are exported in Y-up coordinates, so the addon writes their rotations as `[0,0,0]` but leaves `splat.rotation` configurable (initial value `[0,0,180]`). This **does not mean** that 180° is correct for every input. First verify alignment in the debug view.

### Depth accuracy

The official DOF example has a detailed reconstructed proxy surface. The included `PCW_BOTH_` floor/wall boxes make a **functional but coarse approximation**: the DOF focus/blur boundaries are only as precise as those boxes. For high-quality interior DOF, import a reconstructed mesh or build enough additional `PCW_DEPTH_` geometry to track objects and surfaces closely. Non-rendered physics meshes and the depth proxy can be separate GLBs; sharing geometry is a convenience, not a requirement.

## 4. GitHub Pages deployment

### GitHub Desktop, recommended for large projects

1. Create a new GitHub repository (e.g. `lab5-splat-walkthrough`). Make it public if you are using a public GitHub Pages site.
2. In GitHub Desktop choose **File → Add Local Repository**, point it to the unpacked project folder after initializing it as a repository (`git init`) or use **File → New Repository** and copy the project files into the newly created repository folder.
3. Commit and **Publish repository**.
4. On GitHub → repository **Settings → Pages** → **Build and deployment: Deploy from a branch** → **Branch: main, folder: /(root)** → Save.
5. Open `https://YOUR_USERNAME.github.io/YOUR_REPO/`. It may take a short while after the first commit before Pages publishes the first build.

GitHub Pages project sites operate under `/YOUR_REPO/`; the app uses **relative paths** for local assets so this works without code changes. A `.nojekyll` marker is included.

### Github file limits

GitHub generally warns for files larger than **50 MiB** and rejects individual Git repository files larger than **100 MiB** (approximately 100 MB). Git LFS pointers generally do not work as ordinary Pages binary assets. For a larger `.sog` or streamed SOG asset tree, host the data on a static CORS-enabled object store/CDN (Cloudflare R2, S3, etc.) and set `splat.url` to the **absolute HTTPS URL**. Ensure `Access-Control-Allow-Origin` permits your GitHub Pages origin. The repository may then contain just code, the tiny `.json` configuration and your GLBs. Test the remote URL from the published site.

## 5. File map: what to edit

| File | Function |
| --- | --- |
| `index.html` | Page/UI structure, load control, importer, buttons and PlayCanvas CDN import map |
| `style.css` | UI styling; edit `--accent`, `--panel`, `--bg`, font stack etc. |
| `main.js` | PlayCanvas setup, depth-only proxy, Ammo physics, first person controller, autofocus, DOM annotations, upload preview |
| `assets/scene-config.json` | **Primary settings**: SOG URL, GLB URLs, positions/rotations, start coordinates, camera, controller, DOF |
| `assets/annotations.json` | Hotspot coordinates, titles, descriptions |
| `blender-addon/lab5_splat_walkthrough_exporter.py` | Blender authoring/export sidebar |
| `start-local.bat` | Windows local Python static server |

## 6. How the three examples are combined

- **First-person:** official `FirstPersonController` ESM script, Ammo.js Wasm, a capsule + rigidbody, static GLB mesh collision. Reference: <https://github.com/playcanvas/engine/blob/main/examples/src/examples/gaussian-splatting/first-person.example.mjs>.
- **Depth of field:** `CameraFrame`, `rendering.sceneDepthMap=true`, depth-only proxy (`meshInstance.shaderPassMask &= ~(1 << SHADER_FORWARD)`), and smoothing of autofocus raycasts against the collider. Reference: <https://github.com/playcanvas/engine/blob/main/examples/src/examples/gaussian-splatting/depth-of-field.example.mjs>.
- **Annotations:** projected world-space hotspots. The official sample uses an `AnnotationManager` script; this application deliberately uses HTML-over-canvas hotspots so you can edit/export annotations using plain JSON. Reference: <https://github.com/playcanvas/engine/blob/main/examples/src/examples/gaussian-splatting/annotations.example.mjs>.

The engine and script are pinned via CDN to PlayCanvas **2.23.3**; update both URLs in `index.html` together if you upgrade. Ammo files are served from the official PlayCanvas developer asset host. The starter Sunnyvale GLB is Draco-compressed; the project uses the pinned Google Draco 1.5.7 WASM decoder via `dracoInitialize()`. Blender-exported GLBs normally do not require Draco.

## 7. Troubleshooting checklist

- **SOG failed to load:** confirm the path/case and a bundled SOG (not merely a metadata JSON), inspect DevTools Network for 404/CORS issues. For `.ply` verify it contains Gaussian splat properties, not only a point cloud.
- **Pitch-black / blank scene:** confirm SOG's coordinate orientation, camera start, browser WebGPU/WebGL2 support and network access. Start from the public sample to isolate your asset from the engine.
- **Walk through walls:** add `PCW_COLLIDER_` / `PCW_BOTH_` mesh objects, export again and check `assets/collision.glb` loads. A splat alone never creates mesh physics; avoid tiny gaps at wall/floor junctions. Check the spawn capsule isn't inside a solid mesh.
- **Focus blur appears incorrect:** ensure the depth mesh GLB matches the SOG's location/scale/rotation. Toggle **Show depth proxy**. Avoid using a single flat floor for scenes with many near/far object surfaces.
- **Object shows upside-down:** change **splat.rotation** (often 180° on an axis for original PLY) or fix the source orientation in SuperSplat. Do not independently rotate the proxy without checking it in debug mode.
- **Physics never starts:** look for Ammo `.wasm.js` / `.wasm.wasm` requests in the Network tab; allow access to `developer.playcanvas.com`. This static demo uses CDN-delivered engine and physics files.
- **Annotations cannot be selected while mouse is locked:** press **Esc** or open Annotations and use the list. The mouse unlocks when you click a hotspot.
- **Annotations disappear on refresh:** browser edits are temporary. Use **Download annotations.json**, replace the file in `assets/`, commit and push the repository.
- **PlayCanvas canvas and notes don't align:** project points must use the **same Y-up world space** as the scene. Blender addon handles the Y-up conversion; manually-authored JSON should already use PlayCanvas coordinates.
- **Mobile performance poor:** disable DoF first, lower `app.scene.gsplat.splatBudget` (main.js), use small/streamed SOG, simplify proxy geometry. Mobile controls use PlayCanvas controller touch gestures.

## 8. Scope and verification

The JS file passed `node --check`, the Blender script passed `py_compile`, and the HTML/config files can be inspected offline. **Live browser, WebGPU, Ammo asset fetching and Blender runtime tests were not possible in this environment**, so this is a runnable starter project with static validation, not a claim of end-to-end production QA. The current version supports **one splat scene at a time**; it does not automatically extract a collision mesh from Gaussian data or implement a visual drag-and-drop GLB importer. Your SOG and GLBs must be aligned in the same coordinate space. 

## Credits / external assets

- PlayCanvas Engine: <https://github.com/playcanvas/engine> (MIT)
- Official examples: <https://playcanvas.com/examples/#/gaussian-splatting/depth-of-field>, <https://playcanvas.com/examples/#/gaussian-splatting/first-person> and <https://playcanvas.com/examples/#/gaussian-splatting/annotations>
- PlayCanvas SuperSplat: <https://superspl.at/editor>
- Google Draco mesh decoder: <https://github.com/google/draco> (Apache 2.0)
- Default remote SOG/GLB demo: **Sunnyvale Heritage Park Museum, by zeitgeistarchivescans**, <https://superspl.at/scene/d5d397aa>, licensed **CC BY 4.0**. Files load remotely; they are not distributed in this ZIP. Retain attribution while using this sample.

## 9. GitHub first deployment helper and diagnostics

See [`GITHUB_FIRST_DEPLOY.md`](GITHUB_FIRST_DEPLOY.md) for the exact connected GitHub username, two creation paths, and the initial QA checklist. The `publish-github.ps1` helper creates a new repository from Windows after local GitHub CLI login. The `.github/workflows/validate.yml` workflow runs static validation on each push. In the browser, **Settings → Download test diagnostics** captures useful runtime flags for troubleshooting.

## Deployment repository

This test project is published in **https://github.com/blumsall-sys/lab5-splat-walkthrough1**. When GitHub Pages is configured to deploy `main` `/ (root)`, the target site is **https://blumsall-sys.github.io/lab5-splat-walkthrough1/**. The public Sunnyvale SOG and GLB are loaded externally until you replace the asset paths in `assets/scene-config.json`.

## October 30, 2026 — Native Gaussian depth and first-person annotation triggers

The latest version uses the PlayCanvas native splat scene-depth pipeline on compatible
WebGL2/WebGPU devices: `CameraFrame.isSplatSceneDepthSupported(device)`,
`app.scene.gsplat.sceneDepthWrite = true`, `rendering.samples = 1`, and
`rendering.sceneDepthMap = false`. Native splat depth captures trees, walls,
buildings and the floor instead of relying on a floor-heavy triangle proxy.
On unsupported devices, the existing depth-only GLB serves as a fallback.

The Depth Debug checkbox displays the composed scene depth buffer; if a tree is
missing in this view on a fallback device, that device needs a more complete
proxy mesh for equivalent blur. You can disable blur if it is undesirable;
no collision mesh is needed to generate native splat scene depth.

Automatic focus uses the PlayCanvas GPU splat Picker, sampled at the reticle
approximately every 350 ms, with physics-based fallback. Focus is smoothed.

### Game-like annotation system

The new `world-annotations.js` creates invisible spherical, collision-only
PlayCanvas entities (true trigger zones, with triggerenter / triggerleave events).
A spatial distance check handles spawning inside a trigger and missed updates.
The marker is visual only; it does not intercept pointer-lock or mouse input.

- `radius`: world-unit distance for entering the annotation zone; default 3.
- `mode`: `"auto"` automatically opens the popup on approach; `"interact"`
  shows a prompt and opens on **E** / **F**, controller X (button 2) or touch.
- Both modes permit E/F to toggle the card while the pointer remains locked.
- Walk out of a zone to dismiss the card.
- Use the Annotations panel to add/edit the trigger settings, then export JSON.
- Blender add-on v1.1 includes a radius property that resizes the spherical Empty
  guide, and an activation-mode property exported to the same annotation JSON.

The annotation locations must share the same world coordinate space as the
rendered splat and player; custom exported scenes may require repositioning.
The first Sunnyvale sample marker has a 2.75 m activation sphere.

**Troubleshooting**: Settings > Show scene depth should show grayscale/encoded
depth for the whole scan on supported devices. Download diagnostics to confirm
`nativeSplatDepth: true`. When false, use a more complete depth proxy in Blender.

**Test**: From the sample spawn, move toward the numbered marker until the
interaction prompt appears. In automatic mode the popup opens in-world.
Press E without releasing pointer lock to close, and press E again to reopen.
