import {inside} from './world.mjs?v=ai-26';
// Selected F2: hanging courtyard banner, gold border and light diamond.
export function drawFlag(g,x,y,color){
 g.save();g.translate(x,y);g.lineJoin='round';g.lineCap='round';
 g.fillStyle='#213c3340';g.beginPath();g.ellipse(1,1,3.6,1.1,0,0,Math.PI*2);g.fill();
 g.strokeStyle='#3e3d32';g.lineWidth=1.2;g.beginPath();g.moveTo(0,0);g.lineTo(0,-20);g.stroke();
 g.strokeStyle='#d0b16e';g.lineWidth=.35;g.beginPath();g.moveTo(-.2,-1);g.lineTo(-.2,-19);g.stroke();
 g.fillStyle='#e2c681';g.strokeStyle='#4d4937';g.lineWidth=.45;g.beginPath();g.arc(0,-20.5,.95,0,Math.PI*2);g.fill();g.stroke();
 g.strokeStyle='#454638';g.lineWidth=.9;g.beginPath();g.moveTo(-1,-18);g.lineTo(13,-18);g.stroke();
 g.fillStyle=color;g.strokeStyle='#303c3b';g.lineWidth=.7;g.beginPath();g.moveTo(2,-17.6);g.lineTo(11,-17.6);g.lineTo(11,-5);g.lineTo(6.5,-7.5);g.lineTo(2,-5);g.closePath();g.fill();g.stroke();
 g.strokeStyle='#e7d19b';g.lineWidth=.55;g.beginPath();g.moveTo(3.2,-16.4);g.lineTo(3.2,-7.2);g.lineTo(6.5,-9);g.lineTo(9.8,-7.2);g.lineTo(9.8,-16.4);g.stroke();
 g.fillStyle='#f2e7c6';g.beginPath();g.moveTo(6.5,-14.7);g.lineTo(8,-12.6);g.lineTo(6.5,-10.5);g.lineTo(5,-12.6);g.closePath();g.fill();g.restore();
}
export function flagPosition(province,preferred,S=1400){
 const fits=p=>[[-4,-22],[14,-22],[-4,3],[14,3]].every(([x,y])=>inside({x:p.x+x/S,y:p.y+y/S},province.cell));
 const centre={x:province.home.x-5/S,y:province.home.y+9.5/S};
 for(let i=0;i<=24;i++){const t=i/24,p={x:preferred.x+(centre.x-preferred.x)*t,y:preferred.y+(centre.y-preferred.y)*t};if(fits(p))return p;}
 return centre;
}
