// Focus controls for PlayCanvas GSplat Picker (2.23.3).
// The Picker renders a low-resolution ID + depth pass on demand.
// World points are projected onto camera forward for a consistent focal plane.
export function robustFocusDistance(values, previous = null) {
  const v = values.filter(x => Number.isFinite(x) && x >= 0.4 && x <= 2000)
    .sort((a,b) => a-b);
  if (!v.length) return null;
  const mid = v[Math.floor(v.length / 2)];
  const inliers = v.filter(x => Math.abs(x - mid) <= Math.max(0.8, mid * 0.27));
  if (!inliers.length) return mid;
  const estimate = inliers[Math.floor(inliers.length / 2)];
  // Prefer a stable previously measured surface when two surfaces alternate.
  if (Number.isFinite(previous) && Math.abs(estimate - previous) < Math.max(.3, previous*.07))
    return previous * .6 + estimate*.4;
  return estimate;
}

export function createFocusController({pc,state,el,canvas,report,hitAhead}) {
  const handheld = matchMedia('(pointer: coarse)').matches;
  const pickerSize = handheld ? 96 : 144;
  const modeSelect = el('focus-mode');
  const distanceSlider = el('focus-distance');
  const radiusSlider = el('focus-radius');
  const countSelect = el('focus-samples');
  const physicsFallback = el('focus-physics');
  const status = el('focus-status');
  const distanceLabel = el('focus-value');
  let mode = 'auto';
  let target = 5;
  let current = 5;
  let timer = 0;
  let busy = false;
  let serial = 0;
  let picker = null;
  let armed = false;
  let lastGood = 0;
  let lastCount = 0;
  let blocked = false;
  let committed = null;
  let warningAt = 0;
  let tapPoint = null;
  let smooth = .35;
  let fps = 0;

  const near = () => Math.max(.5,Number(distanceSlider.min)||.5);
  const far = () => Number(distanceSlider.max)||250;
  const clampDistance = n => Math.max(near(),Math.min(far(),n));
  function message(msg) {
    status.textContent = msg;
  }
  function showDistance() {
    distanceLabel.textContent = current.toFixed(1) + ' m ' +
      (mode === 'auto' ? '(auto)' : mode === 'tap' ? '(locked)' : '(manual)');
    if (mode !== 'manual') distanceSlider.value = String(current);
  }
  function modeChanged(value, quiet = false) {
    mode = ['auto','tap','manual'].includes(value) ? value : 'auto';
    modeSelect.value = mode;
    distanceSlider.disabled = mode !== 'manual';
    // Focus buttons can always switch Manual/Auto to one-shot Tap Lock.
    el('tap-focus-scene').disabled = false;
    el('tap-focus-center').disabled = false;
    if (mode === 'manual') {
      target = current = clampDistance(Number(distanceSlider.value)||current);
      armed = false;
      committed = null;
      message('Manual distance — depth picking stopped');
    } else if (mode === 'tap') {
      target = current;
      message('Tap lock — press Focus center or Focus scene');
    } else {
      committed = null;
      message('Autofocus — stable multi-point depth samples');
      timer = 0;
    }
    el('tap-focus-scene').classList.toggle('active',armed);
    showDistance();
    if (!quiet) report('Focus mode: '+mode,'ok');
  }

  function initialize(config) {
    try {
      picker = new pc.Picker(state.app,pickerSize,pickerSize,true);
      state.picker = picker;
    } catch(error) {
      picker = null;state.picker=null;
      console.warn('[Lab5] GPU depth picker unavailable. Manual focus remains functional.',error);
    }
    mode = config?.dof?.mode ?? (config?.dof?.autofocus ? 'auto' : 'manual');
    current = clampDistance(Number(config?.dof?.focusDistance)||5);
    target = current;
    modeChanged(mode, true);
    applyFrame();
  }

  function applyFrame() {
    if (!state.frame) return;
    state.frame.dof.focusDistance = current;
    state.frame.dof.focusRange = Math.max(.2,current*.18);
    // CameraFrame stores config separately from the active render pass. Copy focal
    // parameters into the pass directly on frame updates to avoid rebuilding its pipeline.
    const pass = state.frame.renderPassCamera?.dofPass;
    if (pass) {
      pass.focusDistance = state.frame.dof.focusDistance;
      pass.focusRange = state.frame.dof.focusRange;
    } else if (state.frame.dof.enabled) {
      // In case of a camera-frame implementation without a public dofPass.
      state.frame.update();
    }
    showDistance();
  }

  function pointsAt(cssX,cssY) {
    const box = canvas.getBoundingClientRect();
    const px = Math.max(0,Math.min(1,(cssX-box.left)/Math.max(1,box.width)))*pickerSize;
    const py = Math.max(0,Math.min(1,(cssY-box.top)/Math.max(1,box.height)))*pickerSize;
    // Radius is a fraction of the shorter viewport dimension, mapped into picker pixels.
    const r = Math.round(Number(radiusSlider.value||0)*.01*pickerSize);
    const count = Number(countSelect.value)||5;
    const offsets = count===1 || r===0 ? [[0,0]] :
      [[0,0],[r,0],[-r,0],[0,r],[0,-r]];
    if(count===9 && r) offsets.push([r*.7,r*.7],[-r*.7,r*.7],[r*.7,-r*.7],[-r*.7,-r*.7]);
    return offsets.map(([dx,dy])=>({
      x:Math.max(0,Math.min(pickerSize-1,Math.round(px+dx))),
      y:Math.max(0,Math.min(pickerSize-1,Math.round(py+dy)))
    })).filter((p,i,a)=>a.findIndex(q=>q.x===p.x&&q.y===p.y)===i);
  }

  async function sample(cssX,cssY,lock = false) {
    if (!state.camera || !picker || busy || !state.splat || state.previewSplat) return false;
    busy = true;
    const request = ++serial;
    const at = state.camera.getPosition().clone();
    const forward = state.camera.forward.clone();
    const cameraWorld = state.camera.getWorldTransform().clone();
    let values = [];
    try {
      // prepare() renders the splat scene to the dedicated picker target once.
      const world = state.app.scene.layers.getLayerByName('World');
      picker.prepare(state.camera.camera,state.app.scene,[world]);
      // Multiple depth reads share the same prepared buffer; avoid full screen passes.
      const locations = pointsAt(cssX,cssY);
      const positions = await Promise.all(locations.map(p=>picker.getWorldPointAsync(p.x,p.y)));
      if (request !== serial) return false;
      values = positions.filter(p=>p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z))
        .map(p=>p.clone().sub(at).dot(forward))
        .filter(d=>d > Math.max(.25,state.camera.camera.nearClip) && d < state.camera.camera.farClip*.97);
      lastCount=values.length;
      const measurement=robustFocusDistance(values,mode==='auto'?target:null);
      if (measurement !== null) {
        if (lock || mode === 'tap') {
          target = current = clampDistance(measurement);
          committed = measurement;
          message('Locked at '+current.toFixed(1)+' m ('+values.length+' depth hits)');
        } else if (mode === 'auto') {
          const difference = Math.abs(measurement-target);
          // Don't leap from a tree branch to distant ground on one isolated sample.
          if (difference > Math.max(2,target*.40)) {
            if (committed!==null && Math.abs(committed-measurement)<Math.max(2,measurement*.20)) {
              target=clampDistance(measurement);
              committed=null;
            } else {
              committed=measurement;
            }
          } else {
            committed=null;
            target=clampDistance(measurement);
          }
          message('Autofocus: '+values.length+' hits · target '+target.toFixed(1)+' m');
        }
        lastGood=performance.now();
        return true;
      }
      // Do not unexpectedly snap to an unrelated ground collider; opt in explicitly.
      if (physicsFallback.checked && !lock && mode === 'auto') {
        const hit=hitAhead(Math.min(120,state.camera.camera.farClip));
        if(hit?.point) {
          const distance=hit.point.clone().sub(at).dot(forward);
          if(distance>.5) target=clampDistance(distance);
        }
      }
      message('No splat depth at sample — maintaining focus distance');
      return false;
    }catch(error) {
      if(performance.now()-warningAt > 5000) {
        console.warn('[Lab5] focus sampling error',error);
        warningAt=performance.now();
      }
      message('Picking unavailable — use manual focus');
      return false;
    }finally {
      busy=false;
    }
  }

  async function focusCenter() {
    if (!state.camera) return;
    modeChanged('tap',true);
    const r=canvas.getBoundingClientRect();
    const ok=await sample(r.left+r.width/2,r.top+r.height/2,true);
    if (ok) report('Focus locked to reticle','ok');
    else report('No splat depth at reticle. Manual focus remains available.','info');
  }

  function armSceneTap() {
    if(mode==='manual')modeChanged('tap',true);
    else modeChanged('tap',true);
    armed=!armed;
    el('tap-focus-scene').classList.toggle('active',armed);
    if(armed){
      // Let the next click reach the canvas instead of the Settings shade.
      el('panel').hidden=true;
      el('shade').hidden=true;
      message('Tap a surface in the scene to lock focus');
      report('Tap any visible splat surface to lock focus','ok');
    } else {
      message('Focus scene cancelled');
    }
  }
  function onPointerDown(e) {
    if(!armed || e.target!==canvas) return;
    // Capture prevents FPS controller from using the focus tap to start a drag.
    e.preventDefault();
    e.stopImmediatePropagation();
    const box=canvas.getBoundingClientRect();
    const x=document.pointerLockElement ? box.left+box.width/2 : e.clientX;
    const y=document.pointerLockElement ? box.top+box.height/2 : e.clientY;
    armed=false;
    el('tap-focus-scene').classList.remove('active');
    modeChanged('tap',true);
    sample(x,y,true).then(ok=>{if(!ok)report('No splat depth at selected point','info');});
  }
  canvas.addEventListener('pointerdown',onPointerDown,true);
  el('tap-focus-scene').addEventListener('click',armSceneTap);
  el('tap-focus-center').addEventListener('click',focusCenter);
  el('mobile-focus').addEventListener('click',focusCenter);
  modeSelect.addEventListener('change',()=>modeChanged(modeSelect.value));
  distanceSlider.addEventListener('input',()=>{
    if(mode !== 'manual')return;
    current = target = clampDistance(Number(distanceSlider.value));
    message('Manual: '+current.toFixed(1)+' m');
    applyFrame();
  });
  radiusSlider.addEventListener('input',()=>{
    el('focus-radius-value').textContent=radiusSlider.value+'%';
  });
  window.addEventListener('keydown',e=>{
    if(e.repeat||e.code!=='KeyR'||!el('panel').hidden||e.target instanceof HTMLInputElement)return;
    e.preventDefault();focusCenter();
  });

  function update(dt) {
    if (!state.frame)return;
    if(mode==='auto' && state.frame.dof.enabled && !state.previewSplat) {
      timer-=dt;
      if(timer<=0&&!busy) {
        timer=handheld?1.45:.8;
        const box=canvas.getBoundingClientRect();
        sample(box.left+box.width*.5,box.top+box.height*.5);
      }
      const blend=1-Math.exp(-dt/Math.max(.1,smooth));
      current+=(target-current)*blend;
    }
    if(mode==='manual')current=target;
    applyFrame();
  }
  return {initialize,update,applyFrame,focusCenter,
    diagnostics:()=>({mode,focusMeters:current,targetMeters:target,sampleRadiusPercent:Number(radiusSlider.value),
      samples:Number(countSelect.value),lastValidHits:lastCount,lastSuccessfulPickMsAgo:lastGood?Math.round(performance.now()-lastGood):null,
      pickerSize,busy,armed,physicsFallback:physicsFallback.checked})};
}
