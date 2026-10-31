// Display overlays for PlayCanvas FirstPersonController DualGestureSource.
// The controller remains authoritative for touch movement and camera rotation.
// We listen to its joystick position events instead of implementing parallel physics.
export function createMobileControls({pc,state,el,report}) {
  const touch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const hud = el('mobile-hud');
  const stats = el('mobile-stats');
  const shells = {
    left: {base:el('joystick-left'),stick:el('joystick-left-stick'),hint:el('joystick-left-hint')},
    right:{base:el('joystick-right'),stick:el('joystick-right-stick'),hint:el('joystick-right-hint')}
  };
  let enabled = touch;
  let debug = false;
  let fpsSmoothing = 60;
  let lastSample = 0;
  let force = 0;
  // Keep both on-screen bases pinned inside their own touch-friendly zones.
  // The engine still interprets gestures on each half of the canvas, but
  // visualization never follows a finger into the right-hand button rail.
  function setJoystick(side,bx,by,sx,sy) {
    if(!enabled)return;
    const j=shells[side];
    if(bx < 0 || by < 0){
      j.base.classList.remove('moving');
      j.stick.style.transform='translate(-50%,-50%)';
      return;
    }
    j.base.classList.add('moving');
    const radius=side==='right'?38:42;
    const dx=sx-bx,dy=sy-by;
    const length=Math.hypot(dx,dy);
    const factor=length>radius?radius/length:1;
    const x=Math.round(dx*factor),y=Math.round(dy*factor);
    j.stick.style.transform='translate(calc(-50% + '+x+'px),calc(-50% + '+y+'px))';
  }
  function toggle(enabledNow) {
    enabled=enabledNow;
    hud.hidden=!enabled;
    el('mobile-focus').hidden=!enabled;
    if(!enabled){
      for(const j of Object.values(shells)){
        j.base.classList.remove('moving');
        j.stick.style.transform='translate(-50%,-50%)';
      }
    }
    // Explicitly opt into joysticks on both halves; default controller is joystick-touch.
    if(state.controller?._mobileInput)state.controller._mobileInput.layout=enabled?'joystick-joystick':'joystick-touch';
  }
  function jump() {
    if(!state.player?.rigidbody || !state.app || !state.physics)return;
    const pos=state.player.getPosition();
    const from=pos.clone(),to=pos.clone().add(new pc.Vec3(0,-1.16,0));
    const hit=state.app.systems.rigidbody.raycastFirst(from,to);
    // Avoid applying an impulse midair. A hit within capsule reach counts as ground.
    if(!hit || hit.entity===state.player) return;
    state.player.rigidbody.applyImpulse(0,state.config?.walk?.jumpForce||420,0);
  }

  hud.querySelectorAll('button').forEach(button=>{
    // Let a touch action activate exactly once, independent of the joystick surface.
    button.addEventListener('pointerdown',event=>event.stopPropagation());
    button.addEventListener('touchstart',event=>event.stopPropagation(),{passive:true});
    button.addEventListener('touchmove',event=>event.stopPropagation(),{passive:true});
    button.addEventListener('touchend',event=>event.stopPropagation(),{passive:true});
  });
  el('mobile-jump').onclick=jump;
  el('mobile-interact').onclick=()=>el('interact-btn').click();
  el('mobile-sprint').onclick=()=>{
    const controller=state.controller;
    if(!controller)return;
    // Persistent sprint toggle for touchscreen; stored in controller's multiplier.
    const selected=el('mobile-sprint').classList.toggle('active');
    controller.sprintMult=selected?2.1:1.5;
    el('mobile-sprint').setAttribute('aria-pressed',String(selected));
  };
  function initialize() {
    if (!state.app)return;
    state.app.on('joystick:left',(bx,by,sx,sy)=>setJoystick('left',bx,by,sx,sy));
    state.app.on('joystick:right',(bx,by,sx,sy)=>setJoystick('right',bx,by,sx,sy));
    toggle(touch);
    el('mobile-stats').hidden=!touch;
  }
  function update(dt){
    if(!touch || !state.app)return;
    fpsSmoothing = fpsSmoothing*.96 + (Math.min(180,1/Math.max(.008,dt)))*.04;
    lastSample+=dt;
    if(lastSample>.8){
      lastSample=0;
      stats.textContent=Math.round(fpsSmoothing)+' FPS';
    }
  }
  function controlZones(){
    if(!enabled)return {enabled:false};
    const joy=shells.right.base.getBoundingClientRect();
    const action=hud.querySelector('.mobile-actions').getBoundingClientRect();
    const horizontalGap=Math.round(action.left-joy.right);
    const overlapping=joy.left<action.right && joy.right>action.left &&
      joy.top<action.bottom && joy.bottom>action.top;
    return {enabled:true,overlapping,horizontalGapPx:horizontalGap,
      joystick:{x:Math.round(joy.x),y:Math.round(joy.y),width:Math.round(joy.width),height:Math.round(joy.height)},
      actions:{x:Math.round(action.x),y:Math.round(action.y),width:Math.round(action.width),height:Math.round(action.height)}};
  }
  return {initialize,update,toggle,diagnostics:()=>({
    touch,enabled,fps:Math.round(fpsSmoothing),
    joystickLayout:state.controller?._mobileInput?.layout,
    controlZones:controlZones()
  })};
}
