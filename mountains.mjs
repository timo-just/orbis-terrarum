// Preview candidates: directly usable by the game's existing Canvas renderer.
// Geometry is generated along edges in map coordinates, never a stretched bitmap.
export function drawMountain(g,e,paths,S,variant=3){
 g.save();const clip=new Path2D();for(const id of e.provinces)clip.addPath(paths.get(id));g.clip(clip);
 const dx=(e.b.x-e.a.x)*S,dy=(e.b.y-e.a.y)*S,len=Math.hypot(dx,dy);if(len<.1){g.restore();return;}
 const angle=Math.atan2(dy,dx),lit=(-Math.sin(angle)*-.6+Math.cos(angle)*-.8)>0?1:-1;
 g.translate(e.a.x*S,e.a.y*S);g.rotate(angle);g.lineJoin='round';g.lineCap='round';
 const n=Math.max(2,Math.ceil(len/9)),step=len/n,width=Math.min(10,Math.max(3,len*.19)),seed=e.provinces[0]*7+e.provinces[1]*3;
 const wave=i=>Math.sin(i*1.83+seed)*1.15;
 const ridge=Array.from({length:n+1},(_,i)=>({x:i*step,y:wave(i)}));
 const taper=i=>.2+.8*Math.sin(Math.PI*(.06+.88*i/n));
 const fill=(points,color)=>{g.fillStyle=color;g.beginPath();points.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();g.fill();};
 const stroke=(points,color,w)=>{g.strokeStyle=color;g.lineWidth=w;g.beginPath();points.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.stroke();};
 const side=(sign,mul=1)=>ridge.map((p,i)=>({x:p.x,y:p.y+sign*width*taper(i)*mul}));
 fill([...side(-1,1.12),...side(1,1.12).reverse()],'#37483126');
 if(variant===0){
  for(const sign of [-1,1]){
   fill([...ridge,...side(sign).reverse()],sign===lit?'#c5bd90':'#807b61');
   for(let i=0;i<n;i++){
    const a=ridge[i],b=ridge[i+1],toe={x:(a.x+b.x)/2-step*.13,y:(a.y+b.y)/2+sign*width*taper(i+.5)};
    fill([a,b,toe],sign===lit?(i%2?'#ded3a9':'#cdc39a'):(i%2?'#8c866b':'#706f5a'));
    stroke([a,{x:toe.x-step*.15,y:toe.y*.72},toe],sign===lit?'#a7a37a':'#62664f',.65);
   }
  }
  stroke(ridge,'#eee4c0',1.25);
 }else if(variant===1){
  for(const sign of [-1,1]){
   fill([...ridge,...side(sign).reverse()],sign===lit?'#b7bc91':'#7f8c6c');
   fill([...ridge,...side(sign,.58).reverse()],sign===lit?'#d2c99f':'#989779');
   for(let i=1;i<n;i++){
    const p=ridge[i],end={x:p.x-step*.32,y:p.y+sign*width*taper(i)*.87};
    g.strokeStyle=sign===lit?'#9fa57e':'#69795e';g.lineWidth=.8;g.beginPath();g.moveTo(p.x,p.y);g.quadraticCurveTo(p.x+step*.17,p.y+sign*width*.42,end.x,end.y);g.stroke();
   }
  }
  stroke(ridge,'#eee3bf',1.45);
 }else if(variant===2){
  for(const sign of [-1,1]){
   fill([...ridge,...side(sign).reverse()],sign===lit?'#b6b995':'#7d866b');
   fill([...ridge,...side(sign,.73).reverse()],sign===lit?'#c9c29d':'#949278');
   fill([...ridge,...side(sign,.4).reverse()],sign===lit?'#ded0a7':'#ada38a');
   stroke(side(sign,.73),sign===lit?'#92997799':'#5d715c99',.65);
   stroke(side(sign,.4),'#7b7b6388',.65);
  }
  stroke(ridge,'#f2e3bf',1.2);
 }else{
  for(const sign of [-1,1])fill([...ridge,...side(sign).reverse()],sign===lit?'#b5b798':'#7e866e');
  for(let i=0;i<n;i++){
   const a=ridge[i],b=ridge[i+1],peak={x:a.x+step*.45,y:(a.y+b.y)/2-lit*1.8};
   fill([a,peak,b,{x:b.x,y:b.y+lit*width*taper(i+1)*.75},{x:a.x,y:a.y+lit*width*taper(i)*.65}],'#d4ccb0');
   fill([a,peak,b,{x:b.x-step*.13,y:b.y-lit*width*taper(i+1)*.65},{x:a.x+step*.15,y:a.y-lit*width*taper(i)*.83}],'#8a8878');
   stroke([a,peak,b],'#eee5cf',1.1);
   for(const sign of [-1,1])stroke([peak,{x:a.x+step*.66,y:peak.y+sign*width*.43},{x:a.x+step*.34,y:peak.y+sign*width*.85*taper(i+.5)}],sign===lit?'#aaa88b':'#656f5e',.7);
  }
 }
 g.restore();
}
