# First deployment for GitHub account `blumsall-sys`

**Recommended repository name:** `lab5-splat-walkthrough1`.

## Path A — GitHub integration + small manual step

1. Create a **public** repository at https://github.com/new?name=lab5-splat-walkthrough1 . Choose **Add a README file** so `main` exists.
2. Return to ChatGPT and say **"I created `blumsall-sys/lab5-splat-walkthrough1`; push the Lab5 files."** The GitHub connection can commit source files to an existing repository but cannot create new repositories or enable GitHub Pages.
3. On GitHub, open **Settings → Pages**, choose **Deploy from a branch**, **main / (root)**. Save.
4. Check https://blumsall-sys.github.io/lab5-splat-walkthrough1/ after GitHub Pages finishes publishing.

## Path B — GitHub CLI (completely local, can create the repo)

1. Install Git for Windows and GitHub CLI: https://cli.github.com/
2. In a PowerShell terminal run `gh auth login` (once), then ensure Git author name/email are set.
3. Extract this ZIP to a new empty folder and run `powershell -ExecutionPolicy Bypass -File .\publish-github.ps1` from inside that folder.
4. On GitHub configure Pages exactly as described above.

## Verify the sample *before* replacing assets

- First page must show Sunnyvale public splat, not a black background.
- Try WASD/mouse + Space jump, verify you cannot walk through solid surfaces.
- Settings: toggle depth of field, autofocus, and **Show depth proxy**.
- Add a test annotation at the crosshair and export `annotations.json`.
- Use **Download test diagnostics** to capture engine and feature state if anything fails.
- Replace the `.sog`, `.glb`s, and `.json` only after the baseline scene works.

## Replace only your content

Use Blender's Lab5 add-on to write `assets/scene.sog`, `assets/collision.glb`, `assets/depth-proxy.glb`, and `assets/annotations.json`. Then commit `assets/scene-config.json` with the matching paths and coordinate transforms. Keep `main.js`, `index.html`, and `style.css` unchanged for the first replacement test. For assets above GitHub's 100 MiB hard limit, use an external HTTPS CORS-enabled asset host.

**Note:** The sample splat and GLB are referenced from PlayCanvas and are *not* in this ZIP. Internet access and external asset availability are required. The files have been statically checked, not browser-certified end-to-end.