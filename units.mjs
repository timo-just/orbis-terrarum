import {ICONS} from './icons.mjs?v=keys-18';
const cache=new Map();
const glyph=(name,index)=>{const key=name+index;if(!cache.has(key))cache.set(key,new Path2D(ICONS[name].paths[index].pathData));return cache.get(key);};
export function drawUnit(g,type,x,y,color,stage=0,r=5.2,gold=false){
 const grey='#848b93',ink='#444444';
 if(color==='#69ad59')color='#ffffff';
 if(stage===2)color=grey;
 g.save();g.translate(x,y);g.fillStyle='#f6f4df';g.strokeStyle=gold?'#ffd45b':'#263c4e';g.lineWidth=gold?1.8:.55;
 g.beginPath();g.arc(0,0,r*1.16,0,Math.PI*2);g.fill();g.stroke();
 g.beginPath();g.arc(0,0,r,0,Math.PI*2);g.fillStyle=color;g.fill();
 if(stage===1){g.save();g.clip();g.fillStyle=grey;g.fillRect(0,-r,r,r*2);g.restore();}
 const name=type==='soldier'?'sword':type,asset=ICONS[name],width=r*(type==='horse'?1.36:type==='archer'?1.72:1.85),scale=width/asset.width;
 g.save();g.translate(-width/2,-asset.height*scale/2);g.scale(scale,scale);g.lineJoin='round';g.lineCap='round';
 asset.paths.forEach((p,i)=>{
  if(type==='horse'&&i!==0&&i!==3)return;
  if(p.fillColor&&!p.fillColor.startsWith('@')){g.fillStyle=ink;g.fill(glyph(name,i));}
  if(p.strokeColor){g.strokeStyle=ink;g.lineWidth=Number(p.strokeWidth||1);g.stroke(glyph(name,i));}
 });
 if(type==='horse'){g.fillStyle=color;g.beginPath();g.arc(62,34,3,0,Math.PI*2);g.fill();}
 g.restore();g.restore();
}
