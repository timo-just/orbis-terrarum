import {drawRivers} from './rivers.mjs?v=ai-26';
import {drawFlag,flagPosition} from './flags.mjs?v=ai-26';
import {towerAnchor,wallRoute,drawJoinedWall,drawTower} from './fortifications.mjs?v=ai-26';
import {drawOrnateFrame} from './frame.mjs?v=ai-26';
import {drawParchment} from './parchment.mjs?v=ai-26';
import {drawMountain} from './mountains.mjs?v=ai-26';
import {drawUnit as unit} from './units.mjs?v=ai-26';
import {drawBarracks} from './barracks.mjs?v=ai-26';
import {getLanguage,setLanguage,applyTranslations,translate} from './i18n.mjs?v=ai-26';
import {guideHTML} from './guide.mjs?v=ai-26';
import {snapshotLink,readSnapshot,validateSave,listSaves,deleteSave} from './offline.mjs?v=ai-26';
import {makeBattle,drawBattles,displayOwners} from './combat.mjs?v=ai-26';
import {OnlineGame} from './online.mjs?v=ai-26';
import {TYPES,COLORS,NAMES,createState,chooseStart,legal,apply,winner,active,available,total,shade,undoOwner} from './engine.mjs?v=ai-26';
import {generateWorld,inside,dist2,segmentDistance,center,rng} from './world.mjs?v=ai-26';

const $=id=>document.getElementById(id), canvas=$('map'),ctx=canvas.getContext('2d'),scene=document.createElement('canvas');
scene.width=scene.height=1400;const g=scene.getContext('2d'),S=1400;
const LABELS={soldier:'Soldaten',horse:'Reiter',archer:'Bogenschützen'};
let world,state,settings={players:4,rivers:2,mountains:3,lakes:5,provinces:100},selected=null,type='soldier',amount=0,operation=null,tab='move';
let aiTurnKey='',aiTurnActions=0;
let gameMode='human',aiWorker=null,aiRequest=0,aiPending=false,aiTimer=null,nextStarter=null,roundStarter=null;
let setup=true,zoom=1,pan={x:0,y:0},dirty=true,framePending=false,speed=4,busy=null,status='',saved=null,storageOK=true;
let viewport={left:0,top:0,width:0,height:0},W=innerWidth,H=innerHeight,DPR=Math.min(devicePixelRatio||1,3),mapSize=600,mapCenter={x:W/2,y:H*.43};
let mapOrigin={x:.5,y:.5},mapBounds={x:0,y:0,w:1,h:1};
const pointers=new Map();let drag=null,pinch=null,layoutSetup=null,fitCamera=true;
const online=new OnlineGame(receiveOnline,message=>{$('connection-status').textContent=message;});
let onlinePending=false,pendingRoom=null,lobbyNameDirty=false,hasGame=false,menuOpen=false,controlsCache=null,factionsKey='';
const terrain=document.createElement('canvas');terrain.width=terrain.height=S;const terrainContext=terrain.getContext('2d');let terrainKey='';
const polyPath=poly=>{const p=new Path2D();poly.forEach((v,i)=>i?p.lineTo(v.x*S,v.y*S):p.moveTo(v.x*S,v.y*S));p.closePath();return p;};
const paths=new Map(),layouts=new Map(),piecePositions=new Map(),fortPositions=new Map(),flagPositions=new Map();let vegetation=null,battles=[];const ocean=document.createElement('canvas');let oceanKey='';

function screenToWorld(x,y){return {x:mapOrigin.x+(x-mapCenter.x-pan.x)/(mapSize*zoom),y:mapOrigin.y+(y-mapCenter.y-pan.y)/(mapSize*zoom)};}
function worldToScreen(p){return {x:mapCenter.x+pan.x+(p.x-mapOrigin.x)*mapSize*zoom,y:mapCenter.y+pan.y+(p.y-mapOrigin.y)*mapSize*zoom};}
function resize(){const rect=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,3);if(!rect.width||!rect.height)return;if(!fitCamera&&viewport.left===rect.left&&viewport.top===rect.top&&viewport.width===rect.width&&viewport.height===rect.height&&DPR===ratio)return;const oldCenter=mapCenter,keepCamera=hasGame&&!setup&&!fitCamera&&viewport.width>0&&(Math.abs(zoom-1)>.001||Math.abs(pan.x)+Math.abs(pan.y)>.1);viewport={left:rect.left,top:rect.top,width:rect.width,height:rect.height};W=rect.width;H=rect.height;DPR=ratio;canvas.width=Math.round(W*DPR);canvas.height=Math.round(H*DPR);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';mapCenter={x:rect.left+W/2,y:rect.top+H/2};if(keepCamera){pan.x+=oldCenter.x-mapCenter.x;pan.y+=oldCenter.y-mapCenter.y;if(selected!==null){const point=worldToScreen(world.provinces[selected].home),margin=24;pan.x+=Math.max(rect.left+margin,Math.min(rect.right-margin,point.x))-point.x;pan.y+=Math.max(rect.top+margin,Math.min(rect.bottom-margin,point.y))-point.y;}}else{mapSize=Math.max(1,Math.min((W-56)/mapBounds.w,(H-56)/mapBounds.h));if(fitCamera){zoom=1;pan={x:0,y:0};}}fitCamera=false;requestRender();}

new ResizeObserver(resize).observe(canvas);

function requestRender(){if(framePending)return;framePending=true;requestAnimationFrame(render);}
function drawLine(context,a,b,width,color){context.beginPath();context.moveTo(a.x*S,a.y*S);context.lineTo(b.x*S,b.y*S);context.strokeStyle=color;context.lineWidth=width;context.lineCap='round';context.stroke();}

function towerPoint(t){const key=t.province+':'+t.corner;if(!fortPositions.has(key))fortPositions.set(key,towerAnchor(world.provinces[t.province].cell,world.corners[t.corner].point,5.8/S));return fortPositions.get(key);}
function joinedWall(edge,province){const at=(point,index)=>{const corner=edge.vertices?.[index]??world.corners.findIndex(c=>dist2(c.point,point)<1e-12),tower=state.towers.find(t=>t.province===province&&t.corner===corner);return tower?towerPoint(tower):null;};return wallRoute(edge,world.provinces[province].home,at(edge.a,0),at(edge.b,1),S);}

function wallSegment(edge,province){const c=world.provinces[province].home,dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len,sign=((c.x-(edge.a.x+edge.b.x)/2)*nx+(c.y-(edge.a.y+edge.b.y)/2)*ny)>=0?1:-1,offset=3.2/S*sign;return {a:{x:edge.a.x+nx*offset,y:edge.a.y+ny*offset},b:{x:edge.b.x+nx*offset,y:edge.b.y+ny*offset}};}
function edgeFor(a,b){return world.edges.find(e=>e.provinces.includes(a)&&e.provinces.includes(b));}
function dark(color){const n=parseInt(color.slice(1),16);return `rgb(${(n>>16)*.55},${(n>>8&255)*.55},${(n&255)*.55})`;}
function anchor(id){const p=world.provinces[id],mountains=world.edges.filter(e=>e.mountain&&e.provinces.includes(id)),fits=v=>inside(v,p.cell)&&mountains.every(e=>segmentDistance(v,e.a,e.b)>.0001);
  if(fits(p.home))return p.home;for(let i=0;i<24;i++){const angle=i*2.39996,d=.003+Math.sqrt(i)*.004,v={x:p.home.x+Math.cos(angle)*d,y:p.home.y+Math.sin(angle)*d};if(fits(v))return v;}return p.home;
}
function symbolPositions(id,counts,structures){const cache=JSON.stringify([id,counts,structures,state.walls.filter(w=>w.startsWith(`${id}:`))]);if(layouts.has(cache))return layouts.get(cache);const p=world.provinces[id],poly=p.cell,base=anchor(id),radius=6.4/S,mountainEdges=world.edges.filter(e=>e.mountain&&e.provinces.includes(id)),wallEdges=state.walls.map(w=>w.split(':').map(Number)).filter(([a])=>a===id).map(([a,b])=>edgeFor(a,b)).filter(Boolean);
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
function displayCounts(id){const p=state.p[id],counts=Object.fromEntries(TYPES.map(t=>[t,p[t]]));for(const t of TYPES){let hidden=0;for(const b of battles)if(b.action.target===id)hidden=Math.max(hidden,b.hidden[t]);counts[t]=Math.max(0,counts[t]-hidden);}if(busy?.kind==='volley')busy.shots.forEach((shot,i)=>{if(shot.target===id&&busy.progress<.55+(i%6)*.06)counts[shot.type]++;});return counts;}
function drawScene(){g.clearRect(0,0,S,S);const owners=displayOwners(state,battles),nextTerrainKey=world.seed+':'+owners.join(',');if(terrainKey===nextTerrainKey){g.drawImage(terrain,0,0);}else{world.provinces.forEach((p,id)=>{
    const path=paths.get(id);g.fillStyle=COLORS[owners[id]];g.fill(path);g.strokeStyle='#fafcfde8';g.lineWidth=1.5;g.stroke(path);
  });
  // Lakes are whole water cells. Paint together, outline only the actual shore.
  drawLakes(g);
  world.coast.forEach(e=>{drawLine(g,e.a,e.b,5,'#d4d2a6');drawLine(g,e.a,e.b,1.7,'#eff5db');});
  g.save();const landClip=new Path2D();paths.forEach(path=>landClip.addPath(path));g.clip(landClip);
  world.edges.forEach(e=>{if(e.river){}else if(e.mountain){
    drawMountain(g,e,paths,S);
  }});
  g.restore();
  g.save();const riverClip=new Path2D();paths.forEach(path=>riverClip.addPath(path));g.clip(riverClip);drawRivers(g,world.edges,S);g.restore();
  terrainContext.clearRect(0,0,S,S);terrainContext.drawImage(scene,0,0);terrainKey=nextTerrainKey;}
}
function drawPieces(g){if(vegetation){g.fillStyle='#244f3980';g.fill(vegetation.shadow);g.fillStyle='#357747';g.fill(vegetation.leaves);g.fillStyle='#50894a';g.fill(vegetation.mid);g.fillStyle='#77a55d';g.fill(vegetation.light);g.strokeStyle='#b7ce9670';g.lineWidth=.8;g.stroke(vegetation.grass);}g.save();const clip=new Path2D();paths.forEach(path=>clip.addPath(path));g.clip(clip);g.restore();g.strokeStyle='#f6fbf0';g.lineWidth=1.1;paths.forEach(path=>g.stroke(path));g.save();const riverClip=new Path2D();paths.forEach(path=>riverClip.addPath(path));g.clip(riverClip);drawRivers(g,world.edges,S);g.restore();
  state.walls.forEach(key=>{const [a,b]=key.split(':').map(Number),edge=edgeFor(a,b);if(!edge)return;g.save();g.clip(paths.get(a));drawJoinedWall(g,joinedWall(edge,a),COLORS[state.p[a].owner],S);g.restore();});
  if(selected!==null){g.strokeStyle='#fff';g.lineWidth=4;g.stroke(paths.get(selected));}
  const obstacles=state.p.map(()=>[]);
  state.p.forEach((p,id)=>{if(p.barracks){const c=anchor(id),x=c.x-.012,y=c.y+.008;drawBarracks(g,x*S,y*S,COLORS[p.owner]);obstacles[id].push([x-.006,y-.009,x+.006,y+.009]);}});
  state.towers.forEach(t=>{const p=towerPoint(t);drawTower(g,p.x*S,p.y*S,COLORS[state.p[t.province].owner]);obstacles[t.province].push([p.x-.005,p.y-.008,p.x+.005,p.y+.008]);});
  for(let player=1;player<=state.players;player++){const id=state.flags[player];if(id<0)continue;if(!flagPositions.has(id)){const p=anchor(id);flagPositions.set(id,flagPosition(world.provinces[id],{x:p.x+11/S,y:p.y-3/S},S));}const p=flagPositions.get(id),x=p.x*S,y=p.y*S;drawFlag(g,x,y,COLORS[player]);obstacles[id].push([(x-4)/S,(y-22)/S,(x+14)/S,(y+3)/S]);}
  if(!setup&&state.phase!=='draft')state.p.forEach((p,id)=>{const counts=displayCounts(id),positions=symbolPositions(id,Object.fromEntries(TYPES.map(t=>[t,p[t]])),obstacles[id]);piecePositions.set(id,positions);g.save();g.clip(paths.get(id));TYPES.forEach(t=>(positions[t]||[]).slice(0,counts[t]).forEach((pos,i)=>unit(g,t,pos.x*S,pos.y*S,COLORS[p.owner],shade(p,t,i,state.player),5.2,selected===id&&t===type&&i<amount)));g.restore();});
  if(operation&&selected!==null){for(const target of targets()){if(operation.includes('Tower')){const p=towerPoint({province:selected,corner:target});g.fillStyle='#fff';g.beginPath();g.arc(p.x*S,p.y*S,6,0,Math.PI*2);g.fill();g.strokeStyle='#263d4c';g.lineWidth=1.4;g.stroke();}else{const edge=edgeFor(selected,target);if(edge)drawLine(g,edge.a,edge.b,5,'#fff9ae');}}}
}
function render(time){framePending=false;ctx.setTransform(DPR,0,0,DPR,-viewport.left*DPR,-viewport.top*DPR);ctx.clearRect(viewport.left,viewport.top,W,H);drawOcean(ctx);
  if(!world||!state)return;const previousBattleCount=battles.length;battles=battles.filter(b=>time-b.start<b.duration);if(battles.length!==previousBattleCount)dirty=true;if(battles.length)requestRender();if(busy){busy.progress=Math.min(1,(time-busy.start)/busy.duration);if(busy.progress>=1){busy=null;dirty=true;}else if(busy.kind==='volley')dirty=true;}
  if(dirty){drawScene();dirty=false;}
  ctx.save();const sheet=paperRect();ctx.beginPath();ctx.rect(sheet.x+15*zoom,sheet.y+15*zoom,sheet.w-30*zoom,sheet.h-30*zoom);ctx.clip();ctx.save();ctx.translate(mapCenter.x+pan.x,mapCenter.y+pan.y);ctx.scale(mapSize*zoom/S,mapSize*zoom/S);ctx.drawImage(scene,-mapOrigin.x*S,-mapOrigin.y*S);ctx.translate(-mapOrigin.x*S,-mapOrigin.y*S);drawPieces(ctx);drawBattles(ctx,battles,time,COLORS,unit,piecePositions,S);ctx.restore();
  if(busy){if(busy.kind==='move'){const from=worldToScreen(world.provinces[busy.action.source].home),to=worldToScreen(world.provinces[busy.action.target].home),t=busy.progress;ctx.strokeStyle=COLORS[busy.owner];ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();const n=Math.max(1,busy.action.amount),rows=Math.min(5,n),cols=Math.ceil(n/rows),r=2.8*mapSize*zoom/S;for(let i=0;i<n;i++)unit(ctx,busy.action.type,from.x+(to.x-from.x)*t+(Math.floor(i/rows)-(cols-1)/2)*r*2.5,from.y+(to.y-from.y)*t+(i%rows-(rows-1)/2)*r*1.15,COLORS[busy.owner],0,r);}
    else busy.shots.forEach((shot,i)=>{const start=shot.tower===null?world.provinces[shot.source].home:towerPoint({province:shot.source,corner:shot.tower}),from=worldToScreen(start),to=worldToScreen(world.provinces[shot.target].home),impact=.55+(i%6)*.06,t=busy.progress/impact;if(t<1){const x=from.x+(to.x-from.x)*t,y=from.y+(to.y-from.y)*t-Math.sin(t*Math.PI)*25;ctx.strokeStyle='#384654';ctx.fillStyle='#384654';if(shot.arrow){ctx.beginPath();ctx.moveTo(x-4,y+3);ctx.lineTo(x+4,y-3);ctx.stroke();}else{ctx.beginPath();ctx.arc(x,y,2.3,0,Math.PI*2);ctx.fill();}}else{const phase=(busy.progress-impact)/.18;if(phase<1){ctx.fillStyle=`rgba(255,205,91,${1-phase})`;ctx.beginPath();ctx.arc(to.x,to.y,3+phase*13,0,Math.PI*2);ctx.fill();}}});requestRender();
  }else if($('end-turn').disabled&&state.pool===0)updateUI();ctx.restore();drawFrame(ctx);
}
function targets(){if(selected===null||!operation)return [];const kind=operation==='buildWall'?'wall':operation==='demolishWall'?'demolishWall':operation==='buildTower'?'tower':'demolishTower';return (kind.includes('ower')?world.corners.map((_,i)=>i):state.links[selected].map(l=>l.target)).filter(target=>legal(state,{kind,source:selected,target}));}
function announce(text){status=text;updateUI();requestRender();}
let deployAmount=1;
function phaseText(){if(state.phase==='draft')return `${NAMES[state.player]} wählt eine freie Startprovinz. Wer zuerst wählt, zieht zuletzt.`;if(state.pool>0)return '';return `${NAMES[state.player]} ist am Zug.`;}
function isAITurn(){return !online.room&&gameMode==='ai'&&!setup&&state?.player!==1;}
function cancelAI(){clearTimeout(aiTimer);aiTimer=null;aiRequest++;aiPending=false;if(aiWorker){aiWorker.terminate();aiWorker=null;}}
function scheduleAI(){if(aiPending||aiTimer||!isAITurn()||menuOpen||state.drawn||winner(state)!==null)return;aiTimer=setTimeout(()=>{aiTimer=null;if(!isAITurn()||menuOpen)return;aiPending=true;const id=++aiRequest;if(!aiWorker){aiWorker=new Worker(new URL('./ai-worker.mjs',import.meta.url),{type:'module'});aiWorker.onmessage=({data})=>{if(data.id!==aiRequest)return;aiPending=false;if(!isAITurn()||menuOpen)return;if(data.error){announce('AI: '+data.error);return;}if(data.action?.kind==='draft'){state=chooseStart(state,data.action.source);dirty=true;save();updateUI();requestRender();}else if(data.action){const key=state.turns+':'+state.player;if(aiTurnKey!==key){aiTurnKey=key;aiTurnActions=0;}aiTurnActions++;commit(!state.pool&&aiTurnActions>40?{kind:'pass'}:data.action);}};aiWorker.onerror=()=>{aiPending=false;announce('AI could not load. Reload the game.');};}aiWorker.postMessage({id,state});},180);}
function save(){try{saved={version:1,world,state,settings:{...settings},mode:gameMode};localStorage.setItem('orbis-terrarum-v1',JSON.stringify(saved));storageOK=true;}catch{storageOK=false;}}
function commit(action){if(gameMode==='ai'&&!online.room&&action.kind==='undo'&&undoOwner(state)!==1)return;if(online.room){sendOnlineAction(action);return;}try{const previous=state,owner=state.player;state=apply(state,action);selected=null;amount=0;operation=null;dirty=true;
    if(action.kind==='move'){const b=makeBattle(action,previous,state,world);if(b)battles.push(b);}if(action.kind==='undo'){battles=[];busy=null;}
    if(['pass','shoot'].includes(action.kind)&&state.lastShots.length)busy={kind:'volley',shots:state.lastShots,progress:0,start:performance.now(),duration:1100/speed};
    status=action.kind==='deploy'?(state.pool?phaseText():'Nachschub verteilt. Bewegung, Bau und Umtausch sind frei.'):phaseText();
    if(action.kind==='convert'){selected=action.source;type=action.conversion==='horse'?'horse':action.conversion==='archer'?'archer':'soldier';amount=Math.min(1,available(state.p[selected],type));status='Einheiten getauscht. Verbrauchte Bewegung bleibt erhalten.';}
    if(['barracks','demolishBarracks','wall','demolishWall','tower','demolishTower','flag'].includes(action.kind)){selected=action.source;status={demolishBarracks:'Kaserne abgerissen: fünf Soldaten zurück.',barracks:'Kaserne gebaut. Zwei Nachschubpunkte pro Zug.',wall:'Mauer gebaut. Fluss und Mauer zusammen vierteln die Angriffskraft.',demolishWall:'Mauer abgerissen: zwei Soldaten zurück.',tower:'Grenzturm gebaut. Ein Schuss pro eigenem Zug.',demolishTower:'Grenzturm abgerissen: zwei Soldaten zurück.',flag:'Fahne verlegt.'}[action.kind];}
    if(action.kind==='move'){const lost=previous.flags.findIndex((flag,id)=>id>0&&flag>=0&&state.flags[id]===-2);if(lost>0)status=`Fahne von ${NAMES[lost]} erobert: Alle Provinzen und Gebäude übernommen, gegnerische Einheiten entfernt.`;}
    save();updateUI();requestRender();
  }catch(error){announce(error.message);}}
function updateUI(){if(!state)return;scheduleAI();updateLobbyControls();$('setup').hidden=!setup||Boolean(online.room)||Boolean(pendingRoom);document.body.classList.toggle('choosing-map',setup);document.body.classList.toggle('menu-open',menuOpen);$('topbar').hidden=!hasGame&&!online.room;$('menu').disabled=!hasGame;$('menu').setAttribute('aria-expanded',String(menuOpen));$('local-menu').hidden=!menuOpen||Boolean(online.room);if(online.room)$('lobby').hidden=online.snapshot?.status!=='lobby'&&!menuOpen;if(layoutSetup!==setup){layoutSetup=setup;fitCamera=true;}$('topbar').dataset.playing=String(!setup);$('topbar').dataset.players=String(state.players);$('turn-banner').hidden=setup;$('turn-label').hidden=setup;$('hud').hidden=setup;$('actions').hidden=setup||menuOpen;$('victory').hidden=true;if(setup){$('resume').hidden=!saved;resize();return;}
  const english=getLanguage()==='en',seat=online.snapshot?.seats?.find(s=>s.color===state.player),turnName=seat?.name||translate(NAMES[state.player]);
  $('topbar').style.setProperty('--turn-color',COLORS[state.player]);$('topbar').style.setProperty('--turn-ink',state.player===4?'#24313b':'#ffffff');
  $('turn-label').textContent=english?`${turnName}'s turn`:`${turnName} am Zug`;$('turn-label').title=$('turn-label').textContent;$('turn-label').hidden=setup;
  $('reinforcement-total').hidden=state.phase!=='play'||state.pool===0;$('reinforcement-count').textContent=state.pool;
  $('reinforcement-label').textContent=english?'soldiers left to place':'Soldaten verteilen';
  const nextFactionsKey=state.player+state.phase+state.p.map(p=>p.owner).join(',');if(factionsKey!==nextFactionsKey){factionsKey=nextFactionsKey;$('factions').replaceChildren(...Array.from({length:state.players},(_,i)=>{const id=i+1,el=document.createElement('div');el.className=`faction${id===state.player?' current':''}${state.phase!=='draft'&&!active(state,id)?' out':''}`;el.style.background=COLORS[id];const name=document.createElement('span'),count=document.createElement('span');name.className='faction-name';count.className='faction-count';name.textContent=NAMES[id].toUpperCase();count.textContent=state.p.filter(p=>p.owner===id).length;el.append(name,count);return el;}));}
  $('status').textContent=online.room?`Du: ${NAMES[online.color]}. ${onlinePending?'Aktion wird gespeichert …':phaseText()}`:status||phaseText();const own=!isAITurn()&&selected!==null&&state.p[selected].owner===state.player&&(!online.room||online.myTurn),normal=!isAITurn()&&state.phase==='play'&&state.pool===0&&!onlinePending&&(!online.room||online.myTurn);
  $('selection').hidden=!own||!normal;if(own){const movable=available(state.p[selected],type);amount=Math.max(0,Math.min(amount,movable));$('selection').textContent=`${amount} / ${movable} ${LABELS[type].toUpperCase()}`;$('amount').max=movable;$('amount').value=amount;}
  $('province-panel').hidden=!own||!normal;$('units-panel').hidden=tab!=='move';$('trade-panel').hidden=tab!=='trade';$('archer-hint').hidden=type!=='archer';$('build-panel').hidden=tab!=='build';$('units-tab').setAttribute('aria-pressed',String(tab==='move'));$('build-tab').setAttribute('aria-pressed',String(tab==='build'));$('trade-tab').setAttribute('aria-pressed',String(tab==='trade'));
  $('deploy-controls').hidden=state.phase!=='play'||state.pool===0;$('actions').classList.toggle('deploying',state.pool>0);
  if(state.pool>0){deployAmount=Math.max(1,Math.min(deployAmount,state.pool));$('selection').hidden=true;$('deploy-value').textContent=deployAmount;$('deploy-range').max=state.pool;$('deploy-range').value=deployAmount;const allowed=canUseShortcuts();$('deploy-range').disabled=!allowed;$('deploy-less').disabled=!allowed||deployAmount<=1;$('deploy-more').disabled=!allowed||deployAmount>=state.pool;}else deployAmount=1;
  if(state.pool>0)$('status').textContent=onlinePending?(english?'Saving action …':'Aktion wird gespeichert …'):'';
  $('status').hidden=!$('status').textContent;

  $('phase-hint').textContent=state.phase==='draft'?'Startprovinzen wählen':state.pool?`Noch ${state.pool} Soldaten frei platzieren`:operation?'Markierte Kante oder Ecke anklicken. Esc bricht ab.':own?'': 'Eigene Provinz anklicken, Einheiten auswählen und eine Nachbarprovinz anklicken.';
  const sameControls=controlsCache&&controlsCache.state===state&&controlsCache.selected===selected&&controlsCache.type===type&&controlsCache.operation===operation&&controlsCache.tab===tab;
  if(!sameControls){controlsCache={state,selected,type,operation,tab};
  $('unit-types').replaceChildren(...TYPES.map(t=>button(`${LABELS[t]} (${own?state.p[selected][t]:0})`,()=>{type=t;amount=Math.min(1,available(state.p[selected],type));updateUI();},false,t===type?'active':'')));
  const conversions=[['horse','3 S → 1 Reiter'],['footHorse','1 Reiter → 2 S'],['archer','5 S → 1 Bogen'],['footArcher','1 Bogen → 3 S']];
  $('conversions').replaceChildren(...conversions.map(([conversion,label])=>button(label,()=>commit({kind:'convert',source:selected,conversion}),!own||!legal(state,{kind:'convert',source:selected,conversion}))));
  const build=$('build-panel');build.replaceChildren();if(own){const p=state.p[selected];build.append(button(p.barracks?'Kaserne gebaut':'Kaserne · 10',()=>commit({kind:'barracks',source:selected}),!legal(state,{kind:'barracks',source:selected})),button(operation==='buildWall'?'Abbrechen':'Mauer · 5',()=>chooseOperation('buildWall'),!state.links[selected].some(l=>legal(state,{kind:'wall',source:selected,target:l.target}))),button(operation==='buildTower'?'Abbrechen':'Grenzturm · 5',()=>chooseOperation('buildTower'),!state.corners.some((_,target)=>legal(state,{kind:'tower',source:selected,target}))),button(state.flags[state.player]===selected?'Fahne steht hier':'Fahne hierher · 10',()=>commit({kind:'flag',source:selected}),!legal(state,{kind:'flag',source:selected})));
    if(p.barracks)build.append(button('Kaserne abreißen · +5',()=>commit({kind:'demolishBarracks',source:selected}),!legal(state,{kind:'demolishBarracks',source:selected}), 'danger'));
    if(state.walls.some(w=>w.startsWith(`${selected}:`)))build.append(button(operation==='demolishWall'?'Abbrechen':'Mauer abreißen · +2',()=>chooseOperation('demolishWall'),false,'danger'));
    if(state.towers.some(t=>t.province===selected))build.append(button(operation==='demolishTower'?'Abbrechen':'Turm abreißen · +2',()=>chooseOperation('demolishTower'),false,'danger'));
  }
  }
  for(const [id,key] of [['build-tab','E'],['trade-tab','W'],['units-tab','Q']])$(id).dataset.shortcut=key;
  for(const id of ['unit-types','conversions','build-panel'])[...$(id).children].forEach((b,i)=>{if(i<4)b.dataset.shortcut='ASDF'[i];});$('all').dataset.shortcut='F';
  $('end-turn').textContent=state.phase==='draft'?'Startprovinz wählen':state.pool?(english?`${deployAmount} per click`:`${deployAmount} pro Klick`):'Zug passen';$('end-turn').disabled=!normal;$('undo').disabled=isAITurn()||(gameMode==='ai'&&undoOwner(state)!==1)||!legal(state,{kind:'undo',player:online.room?online.color:undoOwner(state)});
  const won=winner(state);if(won!==null||state.drawn){$('victory').hidden=false;$('winner-title').textContent=state.drawn?'Remis':`${NAMES[won]} gewinnt`;$('winner-title').style.color=state.drawn?'#c8e8ef':COLORS[won];$('victory-text').textContent=state.drawn?'Das Rundenlimit ist erreicht.':'Die letzte aktive Fraktion beherrscht die Welt.';$('province-panel').hidden=true;$('end-turn').disabled=true;}
  if(!storageOK)$('status').textContent+=' Automatisches Speichern ist in diesem Browser nicht verfügbar.';resize();
}
function button(text,fn,disabled=false,cls=''){const b=document.createElement('button');b.textContent=text;b.disabled=disabled;b.className=cls;b.addEventListener('click',fn);return b;}
function chooseOperation(op){operation=operation===op?null:op;dirty=true;updateUI();requestRender();}
function selectAt(x,y,all=false){if(isAITurn()||setup||menuOpen||onlinePending||(online.room&&!online.myTurn)||state.drawn||winner(state)!==null)return;const point=screenToWorld(x,y),id=world.provinces.findIndex(p=>inside(point,p.cell));
  if(state.phase==='draft'){if(id>=0&&state.p[id].owner===0){if(online.room){sendOnlineAction({kind:'draft',source:id});return;}state=chooseStart(state,id);status=phaseText();dirty=true;save();updateUI();requestRender();}else announce('Wähle eine freie grüne Provinz.');return;}
  if(state.pool>0){if(id>=0&&state.p[id].owner===state.player){const quantity=Math.min(deployAmount,state.pool);deployAmount=1;commit({kind:'deploy',source:id,amount:quantity});}else announce(phaseText());return;}
  if(operation&&selected!==null){const choices=targets();let nearest=null,d=Infinity;for(const target of choices){const value=operation.includes('Tower')?dist2(point,towerPoint({province:selected,corner:target})):segmentDistance(point,edgeFor(selected,target).a,edgeFor(selected,target).b);if(value<d){d=value;nearest=target;}}
    const tolerance=20/(mapSize*zoom);if(nearest!==null&&d<tolerance*tolerance){commit({kind:operation==='buildTower'?'tower':operation==='buildWall'?'wall':operation,source:selected,target:nearest});return;}if(id<0){clearSelection();return;}announce('Bitte direkt auf eine markierte Kante oder Ecke klicken.');return;
  }
  if(id<0){clearSelection();return;}const p=state.p[id];
  if(all&&p.owner===state.player){selected=id;amount=available(p,type);dirty=true;updateUI();requestRender();return;}
  if(selected===id){const n=available(p,type);amount=n?(amount>=n?0:amount+1):0;updateUI();requestRender();return;}
  if(selected===null||amount===0){if(p.owner===state.player){selected=id;amount=Math.min(1,available(p,type));tab='move';dirty=true;updateUI();requestRender();}else announce('Wähle zuerst eine eigene Provinz.');return;}
  const action={kind:type==='archer'&&p.owner!==state.player?'shoot':'move',source:selected,target:id,amount,type};if(legal(state,action))commit(action);else if(p.owner===state.player){selected=id;amount=Math.min(1,available(p,type));dirty=true;updateUI();requestRender();}else announce(type==='archer'?'Wähle eine direkt benachbarte gegnerische Provinz zum Schießen.':'Nur direkt verbundene Nachbarn können angegriffen werden. Gebirge blockieren den Weg.');
}
function clearSelection(){if(!state)return;selected=null;amount=0;operation=null;status=phaseText();dirty=true;updateUI();requestRender();}
function zoomAt(x,y,next){const point=screenToWorld(x,y);zoom=Math.max(1,Math.min(4,next));pan.x=x-mapCenter.x-(point.x-mapOrigin.x)*mapSize*zoom;pan.y=y-mapCenter.y-(point.y-mapOrigin.y)*mapSize*zoom;if(zoom<=1)pan={x:0,y:0};requestRender();}
function canUseShortcuts(){return !isAITurn()&&state&&!setup&&!menuOpen&&!$('guide').open&&!document.querySelector('dialog[open]')&&!onlinePending&&(!online.room||online.myTurn)&&state.phase==='play'&&!state.drawn&&winner(state)===null;}
function setQuantity(value){if(state.pool>0)deployAmount=Math.max(1,Math.min(state.pool,value));else if(selected!==null)amount=Math.max(0,Math.min(available(state.p[selected],type),value));updateUI();requestRender();}
canvas.addEventListener('wheel',e=>{e.preventDefault();const point=screenToWorld(e.clientX,e.clientY),id=world.provinces.findIndex(p=>inside(point,p.cell));
  if(!e.ctrlKey&&!e.shiftKey&&!e.altKey&&canUseShortcuts()&&id>=0&&state.p[id].owner===state.player&&state.pool===0&&id===selected){
    if(e.deltaY)setQuantity((state.pool>0?deployAmount:amount)+(e.deltaY<0?1:-1));return;
  }zoomAt(e.clientX,e.clientY,zoom*Math.exp(-e.deltaY*.0013));},{passive:false});
for(const id of ['actions','topbar'])$(id).addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.shiftKey&&!e.altKey&&state?.pool>0&&canUseShortcuts()&&e.deltaY){e.preventDefault();setQuantity(deployAmount+(e.deltaY<0?1:-1));}},{passive:false});
$('deploy-less').onclick=()=>{if(canUseShortcuts())setQuantity(deployAmount-1);};$('deploy-more').onclick=()=>{if(canUseShortcuts())setQuantity(deployAmount+1);};$('deploy-range').oninput=()=>{if(canUseShortcuts())setQuantity(Number($('deploy-range').value));};
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{if(e.button!==0&&e.button!==2)return;canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});drag={x:e.clientX,y:e.clientY,pan:{...pan},moved:false,right:e.button===2,time:performance.now()};if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom,point:screenToWorld((a.x+b.x)/2,(a.y+b.y)/2)};}});
canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pinch&&pointers.size===2){const [a,b]=[...pointers.values()],x=(a.x+b.x)/2,y=(a.y+b.y)/2;zoom=Math.max(1,Math.min(4,pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/pinch.distance));pan.x=x-mapCenter.x-(pinch.point.x-mapOrigin.x)*mapSize*zoom;pan.y=y-mapCenter.y-(pinch.point.y-mapOrigin.y)*mapSize*zoom;if(zoom<=1)pan={x:0,y:0};if(drag)drag.moved=true;requestRender();}else if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>5)drag.moved=true;if(drag.moved){pan=zoom<=1?{x:0,y:0}:{x:drag.pan.x+dx,y:drag.pan.y+dy};requestRender();}}});
canvas.addEventListener('pointerup',e=>{pointers.delete(e.pointerId);if(drag&&!drag.moved&&!pinch){if(!drag.right)selectAt(e.clientX,e.clientY,false);else if(canUseShortcuts()&&state.pool===0&&selected!==null&&amount>0&&!operation){const point=screenToWorld(e.clientX,e.clientY),target=world.provinces.findIndex(p=>inside(point,p.cell));if(target>=0&&state.p[target].owner!==state.player){const action={kind:type==='archer'?'shoot':'move',source:selected,target,amount,type};if(legal(state,action))commit(action);}}}drag=null;pinch=null;});
canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);drag=null;pinch=null;});
canvas.addEventListener('dblclick',e=>e.preventDefault());
window.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('guide').open){$('guide').close();return;}if(menuOpen)toggleMenu();else clearSelection();return;}
  if(e.ctrlKey||e.metaKey||e.altKey||e.repeat||e.target.closest?.('input,textarea,select,[contenteditable],dialog')||!canUseShortcuts())return;
  const key=e.key.toLowerCase();
  if(/^[1-9]$/.test(key)&&(state.pool>0||selected!==null)){e.preventDefault();setQuantity(Number(key));return;}
  if(state.pool>0||selected===null)return;
  const menu={q:'units-tab',w:'trade-tab',e:'build-tab'}[key];if(menu){e.preventDefault();$(menu).click();return;}
  const index='asdf'.indexOf(key);if(index<0)return;
  const buttons=tab==='move'?[...$('unit-types').children,$('all')]:[...(tab==='build'?$('build-panel'):$('conversions')).children];
  const choice=buttons[index];if(choice&&!choice.disabled){e.preventDefault();choice.click();}
});window.addEventListener('resize',()=>{fitCamera=true;resize();});
$('units-tab').onclick=()=>{tab='move';operation=null;dirty=true;updateUI();requestRender();};$('build-tab').onclick=()=>{tab='build';updateUI();};$('trade-tab').onclick=()=>{tab='trade';updateUI();};
$('amount').oninput=()=>{amount=Number($('amount').value);updateUI();requestRender();};$('less').onclick=()=>{amount=Math.max(0,amount-1);updateUI();requestRender();};$('more').onclick=()=>{if(selected!==null)amount=Math.min(available(state.p[selected],type),amount+1);updateUI();requestRender();};$('all').onclick=()=>{if(selected!==null)amount=available(state.p[selected],type);updateUI();requestRender();};
$('end-turn').onclick=()=>commit({kind:'pass'});$('undo').onclick=()=>commit({kind:'undo',player:online.room?online.color:undoOwner(state)});
function toggleMenu(){if(!hasGame)return;renderSaveSlots();menuOpen=!menuOpen;if(online.snapshot&&menuOpen)receiveOnline(online.snapshot);updateUI();requestRender();}
$('menu').onclick=()=>{toggleMenu();if(!menuOpen)scheduleAI();};
function prepareNewGame(){cancelAI();if(online.room){online.leave();gameMode='human';$('game-mode').value='human';}updateMode();nextStarter=((roundStarter??state.starter??state.players)%settings.players)+1;menuOpen=false;hasGame=false;setup=true;busy=null;battles=[];deployAmount=1;clearSelection();updateUI();regenerate();}
$('new-game').onclick=prepareNewGame;
$('prepare-new-game').onclick=prepareNewGame;

function prepareWorld(){const vertices=[...world.provinces.flatMap(p=>p.cell),...world.lakeCells.flat()],xs=vertices.map(p=>p.x),ys=vertices.map(p=>p.y);mapBounds={x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};mapOrigin={x:mapBounds.x+mapBounds.w/2,y:mapBounds.y+mapBounds.h/2};oceanKey='';flagPositions.clear();fortPositions.clear();deployAmount=1;battles=[];piecePositions.clear();fitCamera=true;terrainKey='';controlsCache=null;factionsKey='';paths.clear();layouts.clear();world.provinces.forEach((p,id)=>paths.set(id,polyPath(p.cell)));vegetation=makeVegetation();zoom=1;pan={x:0,y:0};dirty=true;}
async function regenerate(){const b=$('regenerate');b.disabled=true;$('start').disabled=true;$('setup-status').textContent='Die Welt entsteht …';await new Promise(requestAnimationFrame);await new Promise(resolve=>setTimeout(resolve,10));try{world=generateWorld(settings);state=createState(world,settings.players);prepareWorld();$('setup-status').textContent=gameMode==='ai'?(getLanguage()==='de'?'Bereit. Du spielst Blau gegen die KI.':'Ready. You play Blue against AI.'):'Bereit. Alle Fraktionen werden von Menschen gespielt.';updateUI();requestRender();}catch(error){$('setup-status').textContent=error.message;}finally{b.disabled=false;$('start').disabled=!world;}}
function playerButtons(){$('players').replaceChildren(...Array.from({length:6},(_,i)=>button(String(i+1),()=>{settings.players=i+1;playerButtons();},gameMode==='ai'&&i===0,settings.players===i+1?'active':'')));}
for(const key of ['rivers','mountains','lakes','provinces']){$(key).oninput=()=>{settings[key]=Number($(key).value);$(`${key}-value`).textContent=settings[key];};$(key).onchange=regenerate;}
function updateMode(){gameMode=$('game-mode').value;$('online-create').hidden=gameMode!=='online';$('player-name').parentElement.hidden=gameMode!=='online';$('start').hidden=gameMode==='online';$('mode-help').textContent=getLanguage()==='de'?(gameMode==='ai'?'Du spielst Blau; alle anderen Farben steuert die KI.':''):(gameMode==='ai'?'You play Blue; AI controls all other colours.':'');if(gameMode==='ai'&&settings.players<2)settings.players=2;playerButtons();}
$('game-mode').onchange=updateMode;updateMode();
$('regenerate').onclick=regenerate;$('start').onclick=()=>{if(!world)return;online.leave();hasGame=true;menuOpen=false;$('connection').hidden=true;cancelAI();gameMode=$('game-mode').value;const players=gameMode==='ai'?Math.max(2,settings.players):settings.players;settings.players=players;roundStarter=nextStarter&&nextStarter<=players?nextStarter:1+Math.floor(Math.random()*players);nextStarter=null;state=createState(world,players,roundStarter);setup=false;selected=null;operation=null;busy=null;amount=0;status=phaseText();dirty=true;save();updateUI();requestRender();};
$('resume').onclick=()=>{if(!saved)return;online.leave();hasGame=true;menuOpen=false;$('connection').hidden=true;try{world=saved.world;cancelAI();gameMode=saved.mode==='ai'?'ai':'human';$('game-mode').value=gameMode;state=saved.state;roundStarter=state.starter??state.players;settings={...settings,...saved.settings};playerButtons();for(const key of ['rivers','mountains','lakes','provinces']){$(key).value=settings[key];$(`${key}-value`).textContent=settings[key];}setup=false;selected=null;operation=null;busy=null;prepareWorld();status=phaseText();updateUI();requestRender();}catch{announce('Die gespeicherte Partie konnte nicht geladen werden.');}};
try{const text=localStorage.getItem('orbis-terrarum-v1');if(text){const data=JSON.parse(text);if(data.version===1&&data.world?.provinces?.length&&data.state?.p?.length===data.world.provinces.length)saved=data;}}catch{storageOK=false;}
playerButtons();resize();regenerate().then(openInvitation);
window.addEventListener('hashchange',()=>{online.leave();openInvitation();});


function receiveOnline(data,meta={event:'sync'}){
  if(meta.closed){const copy=offlineData();loadOffline(copy);announce('Online-Raum geschlossen. Du siehst jetzt eine Offline-Kopie.');return;}
  cancelAI();gameMode='online';$('game-mode').value='online';pendingRoom=null;$('join-panel').hidden=true;
  const first=!world||world.seed!==data.world.seed||state?.players!==data.state.players;
  const previous=state;world=data.world;state=data.state;roundStarter=state.starter??state.players;settings={...data.settings};
  const action=meta.event==='action'?meta.action:meta.remote?data.lastAction:null;if(first||action){selected=null;amount=0;operation=null;}if(first)busy=null;
  const wasSetup=setup;setup=data.status==='lobby';hasGame=!setup;if(wasSetup&&!setup)menuOpen=false;if(first)prepareWorld();else dirty=true;
  if(data.status==='play'&&previous&&['pass','shoot'].includes(action?.kind)&&state.lastShots.length)busy={kind:'volley',shots:state.lastShots,progress:0,start:performance.now(),duration:1100/speed};
  if(data.status==='play'&&previous&&action?.kind==='move'&&!meta.battles?.length){const b=makeBattle(action,previous,state,world);if(b)battles.push(b);}for(const event of meta.battles||[]){const b=makeBattle(event.action,{player:event.owner,p:{[event.action.target]:event.before}},{p:{[event.action.target]:event.after}},world);if(b)battles.push(b);}if(action?.kind==='undo'){battles=[];busy=null;}
  if(action?.source!==undefined&&state.p[action.source]?.owner===data.you&&state.player===data.you&&['convert','barracks','demolishBarracks','tower','wall','demolishWall','demolishTower','flag'].includes(action.kind)){selected=action.source;if(action.kind==='convert'){type=action.conversion==='horse'?'horse':action.conversion==='archer'?'archer':'soldier';amount=Math.min(1,available(state.p[selected],type));}}
  if(data.status==='lobby')$('lobby').hidden=false;else if(wasSetup||first)$('lobby').hidden=true;$('connection').hidden=false;$('setup').hidden=true;
  $('connection-status').textContent=`Online · Du spielst ${NAMES[data.you]} · ${online.saving?`${online.pending.length} Aktion(en) werden gespeichert …`:'gespeichert'}`;
  $('lobby-title').textContent=data.status==='lobby'?'Lobby':'Aktuelle Onlinepartie';
  if(data.status==='lobby'||first||!$('lobby').hidden){$('lobby-seats').replaceChildren(...Array.from({length:settings.players},(_,i)=>{const seat=data.seats.find(s=>s.color===i+1),el=document.createElement('p');el.style.borderLeft=`5px solid ${COLORS[i+1]}`;el.textContent=`${NAMES[i+1]}: ${seat?seat.name:'Wartet auf Spieler …'}${i+1===data.you?' (du)':''}`;return el;}));
  $('invite-link').value=online.link;$('recovery-link').value=online.recoveryLink;
  updateLobbyControls();
  $('lobby-count').textContent=data.status==='lobby'?`${data.seats.length} / ${data.restoredPlayers||6} Plätze belegt. Der Spielleiter kann ab zwei Spielern starten.`:`${data.seats.length} Spieler in dieser Partie.`;
  if(!lobbyNameDirty&&document.activeElement!==$('lobby-name'))$('lobby-name').value=data.seats.find(s=>s.color===data.you)?.name||'';
  }
  status=phaseText();updateUI();$('setup').hidden=true;requestRender();
}
function sendOnlineAction(action){if(onlinePending||(!online.myTurn&&action.kind!=='undo'))return;try{online.enqueue(action);}catch(e){announce(e.message);$('connection-status').textContent=e.message;}}
async function openInvitation(){
  const params=new URLSearchParams(location.hash.slice(1)),room=params.get('room');if(params.has('offline')){try{loadOffline(await readSnapshot(params.get('offline')));}catch(error){$('setup-status').textContent=error.message;}return;}if(!room)return;
  if(!/^[a-f0-9-]{36}$/.test(room)){announce('Ungültiger Einladungslink.');return;}
  if(!online.configured){$('setup-status').textContent='Die Onlinepartie ist erst nach Einrichtung des Spielservers erreichbar.';return;}
  const seat=params.get('seat');if(seat&&seat.length>=60&&seat.length<=200){localStorage.setItem(`orbis-seat:${room}`,seat);params.delete('seat');history.replaceState(null,'',`${location.pathname}${location.search}#${params}`);}
  if(localStorage.getItem(`orbis-seat:${room}`)){
    $('setup-status').textContent='Partie wird geöffnet …';
    try{await online.resume(room);return;}catch(e){online.leave();if(e.status!==403){$('setup-status').textContent=e.message;return;}}
  }
  pendingRoom=room;setup=true;$('join-panel').hidden=false;$('join-name').value=localStorage.getItem('orbis-name')||'';$('join-status').textContent='';updateUI();$('join-name').focus();
}
$('online-create').onclick=async()=>{if(!online.configured){$('setup-status').textContent='Onlinepartien sind noch nicht eingerichtet. Lokal spielen ist möglich.';return;}const b=$('online-create');b.disabled=true;try{localStorage.setItem('orbis-name',$('player-name').value);await online.create({...settings,players:6,seed:world.seed,...(nextStarter?{starter:nextStarter}:{})},$('player-name').value);history.replaceState(null,'',online.link);}catch(e){$('setup-status').textContent=e.message;}finally{b.disabled=false;}};
$('join-form').onsubmit=async e=>{e.preventDefault();const name=$('join-name').value.trim();if(!pendingRoom||!name)return;const b=$('join-submit');b.disabled=true;$('join-status').textContent='Du trittst der Lobby bei …';try{localStorage.setItem('orbis-name',name);await online.join(pendingRoom,name);}catch(error){online.leave();$('join-status').textContent=error.message;}finally{b.disabled=false;}};
$('join-cancel').onclick=()=>{cancelAI();gameMode='online';$('game-mode').value='online';pendingRoom=null;$('join-panel').hidden=true;online.leave();history.replaceState(null,'',location.pathname+location.search);layoutSetup=null;updateUI();};
function updateLobbyControls(){const data=online.snapshot;if(!data)return;$('close-online').hidden=data.you!==1;$('close-online').disabled=online.saving||onlinePending;$('download-online').disabled=online.saving||onlinePending;$('lobby-start').dataset.required=String(data.restoredPlayers||2);$('lobby-start').hidden=data.status!=='lobby'||data.you!==1;$('lobby-start').disabled=data.seats.length<(data.restoredPlayers||2)||onlinePending||online.sending;$('lobby-start').textContent=onlinePending?'Bitte warten …':`Mit ${data.seats.length} Spielern starten`;$('rename-submit').disabled=onlinePending||online.sending;$('rename-submit').textContent=onlinePending?'Bitte warten …':'Namen speichern';}
$('lobby-name').oninput=()=>{lobbyNameDirty=true;$('rename-status').textContent='Noch nicht gespeichert.';};
$('rename-form').onsubmit=async e=>{e.preventDefault();const name=$('lobby-name').value.trim();if(!name||onlinePending)return;onlinePending=true;updateLobbyControls();$('rename-status').textContent='Name wird gespeichert …';try{try{await online.send('rename',{name});}catch(error){if(error.status!==409)throw error;await online.send('rename',{name});}lobbyNameDirty=false;localStorage.setItem('orbis-name',name);$('lobby-name').value=name;$('rename-status').textContent=`Gespeichert: ${name}`;}catch(error){$('rename-status').textContent=error.message;}finally{onlinePending=false;updateLobbyControls();}};
$('lobby-start').onclick=async()=>{if(onlinePending)return;onlinePending=true;updateLobbyControls();try{await online.send('start');}catch(e){$('connection-status').textContent=e.message;}finally{onlinePending=false;updateLobbyControls();}};
$('lobby-refresh').onclick=async()=>{await online.poll();updateLobbyControls();};
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&online.room)online.poll();});
window.addEventListener('focus',()=>{if(online.room)online.poll();});


for(const [id,target] of [['copy-invite','invite-link'],['copy-recovery','recovery-link']])$(id).onclick=async()=>{try{await navigator.clipboard.writeText($(target).value);$('connection-status').textContent='Link kopiert.';}catch{$(target).focus();$(target).select();$('connection-status').textContent='Bitte den markierten Link kopieren.';}};
$('leave-online').onclick=()=>{if(online.saving){$('connection-status').textContent='Bitte kurz warten, bis deine Aktionen gespeichert sind.';return;}online.leave();onlinePending=false;hasGame=false;menuOpen=false;history.replaceState(null,'',location.pathname+location.search);$('lobby').hidden=true;$('connection').hidden=true;setup=true;layoutSetup=null;regenerate();};
window.addEventListener('beforeunload',event=>{if(online.saving){event.preventDefault();event.returnValue='';}});

function paperRect(){const w=(mapBounds.w*mapSize+42)*zoom,h=(mapBounds.h*mapSize+42)*zoom;return {x:mapCenter.x+pan.x-w/2,y:mapCenter.y+pan.y-h/2,w,h};}
function drawOcean(c){const r=paperRect(),w=mapBounds.w*mapSize+42,h=mapBounds.h*mapSize+42,key=[w,h,DPR].join(':');if(oceanKey!==key){ocean.width=Math.ceil(w*DPR);ocean.height=Math.ceil(h*DPR);const q=ocean.getContext('2d');q.scale(DPR,DPR);drawParchment(q,w,h);oceanKey=key;}c.fillStyle='#c7b596';c.fillRect(viewport.left,viewport.top,W,H);c.drawImage(ocean,r.x,r.y,r.w,r.h);}
function drawFrame(c){const r=paperRect();c.save();c.translate(r.x,r.y);c.scale(zoom,zoom);drawOrnateFrame(c,0,0,r.w/zoom,r.h/zoom);c.restore();}
function drawLakes(c){const water=new Path2D(),shore=new Path2D(),edges=new Map();world.lakeCells.forEach(cell=>{water.addPath(polyPath(cell));cell.forEach((a,i)=>{const b=cell[(i+1)%cell.length],key=[`${a.x.toFixed(6)},${a.y.toFixed(6)}`,`${b.x.toFixed(6)},${b.y.toFixed(6)}`].sort().join(':');if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);});});for(const [a,b] of edges.values()){shore.moveTo(a.x*S,a.y*S);shore.lineTo(b.x*S,b.y*S);}c.fillStyle='#75b7b5';c.fill(water);c.save();c.clip(water);c.lineWidth=10;c.strokeStyle='#b5d7c4';c.stroke(shore);c.lineWidth=2;c.strokeStyle='#e4e2ba';c.stroke(shore);c.lineWidth=.9;c.strokeStyle='#eff4db99';for(let y=12;y<S;y+=38)for(let x=8;x<S;x+=58){c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+9,y+3,x+18,y);c.stroke();}c.restore();c.lineWidth=2;c.strokeStyle='#e3d9aa';c.stroke(shore);}
function offlineData(){return {version:2,world,state,settings:{...settings},language:getLanguage(),mode:online.room?'human':gameMode};}
function loadOffline(data){validateSave(data);cancelAI();gameMode=data.mode==='ai'?'ai':'human';$('game-mode').value=gameMode;online.leave();world=data.world;state=data.state;roundStarter=state.starter??state.players;settings={...settings,...data.settings};saved=data;hasGame=true;setup=false;menuOpen=false;selected=null;amount=0;operation=null;busy=null;prepareWorld();if(data.language)setLanguage(data.language);$('language').value=getLanguage();playerButtons();for(const key of ['rivers','mountains','lakes','provinces']){$(key).value=settings[key];$(`${key}-value`).textContent=settings[key];}$('connection').hidden=true;history.replaceState(null,'',location.pathname+location.search);status='Spielstand geladen.';save();updateUI();requestRender();}
function renderSaveSlots(){const slots=listSaves();$('save-slots').replaceChildren(...slots.map(slot=>{const row=document.createElement('div');row.className='save-slot';const text=document.createElement('span');text.textContent=(slot.name||'Partie')+' \u00b7 '+new Date(slot.date).toLocaleString(getLanguage());row.append(text,button('Laden',()=>loadOffline(slot.data)),button('L\u00f6schen',()=>{deleteSave(slot.id);renderSaveSlots();},false,'danger'));return row;}));}
$('save-offline').onclick=()=>{try{downloadSave();$('save-status').textContent='Spielstand als Datei herunterladen';}catch(error){$('save-status').textContent=error.message;}};
$('share-offline').onclick=async()=>{try{const link=await snapshotLink(offlineData());await navigator.clipboard.writeText(link);$('save-status').textContent='Momentaufnahme-Link kopiert.';}catch(error){$('save-status').textContent=error.message;}};
function downloadSave(){if(online.saving||onlinePending)throw Error('Wait until your actions are synchronized.');const url=URL.createObjectURL(new Blob([JSON.stringify(offlineData())],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='orbis-terrarum.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export-offline').onclick=$('download-online').onclick=()=>{try{downloadSave();}catch(error){announce(error.message);}};
$('close-online').onclick=async()=>{if(!confirm(getLanguage()==='de'?'Datei herunterladen und Online-Raum für alle Spieler löschen? Zur Fortsetzung die Datei laden und einen neuen Raum erstellen.':'Download a file and delete the online room for everyone? To resume, load the file and host a new room.'))return;try{downloadSave();await online.send('close');}catch(error){$('connection-status').textContent=error.message;}};
$('host-file-online').onclick=async()=>{try{if(state.players<2)throw Error('An online game needs at least two players.');const data=offlineData();await online.create({...settings,players:6},localStorage.getItem('orbis-name')||'Host',data);history.replaceState(null,'',online.link);}catch(error){announce(error.message);}};
$('import-offline').onclick=$('load-start').onclick=()=>$('save-file').click();
$('save-file').onchange=async()=>{try{const file=$('save-file').files[0];if(file){if(file.size>5000000)throw Error('Spielstand ist zu gro\u00df.');loadOffline(JSON.parse(await file.text()));}}catch(error){$('save-status').textContent=error.message;$('setup-status').textContent=error.message;}finally{$('save-file').value='';}};
function openGuide(){$('guide-content').innerHTML=guideHTML(getLanguage());$('guide').showModal();}
$('guide-local').onclick=$('guide-online').onclick=openGuide;$('guide-close').onclick=()=>$('guide').close();
for(const id of ['language','join-language','lobby-language']){$(id).value=getLanguage();$(id).onchange=()=>setLanguage($(id).value);}document.addEventListener('orbis-language',()=>{for(const id of ['language','join-language','lobby-language'])$(id).value=getLanguage();if($('guide').open)$('guide-content').innerHTML=guideHTML(getLanguage());if(state&&!setup)updateUI();if(setup)updateMode();});applyTranslations();
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});

function makeVegetation(){const v={shadow:new Path2D(),leaves:new Path2D(),mid:new Path2D(),light:new Path2D(),grass:new Path2D()};world.provinces.forEach((p,id)=>{const random=rng((world.seed+777+Math.imul(id+1,2654435761))>>>0),mountains=world.edges.filter(e=>e.mountain&&e.provinces.includes(id));for(let j=0;j<8;j++){const x=p.home.x+(random()-.5)*.09,y=p.home.y+(random()-.5)*.08,r=4/S;if(![[x-r,y-r],[x+r,y-r],[x-r,y+r],[x+r,y+r]].every(([x,y])=>inside({x,y},p.cell))||mountains.some(e=>segmentDistance({x,y},e.a,e.b)<.00008))continue;if(p.biome==='forest'){v.shadow.moveTo(x*S+4,y*S+2);v.shadow.ellipse(x*S+1,y*S+2,3,4,0,0,Math.PI*2);const polygon=(path,points)=>{points.forEach(([a,b],i)=>i?path.lineTo(x*S+a*.45,y*S+b*.45):path.moveTo(x*S+a*.45,y*S+b*.45));path.closePath();};polygon(v.leaves,[[-6,-4],[1,-8],[7,-3],[6,5],[-2,7],[-7,2]]);polygon(v.mid,[[-6,-4],[1,-8],[2,1],[-7,2]]);polygon(v.light,[[-6,-4],[1,-8],[-1,-1]]);}else{v.grass.moveTo(x*S-1,y*S);v.grass.lineTo(x*S,y*S+3);v.grass.lineTo(x*S+2,y*S-1);}}});return v;}
