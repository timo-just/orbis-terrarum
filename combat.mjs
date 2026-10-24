export function makeBattle(action,before,after,world,now=performance.now()){
 const edge=world.edges.find(e=>e.provinces.includes(action.source)&&e.provinces.includes(action.target));if(!edge)return null;
 const from=world.provinces[action.source].home,to=world.provinces[action.target].home,mid={x:(edge.a.x+edge.b.x)/2,y:(edge.a.y+edge.b.y)/2},d=Math.hypot(to.x-from.x,to.y-from.y)||1,axis={x:(to.x-from.x)/d,y:(to.y-from.y)/d};
 const enemy=before.p[action.target].owner!==before.player,old=before.p[action.target],current=after.p[action.target],captured=current.owner===before.player;
 return {action,start:now,duration:enemy?3000:650,from,to,mid,axis,enemy,owner:before.player,defender:old.owner,old:{...old},hidden:enemy?{soldier:current.soldier,horse:current.horse,archer:current.archer}:{soldier:0,horse:0,archer:0,[action.type]:action.amount},survivors:enemy?(captured?current[action.type]:0):action.amount,defenderDead:enemy?(captured?old.soldier+old.horse+old.archer:old.soldier+old.horse+old.archer-current.soldier-current.horse-current.archer):0};
}
const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const clamp=t=>Math.max(0,Math.min(1,t));
export function drawBattles(g,battles,time,colors,drawUnit,positions,S){
 for(const b of battles){const t=clamp((time-b.start)/b.duration),side={x:-b.axis.y,y:b.axis.x},{action:a}=b;
  const formation=(base,i,n,dir)=>({x:base.x+side.x*((i%7)-Math.min(6,n-1)/2)*.009+b.axis.x*Math.floor(i/7)*.009*dir,y:base.y+side.y*((i%7)-Math.min(6,n-1)/2)*.009+b.axis.y*Math.floor(i/7)*.009*dir});
  const end=(type,i)=>positions.get(a.target)?.[type]?.[i+(b.enemy?0:b.old[type])]||{x:b.to.x+(i%5-2)*.006,y:b.to.y+Math.floor(i/5)*.006};
  function actor(type,i,n,attacker,dead){
    const base={x:b.mid.x+b.axis.x*(attacker?.018:.065),y:b.mid.y+b.axis.y*(attacker?.018:.065)},line=formation(base,i,n,attacker?-1:1),collision={x:b.mid.x+b.axis.x*.041+side.x*((i%7)-3)*.009,y:b.mid.y+b.axis.y*.041+side.y*((i%7)-3)*.009};let p;
    if(!b.enemy){const u=clamp(t*1.3-i/Math.max(1,n)*.25);p=u<.5?mix(b.from,b.mid,u*2):mix(b.mid,end(type,i),(u-.5)*2);}
    else if(t<.28){if(attacker){const delay=.06*i/Math.max(1,n-1),u=clamp((t-delay)/(.28-delay));p=u<.5?mix(b.from,b.mid,u*2):mix(b.mid,line,(u-.5)*2);}else p=mix(b.to,line,clamp(t/.28));}
    else if(t<.42)p=line;
    else if(t<.65)p=mix(line,collision,clamp((t-.42)/.23));
    else if(dead){const f=clamp((t-.65)/.15);p={x:collision.x+b.axis.x*(attacker?-1:1)*Math.sin(f*Math.PI)*.009,y:collision.y+b.axis.y*(attacker?-1:1)*Math.sin(f*Math.PI)*.009};if(f>.4){g.save();g.globalAlpha=1-f;g.fillStyle=colors[attacker?b.owner:b.defender];for(let k=0;k<5;k++){const angle=k*Math.PI*2/5,x=(p.x+Math.cos(angle)*f*.014)*S,y=(p.y+Math.sin(angle)*f*.014)*S;g.beginPath();g.moveTo(x-1.4,y+1.4);g.lineTo(x+1.7,y);g.lineTo(x,y-1.7);g.fill();}g.restore();return;}}
    else p=mix(collision,end(type,i),clamp((t-.73)/.27));
    drawUnit(g,type,p.x*S,p.y*S,colors[attacker?b.owner:b.defender],0,5.2,false);
  }
  for(let i=0;i<a.amount;i++)actor(a.type,i,a.amount,true,i>=b.survivors);
  if(b.enemy){let i=0;const n=b.old.soldier+b.old.horse+b.old.archer;for(const type of ['soldier','horse','archer'])for(let j=0;j<b.old[type];j++,i++)actor(type,j,n,false,i<b.defenderDead);}
 }
}
