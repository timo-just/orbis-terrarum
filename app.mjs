import {TYPES,COLORS,NAMES,createState,chooseStart,legal,apply,winner,active,available,total,shade} from './engine.mjs';
import {generateWorld,inside,dist2,segmentDistance,center,rng} from './world.mjs';
import {ICONS} from './icons.mjs';

const $=id=>document.getElementById(id), canvas=$('map'),ctx=canvas.getContext('2d'),scene=document.createElement('canvas');
scene.width=scene.height=1400;const g=scene.getContext('2d'),S=1400;
const LABELS={soldier:'Soldaten',horse:'Reiter',archer:'Bogenschützen'};
let world,state,settings={players:4,rivers:2,mountains:3,lakes:2},selected=null,type='soldier',amount=0,operation=null,tab='units';
let setup=true,zoom=1,pan={x:0,y:0},dirty=true,framePending=false,speed=1,busy=null,status='',saved=null,storageOK=true;
let W=innerWidth,H=innerHeight,DPR=Math.min(devicePixelRatio||1,2),mapSize=600,mapCenter={x:W/2,y:H*.43};
const pointers=new Map();let drag=null,pinch=null;
const polyPath=poly=>{const p=new Path2D();poly.forEach((v,i)=>i?p.lineTo(v.x*S,v.y*S):p.moveTo(v.x*S,v.y*S));p.closePath();return p;};
const paths=new Map(),layouts=new Map();
const glyphs=new Map();
function icon(context,name,x,y,width,color=null){const asset=ICONS[name],height=width*asset.height/asset.width;context.save();context.translate(x-width/2,y-height/2);context.scale(width/asset.width,width/asset.width);
  asset.paths.forEach((p,i)=>{const cache=`${name}:${i}`;if(!glyphs.has(cache))glyphs.set(cache,new Path2D(p.pathData));const path=glyphs.get(cache);
    let fill=p.fillColor;if(fill?.startsWith('@'))fill='transparent';if(color&&name==='archer')fill=fill==='transparent'?fill:color;
    if(color&&name==='horse'&&fill!=='#35404A')fill=color;
    if(fill&&fill!=='transparent'){context.fillStyle=fill;context.fill(path);}if(p.strokeColor){context.strokeStyle=color&&name==='archer'?color:p.strokeColor;context.lineWidth=Number(p.strokeWidth||1);context.lineJoin=p.strokeLineJoin||'round';context.lineCap=p.strokeLineCap||'round';context.stroke(path);}
  });context.restore();
}
function unit(context,t,x,y,color,stage=0,r=3.1){const grey='#848b93';if(stage===2)color=grey;context.save();context.fillStyle='#ffffffee';context.beginPath();context.arc(x,y,r*1.2,0,Math.PI*2);context.fill();
  if(t==='soldier'){context.fillStyle=color;context.beginPath();context.arc(x,y,r,0,Math.PI*2);context.fill();context.fillStyle='#ffffff65';context.beginPath();context.arc(x-r*.25,y-r*.3,r*.25,0,Math.PI*2);context.fill();}
  else{icon(context,t,x,y,r*2.15,color);if(stage===1){context.beginPath();context.rect(x,y-r*1.8,r*1.8,r*3.6);context.clip();icon(context,t,x,y,r*2.15,grey);}}
  context.restore();
}
function screenToWorld(x,y){return {x:.5+(x-mapCenter.x-pan.x)/(mapSize*zoom),y:.5+(y-mapCenter.y-pan.y)/(mapSize*zoom)};}
function worldToScreen(p){return {x:mapCenter.x+pan.x+(p.x-.5)*mapSize*zoom,y:mapCenter.y+pan.y+(p.y-.5)*mapSize*zoom};}
function resize(){W=innerWidth;H=innerHeight;DPR=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(W*DPR);canvas.height=Math.round(H*DPR);const small=W<600;mapSize=Math.min(W*.94,H*(small?.72:.78));mapCenter={x:W/2,y:H*(small?.40:.43)};requestRender();}
function requestRender(){if(framePending)return;framePending=true;requestAnimationFrame(render);}
function drawLine(context,a,b,width,color){context.beginPath();context.moveTo(a.x*S,a.y*S);context.lineTo(b.x*S,b.y*S);context.strokeStyle=color;context.lineWidth=width;context.lineCap='round';context.stroke();}
function towerPoint(t){const p=world.corners[t.corner].point,c=world.provinces[t.province].home,d=Math.sqrt(dist2(p,c))||1,inset=Math.min(d*.15,.0035);return {x:p.x+(c.x-p.x)/d*inset,y:p.y+(c.y-p.y)/d*inset};}
function wallSegment(edge,province){const c=world.provinces[province].home,dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len,sign=((c.x-(edge.a.x+edge.b.x)/2)*nx+(c.y-(edge.a.y+edge.b.y)/2)*ny)>=0?1:-1,offset=3.2/S*sign;return {a:{x:edge.a.x+nx*offset,y:edge.a.y+ny*offset},b:{x:edge.b.x+nx*offset,y:edge.b.y+ny*offset}};}
function edgeFor(a,b){return world.edges.find(e=>e.provinces.includes(a)&&e.provinces.includes(b));}
function dark(color){const n=parseInt(color.slice(1),16);return `rgb(${(n>>16)*.55},${(n>>8&255)*.55},${(n&255)*.55})`;}
function anchor(id){const p=world.provinces[id],mountains=world.edges.filter(e=>e.mountain&&e.provinces.includes(id)),fits=v=>inside(v,p.cell)&&mountains.every(e=>segmentDistance(v,e.a,e.b)>.0001);
  if(fits(p.home))return p.home;for(let i=0;i<24;i++){const angle=i*2.39996,d=.003+Math.sqrt(i)*.004,v={x:p.home.x+Math.cos(angle)*d,y:p.home.y+Math.sin(angle)*d};if(fits(v))return v;}return p.home;
}
function symbolPositions(id,counts,structures){const cache=JSON.stringify([id,counts,structures,state.walls.filter(w=>w.startsWith(`${id}:`))]);if(layouts.has(cache))return layouts.get(cache);const p=world.provinces[id],poly=p.cell,base=anchor(id),radius=4.2/S,mountainEdges=world.edges.filter(e=>e.mountain&&e.provinces.includes(id)),wallEdges=state.walls.map(w=>w.split(':').map(Number)).filter(([a])=>a===id).map(([a,b])=>edgeFor(a,b)).filter(Boolean);
  const xs=poly.map(p=>p.x),ys=poly.map(p=>p.y),bounds={left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)};
  function fits(x,y){return [[x,y],[x-radius,y-radius],[x+radius,y-radius],[x-radius,y+radius],[x+radius,y+radius]].every(([x,y])=>inside({x,y},poly))&&mountainEdges.every(e=>segmentDistance({x,y},e.a,e.b)>.00012)&&wallEdges.every(e=>segmentDistance({x,y},e.a,e.b)>.00005)&&structures.every(rect=>!(x>rect[0]&&x<rect[2]&&y>rect[1]&&y<rect[3]));}
  const present=TYPES.filter(t=>counts[t]>0),out={};present.forEach((t,group)=>{
    const count=counts[t],left=bounds.left+(bounds.right-bounds.left)*group/present.length,right=bounds.left+(bounds.right-bounds.left)*(group+1)/present.length,cx=present.length===1?base.x:(left+right)/2;
    const rows=Math.min(5,count),cols=Math.ceil(count/rows);let ideal=Array.from({length:count},(_,i)=>({x:cx+(Math.floor(i/rows)-(cols-1)/2)*radius*2.6,y:base.y+(i%rows-(rows-1)/2)*radius*1.15}));
    if(ideal.every(q=>fits(q.x,q.y)))out[t]=ideal;else{
      let candidates=[];for(const spacing of [radius*1.3,radius*.55,radius*.25]){candidates=[];for(let y=bounds.top+radius;y<=bounds.bottom-radius;y+=spacing)for(let x=bounds.left+radius;x<=bounds.right-radius;x+=spacing)if(fits(x,y))candidates.push({x,y});
        const partition=candidates.filter(p=>p.x>=left&&p.x<=right);if(partition.length) candidates=partition;
        candidates.sort((a,b)=>dist2(a,{x:cx,y:base.y})-dist2(b,{x:cx,y:base.y}));if(candidates.length>=count)break;
      }
      if(!candidates.length){for(let y=bounds.top;y<=bounds.bottom;y+=radius)for(let x=bounds.left;x<=bounds.right;x+=radius)if(inside({x,y},poly)&&mountainEdges.every(e=>segmentDistance({x,y},e.a,e.b)>.00004))candidates.push({x,y});}
      if(!candidates.length)candidates=[base];out[t]=Array.from({length:count},(_,i)=>({...candidates[i%candidates.length]})).sort((a,b)=>a.y-b.y||a.x-b.x);
    }
  });if(layouts.size>500)layouts.clear();layouts.set(cache,out);return out;
}
function displayCounts(id){const p=state.p[id],counts=Object.fromEntries(TYPES.map(t=>[t,p[t]]));if(busy?.kind==='volley')busy.shots.forEach((shot,i)=>{if(shot.target===id&&busy.progress<.55+(i%6)*.06)counts[shot.type]++;});return counts;}
function drawScene(){g.clearRect(0,0,S,S);const random=rng(world.seed+777);world.provinces.forEach((p,id)=>{
    const path=paths.get(id);g.fillStyle=COLORS[state.p[id].owner];g.fill(path);g.strokeStyle='#fafcfde8';g.lineWidth=1.5;g.stroke(path);
    if(state.p[id].owner===0){g.save();g.clip(path);for(let j=0;j<8;j++){const x=p.home.x+(random()-.5)*.09,y=p.home.y+(random()-.5)*.08;if(p.biome==='forest'){g.fillStyle='#255e32';g.beginPath();g.ellipse(x*S+1,y*S+2,3,4,0,0,Math.PI*2);g.fill();g.fillStyle='#347846';g.beginPath();g.arc(x*S,y*S,3,0,Math.PI*2);g.fill();}else{g.strokeStyle=p.biome==='dry'?'#dfd18b70':'#daf0b670';g.lineWidth=.8;g.beginPath();g.moveTo(x*S-1,y*S);g.lineTo(x*S,y*S+3);g.lineTo(x*S+2,y*S-1);g.stroke();}}g.restore();}
  });
  // Lakes are whole water cells. Paint together, outline only the actual shore.
  const waterPath=new Path2D();world.lakeCells.forEach(cell=>waterPath.addPath(polyPath(cell)));g.fillStyle='#3eb3de';g.fill(waterPath);g.save();g.clip(waterPath);g.strokeStyle='#b9edf04a';g.lineWidth=1;for(let y=30;y<S;y+=80){g.beginPath();g.moveTo(0,y);g.quadraticCurveTo(S/2,y+8,S,y);g.stroke();}g.restore();
  world.coast.forEach(e=>drawLine(g,e.a,e.b,1.7,'#f7fdff'));
  g.save();const landClip=new Path2D();paths.forEach(path=>landClip.addPath(path));g.clip(landClip);
  world.edges.forEach(e=>{if(e.river){drawLine(g,e.a,e.b,7,'#eef9fc');drawLine(g,e.a,e.b,4.8,'#237ec5');drawLine(g,e.a,e.b,1.6,'#83d5f2');}else if(e.mountain){
    g.save();const clip=new Path2D();e.provinces.forEach(id=>clip.addPath(paths.get(id)));g.clip(clip);const dx=(e.b.x-e.a.x)*S,dy=(e.b.y-e.a.y)*S,len=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);g.translate(e.a.x*S,e.a.y*S);g.rotate(angle);const sections=Math.max(2,Math.ceil(len/9)),ridge=Array.from({length:sections+1},(_,i)=>[i*len/sections,Math.sin(i*1.9+e.provinces[0])*1.8]);
    for(let i=0;i<sections;i++){const a=ridge[i],b=ridge[i+1];g.fillStyle=i%2?'#999c7a':'#b8b798';g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.lineTo(b[0]+3,b[1]+8);g.lineTo(a[0]-3,a[1]+7);g.closePath();g.fill();g.fillStyle=i%2?'#d4d0ae':'#c4c0a0';g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.lineTo(b[0]-3,b[1]-7);g.lineTo(a[0]+2,a[1]-8);g.closePath();g.fill();}g.restore();
  }});
  g.restore();
  state.walls.forEach(key=>{const [a,b]=key.split(':').map(Number),edge=edgeFor(a,b);if(!edge)return;const segment=wallSegment(edge,a);g.save();g.clip(paths.get(a));drawLine(g,segment.a,segment.b,4.8,dark(COLORS[state.p[a].owner]));g.restore();});
  if(selected!==null){g.strokeStyle='#fff';g.lineWidth=4;g.stroke(paths.get(selected));}
  const obstacles=state.p.map(()=>[]);
  state.p.forEach((p,id)=>{if(p.barracks){const c=anchor(id),x=c.x-.012,y=c.y+.008;icon(g,'barracks',x*S,y*S,11);obstacles[id].push([x-.006,y-.009,x+.006,y+.009]);}});
  state.towers.forEach(t=>{const p=towerPoint(t);icon(g,'tower',p.x*S,p.y*S,7.5);obstacles[t.province].push([p.x-.005,p.y-.008,p.x+.005,p.y+.008]);});
  for(let player=1;player<=state.players;player++){const id=state.flags[player];if(id<0)continue;const p=anchor(id),x=p.x*S+11,y=p.y*S-3;g.lineWidth=1.5;g.strokeStyle='#000';g.beginPath();g.moveTo(x,y);g.lineTo(x,y-16);g.stroke();g.fillStyle=COLORS[player];g.beginPath();g.moveTo(x,y-16);g.lineTo(x+11,y-12);g.lineTo(x,y-8);g.closePath();g.fill();g.lineWidth=1;g.stroke();obstacles[id].push([(x-2)/S,(y-18)/S,(x+13)/S,(y+1)/S]);}
  if(!setup&&state.phase!=='draft')state.p.forEach((p,id)=>{const counts=displayCounts(id),positions=symbolPositions(id,counts,obstacles[id]);g.save();g.clip(paths.get(id));TYPES.forEach(t=>(positions[t]||[]).forEach((pos,i)=>unit(g,t,pos.x*S,pos.y*S,COLORS[p.owner],shade(p,t,i,state.player))));g.restore();});
  if(operation&&selected!==null){for(const target of targets()){if(operation.includes('Tower')){const p=towerPoint({province:selected,corner:target});g.fillStyle='#fff';g.beginPath();g.arc(p.x*S,p.y*S,6,0,Math.PI*2);g.fill();g.strokeStyle='#263d4c';g.lineWidth=1.4;g.stroke();}else{const edge=edgeFor(selected,target);if(edge)drawLine(g,edge.a,edge.b,5,'#fff9ae');}}}
}
function render(time){framePending=false;ctx.setTransform(DPR,0,0,DPR,0,0);ctx.clearRect(0,0,W,H);ctx.fillStyle='#bfe8f4';ctx.fillRect(0,0,W,H);
  if(!world||!state)return;if(busy){busy.progress=Math.min(1,(time-busy.start)/busy.duration);if(busy.progress>=1){busy=null;dirty=true;}else if(busy.kind==='volley')dirty=true;}
  if(dirty){drawScene();dirty=false;}
  ctx.save();ctx.translate(mapCenter.x+pan.x,mapCenter.y+pan.y);ctx.scale(mapSize*zoom/S,mapSize*zoom/S);ctx.drawImage(scene,-S/2,-S/2);ctx.restore();
  if(busy){if(busy.kind==='move'){const from=worldToScreen(world.provinces[busy.action.source].home),to=worldToScreen(world.provinces[busy.action.target].home),t=busy.progress;ctx.strokeStyle=COLORS[busy.owner];ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();const n=Math.max(1,busy.action.amount),rows=Math.min(5,n),cols=Math.ceil(n/rows),r=2.8*mapSize*zoom/S;for(let i=0;i<n;i++)unit(ctx,busy.action.type,from.x+(to.x-from.x)*t+(Math.floor(i/rows)-(cols-1)/2)*r*2.5,from.y+(to.y-from.y)*t+(i%rows-(rows-1)/2)*r*1.15,COLORS[busy.owner],0,r);}
    else busy.shots.forEach((shot,i)=>{const start=shot.tower===null?world.provinces[shot.source].home:towerPoint({province:shot.source,corner:shot.tower}),from=worldToScreen(start),to=worldToScreen(world.provinces[shot.target].home),impact=.55+(i%6)*.06,t=busy.progress/impact;if(t<1){const x=from.x+(to.x-from.x)*t,y=from.y+(to.y-from.y)*t-Math.sin(t*Math.PI)*25;ctx.strokeStyle='#384654';ctx.fillStyle='#384654';if(shot.arrow){ctx.beginPath();ctx.moveTo(x-4,y+3);ctx.lineTo(x+4,y-3);ctx.stroke();}else{ctx.beginPath();ctx.arc(x,y,2.3,0,Math.PI*2);ctx.fill();}}else{const phase=(busy.progress-impact)/.18;if(phase<1){ctx.fillStyle=`rgba(255,205,91,${1-phase})`;ctx.beginPath();ctx.arc(to.x,to.y,3+phase*13,0,Math.PI*2);ctx.fill();}}});requestRender();
  }else if($('end-turn').disabled&&state.pool===0)updateUI();
}
function targets(){if(selected===null||!operation)return [];const kind=operation==='buildWall'?'wall':operation==='demolishWall'?'demolishWall':operation==='buildTower'?'tower':'demolishTower';return (kind.includes('ower')?world.corners.map((_,i)=>i):state.links[selected].map(l=>l.target)).filter(target=>legal(state,{kind,source:selected,target}));}
function announce(text){status=text;updateUI();requestRender();}
function phaseText(){if(state.phase==='draft')return `${NAMES[state.player]} wählt eine freie Startprovinz. Wer zuerst wählt, zieht zuletzt.`;if(state.pool>0)return `${NAMES[state.player]}: ${state.pool} Soldaten verteilen – jeder Klick auf eine eigene Provinz setzt einen Soldaten.`;return `${NAMES[state.player]} ist am Zug.`;}
function save(){try{saved={version:1,world,state,settings:{...settings}};localStorage.setItem('orbis-terrarum-v1',JSON.stringify(saved));storageOK=true;}catch{storageOK=false;}}
function commit(action){if(busy)return;try{const previous=state,owner=state.player;state=apply(state,action);selected=null;amount=0;operation=null;dirty=true;
    if(action.kind==='move')busy={kind:'move',action,owner,progress:0,start:performance.now(),duration:200/speed};
    if(action.kind==='pass'&&state.lastShots.length)busy={kind:'volley',shots:state.lastShots,progress:0,start:performance.now(),duration:1100/speed};
    status=action.kind==='deploy'?(state.pool?phaseText():'Nachschub verteilt. Bewegung, Bau und Umtausch sind frei.'):phaseText();
    if(action.kind==='convert'){selected=action.source;type=action.conversion==='horse'?'horse':action.conversion==='archer'?'archer':'soldier';amount=Math.min(1,available(state.p[selected],type));status='Einheiten getauscht. Verbrauchte Bewegung bleibt erhalten.';}
    if(['barracks','wall','demolishWall','tower','demolishTower','flag'].includes(action.kind)){selected=action.source;status={barracks:'Kaserne gebaut. Zwei Nachschubpunkte pro Zug.',wall:'Mauer gebaut. Fluss und Mauer zusammen vierteln die Angriffskraft.',demolishWall:'Mauer abgerissen: zwei Soldaten zurück.',tower:'Grenzturm gebaut. Ein Schuss pro eigenem Zug.',demolishTower:'Grenzturm abgerissen: zwei Soldaten zurück.',flag:'Fahne verlegt.'}[action.kind];}
    if(action.kind==='move'){const lost=previous.flags.findIndex((flag,id)=>id>0&&flag>=0&&state.flags[id]===-2);if(lost>0)status=`Fahne von ${NAMES[lost]} erobert: Alle Provinzen und Gebäude übernommen, gegnerische Einheiten entfernt.`;}
    save();updateUI();requestRender();
  }catch(error){announce(error.message);}}
function updateUI(){if(!state)return;$('setup').hidden=!setup;$('hud').hidden=setup;$('actions').hidden=setup;$('victory').hidden=true;if(setup){$('resume').hidden=!saved;return;}
  $('factions').replaceChildren(...Array.from({length:state.players},(_,i)=>{const id=i+1,el=document.createElement('div');el.className=`faction${id===state.player?' current':''}${state.phase!=='draft'&&!active(state,id)?' out':''}`;el.style.background=COLORS[id];el.textContent=`${NAMES[id].toUpperCase()} ${state.p.filter(p=>p.owner===id).length}`;return el;}));
  $('status').textContent=status||phaseText();const own=selected!==null&&state.p[selected].owner===state.player,normal=state.phase==='play'&&state.pool===0&&!busy;
  $('selection').hidden=!own||!normal;if(own){const movable=available(state.p[selected],type);amount=Math.max(0,Math.min(amount,movable));$('selection').textContent=`${amount} / ${movable} ${LABELS[type].toUpperCase()}`;$('amount').max=movable;$('amount').value=amount;}
  $('province-panel').hidden=!own||!normal;$('units-panel').hidden=tab!=='units';$('build-panel').hidden=tab!=='build';$('units-tab').setAttribute('aria-pressed',String(tab==='units'));$('build-tab').setAttribute('aria-pressed',String(tab==='build'));
  $('phase-hint').textContent=state.phase==='draft'?'Startprovinzen wählen':state.pool?`Noch ${state.pool} Soldaten frei platzieren`:operation?'Markierte Kante oder Ecke anklicken. Esc bricht ab.':own?'': 'Eigene Provinz anklicken, Einheiten auswählen und eine Nachbarprovinz anklicken.';
  $('unit-types').replaceChildren(...TYPES.map(t=>button(`${LABELS[t]} (${own?state.p[selected][t]:0})`,()=>{type=t;amount=Math.min(1,available(state.p[selected],type));updateUI();},false,t===type?'active':'')));
  const conversions=[['horse','3 S → 1 Reiter'],['footHorse','1 Reiter → 2 S'],['archer','10 S → 1 Bogen'],['footArcher','1 Bogen → 5 S']];
  $('conversions').replaceChildren(...conversions.map(([conversion,label])=>button(label,()=>commit({kind:'convert',source:selected,conversion}),!own||!legal(state,{kind:'convert',source:selected,conversion}))));
  const build=$('build-panel');build.replaceChildren();if(own){const p=state.p[selected];build.append(button(p.barracks?'Kaserne gebaut':'Kaserne · 10',()=>commit({kind:'barracks',source:selected}),!legal(state,{kind:'barracks',source:selected})),button(operation==='buildWall'?'Abbrechen':'Mauer · 5',()=>chooseOperation('buildWall'),!state.links[selected].some(l=>legal(state,{kind:'wall',source:selected,target:l.target}))),button(operation==='buildTower'?'Abbrechen':'Grenzturm · 5',()=>chooseOperation('buildTower'),!state.corners.some((_,target)=>legal(state,{kind:'tower',source:selected,target}))),button(state.flags[state.player]===selected?'Fahne steht hier':'Fahne hierher · 10',()=>commit({kind:'flag',source:selected}),!legal(state,{kind:'flag',source:selected})));
    if(state.walls.some(w=>w.startsWith(`${selected}:`)))build.append(button(operation==='demolishWall'?'Abbrechen':'Mauer abreißen · +2',()=>chooseOperation('demolishWall'),false,'danger'));
    if(state.towers.some(t=>t.province===selected))build.append(button(operation==='demolishTower'?'Abbrechen':'Turm abreißen · +2',()=>chooseOperation('demolishTower'),false,'danger'));
  }
  $('end-turn').textContent=state.phase==='draft'?'Startprovinz wählen':state.pool?`Nachschub: ${state.pool}`:'Zug passen';$('end-turn').disabled=!normal;$('speed').textContent=`Tempo ${speed}×`;
  const won=winner(state);if(won!==null||state.drawn){$('victory').hidden=false;$('winner-title').textContent=state.drawn?'Remis':`${NAMES[won]} gewinnt`;$('winner-title').style.color=state.drawn?'#c8e8ef':COLORS[won];$('victory-text').textContent=state.drawn?'Das Rundenlimit ist erreicht.':'Die letzte aktive Fraktion beherrscht die Welt.';$('province-panel').hidden=true;$('end-turn').disabled=true;}
  if(!storageOK)$('status').textContent+=' Automatisches Speichern ist in diesem Browser nicht verfügbar.';
}
function button(text,fn,disabled=false,cls=''){const b=document.createElement('button');b.textContent=text;b.disabled=disabled;b.className=cls;b.addEventListener('click',fn);return b;}
function chooseOperation(op){operation=operation===op?null:op;dirty=true;updateUI();requestRender();}
function selectAt(x,y,all=false){if(setup||busy||state.drawn||winner(state)!==null)return;const point=screenToWorld(x,y),id=world.provinces.findIndex(p=>inside(point,p.cell));
  if(state.phase==='draft'){if(id>=0&&state.p[id].owner===0){state=chooseStart(state,id);status=phaseText();dirty=true;save();updateUI();requestRender();}else announce('Wähle eine freie grüne Provinz.');return;}
  if(state.pool>0){if(id>=0&&state.p[id].owner===state.player)commit({kind:'deploy',source:id,amount:1});else announce(phaseText());return;}
  if(operation&&selected!==null){const choices=targets();let nearest=null,d=Infinity;for(const target of choices){const value=operation.includes('Tower')?dist2(point,towerPoint({province:selected,corner:target})):segmentDistance(point,edgeFor(selected,target).a,edgeFor(selected,target).b);if(value<d){d=value;nearest=target;}}
    const tolerance=20/(mapSize*zoom);if(nearest!==null&&d<tolerance*tolerance){commit({kind:operation==='buildTower'?'tower':operation==='buildWall'?'wall':operation,source:selected,target:nearest});return;}if(id<0){clearSelection();return;}announce('Bitte direkt auf eine markierte Kante oder Ecke klicken.');return;
  }
  if(id<0){clearSelection();return;}const p=state.p[id];
  if(all&&p.owner===state.player){selected=id;amount=available(p,type);dirty=true;updateUI();requestRender();return;}
  if(selected===id){const n=available(p,type);amount=n?(amount>=n?0:amount+1):0;updateUI();requestRender();return;}
  if(selected===null||amount===0){if(p.owner===state.player){selected=id;amount=Math.min(1,available(p,type));tab='units';dirty=true;updateUI();requestRender();}else announce('Wähle zuerst eine eigene Provinz.');return;}
  const action={kind:'move',source:selected,target:id,amount,type};if(legal(state,action))commit(action);else if(p.owner===state.player){selected=id;amount=Math.min(1,available(p,type));dirty=true;updateUI();requestRender();}else announce(type==='archer'?'Bogenschützen ziehen nur in eigene Provinzen.':'Nur direkt verbundene Nachbarn können angegriffen werden. Gebirge blockieren den Weg.');
}
function clearSelection(){if(!state)return;selected=null;amount=0;operation=null;status=phaseText();dirty=true;updateUI();requestRender();}
function zoomAt(x,y,next){const point=screenToWorld(x,y);zoom=Math.max(.55,Math.min(4,next));pan.x=x-mapCenter.x-(point.x-.5)*mapSize*zoom;pan.y=y-mapCenter.y-(point.y-.5)*mapSize*zoom;requestRender();}
canvas.addEventListener('wheel',e=>{e.preventDefault();zoomAt(e.clientX,e.clientY,zoom*Math.exp(-e.deltaY*.0013));},{passive:false});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{if(e.button!==0&&e.button!==2)return;canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});drag={x:e.clientX,y:e.clientY,pan:{...pan},moved:false,right:e.button===2,time:performance.now()};if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom,point:screenToWorld((a.x+b.x)/2,(a.y+b.y)/2)};}});
canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pinch&&pointers.size===2){const [a,b]=[...pointers.values()],x=(a.x+b.x)/2,y=(a.y+b.y)/2;zoom=Math.max(.55,Math.min(4,pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/pinch.distance));pan.x=x-mapCenter.x-(pinch.point.x-.5)*mapSize*zoom;pan.y=y-mapCenter.y-(pinch.point.y-.5)*mapSize*zoom;if(drag)drag.moved=true;requestRender();}else if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>5)drag.moved=true;if(drag.moved){pan={x:drag.pan.x+dx,y:drag.pan.y+dy};requestRender();}}});
canvas.addEventListener('pointerup',e=>{pointers.delete(e.pointerId);if(drag&&!drag.moved&&!drag.right&&!pinch)selectAt(e.clientX,e.clientY,performance.now()-drag.time>500);drag=null;pinch=null;});
canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);drag=null;pinch=null;});
canvas.addEventListener('dblclick',e=>{e.preventDefault();selectAt(e.clientX,e.clientY,true);});
window.addEventListener('keydown',e=>{if(e.key==='Escape')clearSelection();});window.addEventListener('resize',resize);
$('units-tab').onclick=()=>{tab='units';operation=null;dirty=true;updateUI();requestRender();};$('build-tab').onclick=()=>{tab='build';updateUI();};
$('amount').oninput=()=>{amount=Number($('amount').value);updateUI();requestRender();};$('less').onclick=()=>{amount=Math.max(0,amount-1);updateUI();requestRender();};$('more').onclick=()=>{if(selected!==null)amount=Math.min(available(state.p[selected],type),amount+1);updateUI();requestRender();};$('all').onclick=()=>{if(selected!==null)amount=available(state.p[selected],type);updateUI();requestRender();};
$('end-turn').onclick=()=>commit({kind:'pass'});$('speed').onclick=()=>{speed=({1:4,4:12,12:1})[speed];updateUI();};
$('menu').onclick=()=>{if(busy)return;setup=true;clearSelection();updateUI();};$('new-game').onclick=()=>{setup=true;clearSelection();updateUI();};
function prepareWorld(){paths.clear();layouts.clear();world.provinces.forEach((p,id)=>paths.set(id,polyPath(p.cell)));zoom=1;pan={x:0,y:0};dirty=true;}
async function regenerate(){const b=$('regenerate');b.disabled=true;$('start').disabled=true;$('setup-status').textContent='Die Welt entsteht …';await new Promise(requestAnimationFrame);await new Promise(resolve=>setTimeout(resolve,10));try{world=generateWorld(settings);state=createState(world,settings.players);prepareWorld();$('setup-status').textContent='Bereit. Alle Fraktionen werden von Menschen gespielt.';updateUI();requestRender();}catch(error){$('setup-status').textContent=error.message;}finally{b.disabled=false;$('start').disabled=!world;}}
function playerButtons(){$('players').replaceChildren(...Array.from({length:6},(_,i)=>button(String(i+1),()=>{settings.players=i+1;playerButtons();},false,settings.players===i+1?'active':'')));}
for(const key of ['rivers','mountains','lakes']){$(key).oninput=()=>{settings[key]=Number($(key).value);$(`${key}-value`).textContent=settings[key];};$(key).onchange=regenerate;}
$('regenerate').onclick=regenerate;$('start').onclick=()=>{if(!world)return;state=createState(world,settings.players);setup=false;selected=null;operation=null;busy=null;amount=0;status=phaseText();dirty=true;save();updateUI();requestRender();};
$('resume').onclick=()=>{if(!saved)return;try{world=saved.world;state=saved.state;settings={...settings,...saved.settings};playerButtons();for(const key of ['rivers','mountains','lakes']){$(key).value=settings[key];$(`${key}-value`).textContent=settings[key];}setup=false;selected=null;operation=null;busy=null;prepareWorld();status=phaseText();updateUI();requestRender();}catch{announce('Die gespeicherte Partie konnte nicht geladen werden.');}};
try{const text=localStorage.getItem('orbis-terrarum-v1');if(text){const data=JSON.parse(text);if(data.version===1&&data.world?.provinces?.length&&data.state?.p?.length===data.world.provinces.length)saved=data;}}catch{storageOK=false;}
playerButtons();resize();regenerate();
