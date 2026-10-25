import {rng} from './world.mjs?v=tutorial-34';
// Procedural paper, drawn once per viewport size and cached by the map renderer.
export function drawParchment(g,w,h){
 const random=rng(92741),gradient=g.createRadialGradient(w*.46,h*.42,0,w*.5,h*.5,Math.hypot(w,h)*.6);
 gradient.addColorStop(0,'#eee0b9');gradient.addColorStop(.55,'#dfc797');gradient.addColorStop(.85,'#c19a66');gradient.addColorStop(1,'#91643f');g.fillStyle=gradient;g.fillRect(0,0,w,h);
 for(let i=0;i<250;i++){const x=random()*w,y=random()*h,r=10+random()*75;const stain=g.createRadialGradient(x,y,0,x,y,r);stain.addColorStop(0,i%3?'#9d79420c':'#fff5d618');stain.addColorStop(1,i%3?'#9d794200':'#fff5d600');g.fillStyle=stain;g.fillRect(x-r,y-r,r*2,r*2);}
 // Fine irregular fibres rather than a stretched photograph or repeating texture.
 for(let i=0;i<Math.min(22000,w*h/45);i++){const x=random()*w,y=random()*h;g.fillStyle=i%2?'#75592f13':'#fff5d62b';g.fillRect(x,y,.5+random()*1.2,.4+random()*.7);}
 for(const [x,y,dx,dy] of [[0,0,w,0],[w,0,-w,0],[0,0,0,h],[0,h,0,-h]]){const fade=g.createLinearGradient(x,y,x+dx*.12,y+dy*.12);fade.addColorStop(0,'#7c4d2b55');fade.addColorStop(1,'#7c4d2b00');g.fillStyle=fade;g.fillRect(0,0,w,h);}
 // Faint atlas compass, kept away from the centre of the playing area.
 g.save();g.translate(w*.12,h*.83);const r=Math.min(w,h)*.105;g.strokeStyle='#87633116';g.lineWidth=2;for(const k of [.75,1]){g.beginPath();g.arc(0,0,r*k,0,Math.PI*2);g.stroke();}for(let i=0;i<16;i++){g.rotate(Math.PI/8);g.fillStyle=i%2?'#8e6a3710':'#8e6a371c';g.beginPath();g.moveTo(0,-r*(i%2?.65:.95));g.lineTo(r*.11,0);g.lineTo(0,r*.2);g.lineTo(-r*.11,0);g.closePath();g.fill();}g.restore();
}
