// GPU performance profiles and dynamic resolution for PlayCanvas 2.23.3.
// GSplat system already performs camera frustum checks and distance LOD for
// streamed octree SOG; this module tunes that engine rather than faking
// per-splat visibility from a whole-scene static collider.
export function createPerformanceController({state,el,report}) {
  const mobile = matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints>0;
  const profiles={
    low: {pixelRatio:.8,budget:700000,minContribution:4.0,foveationStrength:2.0,blurRings:2,blurRingPoints:4},
    balanced:{pixelRatio:1.15,budget:1800000,minContribution:3.0,foveationStrength:1.0,blurRings:3,blurRingPoints:5},
    high:{pixelRatio:1.6,budget:3500000,minContribution:2.3,foveationStrength:0,blurRings:4,blurRingPoints:5}
  };
  let preset=mobile?'balanced':'high';
  let adaptive=true;
  let pixelScale=1;
  let performanceSample=0;
  let slowTicks=0,fastTicks=0;
  let targetFps=mobile?40:55;
  let fps=60;
  let statsTimer=0;
  let lockedMode=null;
  let telemetryEnabled=true;
  const quality=el('quality-preset');
  const adaptiveEl=el('adaptive-quality');
  const stats=el('render-stats');
  const display=el('perf-readout');
  const maxDpr=()=>Math.max(1,Math.min(devicePixelRatio||1,2));
  const profile=()=>profiles[preset]||profiles.balanced;

  function set(presetNext,announce=false){
    preset=profiles[presetNext]?presetNext:'balanced';
    quality.value=preset;
    const setting=profile();
    if(!state.app)return;
    const gd=state.app.graphicsDevice;
    pixelScale=Math.min(maxDpr(),setting.pixelRatio);
    gd.maxPixelRatio=pixelScale;
    state.app.resizeCanvas();
    const gs=state.app.scene.gsplat;
    gs.splatBudget=setting.budget;
    gs.minContribution=setting.minContribution;
    gs.foveationStrength=setting.foveationStrength;
    gs.foveationCenter=.25;
    if(state.frame){
      state.frame.dof.blurRings=setting.blurRings;
      state.frame.dof.blurRingPoints=setting.blurRingPoints;
      state.frame.dof.highQuality=preset==='high';
      state.frame.update();
    }
    if(state.splat?.gsplat){
      // LOD base distance is meaningful only on streamed octree LOD assets.
      // A flat .sog keeps one set of Gaussian data, subject to budget/quality.
      state.splat.gsplat.lodBaseDistance=preset==='low'?3:preset==='balanced'?5:7;
    }
    if(announce)report('Quality profile: '+preset,'ok');
  }
  quality.onchange=()=>{set(quality.value,true); slowTicks=0;fastTicks=0;};
  adaptiveEl.onchange=()=>{adaptive=adaptiveEl.checked;slowTicks=0;fastTicks=0;};
  el('show-stats').onchange=()=>{telemetryEnabled=el('show-stats').checked;stats.hidden=!telemetryEnabled;};

  function initialize(cfg){
    adaptive=cfg?.performance?.adaptive??true;
    preset=cfg?.performance?.profile??(mobile?'balanced':'high');
    quality.value=preset;
    adaptiveEl.checked=adaptive;
    stats.hidden=!telemetryEnabled;
    set(preset);
  }
  function update(dt){
    if(!state.app)return;
    const instant=1/Math.max(.008,dt);
    fps=fps*.94+Math.min(180,instant)*.06;
    performanceSample+=dt;
    statsTimer+=dt;
    if(statsTimer>.6){
      const gs=state.app.scene.gsplat;
      const label=preset==='low'?'Low':preset==='high'?'High':'Balanced';
      const count=(gs.splatBudget/1000000).toFixed(1);
      display.textContent=label+' · '+Math.round(fps)+' FPS · '+count+'M splat budget · '+pixelScale.toFixed(2)+'× DPR';
      stats.textContent=Math.round(fps)+' FPS · '+label;
      statsTimer=0;
    }
    // Adapt conservatively: a two-second condition, and never switch faster than
    // the stage can settle. Audio/physics/collision updates are unaffected.
    if(!adaptive || performanceSample<2)return;
    performanceSample=0;
    if(fps<targetFps*.78){slowTicks++;fastTicks=0;}
    else if(fps>targetFps*1.28){fastTicks++;slowTicks=0;}
    else{slowTicks=0;fastTicks=0;}
    if(slowTicks>=2){
      slowTicks=0;
      const next=preset==='high'?'balanced':'low';
      if(next!==preset) set(next);
    }
    if(fastTicks>=4){
      fastTicks=0;
      // Do not continuously push mobile devices to High and overheat.
      const next=preset==='low'?'balanced':mobile?'balanced':'high';
      if(next!==preset) set(next);
    }
  }
  return {initialize,update,refresh:()=>set(preset),diagnostics:()=>({
    preset,adaptive,pixelRatio:pixelScale,fps:Math.round(fps),
    splatBudget:state.app?.scene?.gsplat?.splatBudget,
    minContribution:state.app?.scene?.gsplat?.minContribution,
    foveationStrength:state.app?.scene?.gsplat?.foveationStrength,
    frustumCulling:'engine-native',flatSOGPerRegionCulling:false
  })};
}
