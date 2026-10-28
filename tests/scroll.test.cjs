const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Camera}=require('../core.js');
test('smooth camera follows immediately in single-pixel increments, without a dead zone',()=>{
  const camera=new Camera(640,400);camera.setSmooth(true,{x:150,y:90});
  assert.deepEqual([camera.x,camera.y],[0,0]);
  for(let i=1;i<=60;i++){
    camera.update({x:150+i,y:90+i});
    assert.deepEqual([camera.x,camera.y],[i,i]);
    assert.deepEqual([camera.dx,camera.dy],[0,0]);
  }
  camera.update({x:209,y:149});assert.deepEqual([camera.x,camera.y],[59,59]);
});
test('smooth camera respects map edges, fractional motion, mobile sizes and respawn jumps',()=>{
  const camera=new Camera(640,400);camera.setSmooth(true,{x:320.25,y:200.25});
  assert.deepEqual([camera.x,camera.y],[170,110]);
  camera.update({x:620,y:380});assert.deepEqual([camera.x,camera.y],[320,200]);
  camera.update({x:20,y:20});assert.deepEqual([camera.x,camera.y],[0,0]);
  camera.setViewport(180,390,{x:320,y:200});assert.deepEqual([camera.x,camera.y],[240,10]);
  camera.update({x:20,y:20});assert.deepEqual([camera.x,camera.y],[0,0]);
});
test('classic mode still uses the original four-pixel scrolling and dead zone',()=>{
  const camera=new Camera(640,400);camera.setSmooth(false,{x:150,y:90});
  camera.update({x:160,y:100});assert.deepEqual([camera.x,camera.y],[0,0]);
  camera.update({x:300,y:250});assert.deepEqual([camera.x,camera.y],[4,4]);
});
