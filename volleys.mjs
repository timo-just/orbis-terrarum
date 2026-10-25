// Immutable world-space effects: concurrent human actions cannot overwrite shots.
export function makeVolley(shots,previous,world,positions,towerPoint,now=performance.now()){
 const remaining=new Map(),fired=new Map();
 const actors=shots.map(shot=>{
  const key=shot.target+':'+shot.type,index=(remaining.get(key)??previous.p[shot.target][shot.type])-1;remaining.set(key,index);
  const sourceIndex=fired.get(shot.source)||0;fired.set(shot.source,sourceIndex+1);
  const from=shot.tower===null?(positions.get(shot.source)?.archer?.[sourceIndex]||world.provinces[shot.source].home):towerPoint({province:shot.source,corner:shot.tower});
  const to=positions.get(shot.target)?.[shot.type]?.[Math.max(0,index)]||world.provinces[shot.target].home;
  return {...shot,from:{...from},to:{...to},owner:previous.p[shot.target].owner};
 });
 return {shots:actors,start:now,duration:1000};
}
export function drawVolleys(g,volleys,time,colors,drawUnit,S){
 for(const volley of volleys)for(let i=0;i<volley.shots.length;i++){
  const shot=volley.shots[i],progress=(time-volley.start)/volley.duration,impact=.55+(i%5)*.035,t=Math.max(0,progress/impact),from=shot.from,to=shot.to;
  if(t<1){
   drawUnit(g,shot.type,to.x*S,to.y*S,colors[shot.owner],0,5.2,false);
   const x=(from.x+(to.x-from.x)*t)*S,y=(from.y+(to.y-from.y)*t)*S-Math.sin(t*Math.PI)*18;
   g.save();g.translate(x,y);g.strokeStyle='#283039';g.fillStyle='#283039';g.lineWidth=1.5;
   if(shot.arrow){g.rotate(Math.atan2((to.y-from.y)*S-Math.cos(t*Math.PI)*18*Math.PI,(to.x-from.x)*S));g.beginPath();g.moveTo(-7,0);g.lineTo(5,0);g.stroke();g.beginPath();g.moveTo(7,0);g.lineTo(2,-3);g.lineTo(2,3);g.closePath();g.fill();g.beginPath();g.moveTo(-5,0);g.lineTo(-8,-2);g.moveTo(-5,0);g.lineTo(-8,2);g.stroke();}
   else{g.beginPath();g.arc(0,0,3,0,Math.PI*2);g.fill();g.fillStyle='#8c969e';g.beginPath();g.arc(-.8,-.9,.9,0,Math.PI*2);g.fill();}g.restore();
  }else{
   const f=Math.min(1,(progress-impact)/.28);if(f>=1)continue;
   g.save();g.globalAlpha=1-f;g.fillStyle='#ffe4a1';g.beginPath();g.arc(to.x*S,to.y*S,2+f*10,0,Math.PI*2);g.fill();g.fillStyle=colors[shot.owner];g.strokeStyle='#30373d';g.lineWidth=.8;
   for(let k=0;k<6;k++){const angle=k*Math.PI/3,dx=Math.cos(angle)*f*15,dy=Math.sin(angle)*f*15,x=to.x*S+dx,y=to.y*S+dy;g.beginPath();g.moveTo(x-2,y-1);g.lineTo(x+2,y);g.lineTo(x,y+3);g.closePath();g.fill();g.stroke();}g.restore();
  }
 }
}
