/* Mink single-player simulation. Coordinates and timers retain Pascal units.
   Browser-independent so gameplay can be checked using Node's built-in tests. */
(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.MinkCore = factory();
})(globalThis, function() {
  'use strict';
  const WIDTH=320, HEIGHT=200, TILE=20, HZ=70, TAU=Math.PI*2;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const direction=(a,b)=>Math.atan2(b.x-a.x, a.y-b.y);
  const vector=a=>({x:Math.sin(a),y:-Math.cos(a)});
  // Pascal Round uses ties-to-even, unlike JavaScript Math.round.
  function round(n) {const f=Math.floor(n);return n-f===0.5 ? (f%2===0?f:f+1) : Math.round(n);}
  const WEAPONS=[null,
    {name:'SIDEARM',delay:15,damage:5,pellets:1,spread:0.05},
    {name:'RIFLE',delay:10,damage:4,pellets:1,spread:0.10},
    {name:'AUTO',delay:3,damage:3,pellets:1,spread:0.20},
    {name:'ROCKET',delay:50,damage:250,pellets:1,spread:0},
    {name:'SCATTER',delay:50,damage:7,pellets:10,spread:0.50},
    {name:'BEAM',delay:2,damage:7,pellets:20,spread:0}
  ];
  class Camera {
    constructor(w,h) {this.width=w;this.height=h;this.viewWidth=WIDTH;this.viewHeight=HEIGHT;this.x=0;this.y=0;this.dx=0;this.dy=0;}
    setViewport(width,height,p) {
      this.viewWidth=clamp(Math.round(width),1,this.width);
      this.viewHeight=clamp(Math.round(height),1,this.height);
      this.center(p);
    }
    update(p) {
      const tx=round((round(p.x)-(this.viewWidth/2-10))/4)*4, ty=round((round(p.y)-(this.viewHeight/2-10))/4)*4;
      if(tx>this.x+28)this.dx=1;
      if(tx<this.x-28)this.dx=-1;
      if(ty>this.y+20)this.dy=1;
      if(ty<this.y-20)this.dy=-1;
      if(this.dx) {
        this.x+=4*this.dx;
        if((this.dx===1&&this.x>tx+12)||(this.dx===-1&&this.x<tx-12))this.dx=0;
      }
      if(this.dy) {
        this.y+=4*this.dy;
        if((this.dy===1&&this.y>ty+8)||(this.dy===-1&&this.y<ty-8))this.dy=0;
      }
      const x=clamp(this.x,0,Math.max(0,this.width-this.viewWidth));
      const y=clamp(this.y,0,Math.max(0,this.height-this.viewHeight));
      if(x!==this.x)this.dx=0;
      if(y!==this.y)this.dy=0;
      this.x=x;this.y=y;
    }
    center(p) {
      this.x=clamp(round((p.x-(this.viewWidth/2-10))/4)*4,0,Math.max(0,this.width-this.viewWidth));
      this.y=clamp(round((p.y-(this.viewHeight/2-10))/4)*4,0,Math.max(0,this.height-this.viewHeight));
      this.dx=this.dy=0;
    }
  }
  class Game {
    constructor(level, botCount=10, seed=Date.now()) {
      this.level=level;this.width=level.width*TILE;this.height=level.height*TILE;
      this.camera=new Camera(this.width,this.height);
      this.seed=seed>>>0;this.tick=0;this.flash=0;this.notice='';this.noticeTicks=0;
      this.actors=[];this.pickups=[];this.rockets=[];this.effects=[];this.particles=[];this.bags=[];this.events=[];
      this.spawnCells=[];
      for(let y=0;y<level.height;y++)for(let x=0;x<level.width;x++) {
        if(level.layers[0][y*level.width+x]===1)this.spawnCells.push({x:x*TILE,y:y*TILE});
        const kind=level.layers[2][y*level.width+x];
        if(kind)this.pickups.push({x:x*TILE,y:y*TILE,kind,timer:0});
      }
      if(!this.spawnCells.length)throw Error('Level has no walkable tiles');
      for(let i=0;i<=clamp(Math.floor(botCount),0,19);i++) {
        const actor={id:i,x:0,y:0,dir:0,health:100,score:0,kills:0,deaths:0,dead:false,
          deathTicks:0,walk:0,frame:1,weapon:1,ammo:[0,30,0,0,0,0,0],
          weapons:[false,true,false,false,false,false,false],cooldowns:Array(7).fill(0)};
        this.spawn(actor);this.actors.push(actor);
      }
      this.player=this.actors[0];this.camera.center(this.player);
    }
    random(n=1) { // Stable PRNG for repeatable simulation checks.
      this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;
      return this.seed/4294967296*n;
    }
    tile(x,y) {
      const tx=Math.floor(x/TILE),ty=Math.floor(y/TILE);
      return tx<0||ty<0||tx>=this.level.width||ty>=this.level.height?0:this.level.layers[0][ty*this.level.width+tx];
    }
    floor(x,y) {return this.tile(x,y)===1;}
    walkable(x,y,ignore=-1) {
      if(![[x,y],[x+19,y],[x,y+19],[x+19,y+19]].every(([px,py])=>this.floor(round(px),round(py))))return false;
      return !this.actors.some(a=>a.id!==ignore&&!a.dead&&x<a.x+20&&x+20>a.x&&y<a.y+20&&y+20>a.y);
    }
    spawn(a) {
      const start=Math.floor(this.random(this.spawnCells.length));
      for(let i=0;i<this.spawnCells.length;i++) {
        const p=this.spawnCells[(start+i)%this.spawnCells.length];
        if(this.walkable(p.x,p.y,a.id)) {a.x=p.x;a.y=p.y;return true;}
      }
      return false; // Never loop forever if a custom level is overcrowded.
    }
    bestWeapon(a) {
      let best=0;
      for(let w=1;w<=6;w++)if(a.weapons[w]&&a.ammo[w]>0)best=w;
      return best||a.weapon;
    }
    switchWeapon(a,w) {if(w>=1&&w<=6&&a.weapons[w]&&a.ammo[w]>0)a.weapon=w;}
    move(a,dx,dy) {
      if(this.walkable(a.x+dx,a.y,a.id))a.x+=dx;
      if(this.walkable(a.x,a.y+dy,a.id))a.y+=dy;
    }
    message(text) {this.notice=text;this.noticeTicks=140;}
    effect(kind,x,y,extra={}) {
      this.effects.push({kind,x,y,age:0,...extra});
      if(this.effects.length>300)this.effects.shift();
    }
    bleed(a,dir,count=3,power=5,limbs=false) {
      for(let i=0;i<count;i++) {
        const angle=dir+this.random(1)-0.5;
        const speed=power+(limbs?this.random(3):0);
        this.particles.push({x:a.x+10.5,y:a.y+10.5,dir:angle,speed,
          decay:Math.max(0.1,power/10),age:0,kind:1+Math.floor(this.random(3)),limb:limbs});
      }
      if(this.particles.length>1400)this.particles.splice(0,this.particles.length-1400);
    }
    damage(victim,amount,shooter,dir,kind=1,power=0.5) {
      if(victim.dead||amount<=0)return;
      victim.health=Math.max(0,victim.health-amount);
      if(victim.id===0)this.flash=Math.max(this.flash,Math.min(0.6,amount/100));
      if(victim.health>0) {this.bleed(victim,dir,3,power*10);return;}
      victim.dead=true;victim.deathTicks=0;victim.deaths++;victim.score--;
      const attacker=this.actors[shooter];
      if(attacker){attacker.score++;attacker.kills++;if(shooter===victim.id)victim.score--;}
      this.bags.push({x:victim.x,y:victim.y,age:0,ammo:[...victim.ammo],weapons:[...victim.weapons]});
      if(this.bags.length>50)this.bags.shift();
      if([4,5,6].includes(kind)) {
        this.bleed(victim,dir,10,power*10,true);
        if(kind===4)this.effect('liquid',round(victim.x)+3,round(victim.y)+3);
      } else this.effect('body',round(victim.x)+3,round(victim.y)+3,{color:victim.id+1});
      const label=id=>id===0?'YOU':`BOT ${String(id).padStart(2,'0')}`;
      this.events.unshift({text:shooter===victim.id?`${label(victim.id)} / SELF DESTRUCT`:`${label(shooter)} > ${label(victim.id)}`,tick:this.tick});
      this.events.length=Math.min(this.events.length,4);
    }
    trace(x,y,dir,ignore) {
      const v=vector(dir),max=Math.ceil(Math.hypot(this.width,this.height)/5)+10;
      // The original bullets are invisible hitscan rays, sampled in five-pixel steps.
      for(let i=0;i<max;i++) {
        if(!this.floor(round(x),round(y)))return {x,y,actor:null};
        const actor=this.actors.find(a=>a.id!==ignore&&!a.dead&&round(x)>=a.x&&round(x)<=a.x+19&&round(y)>=a.y&&round(y)<=a.y+19);
        if(actor)return{x,y,actor};
        x+=v.x*5;y+=v.y*5;
      }
      return{x,y,actor:null};
    }
    fire(a) {
      const w=a.weapon,spec=WEAPONS[w];
      if(a.dead||a.cooldowns[w]>0||!a.weapons[w]||a.ammo[w]<=0)return false;
      if(w===4&&this.rockets.length>=50)return false;
      const v=vector(a.dir);
      a.ammo[w]--;a.cooldowns[w]=spec.delay;
      if(w===4)this.rockets.push({x:a.x+10.5+v.x*15,y:a.y+10.5+v.y*15,dir:a.dir,shooter:a.id,age:0});
      else for(let i=0;i<spec.pellets;i++) {
        const dir=a.dir+(spec.spread?(Math.floor(this.random(10))/10-0.5)*spec.spread:0);
        const hit=this.trace(a.x+10.5+v.x*10-4,a.y+10.5+v.y*10-4,dir,a.id);
        if(hit.actor) {
          const power=w===5||w===6?Math.max(1,100-distance(a,hit.actor))/(w===6?50:100):0.5;
          this.damage(hit.actor,spec.damage,a.id,dir,w,power);
        } else this.effect('smoke',round(hit.x)-3,round(hit.y)-3);
      }
      if(a.ammo[w]===0)a.weapon=this.bestWeapon(a);
      return true;
    }
    explode(r) {
      this.effect('explosion',round(r.x)-4,round(r.y)-4);
      for(const a of this.actors)if(!a.dead) {
        const center={x:a.x+10.5,y:a.y+10.5},d=distance(center,r);
        if(d<=40)this.damage(a,round((40-d)/40*250),r.shooter,direction(r,center),4,(40-d)/40);
      }
    }
    updateRockets() {
      const alive=[];
      for(const r of this.rockets) {
        r.age++;
        const hit=!this.floor(round(r.x),round(r.y))||this.actors.some(a=>!a.dead&&r.x>=a.x&&r.x<=a.x+19&&r.y>=a.y&&r.y<=a.y+19);
        if(hit||r.age>1400){this.explode(r);continue;}
        const v=vector(r.dir);r.x+=v.x*1.5;r.y+=v.y*1.5;
        if(r.age%3===0)this.effect('smoke',round(r.x-v.x*4)-3,round(r.y-v.y*4)-3);
        alive.push(r);
      }
      this.rockets=alive;
    }
    collect(a) {
      for(const item of this.pickups)if(!item.timer&&Math.abs(a.x-item.x)<10&&Math.abs(a.y-item.y)<10) {
        item.timer=1000;
        if(item.kind===1) {a.health=Math.min(100,a.health+50);if(a.id===0)this.message('+50 HEALTH');}
        else {
          const w=item.kind-1,amount=[0,20,50,150,10,10,1000][w];
          a.weapons[w]=true;a.ammo[w]+=amount;
          if(a.weapon<w)a.weapon=w;
          if(a.id===0)this.message(`${WEAPONS[w].name} +${amount}`);
        }
      }
      for(let i=this.bags.length-1;i>=0;i--) {
        const bag=this.bags[i];
        if(Math.abs(a.x-bag.x)<10&&Math.abs(a.y-bag.y)<10) {
          for(let w=1;w<=6;w++){a.ammo[w]+=bag.ammo[w];a.weapons[w] ||= bag.weapons[w];}
          a.weapon=this.bestWeapon(a);this.bags.splice(i,1);
          if(a.id===0)this.message('WEAPONS RECOVERED');
        }
      }
    }
    respawn(a) {
      a.deathTicks++;
      if(a.deathTicks===50&&!this.spawn(a)){a.deathTicks=49;return;}
      if(a.deathTicks>=100) {
        if(!this.walkable(a.x,a.y,a.id)&&!this.spawn(a)){a.deathTicks=99;return;}
        // Use the same loadout as the initial spawn. The Pascal respawn code
        // granted slot 6 with 10,000 rounds, escalating every death into a beam fight.
        a.dead=false;a.health=100;a.weapon=1;a.frame=1;a.walk=0;
        a.weapons=[false,true,false,false,false,false,false];a.ammo=[0,30,0,0,0,0,0];a.cooldowns.fill(0);
      }
    }
    step(input={}) {
      this.tick++;this.flash=Math.max(0,this.flash-0.01);this.noticeTicks=Math.max(0,this.noticeTicks-1);
      for(const item of this.pickups)if(item.timer>0)item.timer--;
      for(const a of this.actors) {
        if(a.dead){this.respawn(a);continue;}
        for(let w=1;w<=6;w++)if(a.cooldowns[w]>0)a.cooldowns[w]--;
        let forward=0,strafe=0,trigger=false;
        const touchMovement=a.id===0&&Number.isFinite(input.moveX)&&Number.isFinite(input.moveY);
        if(a.id===0) {
          if(Number.isFinite(input.aimDir))a.dir=input.aimDir;
          else if(Number.isFinite(input.aimX)&&Number.isFinite(input.aimY))a.dir=direction({x:a.x+10.5,y:a.y+10.5},{x:input.aimX+this.camera.x,y:input.aimY+this.camera.y});
          forward=(input.forward?1:0)-(input.back?1:0);strafe=(input.right?1:0)-(input.left?1:0);
          if(input.weapon)this.switchWeapon(a,input.weapon);
          trigger=!!input.fire;
        } else {
          // Original AI: move forward, fire continuously, periodically aim at nearest opponent.
          if(Math.floor(this.random(20))===0) {
            const targets=this.actors.filter(t=>t.id!==a.id&&!t.dead).sort((b,c)=>distance(a,b)-distance(a,c));
            if(targets[0])a.dir=direction(a,targets[0]);
          }
          forward=1;trigger=true;
        }
        const v=vector(a.dir);
        if(forward||strafe||(touchMovement&&(input.moveX||input.moveY))) {
          if(touchMovement) {
            const length=Math.max(1,Math.hypot(input.moveX,input.moveY));
            this.move(a,input.moveX/length,input.moveY/length);
          } else {
            this.move(a,v.x*forward,v.y*forward);
            this.move(a,Math.cos(a.dir)*strafe,Math.sin(a.dir)*strafe);
          }
          if(++a.walk>10){a.walk=0;a.frame=(a.frame-1+(forward<0?-1:1)+4)%4+1;}
        }
        this.collect(a);
        if(trigger)this.fire(a);
      }
      this.updateRockets();
      for(const e of this.effects)e.age++;
      this.effects=this.effects.filter(e=>e.age<({smoke:9,explosion:30,body:535,liquid:556}[e.kind]||30));
      for(const p of this.particles) {
        p.age++;p.speed=Math.max(0,p.speed-p.decay);
        const v=vector(p.dir),x=p.x+v.x*p.speed,y=p.y+v.y*p.speed;
        if(this.floor(x,y)){p.x=x;p.y=y;}else p.speed=0;
      }
      this.particles=this.particles.filter(p=>p.age<(p.limb?530:320));
      for(const bag of this.bags)bag.age++;
      this.bags=this.bags.filter(b=>b.age<7000);
      this.camera.update(this.player);
    }
  }
  return {Game,Camera,WEAPONS,WIDTH,HEIGHT,TILE,HZ,TAU,clamp,round,vector,direction};
});
