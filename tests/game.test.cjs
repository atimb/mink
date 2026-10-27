const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');
const assets=require('../assets.js');
const {Game,Camera,round}=require('../core.js');

test('original assets: dimensions, untouched data checksums, map and byte orientation',()=>{
  assert.equal(Object.keys(assets.sprites).length,68);
  assert.deepEqual([assets.level.width,assets.level.height],[32,20]);
  assert.equal(assets.level.layers.length,3);
  // The checked-out repository ships the complete bundle, not the optional DAT archive.
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(assets)).digest('hex'),
    '02b0579b314173bb2e605818f06c63cc500373f02189d259ef630e131373b5e1');
  if(fs.existsSync(path.join(__dirname,'../original-data/manifest.json'))){
    const manifest=require('../original-data/manifest.json');assert.equal(manifest.length,76);
    for(const entry of manifest){
      const data=fs.readFileSync(path.join(__dirname,'../original-data',entry.file));
      assert.equal(data.length,entry.bytes);
      assert.equal(crypto.createHash('sha256').update(data).digest('hex'),entry.sha256);
    }
    const data=fs.readFileSync(path.join(__dirname,'../original-data/MAN1.DAT'));
    const offset=Buffer.from('100\r\n20\r\n20\r\n').length;
    for(let x=0;x<20;x++)for(let y=0;y<20;y++)assert.equal(assets.sprites.man1.pixels[y*20+x],data[offset+x*22+y]);
  }
  assert(assets.level.layers[0].every(t=>t>=1&&t<=11));
  assert(assets.level.layers[2].some(t=>t===5));
});
test('Pascal rounding and camera dead zone, four-pixel steps, both axes and level edges',()=>{
  assert.deepEqual([round(0.5),round(1.5),round(-0.5),round(-1.5)],[0,2,0,-2]);
  const camera=new Camera(640,400);
  camera.update({x:150,y:90});assert.deepEqual([camera.x,camera.y],[0,0]);
  camera.update({x:179,y:111});assert.deepEqual([camera.x,camera.y],[0,0]);
  camera.update({x:300,y:250});assert.deepEqual([camera.x,camera.y],[4,4]);
  for(let i=0;i<300;i++)camera.update({x:620,y:380});
  assert.deepEqual([camera.x,camera.y],[320,200]);
  for(let i=0;i<300;i++)camera.update({x:20,y:20});
  assert.deepEqual([camera.x,camera.y],[0,0]);
});
function arena(){
  const width=32,height=20,layers=[Array(width*height).fill(1),Array(width*height).fill(1),Array(width*height).fill(0)];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(!x||!y||x===width-1||y===height-1)layers[0][y*width+x]=2;
  return {width,height,layers};
}
function place(game,a,x,y){a.x=x;a.y=y;a.dead=false;a.health=100;}
test('aim-relative forward and strafe, solid walls and actor collision',()=>{
  const game=new Game(arena(),1,123),p=game.player,b=game.actors[1];
  place(game,p,100,100);place(game,b,400,300);game.camera.x=game.camera.y=0;
  game.step({forward:true,aimX:200,aimY:110.5});assert(p.x>100.99);assert.equal(p.y,100);
  game.step({right:true,aimX:200,aimY:110.5});assert(p.y>100.99);
  place(game,p,20,20);game.move(p,-1,-1);assert.deepEqual([p.x,p.y],[20,20]);
  place(game,p,100,100);place(game,b,120,100);game.move(p,1,0);assert.equal(p.x,100);
});
test('all six weapons fire, consume ammo and respect cooldowns; hitscan stops at walls',()=>{
  for(let w=1;w<=6;w++){
    const game=new Game(arena(),1,3),p=game.player,b=game.actors[1];
    place(game,p,100,100);place(game,b,180,100);p.dir=Math.PI/2;p.weapon=w;p.weapons[w]=true;p.ammo[w]=10;
    assert(game.fire(p));assert.equal(p.ammo[w],9);assert.equal(game.fire(p),false);
    if(w===4){assert.equal(game.rockets.length,1);for(let i=0;i<80;i++)game.updateRockets();assert(b.health<100||b.dead);}
    else assert(b.health<100||b.dead);
  }
  const level=arena();level.layers[0][5*32+8]=2;
  const game=new Game(level,1,3);place(game,game.player,100,100);place(game,game.actors[1],180,100);
  game.player.dir=Math.PI/2;game.fire(game.player);assert.equal(game.actors[1].health,100);
});
test('pickup locations retained, ammo collection, timed reappearance, health cap',()=>{
  const level=arena();level.layers[2][5*32+5]=5;level.layers[2][5*32+6]=1;
  const game=new Game(level,0,4),p=game.player;place(game,p,100,100);game.collect(p);
  assert.equal(p.ammo[4],10);assert.equal(p.weapon,4);assert.equal(game.pickups[0].timer,1000);
  place(game,p,120,100);p.health=75;game.collect(p);assert.equal(p.health,100);
  place(game,p,300,300);for(let i=0;i<1000;i++)game.step();assert.equal(game.pickups[0].timer,0);
});
test('kills, dropped inventory, corpse, respawn animation and starting sidearm loadout',()=>{
  const game=new Game(arena(),1,5),p=game.player,b=game.actors[1];
  game.damage(b,100,0,0,1);assert(b.dead);assert.equal(p.score,1);assert.equal(b.score,-1);
  assert.equal(game.bags.length,1);assert.equal(game.effects[0].kind,'body');
  for(let i=0;i<100;i++)game.respawn(b);
  assert(!b.dead);assert.equal(b.health,100);assert.equal(b.weapon,1);assert.equal(b.ammo[1],30);
  assert.equal(b.ammo[6],0);assert.equal(b.weapons[6],false);
  assert(game.walkable(b.x,b.y,b.id));
});
test('repeated deaths do not grant rapid-fire weapons or increase the starting fire rate',()=>{
  const game=new Game(arena(),0,123),p=game.player;
  for(let life=0;life<5;life++){
    // Simulate dying while holding a collected beam with active cooldowns.
    p.weapon=6;p.weapons[6]=true;p.ammo[6]=10000;p.cooldowns.fill(20);
    game.damage(p,100,0,0,1);
    for(let i=0;i<100;i++)game.respawn(p);
    assert(!p.dead);assert.equal(p.weapon,1);
    assert.deepEqual(p.ammo,[0,30,0,0,0,0,0]);
    assert.deepEqual(p.weapons,[false,true,false,false,false,false,false]);
    assert(p.cooldowns.every(t=>t===0));
    // Isolate the new life from dropped-inventory pickups, then hold fire for a second.
    game.bags=[];
    for(let i=0;i<70;i++)game.step({fire:true,aimX:319,aimY:100});
    assert.equal(p.ammo[1],25,'sidearm fires five times in 70 ticks on every life');
  }
});
test('20-player original-level simulation stays bounded through combat and respawns',()=>{
  const game=new Game(assets.level,19,88);let deaths=0;
  for(let i=0;i<14000;i++){
    game.step({aimX:200,aimY:100,fire:true,forward:i%140<70,right:i%300<70});
    for(const a of game.actors){
      assert(Number.isFinite(a.x)&&Number.isFinite(a.y));
      assert(a.x>=0&&a.x+19<game.width&&a.y>=0&&a.y+19<game.height);
      if(!a.dead)assert(game.floor(round(a.x),round(a.y)));
      assert(a.ammo.every(n=>n>=0));
    }
    assert(game.camera.x>=0&&game.camera.x<=320&&game.camera.y>=0&&game.camera.y<=200);
    assert.equal(game.camera.x%4,0);assert.equal(game.camera.y%4,0);
  }
  deaths=game.actors.reduce((n,a)=>n+a.deaths,0);assert(deaths>10);
  assert(game.particles.length<=1400&&game.effects.length<=300&&game.rockets.length<=50&&game.bags.length<=50);
});
test('renderer draws original indexed sprites, recolors players and retains a 320x200 frame',()=>{
  const sandbox={MinkCore:require('../core.js')};sandbox.globalThis=sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../renderer.js'),'utf8'),sandbox);
  let image;
  const context={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:i=>{image=i;}};
  const renderer=new sandbox.MinkRenderer({getContext:()=>context},assets);
  assert.equal(renderer.palette.length,256);
  assert.deepEqual(Array.from(renderer.palette[1]),[0,0,170]);
  assert.deepEqual(Array.from(renderer.palette[32]),[0,0,255]);
  assert.deepEqual(Array.from(renderer.palette[248]),[0,0,0]);
  const game=new Game(assets.level,1,100);renderer.render(game);
  assert.equal(image.data.length,320*200*4);assert(image.data.some((v,i)=>i%4!==3&&v>0));
  assert.equal(renderer.world.length,640*400);
  for(let d=0;d<8;d++){const sprite=renderer.rotated('man1',d);assert.equal(sprite.pixels.length,400);assert(sprite.pixels.includes(255));}
});
