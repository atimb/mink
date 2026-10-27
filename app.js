(function(){
  'use strict';
  const {Game,WEAPONS,HZ,clamp}=MinkCore;
  const $=id=>document.getElementById(id);
  const canvas=$('game'),renderer=new MinkRenderer(canvas,MinkAssets);
  let game=new Game(MinkAssets.level,10,101),state='ready',accumulator=0,last=0,uiTick=-1;
  const keys=new Set(),mouse={x:160,y:100,down:false,inside:false};
  const buttons=[];
  for(let w=1;w<=6;w++){
    const button=document.createElement('button');button.className='weapon unowned';
    button.innerHTML=`<span class="slot">${w}</span><span><span class="name">${WEAPONS[w].name}</span><span class="ammo">—</span></span>`;
    button.title=`${w} / ${WEAPONS[w].name}`;
    button.addEventListener('click',()=>{if(state==='playing'){game.switchWeapon(game.player,w);updateUI(true);canvas.focus({preventScroll:true});}});
    $('weapons').append(button);buttons[w]=button;
  }
  function resize(){
    const fullscreen=!!document.fullscreenElement;
    const chrome=['.frame-label','.weapon-bar','.console-line',...(fullscreen?[]:['.masthead','footer'])]
      .reduce((height,selector)=>height+document.querySelector(selector).offsetHeight,0);
    const availableW=innerWidth-(fullscreen?0:32),availableH=innerHeight-chrome-(fullscreen?16:32);
    const scale=Math.max(1,Math.floor(Math.min(availableW/320,availableH/200)));
    document.documentElement.style.setProperty('--scale',scale);
    $('stage').classList.toggle('compact',scale<=2);
  }
  addEventListener('resize',resize);document.addEventListener('fullscreenchange',resize);resize();
  function clearInput(){keys.clear();mouse.down=false;$('scoreboard').hidden=true;}
  function start(){
    const bots=clamp(Number($('bots').value)||10,1,19);
    game=new Game(MinkAssets.level,bots);state='playing';accumulator=0;clearInput();
    $('overlay').hidden=true;$('pause').disabled=false;document.body.classList.add('playing');
    canvas.focus({preventScroll:true});updateUI(true);
  }
  function pause(){
    if(state!=='playing')return;
    state='paused';clearInput();document.body.classList.remove('playing');
    $('overlay').hidden=false;$('menu-title').innerHTML='TAKE A<br>BREATHER<span>.</span>';
    document.querySelector('.menu-copy').textContent='The arena will wait.';
    $('start-form').hidden=true;$('resume').hidden=false;$('new-match').hidden=false;
    $('status').textContent='PAUSED';$('pause').textContent='RESUME →';$('resume').focus({preventScroll:true});
  }
  function resume(){
    if(state!=='paused')return;
    state='playing';clearInput();accumulator=0;$('overlay').hidden=true;document.body.classList.add('playing');
    $('pause').textContent='PAUSE Ⅱ';canvas.focus({preventScroll:true});updateUI(true);
  }
  $('bots').addEventListener('input',()=>{$('bot-value').value=$('bots').value+' BOTS';$('readout').textContent=`ORIGINAL LEVEL 01 / ${$('bots').value} BOTS`;});
  $('start-form').addEventListener('submit',event=>{event.preventDefault();start();});
  $('resume').addEventListener('click',resume);
  $('new-match').addEventListener('click',()=>{
    state='ready';$('resume').hidden=true;$('new-match').hidden=true;$('start-form').hidden=false;
    $('menu-title').innerHTML='BACK IN<br>THE ARENA<span>.</span>';
    document.querySelector('.menu-copy').innerHTML='Same pixels. Same battleground.<br>One more round.';
    $('pause').disabled=true;$('pause').textContent='PAUSE Ⅱ';$('status').textContent='READY TO PLAY';
    $('bots').focus({preventScroll:true});
  });
  $('pause').addEventListener('click',()=>state==='playing'?pause():resume());
  async function fullscreen(){
    try{if(document.fullscreenElement)await document.exitFullscreen();else await $('cabinet').requestFullscreen();}
    catch(error){$('status').textContent='USE BROWSER FULLSCREEN';}
  }
  $('fullscreen').addEventListener('click',fullscreen);
  function pointer(e){
    const rect=canvas.getBoundingClientRect();
    mouse.x=clamp((e.clientX-rect.left)/rect.width*320,2,317);
    mouse.y=clamp((e.clientY-rect.top)/rect.height*200,2,197);
  }
  canvas.addEventListener('pointermove',e=>{pointer(e);mouse.inside=true;});
  canvas.addEventListener('pointerdown',e=>{
    if(state!=='playing'||e.button!==0)return;
    e.preventDefault();pointer(e);mouse.down=true;mouse.inside=true;
    canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});
  });
  canvas.addEventListener('pointerup',()=>{mouse.down=false;});
  canvas.addEventListener('pointercancel',()=>{mouse.down=false;});
  canvas.addEventListener('lostpointercapture',()=>{mouse.down=false;});
  canvas.addEventListener('pointerleave',e=>{mouse.inside=false;if(!canvas.hasPointerCapture(e.pointerId))mouse.down=false;});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  addEventListener('pointerup',()=>{mouse.down=false;});
  addEventListener('keydown',e=>{
    const editing=e.target instanceof HTMLInputElement;
    if(e.code==='Escape'){if(state==='playing')pause();else if(state==='paused')resume();return;}
    if(e.code==='KeyF'&&!editing){e.preventDefault();if(!e.repeat)fullscreen();return;}
    if(state!=='playing')return;
    if(['KeyW','KeyA','KeyS','KeyD','Tab','Space','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6'].includes(e.code))e.preventDefault();
    keys.add(e.code);
    if(/^Digit[1-6]$/.test(e.code))game.switchWeapon(game.player,Number(e.code.slice(-1)));
    if(e.code==='Tab'){$('scoreboard').hidden=false;updateScores();}
  });
  addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='Tab'){$('scoreboard').hidden=true;e.preventDefault();}});
  addEventListener('blur',()=>{clearInput();pause();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();pause();}});
  function updateScores(){
    const rows=$('score-rows');rows.replaceChildren();
    for(const a of [...game.actors].sort((a,b)=>b.score-a.score)){
      const row=document.createElement('div');row.className='score-row'+(a.id===0?' self':'');
      const rgb=renderer.palette[a.id+1];
      row.innerHTML=`<span><i class="swatch" style="background:rgb(${rgb.join(',')})"></i>${a.id===0?'YOU':`BOT ${String(a.id).padStart(2,'0')}`}</span><span>${a.kills}</span><span>${a.deaths}</span><span>${a.score}</span>`;
      rows.append(row);
    }
  }
  function updateUI(force=false){
    if(!force&&game.tick-uiTick<7)return;uiTick=game.tick;
    const p=game.player;
    $('status').textContent=state==='playing'?(p.dead?'RESPAWNING':'MATCH IN PROGRESS'):state==='paused'?'PAUSED':'READY TO PLAY';
    if(state==='playing')$('readout').textContent=`${WEAPONS[p.weapon].name} / ${game.actors.length-1} BOTS / ${Math.floor(game.tick/HZ/60).toString().padStart(2,'0')}:${Math.floor(game.tick/HZ%60).toString().padStart(2,'0')}`;
    for(let w=1;w<=6;w++){
      buttons[w].classList.toggle('unowned',!p.weapons[w]);buttons[w].classList.toggle('selected',p.weapon===w);
      buttons[w].setAttribute('aria-pressed',String(p.weapon===w));
      buttons[w].setAttribute('aria-label',`${w}: ${WEAPONS[w].name}, ${p.weapons[w]?p.ammo[w]+' ammo':'not collected'}`);
      buttons[w].querySelector('.ammo').textContent=p.weapons[w]?p.ammo[w]+' RDS':'—';
    }
    if(!$('scoreboard').hidden)updateScores();
  }
  function frame(now){
    const elapsed=Math.min(100,now-last||0);last=now;
    if(state==='playing'){
      accumulator+=elapsed;
      while(accumulator>=1000/HZ){
        game.step({aimX:mouse.x,aimY:mouse.y,forward:keys.has('KeyW'),back:keys.has('KeyS'),left:keys.has('KeyA'),right:keys.has('KeyD'),fire:mouse.down});
        accumulator-=1000/HZ;
      }
      updateUI();
    }
    renderer.render(game,{crosshair:mouse,hud:state!=='ready'});
    requestAnimationFrame(frame);
  }
  updateUI(true);requestAnimationFrame(frame);
  // Read-only snapshot for troubleshooting; no gameplay/debug controls exposed.
  window.minkSnapshot=()=>({state,tick:game.tick,viewport:{width:canvas.width,height:canvas.height},
    camera:{x:game.camera.x,y:game.camera.y},player:{x:game.player.x,y:game.player.y,health:game.player.health,weapon:game.player.weapon,score:game.player.score},
    bots:game.actors.length-1,rockets:game.rockets.length,effects:game.effects.length});
})();
