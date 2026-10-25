import {dist2} from './world.mjs?v=tutorial-33';
// Closest point to the corner in a polygon inset by the tower's full footprint.
export function towerAnchor(cell,corner,radius){
 let area=0;cell.forEach((a,i)=>{const b=cell[(i+1)%cell.length];area+=a.x*b.y-b.x*a.y;});
 const sign=area>=0?1:-1;let inset=cell.map(p=>({...p}));
 for(let i=0;i<cell.length&&inset.length;i++){
  const a=cell[i],b=cell[(i+1)%cell.length],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(!len)continue;
  const nx=-dy/len*sign,ny=dx/len*sign,d=p=>(p.x-a.x)*nx+(p.y-a.y)*ny-radius,next=[];
  for(let j=0;j<inset.length;j++){
   const p=inset[j],q=inset[(j+1)%inset.length],dp=d(p),dq=d(q);
   if(dp>=-1e-12)next.push(p);
   if((dp>=0)!==(dq>=0)){const t=dp/(dp-dq);next.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});}
  }inset=next;
 }
 if(!inset.length)return {x:cell.reduce((v,p)=>v+p.x,0)/cell.length,y:cell.reduce((v,p)=>v+p.y,0)/cell.length};
 let best=inset[0],distance=dist2(corner,best);
 for(let i=0;i<inset.length;i++){
  const a=inset[i],b=inset[(i+1)%inset.length],dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy,t=len?Math.max(0,Math.min(1,((corner.x-a.x)*dx+(corner.y-a.y)*dy)/len)):0;
  const p={x:a.x+dx*t,y:a.y+dy*t},d=dist2(corner,p);if(d<distance){best=p;distance=d;}
 }return best;
}
export function wallRoute(edge,home,startTower,endTower,S=1400){
 const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,len=Math.hypot(dx,dy)||1,tx=dx/len,ty=dy/len,nx=-ty,ny=tx,sign=((home.x-(edge.a.x+edge.b.x)/2)*nx+(home.y-(edge.a.y+edge.b.y)/2)*ny)>=0?1:-1,offset=3.2/S*sign;
 const a={x:edge.a.x+nx*offset,y:edge.a.y+ny*offset},b={x:edge.b.x+nx*offset,y:edge.b.y+ny*offset};
 const points=[];
 if(startTower){const d=Math.max(0,Math.min(len*.45,(startTower.x-a.x)*tx+(startTower.y-a.y)*ty+6/S));points.push(startTower,{x:a.x+tx*d,y:a.y+ty*d});}else points.push(a);
 if(endTower){const d=Math.max(len*.55,Math.min(len,(endTower.x-a.x)*tx+(endTower.y-a.y)*ty-6/S));points.push({x:a.x+tx*d,y:a.y+ty*d},endTower);}else points.push(b);
 return {points,sign};
}
// W1: classic stone wall with closely spaced crenellations.
export function drawJoinedWall(g,route,color,S=1400){
 const {points,sign}=route;g.save();g.lineCap='butt';g.lineJoin='round';
 const line=new Path2D();points.forEach((p,i)=>i?line.lineTo(p.x*S,p.y*S):line.moveTo(p.x*S,p.y*S));
 for(const [width,fill] of [[6,'#4f554f'],[4.8,'#727c72'],[3.8,'#c7c7b0']]){g.lineWidth=width;g.strokeStyle=fill;g.stroke(line);}
 const stripes=new Path2D();let travelled=0,next=2.5;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=(b.x-a.x)*S,dy=(b.y-a.y)*S,len=Math.hypot(dx,dy);if(!len)continue;
  const angle=Math.atan2(dy,dx),nx=-dy/len*sign,ny=dx/len*sign;
  stripes.moveTo(a.x*S+nx,a.y*S+ny);stripes.lineTo(b.x*S+nx,b.y*S+ny);
  while(next<travelled+len){const t=(next-travelled)/len;g.save();g.translate(a.x*S+dx*t,a.y*S+dy*t);g.rotate(angle);g.fillStyle='#e1dec6';g.strokeStyle='#4f554f';g.lineWidth=.65;g.fillRect(-1.4,-sign*2.1-1.05,2.8,2.1);g.strokeRect(-1.4,-sign*2.1-1.05,2.8,2.1);g.restore();next+=5;}travelled+=len;
 }
 const n=parseInt(color.slice(1),16);g.strokeStyle=`rgb(${(n>>16)*.55},${(n>>8&255)*.55},${(n&255)*.55})`;g.lineWidth=1.2;g.stroke(stripes);g.restore();
}

// T1: selected open round tower, matching the approved vector preview.
export function drawTower(g,x,y,color){
 g.save();g.translate(x,y);g.fillStyle='#213c3340';g.beginPath();g.arc(.6,1,5.3,0,Math.PI*2);g.fill();
 g.lineWidth=.65;g.strokeStyle='#4f554f';g.fillStyle='#c7c7ae';g.beginPath();g.arc(0,0,4.8,0,Math.PI*2);g.fill();g.stroke();
 g.fillStyle='#929b91';g.beginPath();g.arc(0,0,3.15,0,Math.PI*2);g.fill();g.stroke();
 for(let i=0;i<8;i++){g.save();g.rotate(i*Math.PI/4);g.fillStyle='#e4e0c8';g.strokeStyle='#4f554f';g.lineWidth=.5;g.fillRect(-1,-5,2,1.8);g.strokeRect(-1,-5,2,1.8);g.restore();}
 g.fillStyle=color;g.strokeStyle='#3b4d4b';g.lineWidth=.35;g.fillRect(-1,-1,2,2);g.strokeRect(-1,-1,2,2);g.restore();
}
