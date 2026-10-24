export function drawOrnateFrame(g,x,y,w,h,variant=2){
 const band=variant===3?17:15;g.save();g.translate(x,y);g.lineJoin='round';
 g.strokeStyle='#423b30';g.lineWidth=band;g.strokeRect(band/2,band/2,w-band,h-band);
 g.strokeStyle='#a99156';g.lineWidth=1.4;g.strokeRect(1.2,1.2,w-2.4,h-2.4);g.strokeRect(band-1,band-1,w-band*2+2,h-band*2+2);
 function edge(length){
  g.strokeStyle='#c8ae70';g.lineWidth=1.2;
  for(let i=band;i<length-band-18;i+=22){g.save();g.translate(i,band/2);g.beginPath();
   if(variant===0){g.moveTo(-2,3);g.bezierCurveTo(3,7,15,4,15,-1);g.bezierCurveTo(15,-7,6,-7,6,-1);g.bezierCurveTo(6,3,12,3,11,-1);}
   else if(variant===1){g.moveTo(0,4);g.bezierCurveTo(7,3,7,-6,17,-4);g.bezierCurveTo(15,5,6,7,4,1);g.moveTo(8,0);g.quadraticCurveTo(13,-4,16,-3);g.moveTo(9,0);g.quadraticCurveTo(15,3,16,-3);}
   else if(variant===2){g.moveTo(0,0);g.bezierCurveTo(6,-9,16,-9,22,0);g.bezierCurveTo(16,9,6,9,0,0);g.moveTo(0,0);g.bezierCurveTo(6,6,16,6,22,0);}
   else{g.moveTo(-2,-3);g.quadraticCurveTo(4,6,9,-3);g.quadraticCurveTo(14,-11,20,-3);g.moveTo(-2,3);g.quadraticCurveTo(4,11,9,3);g.quadraticCurveTo(14,-6,20,3);}
   g.stroke();g.strokeStyle='#f0d69b';g.lineWidth=.5;g.beginPath();g.moveTo(0,-5);g.lineTo(3,-5);g.stroke();g.restore();
  }
 }
 for(const [tx,ty,angle,len] of [[0,0,0,w],[w,0,Math.PI/2,h],[w,h,Math.PI,w],[0,h,-Math.PI/2,h]]){g.save();g.translate(tx,ty);g.rotate(angle);edge(len);g.restore();}
 for(const [cx,cy] of [[band/2,band/2],[w-band/2,band/2],[w-band/2,h-band/2],[band/2,h-band/2]]){
  g.save();g.translate(cx,cy);g.fillStyle='#493f30';g.strokeStyle='#dbc080';g.lineWidth=.9;g.beginPath();g.arc(0,0,variant===3?10:6.5,0,Math.PI*2);g.fill();g.stroke();
  for(let k=0;k<8;k++){g.rotate(Math.PI/4);g.fillStyle=k%2?'#9d824c':'#ebcf8a';g.beginPath();g.moveTo(0,-(variant===3?8:5));g.lineTo(2,0);g.lineTo(0,2);g.lineTo(-2,0);g.closePath();g.fill();}g.restore();
 }g.restore();
}
