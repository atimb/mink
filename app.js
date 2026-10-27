(function(){
  'use strict';
  const {Game,WEAPONS,HZ,clamp}=MinkCore;
  const $=id=>document.getElementById(id);
  const mobile=matchMedia('(hover: none) and (pointer: coarse)').matches||new URLSearchParams(location.search).get('controls')==='touch';
  document.documentElement.classList.toggle('mobile',mobile);
  $('touch-controls').hidden=!mobile;
  const canvas=$('game'),renderer=new MinkRenderer(canvas,MinkAssets);
  let game=new Game(MinkAssets.level,10,101),state='ready',accumulator=0,last=0,uiTick=-1;
  const keys=new Set(),mouse={x:160,y:100,down:false,inside:false};
  const sticks={move:{id:null,x:0,y:0,element:$('move-stick')},fire:{id:null,x:0,y:0,element:$('fire-stick')}};
  let fullscreenAttempted=false;
  const buttons=[];
  for(let w=1;w<=6;w++){
    const button=document.createElement('button');button.className='weapon unowned';
    button.innerHTML=`<span class="slot">${w}</span><span><span class="name">${WEAPONS[w].name}</span><span class="ammo">—</span></span>`;
    button.title=`${w} / ${WEAPONS[w].name}`;
    button.addEventListener('click',()=>{if(state==='playing'){game.switchWeapon(game.player,w);updateUI(true);canvas.focus({preventScroll:true});}});
    $('weapons').append(button);buttons[w]=button;
  }
  function resize(){
    if(mobile){
      const width=window.visualViewport?.width||innerWidth,height=window.visualViewport?.height||innerHeight;
      document.documentElement.style.setProperty('--touch-width',width+'px');
      document.documentElement.style.setProperty('--touch-height',height+'px');
      const view=MinkTouch.viewport(width,height,game.width,game.height);
      if(game.camera.viewWidth!==view.width||game.camera.viewHeight!==view.height){
        clearInput();renderer.resize(view.width,view.height);
        game.camera.setViewport(view.width,view.height,game.player);
      }
      return;
    }
    const fullscreen=!!document.fullscreenElement;
    const chrome=['.frame-label','.weapon-bar','.console-line',...(fullscreen?[]:['.masthead','footer'])]
      .reduce((height,selector)=>height+document.querySelector(selector).offsetHeight,0);
    const availableW=innerWidth-(fullscreen?0:32),availableH=innerHeight-chrome-(fullscreen?16:32);
    const scale=Math.max(1,Math.floor(Math.min(availableW/320,availableH/200)));
    document.documentElement.style.setProperty('--scale',scale);
    $('stage').classList.toggle('compact',scale<=2);
  }
  addEventListener('resize',resize);document.addEventListener('fullscreenchange',resize);resize();
  window.visualViewport?.addEventListener('resize',()=>{if(mobile)resize();});
  function resetStick(stick){
    const id=stick.id;stick.id=null;stick.x=stick.y=0;
    stick.element.classList.remove('active');stick.element.querySelector('.stick-knob').style.transform='translate(0px,0px)';
    if(id!==null&&stick.element.hasPointerCapture(id))stick.element.releasePointerCapture(id);
  }
  function clearInput(){keys.clear();mouse.down=false;$('scoreboard').hidden=true;if(mobile)Object.values(sticks).forEach(resetStick);}
  function start(){
    const bots=mobile?10:clamp(Number($('bots').value)||10,1,19);
    game=new Game(MinkAssets.level,bots);state='playing';accumulator=0;clearInput();
    $('overlay').hidden=true;$('pause').disabled=false;document.body.classList.add('playing');
    if(mobile)resize();else canvas.focus({preventScroll:true});updateUI(true);
  }
  function pause(){
    if(state!=='playing')return;
    if(mobile){state='paused';clearInput();accumulator=0;return;}
    state='paused';clearInput();document.body.classList.remove('playing');
    $('overlay').hidden=false;$('menu-title').innerHTML='TAKE A<br>BREATHER<span>.</span>';
    document.querySelector('.menu-copy').textContent='The arena will wait.';
    $('start-form').hidden=true;$('resume').hidden=false;$('new-match').hidden=false;
    $('status').textContent='PAUSED';$('pause').textContent='RESUME →';$('resume').focus({preventScroll:true});
  }
  function resume(){
    if(state!=='paused')return;
    if(mobile){state='playing';clearInput();accumulator=0;updateUI(true);return;}
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
    try{if(document.fullscreenElement)await document.exitFullscreen();else await (mobile?document.documentElement:$('cabinet')).requestFullscreen();}
    catch(error){$('status').textContent='USE BROWSER FULLSCREEN';}
  }
  $('fullscreen').addEventListener('click',fullscreen);
  function pointer(e){
    const rect=canvas.getBoundingClientRect();
    mouse.x=clamp((e.clientX-rect.left)/rect.width*320,2,317);
    mouse.y=clamp((e.clientY-rect.top)/rect.height*200,2,197);
  }
  canvas.addEventListener('pointermove',e=>{if(mobile)return;pointer(e);mouse.inside=true;});
  canvas.addEventListener('pointerdown',e=>{
    if(mobile||state!=='playing'||e.button!==0)return;
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
    if(e.code==='Escape'){if(mobile)return;if(state==='playing')pause();else if(state==='paused')resume();return;}
    if(e.code==='KeyF'&&!editing){e.preventDefault();if(!e.repeat)fullscreen();return;}
    if(state!=='playing')return;
    if(['KeyW','KeyA','KeyS','KeyD','Tab','Space','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6'].includes(e.code))e.preventDefault();
    keys.add(e.code);
    if(/^Digit[1-6]$/.test(e.code))game.switchWeapon(game.player,Number(e.code.slice(-1)));
    if(e.code==='Tab'){$('scoreboard').hidden=false;updateScores();}
  });
  addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='Tab'){$('scoreboard').hidden=true;e.preventDefault();}});
  addEventListener('blur',()=>{clearInput();pause();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();pause();}else if(mobile)resume();});
  addEventListener('focus',()=>{if(mobile&&!document.hidden)resume();});
  if(mobile){
    for(const stick of Object.values(sticks)){
      const update=e=>{
        const rect=stick.element.getBoundingClientRect();
        const value=MinkTouch.stick(e.clientX-rect.left-rect.width/2,e.clientY-rect.top-rect.height/2,rect.width*0.32);
        stick.x=value.x;stick.y=value.y;
        stick.element.querySelector('.stick-knob').style.transform=`translate(${value.knobX}px,${value.knobY}px)`;
      };
      stick.element.addEventListener('pointerdown',e=>{
        if(state!=='playing'||stick.id!==null)return;
        e.preventDefault();stick.id=e.pointerId;stick.element.setPointerCapture(e.pointerId);
        stick.element.classList.add('active');update(e);
      });
      stick.element.addEventListener('pointermove',e=>{if(stick.id===e.pointerId){e.preventDefault();update(e);}});
      for(const event of ['pointerup','pointercancel','lostpointercapture']){
        stick.element.addEventListener(event,e=>{if(stick.id===e.pointerId)resetStick(stick);});
      }
    }
    $('touch-weapon').addEventListener('click',()=>{
      const p=game.player,owned=[1,2,3,4,5,6].filter(w=>p.weapons[w]&&p.ammo[w]>0);
      if(owned.length)game.switchWeapon(p,owned[(owned.indexOf(p.weapon)+1)%owned.length]);
      updateUI(true);
    });
    // Touch activation is granted on release. Fullscreen is best-effort and never gates play.
    $('touch-controls').addEventListener('pointerup',e=>{
      if(e.pointerType!=='touch'||fullscreenAttempted||document.fullscreenElement||!document.fullscreenEnabled)return;
      fullscreenAttempted=true;
      document.documentElement.requestFullscreen({navigationUI:'hide'}).catch(()=>{});
    });
    canvas.setAttribute('aria-label','Mink arena. Left joystick moves; right joystick aims and fires. Tap the weapon display to switch weapons.');
  }
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
    if(mobile){
      $('touch-health').textContent=p.dead?'0':p.health;
      $('touch-score').textContent=p.score;
      $('touch-weapon-name').textContent=WEAPONS[p.weapon].name;
      $('touch-ammo').textContent=p.ammo[p.weapon]+' RDS';
      $('touch-weapon').setAttribute('aria-label',`${WEAPONS[p.weapon].name}, ${p.ammo[p.weapon]} ammo. Tap to switch weapon.`);
    }
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
        game.step(mobile?MinkTouch.input(sticks.move,sticks.fire,sticks.fire.id!==null,game.player.dir):
          {aimX:mouse.x,aimY:mouse.y,forward:keys.has('KeyW'),back:keys.has('KeyS'),left:keys.has('KeyA'),right:keys.has('KeyD'),fire:mouse.down});
        accumulator-=1000/HZ;
      }
      updateUI();
    }
    const crosshair=mobile?{x:game.player.x+10.5-game.camera.x+Math.sin(game.player.dir)*42,
      y:game.player.y+10.5-game.camera.y-Math.cos(game.player.dir)*42}:mouse;
    renderer.render(game,{crosshair,hud:state!=='ready',mobile});
    requestAnimationFrame(frame);
  }
  if(mobile)start();else updateUI(true);
  requestAnimationFrame(frame);
  // Read-only snapshot for troubleshooting; no gameplay/debug controls exposed.
  window.minkSnapshot=()=>({state,mobile,tick:game.tick,viewport:{width:canvas.width,height:canvas.height},
    camera:{x:game.camera.x,y:game.camera.y},player:{x:game.player.x,y:game.player.y,health:game.player.health,weapon:game.player.weapon,score:game.player.score},
    bots:game.actors.length-1,rockets:game.rockets.length,effects:game.effects.length});
})();
