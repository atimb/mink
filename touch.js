/* Mobile-only input geometry, shared by the browser controls and Node tests. */
(function(root,factory){
  if(typeof module!=='undefined'&&module.exports)module.exports=factory();
  else root.MinkTouch=factory();
})(globalThis,function(){
  'use strict';
  function viewport(width,height,worldWidth=640,worldHeight=400){
    const scale=Math.max(Math.min(width,height)/180,width/worldWidth,height/worldHeight);
    return {width:Math.min(worldWidth,Math.max(1,Math.round(width/scale))),
      height:Math.min(worldHeight,Math.max(1,Math.round(height/scale)))};
  }
  function stick(dx,dy,radius,deadZone=0.16){
    const distance=Math.hypot(dx,dy),length=Math.min(1,distance/radius);
    const strength=Math.max(0,(length-deadZone)/(1-deadZone));
    return {x:distance?dx/distance*strength:0,y:distance?dy/distance*strength:0,
      knobX:distance?dx/distance*Math.min(distance,radius):0,
      knobY:distance?dy/distance*Math.min(distance,radius):0};
  }
  function input(move,aim,fire,previousDirection){
    let dir=previousDirection;
    if(Math.hypot(aim.x,aim.y)>0)dir=Math.atan2(aim.x,-aim.y);
    else if(!fire&&Math.hypot(move.x,move.y)>0)dir=Math.atan2(move.x,-move.y);
    return {moveX:move.x,moveY:move.y,aimDir:dir,fire};
  }
  return {viewport,stick,input};
});
