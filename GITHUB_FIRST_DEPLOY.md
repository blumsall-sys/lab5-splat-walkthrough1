# Lab5 Splat Walkthrough1 — first deployment

Repository: https://github.com/blumsall-sys/lab5-splat-walkthrough1

**The initial project files are committed and the validation workflow has passed.**
The browser runtime has not yet been verified end-to-end.

## Enable GitHub Pages (one-time manual account setting)

1. Open https://github.com/blumsall-sys/lab5-splat-walkthrough1/settings/pages
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select **main** and **/(root)**, then click **Save**.
4. Once GitHub completes publishing, open https://blumsall-sys.github.io/lab5-splat-walkthrough1/

If this setting is already enabled, you can skip it.

## First baseline test

1. Confirm the public Sunnyvale Gaussian splat becomes visible (initial load needs internet).
2. Click inside the viewport, walk with WASD, turn with the mouse and use Space to jump.
3. Confirm your body collides with the sample geometry, rather than falling through it.
4. Open **Settings**, toggle **Depth of field**, **Autofocus**, blur radius, and **Show depth proxy**.
5. Open **Annotations**, place a note, enter some text and download `annotations.json`.
6. Open **Settings → Download test diagnostics** if any item fails. Also capture your browser Console errors.

The default .sog and .glb are external examples from PlayCanvas: no private client scans are in this repository.

## Once the baseline works

Follow [REPLACE_ASSETS.md](REPLACE_ASSETS.md) to export a bundled SuperSplat SOG and use the Blender addon for custom collision/depth geometry. Replace only `assets/scene-config.json`, `assets/annotations.json` and the referenced SOG/GLBs. Keep the tested viewer source unchanged for this step.

## Local Windows test

Clone/download the repository, then run `start-local.bat` (Python required). Open http://localhost:8080.

## Known limitations

GitHub Pages must be turned on in repository settings by an account administrator. GitHub Actions validation checks source syntax/JSON and cannot substitute for a visual browser walkthrough test. Large SOGs (>100 MiB GitHub limit) should use an external HTTPS CORS-enabled asset host.
