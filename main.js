// Lab5 Splat Walkthrough. PlayCanvas 2.23.3. Static GitHub Pages application.
import * as pc from 'playcanvas';
import { FirstPersonController } from 'playcanvas/scripts/esm/first-person-controller.mjs';
import { createWorldAnnotations } from './world-annotations.js';

const el = id => document.getElementById(id);
const canvas = el('application-canvas');
const state = {app:null, camera:null, player:null, splat:null, splatAsset:null, frame:null,
  depthParts:[], annotations:[], selected:null, config:null, physics:false,
  nativeSplatDepth:false,picker:null,focusPending:false,focusTick:0,targetFocus:5,
  lastFocusPick:0,previewSplat:false};
const buttons = new Map();
function report(message, level='info') {
  const item=el('status'); item.textContent=message; item.className=level==='info'?'':level;
  if(level==='error') console.error('[Lab5]',message); else console.log('[Lab5]',message);
}
function transform(entity, t={}) {
  entity.setLocalPosition(...(t.position||[0,0,0]));
  entity.setLocalEulerAngles(...(t.rotation||[0,0,0]));
  entity.setLocalScale(...(t.scale||[1,1,1]));
}
function panel(which) {
  if(document.pointerLockElement) document.exitPointerLock();
  el('panel').hidden=false; el('shade').hidden=false;
  for(const name of ['settings','notes','help']) el(name+'-panel').hidden=name!==which;
  el('panel-title').textContent={settings:'Scene settings',notes:'Annotations',help:'Walkthrough controls'}[which];
}
function closePanel(){el('panel').hidden=true;el('shade').hidden=true;}
el('settings-btn').onclick=()=>panel('settings');
el('notes-btn').onclick=()=>panel('notes');
el('help-btn').onclick=()=>panel('help');
el('panel-close').onclick=closePanel;
el('shade').onclick=closePanel;
el('tooltip-close').onclick=()=>el('tooltip').hidden=true;

function syncSettings(){
  el('focus-value').textContent=Number(el('focus-distance').value).toFixed(1)+' m';
  el('blur-value').textContent=el('blur-radius').value;
  el('focus-distance').disabled=el('auto-focus').checked;
}
function applyDOF(){
  syncSettings();
  if(!state.frame)return;
  const dof=state.frame.dof;
  dof.enabled=el('dof-on').checked&&!state.previewSplat&&(state.nativeSplatDepth||state.depthParts.length>0);
  dof.blurRadius=Number(el('blur-radius').value);
  dof.focusDistance=Number(el('focus-distance').value);
  dof.focusRange=Math.max(0.1,dof.focusDistance*0.17);
  state.frame.update();
}
for(const id of ['dof-on','auto-focus','focus-distance','blur-radius']){
  el(id).addEventListener('input',applyDOF);
}
// Inspect the actual depth pass, including trees, instead of rendering the proxy in color.
el('proxy-debug').onchange=()=>{
  if(!state.frame)return;
  state.frame.debug=el('proxy-debug').checked?'depth':null;
  state.frame.update();
};
el('reset-player').onclick=()=>{
  if(!state.player)return;
  const coords=state.config.spawn.position;
  if(state.player.rigidbody)state.player.rigidbody.teleport(...coords);
  else state.player.setPosition(...coords);
  report('Returned to starting position.','ok');
};
function download(name,text){
  const blob=new Blob([text],{type:'application/json'});
  const href=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=href;a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(href),1500);
}
el('download-diagnostics').onclick=()=>download('lab5-test-diagnostics.json',JSON.stringify({
  engine:pc.version,href:location.href,splat:state.splatAsset?.file?.url||null,
  splatLoaded:!!state.splat?.gsplat?.asset,physics:state.physics,
  rigidbodies:state.app?.root?.findComponents('rigidbody')?.length||0,
  depthProxyParts:state.depthParts.length,nativeSplatDepth:state.nativeSplatDepth,
  sceneDepthWrite:!!state.app?.scene?.gsplat?.sceneDepthWrite,
  sceneDepthMapPrepass:!!state.frame?.rendering?.sceneDepthMap,
  dof:!!state.frame?.dof?.enabled,focusDistance:state.frame?.dof?.focusDistance,
  annotations:state.annotations.length,interaction:worldNotes.diagnostics(),
  fps:Math.round(state.app?.stats?.frame?.fps||0)
},null,2));

async function fetchConfig(){
  const res=await fetch('./assets/scene-config.json',{cache:'no-store'});
  if(!res.ok)throw Error('Cannot load assets/scene-config.json: HTTP '+res.status);
  return res.json();
}
function loadAsset(name,type,url,required=true,contents=null){
  if(!url)return Promise.resolve(null);
  const options={url};
  if(contents)options.contents=contents;
  const asset=new pc.Asset(name,type,options);
  state.app.assets.add(asset);
  return new Promise((resolve,reject)=>{
    asset.once('load',()=>resolve(asset));
    asset.once('error',e=>{
      if(required)reject(Error(name+' failed: '+(e?.message||e||url)));
      else {console.warn('[Lab5] Optional asset unavailable',name,e);resolve(null);}
    });
    state.app.assets.load(asset);
  });
}
function instanceGLB(asset,config,name){
  const result=asset.resource.instantiateRenderEntity();
  result.name=name; state.app.root.addChild(result);transform(result,config);
  return result;
}
function addDepth(asset,cfg){
  if(!asset)return;
  const root=instanceGLB(asset,cfg,'Invisible depth-only proxy');
  for(const render of root.findComponents('render'))for(const mi of render.meshInstances){
    mi.shaderPassMask&=~(1<<pc.SHADER_FORWARD);
    state.depthParts.push(mi);
  }
}
function addCollision(asset,cfg){
  if(!asset)return;
  const root=instanceGLB(asset,cfg,'Invisible static collision mesh');
  let parts=0;
  for(const render of root.findComponents('render')){
    render.entity.addComponent('rigidbody',{type:'static',friction:0.7,restitution:0});
    render.entity.addComponent('collision',{type:'mesh',renderAsset:render.asset});
    render.enabled=false;parts++;
  }
  report('Loaded '+parts+' static collision render components.');
}
function addPlayer(cfg){
  const eye=new pc.Entity('First person eye');
  eye.addComponent('camera',{
    clearColor:new pc.Color(0.1,0.13,0.15),fov:cfg.camera.fov,
    nearClip:0.08,farClip:cfg.camera.farClip,toneMapping:pc.TONEMAP_ACES
  });
  eye.setLocalPosition(0,cfg.spawn.eyeHeight,0);
  const player=new pc.Entity('First person capsule');
  player.setPosition(...cfg.spawn.position);player.addChild(eye);
  player.addComponent('collision',{type:'capsule',radius:cfg.walk.radius,height:cfg.walk.height});
  player.addComponent('rigidbody',{type:'dynamic',mass:100,linearDamping:0,angularDamping:0,
    linearFactor:pc.Vec3.ONE,angularFactor:pc.Vec3.ZERO,friction:0.7,restitution:0});
  player.addComponent('script');
  const controller=player.script.create(FirstPersonController,{properties:{
    camera:eye,jumpForce:cfg.walk.jumpForce,speedGround:cfg.walk.speedGround,sprintMult:cfg.walk.sprintMult
  }});
  state.app.root.addChild(player);
  if(controller?._angles)controller._angles.set(cfg.spawn.pitch||0,cfg.spawn.yaw||0,0);
  state.player=player;state.camera=eye;
}
function createCameraFrame(cfg){
  const frame=new pc.CameraFrame(state.app,state.camera.camera);
  frame.rendering.toneMapping=pc.TONEMAP_ACES;
  frame.rendering.samples=1;
  // The native splat scene-depth path requires no depth prepass and no MSAA.
  // Only fallback devices need the old proxy-geometry depth prepass.
  frame.rendering.sceneDepthMap=!state.nativeSplatDepth;
  state.app.scene.gsplat.sceneDepthWrite=state.nativeSplatDepth;
  frame.dof.nearBlur=true;
  frame.dof.highQuality=true;
  frame.dof.blurRings=cfg.dof.blurRings||4;
  frame.dof.blurRingPoints=cfg.dof.blurRingPoints||5;
  frame.update();state.frame=frame;applyDOF();
}
const rayFrom=new pc.Vec3(),rayTo=new pc.Vec3();
function hitAhead(maxDistance=100){
  if(!state.physics||!state.camera)return null;
  const eye=state.camera.getPosition(), direction=state.camera.forward;
  rayFrom.copy(eye).add(direction.clone().mulScalar(0.3));
  rayTo.copy(eye).add(direction.clone().mulScalar(maxDistance));
  return state.app.systems.rigidbody.raycastFirst(rayFrom,rayTo);
}
let smoothFocus=5;
let lastWarn=0;
function autoFocus(delta){
  if(!state.frame||!state.frame.dof.enabled||!el('auto-focus').checked)return;
  state.focusTick-=delta;
  if(state.picker&&!state.focusPending&&state.focusTick<=0){
    state.focusTick=0.35;
    state.focusPending=true;
    try{
      const world=state.app.scene.layers.getLayerByName('World');
      state.picker.prepare(state.camera.camera,state.app.scene,[world]);
      state.picker.getWorldPointAsync(16,16).then(point=>{
        if(point&&Number.isFinite(point.x)){
          const distance=state.camera.getPosition().distance(point);
          if(distance>0.25&&distance<state.config.camera.farClip){
            state.targetFocus=distance;
            state.lastFocusPick=performance.now();
          }
        }
      }).catch(error=>{
        if(performance.now()-lastWarn>5000){console.warn('[Lab5] Splat focus picker:',error);lastWarn=performance.now();}
      }).finally(()=>{state.focusPending=false;});
    }catch(error){
      console.warn('[Lab5] Splat focus picker unavailable, using physics ray',error);
      state.focusPending=false;
      state.picker?.destroy();
      state.picker=null;
    }
  }
  if(!state.lastFocusPick||performance.now()-state.lastFocusPick>1300){
    const hit=hitAhead(100);
    if(hit?.point)state.targetFocus=state.camera.getPosition().distance(hit.point);
  }
  const destination=Number.isFinite(state.targetFocus)?Math.max(0.5,state.targetFocus):5;
  smoothFocus+=(destination-smoothFocus)*(1-Math.exp(-delta/0.2));
  state.frame.dof.focusDistance=smoothFocus;
  state.frame.dof.focusRange=Math.max(0.2,smoothFocus*0.2);
  el('focus-value').textContent=smoothFocus.toFixed(1)+' m (auto)';
}

// Keep authoring controls but move game interactions to dedicated PlayCanvas trigger module.
const worldNotes=createWorldAnnotations({pc,state,canvas,el,hitAhead,report,download});

async function changeSplat(url,cfg,contents=null){
  report('Loading Gaussian splat…');
  const asset=await loadAsset('Scene Gaussian Splat','gsplat',url,true,contents);
  const root=new pc.Entity('Visible Gaussian Splat');
  root.addComponent('gsplat',{asset});transform(root,cfg);
  state.app.root.addChild(root);
  const old=state.splat,oldAsset=state.splatAsset;
  state.splat=root;state.splatAsset=asset;
  if(old)old.destroy();
  if(oldAsset){state.app.assets.remove(oldAsset);oldAsset.unload();}
  report('Loaded '+url.split('/').pop()+'. Click the scene to walk.','ok');
}
el('local-splat').onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  const extension=file.name.split('.').pop().toLowerCase();
  if(!['sog','ply'].includes(extension)){report('Choose a .sog or Gaussian .ply.','error');return;}
  try{
    const data=await file.arrayBuffer();
    await changeSplat('./preview-'+Date.now()+'.'+extension,state.config.splat,data);
    state.previewSplat=true;el('dof-on').checked=false;applyDOF();
    report('Previewing '+file.name+'. Old colliders still belong to Sunnyvale. Depth of field disabled.','ok');
  }catch(err){report('Preview failed: '+err.message,'error');}
  e.target.value='';
};
el('reset-splat').onclick=async()=>{
  try{await changeSplat(state.config.splat.url,state.config.splat);state.previewSplat=false;el('dof-on').checked=state.config.dof.enabled;applyDOF();}
  catch(err){report(err.message,'error');}
};

pc.WasmModule.setConfig('Ammo',{
  glueUrl:'https://developer.playcanvas.com/assets/modules/ammo/ammo.wasm.js',
  wasmUrl:'https://developer.playcanvas.com/assets/modules/ammo/ammo.wasm.wasm',
  fallbackUrl:'https://developer.playcanvas.com/assets/modules/ammo/ammo.js'
});
pc.dracoInitialize({
  jsUrl:'https://www.gstatic.com/draco/versioned/decoders/1.5.7/draco_wasm_wrapper.js',
  wasmUrl:'https://www.gstatic.com/draco/versioned/decoders/1.5.7/draco_decoder.wasm',
  lazyInit:true
});
async function start(){
  try{
    report('Loading scene configuration and physics…');
    const cfg=await fetchConfig();state.config=cfg;
    document.title=cfg.projectName+' · PlayCanvas';el('site-title').textContent=cfg.projectName;
    el('dof-on').checked=!!cfg.dof.enabled;el('auto-focus').checked=!!cfg.dof.autofocus;
    el('focus-distance').value=cfg.dof.focusDistance;el('blur-radius').value=cfg.dof.blurRadius;
    syncSettings();
    await new Promise(resolve=>pc.WasmModule.getInstance('Ammo',resolve));
    state.physics=true;
    const device=await pc.createGraphicsDevice(canvas,{deviceTypes:['webgpu','webgl2'],antialias:false});
    device.maxPixelRatio=Math.min(window.devicePixelRatio||1,1.75);
    const opts=new pc.AppOptions();
    opts.graphicsDevice=device;opts.mouse=new pc.Mouse(document.body);
    opts.touch=new pc.TouchDevice(document.body);opts.keyboard=new pc.Keyboard(window);
    opts.gamepads=new pc.GamePads();
    opts.componentSystems=[pc.RenderComponentSystem,pc.CameraComponentSystem,pc.LightComponentSystem,
      pc.ScriptComponentSystem,pc.CollisionComponentSystem,pc.RigidBodyComponentSystem,pc.GSplatComponentSystem];
    opts.resourceHandlers=[pc.TextureHandler,pc.ContainerHandler,pc.ScriptHandler,pc.GSplatHandler];
    const app=new pc.AppBase(canvas);app.init(opts);state.app=app;
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);app.setCanvasResolution(pc.RESOLUTION_AUTO);
    window.addEventListener('resize',()=>app.resizeCanvas());
    app.start();app.systems.rigidbody.gravity.set(0,-10,0);
    app.scene.gsplat.splatBudget=(window.innerWidth<700?1:3)*1000000;
    state.nativeSplatDepth=typeof pc.CameraFrame.isSplatSceneDepthSupported==='function'
      &&pc.CameraFrame.isSplatSceneDepthSupported(device);
    app.scene.gsplat.sceneDepthWrite=state.nativeSplatDepth;
    app.scene.gsplat.enableIds=true;
    report('Loading Sunnyvale sample SOG and collision/depth meshes…');
    const [splat,depth,collision]=await Promise.all([
      loadAsset('Sample splat','gsplat',cfg.splat.url),
      state.nativeSplatDepth?Promise.resolve(null):loadAsset('Depth GLB','container',cfg.depthMesh?.url,false),
      loadAsset('Collision GLB','container',cfg.collisionMesh?.url,false)
    ]);
    addDepth(depth,cfg.depthMesh);
    addCollision(collision,cfg.collisionMesh);
    addPlayer(cfg);createCameraFrame(cfg);
    const splatRoot=new pc.Entity('Sunnyvale Gaussian Splat');
    splatRoot.addComponent('gsplat',{asset:splat});
    transform(splatRoot,cfg.splat);app.root.addChild(splatRoot);
    state.splat=splatRoot;state.splatAsset=splat;
    smoothFocus=cfg.dof.focusDistance;state.targetFocus=smoothFocus;
    try{state.picker=new pc.Picker(app,32,32,true);}catch(error){console.warn('[Lab5] Splat focus picker unavailable',error);}
    await worldNotes.load(cfg);
    app.on('update',dt=>{autoFocus(dt);worldNotes.update();});
    window.lab5={app,state,config:cfg,worldNotes};
    report('Walkthrough loaded: '+(collision?'collision':'NO COLLISION')+' · '+
      (state.nativeSplatDepth?'native splat depth':depth?'proxy depth':'NO DEPTH')+
      ' · '+state.annotations.length+' game trigger(s).','ok');
    if(!collision||(!state.nativeSplatDepth&&!depth))
      console.warn('[Lab5] Collider or fallback proxy unavailable; check Network.');
    if(!state.nativeSplatDepth)console.warn('[Lab5] Native splat scene depth unsupported: using GLB proxy fallback.');
  }catch(err){
    console.error('[Lab5] Startup error',err);
    report('Startup failed: '+(err?.message||err)+'. Check browser DevTools Console and Network.','error');
  }
}
start();
