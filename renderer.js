(function(root) {
  'use strict';
  const {WIDTH,HEIGHT,round,clamp,TAU}=root.MinkCore;
  function defaultPalette() {
    const out=[];
    const add=(r,g,b)=>out.push([r,g,b]);
    for(let i=0;i<16;i++) {
      const low=i&8?21:0,high=i&8?63:42;
      add(i&4?high:low,i===6?21:(i&2?high:low),i&1?high:low);
    }
    for(const gray of [0,5,8,11,14,17,20,24,28,32,36,40,45,50,56,63])add(gray,gray,gray);
    // Standard BIOS mode 13h: nine 24-color rings, then eight black entries.
    for(const ramp of [[0,16,31,47,63],[31,39,47,55,63],[45,49,54,58,63],
      [0,7,14,21,28],[14,17,21,24,28],[20,22,24,26,28],
      [0,4,8,12,16],[8,10,12,14,16],[11,12,13,15,16]]) {
      let rgb=[ramp[0],ramp[0],ramp[4]];
      for(const channel of [0,2,1,0,2,1]) {
        const ascending=rgb[channel]===ramp[0];
        for(let i=0;i<4;i++) {
          rgb[channel]=ramp[ascending?i:4-i];add(...rgb);
        }
        rgb[channel]=ramp[ascending?4:0];
      }
    }
    while(out.length<256)add(0,0,0);
    return out.map(rgb=>rgb.map(v=>(v<<2)|(v>>4)));
  }
  // Small hand-defined bitmap alphabet, avoiding font smoothing in the viewport.
  const FONT={
    A:['010','101','111','101','101'],B:['110','101','110','101','110'],C:['011','100','100','100','011'],
    D:['110','101','101','101','110'],E:['111','100','110','100','111'],F:['111','100','110','100','100'],
    G:['011','100','101','101','011'],H:['101','101','111','101','101'],I:['111','010','010','010','111'],
    J:['001','001','001','101','010'],K:['101','101','110','101','101'],L:['100','100','100','100','111'],
    M:['10001','11011','10101','10001','10001'],N:['1001','1101','1011','1001','1001'],O:['010','101','101','101','010'],
    P:['110','101','110','100','100'],Q:['010','101','101','011','001'],R:['110','101','110','101','101'],
    S:['011','100','010','001','110'],T:['111','010','010','010','010'],U:['101','101','101','101','111'],
    V:['101','101','101','101','010'],W:['10101','10101','10101','10101','01010'],X:['101','101','010','101','101'],
    Y:['101','101','010','010','010'],Z:['111','001','010','100','111'],
    '0':['111','101','101','101','111'],'1':['010','110','010','010','111'],'2':['110','001','010','100','111'],
    '3':['110','001','010','001','110'],'4':['101','101','111','001','001'],'5':['111','100','110','001','110'],
    '6':['011','100','111','101','111'],'7':['111','001','010','010','010'],'8':['111','101','111','101','111'],
    '9':['111','101','111','001','110'],'.':['0','0','0','0','1'],'-':['000','000','111','000','000'],
    '+':['000','010','111','010','000'],':':['0','1','0','1','0'],'/':['001','001','010','100','100'],
    '>':['100','010','001','010','100'],' ':['00','00','00','00','00']
  };
  class Renderer {
    constructor(canvas,assets) {
      this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.ctx.imageSmoothingEnabled=false;
      this.assets=assets;this.palette=defaultPalette();this.frame=new Uint8Array(WIDTH*HEIGHT);
      this.image=this.ctx.createImageData(WIDTH,HEIGHT);this.cache=new Map();
      const level=assets.level;this.worldWidth=level.width*20;this.worldHeight=level.height*20;
      this.world=new Uint8Array(this.worldWidth*this.worldHeight);
      const under=assets.sprites['bg'+level.layers[1][0]];
      for(let ty=0;ty<level.height;ty++)for(let tx=0;tx<level.width;tx++) {
        const tile=assets.sprites['bg'+level.layers[0][ty*level.width+tx]];
        for(let y=0;y<20;y++)for(let x=0;x<20;x++) {
          const v=tile.pixels[y*20+x];
          this.world[(ty*20+y)*this.worldWidth+tx*20+x]=v===255?under.pixels[y*20+x]:v;
        }
      }
      for(let frame=1;frame<=4;frame++)for(let d=0;d<8;d++)this.rotated(`man${frame}`,d);
      for(let d=0;d<8;d++)this.rotated('rck1',d);
    }
    rotated(name,dir) {
      const key=name+':'+dir;
      if(this.cache.has(key))return this.cache.get(key);
      const source=this.assets.sprites[name];
      if(!dir){this.cache.set(key,source);return source;}
      const result={width:source.width,height:source.height,pixels:new Uint8Array(source.pixels.length).fill(255)};
      const center=source.width===20?10:4,a=dir*Math.PI/4,cos=Math.cos(a),sin=Math.sin(a);
      // Match createimages: forward map original pixels into eight discrete views.
      for(let x=1;x<=source.width;x++)for(let y=1;y<=source.height;y++) {
        const rx=round(center+(x-center)*cos-(y-center)*sin)-1;
        const ry=round(center+(x-center)*sin+(y-center)*cos)-1;
        if(rx>=0&&ry>=0&&rx<source.width&&ry<source.height)result.pixels[ry*source.width+rx]=source.pixels[(y-1)*source.width+x-1];
      }
      this.cache.set(key,result);return result;
    }
    sprite(name,x,y,color=0,rotation=null) {
      const sprite=rotation===null?this.assets.sprites[name]:this.rotated(name,rotation);
      if(!sprite)return;
      x=round(x);y=round(y);
      if(x+sprite.width<0||y+sprite.height<0||x>=WIDTH||y>=HEIGHT)return;
      for(let sy=Math.max(0,-y);sy<Math.min(sprite.height,HEIGHT-y);sy++) {
        for(let sx=Math.max(0,-x);sx<Math.min(sprite.width,WIDTH-x);sx++) {
          let c=sprite.pixels[sy*sprite.width+sx];
          if(c===255)continue;
          if(c===1&&color)c=color;
          this.frame[(sy+y)*WIDTH+sx+x]=c;
        }
      }
    }
    rect(x,y,w,h,color) {
      for(let j=Math.max(0,y);j<Math.min(HEIGHT,y+h);j++)this.frame.fill(color,j*WIDTH+Math.max(0,x),j*WIDTH+Math.min(WIDTH,x+w));
    }
    text(text,x,y,color=15,scale=1) {
      for(const char of text.toUpperCase()) {
        const glyph=FONT[char]||FONT[' '];
        for(let gy=0;gy<5;gy++)for(let gx=0;gx<glyph[gy].length;gx++)if(glyph[gy][gx]==='1')this.rect(x+gx*scale,y+gy*scale,scale,scale,color);
        x+=(glyph[0].length+1)*scale;
      }
    }
    number(value,x,y) {
      const digits=String(Math.floor(value));
      for(let i=0;i<digits.length;i++) {
        if(digits[i]==='-')this.rect(x+i*4,y+2,3,1,15);
        else this.sprite('n'+digits[i],x+i*4,y);
      }
    }
    render(game,{crosshair={x:160,y:100},hud=true}={}) {
      const cx=game.camera.x,cy=game.camera.y;
      for(let y=0;y<HEIGHT;y++) {
        const offset=(cy+y)*this.worldWidth+cx;
        this.frame.set(this.world.subarray(offset,offset+WIDTH),y*WIDTH);
      }
      const draw=(name,x,y,color=0,rot=null)=>this.sprite(name,x-cx,y-cy,color,rot);
      for(const p of game.pickups)if(!p.timer)draw('obj'+p.kind,p.x,p.y);
      for(const e of game.effects) {
        if(e.kind==='body')draw('bdy'+Math.min(6,1+Math.floor(e.age/7)),e.x,e.y,e.color);
        if(e.kind==='liquid')draw('lqd'+Math.min(9,1+Math.floor(e.age/7)),e.x,e.y);
      }
      for(const bag of game.bags)draw('bag1',bag.x,bag.y);
      for(const p of game.particles) {
        if(p.limb)draw('lmb'+p.kind,p.x,p.y);
        else {
          const x=round(p.x)-cx,y=round(p.y)-cy;
          if(x>=0&&y>=0&&x<WIDTH&&y<HEIGHT)this.frame[y*WIDTH+x]=this.assets.sprites['bld'+p.kind].pixels[0];
        }
      }
      for(const a of game.actors) {
        if(a.dead) {
          if(a.deathTicks>=50)draw('rel'+Math.min(5,1+Math.floor((a.deathTicks-50)/10)),a.x,a.y,a.id+1);
        } else draw('man'+a.frame,a.x,a.y,a.id+1,((round(a.dir/(TAU/8))%8)+8)%8);
      }
      for(const e of game.effects) {
        if(e.kind==='smoke')draw('smk'+Math.min(3,1+Math.floor(e.age/3)),e.x,e.y);
        if(e.kind==='explosion')draw('exp'+Math.min(3,1+Math.floor(e.age/10)),e.x,e.y);
      }
      for(const r of game.rockets)draw('rck1',r.x-4,r.y-4,0,((round(r.dir/(TAU/8))%8)+8)%8);
      if(hud) {
        // Original HUD positions: frags left, ammo center, health right.
        this.number(game.player.score,1,1);
        this.number(game.player.ammo[game.player.weapon],155,1);
        this.number(game.player.health,308,1);
        this.sprite(game.player.dead?'cross2':'cross1',clamp(round(crosshair.x),2,317)-2,clamp(round(crosshair.y),2,197)-2);
        if(game.player.dead) {
          this.rect(95,86,130,23,0);this.text('RESPAWNING',132,90,15);
          this.text((Math.max(0,100-game.player.deathTicks)/70).toFixed(1)+' SECONDS',137,100,7);
        }
        if(game.noticeTicks>0){this.rect(2,187,Math.min(240,game.notice.length*5+4),9,0);this.text(game.notice,4,189,15);}
      }
      this.present(game.flash);
    }
    present(flash=0) {
      const data=this.image.data,palette=this.palette;
      const mul=1+flash*3;
      for(let i=0;i<this.frame.length;i++) {
        const c=palette[this.frame[i]],n=i*4;
        data[n]=Math.min(255,c[0]*mul);data[n+1]=c[1]/mul;data[n+2]=c[2]/mul;data[n+3]=255;
      }
      this.ctx.putImageData(this.image,0,0);
    }
  }
  root.MinkRenderer=Renderer;
})(globalThis);
