// Selected FL1. Cache edge geometry; zoom draws sharp vectors without rebuilding it.
const geometry=new WeakMap();
export function drawRivers(g,edges,S=1400){
 let cached=geometry.get(edges);
 if(!cached||cached.scale!==S){
  const parts=edges.filter(e=>e.river).map(e=>{
   const dx=(e.b.x-e.a.x)*S,dy=(e.b.y-e.a.y)*S,len=Math.hypot(dx,dy),nx=-dy/(len||1),ny=dx/(len||1),n=Math.max(2,Math.ceil(len/7)),seed=e.provinces[0]*7+e.provinces[1]*3;
   const width=t=>1+Math.sin(t*Math.PI)*Math.sin(t*13+seed)*.13;
   function ribbon(w){
    const path=new Path2D();for(const sign of [-1,1])for(let j=0;j<=n;j++){const t=sign<0?j/n:1-j/n,x=e.a.x*S+dx*t+nx*sign*w/2*width(t),y=e.a.y*S+dy*t+ny*sign*w/2*width(t);if(sign<0&&j===0)path.moveTo(x,y);else path.lineTo(x,y);}path.closePath();
    for(const point of [e.a,e.b]){path.moveTo(point.x*S+w/2,point.y*S);path.arc(point.x*S,point.y*S,w/2,0,Math.PI*2);}return path;
   }
   const glints=new Path2D();for(let x=5+(seed%9);x<len-4;x+=22){const at=(a,b)=>({x:e.a.x*S+dx/(len||1)*a+nx*b,y:e.a.y*S+dy/(len||1)*a+ny*b}),a=at(x,-1.2),b=at(x+3,-1.9),c=at(x+6,-.7),d=at(x+9,-1.4);glints.moveTo(a.x,a.y);glints.bezierCurveTo(b.x,b.y,c.x,c.y,d.x,d.y);}
   return {bank:ribbon(8.8),water:ribbon(6),shallow:ribbon(3.7),glints};
  });cached={scale:S,parts};geometry.set(edges,cached);
 }
 g.save();g.lineCap='round';g.lineJoin='round';
 // Complete-network layers prevent banks from crossing the water at junctions.
 g.fillStyle='#c6c5a0';cached.parts.forEach(p=>g.fill(p.bank));g.fillStyle='#4e9eae';cached.parts.forEach(p=>g.fill(p.water));
 for(const p of cached.parts){g.save();g.clip(p.water);g.globalAlpha=.32;g.fillStyle='#84c1c5';g.fill(p.shallow);g.globalAlpha=1;g.strokeStyle='#c1e7e48f';g.lineWidth=.5;g.stroke(p.glints);g.restore();}g.restore();
}
