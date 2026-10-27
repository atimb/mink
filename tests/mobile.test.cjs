const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const crypto=require('node:crypto');
const touch=require('../touch.js'),core=require('../core.js'),assets=require('../assets.js');

test('phone portrait, landscape and browser-bar resize fill the viewport without stretching the world',()=>{
  for(const [w,h] of [[390,844],[844,390],[360,640],[640,360],[430,932],[932,430],[320,480],[1024,768]]){
    const view=touch.viewport(w,h);
    assert(view.width<=640&&view.height<=400);
    assert(Math.abs(view.width/view.height-w/h)<0.007);
    const game=new core.Game(assets.level,10,12);
    game.camera.setViewport(view.width,view.height,game.player);
    for(const p of [{x:20,y:20},{x:620,y:380},{x:320,y:200}]){
      for(let i=0;i<200;i++)game.camera.update(p);
      assert(game.camera.x>=0&&game.camera.x+view.width<=640);
      assert(game.camera.y>=0&&game.camera.y+view.height<=400);
    }
  }
});
test('joysticks have a dead zone, proportional speed and bounded diagonal magnitude',()=>{
  assert.deepEqual(touch.stick(0,0,50),{x:0,y:0,knobX:0,knobY:0});
  assert.equal(touch.stick(3,3,50).x,0);
  const halfway=touch.stick(25,0,50);assert(halfway.x>0&&halfway.x<1);
  const full=touch.stick(200,200,50);
  assert(Math.abs(Math.hypot(full.x,full.y)-1)<1e-12);
  assert(Math.abs(Math.hypot(full.knobX,full.knobY)-50)<1e-12);
});
test('both sticks combine independent movement and aim; releasing fire preserves aim and stops shooting',()=>{
  const input=touch.input({x:1,y:0},{x:0,y:-1},true,2);
  assert.deepEqual(input,{moveX:1,moveY:0,aimDir:0,fire:true});
  const released=touch.input({x:0,y:0},{x:0,y:0},false,input.aimDir);
  assert.equal(released.fire,false);assert.equal(released.aimDir,0);
  const firingCenter=touch.input({x:-1,y:0},{x:0,y:0},true,1.4);
  assert.equal(firingCenter.aimDir,1.4);assert(firingCenter.fire);
});
function openLevel(){
  return {width:32,height:20,layers:[Array(640).fill(1),Array(640).fill(1),Array(640).fill(0)]};
}
test('mobile movement is screen-relative while aiming and firing in a different direction',()=>{
  const game=new core.Game(openLevel(),0,7),p=game.player;
  p.x=200;p.y=200;
  game.step(touch.input({x:1,y:0},{x:0,y:-1},true,0));
  assert.equal(p.x,201);assert.equal(p.y,200);assert.equal(p.dir,0);assert.equal(p.ammo[1],29);
  for(let i=0;i<30;i++)game.step(touch.input({x:0,y:0},{x:0,y:0},false,p.dir));
  assert.equal(p.ammo[1],29);assert.equal(p.x,201);
  game.step({moveX:1,moveY:1,aimDir:0});
  assert(Math.abs(p.x-201-Math.SQRT1_2)<1e-10);
  assert(Math.abs(p.y-200-Math.SQRT1_2)<1e-10);
});
test('mobile renderer reallocates pixels on rotation; desktop remains 320x200',()=>{
  const sandbox={MinkCore:core};sandbox.globalThis=sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../renderer.js'),'utf8'),sandbox);
  let image;
  const ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:i=>{image=i;}};
  const renderer=new sandbox.MinkRenderer({getContext:()=>ctx},assets);
  assert.equal(renderer.width,320);assert.equal(renderer.height,200);
  const game=new core.Game(assets.level,10,25);
  for(const [w,h] of [[390,844],[844,390],[390,760]]){
    const view=touch.viewport(w,h);renderer.resize(view.width,view.height);
    game.camera.setViewport(view.width,view.height,game.player);
    renderer.render(game,{mobile:true,crosshair:{x:90,y:100}});
    assert.equal(image.data.length,view.width*view.height*4);
    assert(image.data.every((v,i)=>i%4!==3||v===255));
    assert(image.data.some((v,i)=>i%4!==3&&v>0));
  }
});
test('desktop simulation and pixels match the pre-mobile version exactly',()=>{
  // Baseline captured from the user's checkout before adding mobile support.
  const game=new core.Game(assets.level,10,752);
  for(let i=0;i<600;i++)game.step({aimX:200,aimY:60,fire:i%100<50,forward:i%140<70,right:i%300<70});
  const state={actors:game.actors,pickups:game.pickups,rockets:game.rockets,effects:game.effects,
    particles:game.particles,bags:game.bags,seed:game.seed,tick:game.tick,
    camera:[game.camera.x,game.camera.y,game.camera.dx,game.camera.dy]};
  const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
  assert.equal(hash(JSON.stringify(state)),'3ff02f0aa1167d78b257207725053c0ad247d0a14c4513906233d5f87941455b');
  const sandbox={MinkCore:core};sandbox.globalThis=sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../renderer.js'),'utf8'),sandbox);
  let image;
  const ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:i=>{image=i;}};
  const renderer=new sandbox.MinkRenderer({getContext:()=>ctx},assets);renderer.render(game);
  assert.equal(hash(image.data),'b6c2dad8c4190fb517d497ffce3fb8b9d6163d59d49c1ee5b9178df8a74b4490');
});
