// Orbis Terrarum — deterministic, DOM-free game rules. Shared by human play, online server and AI self-play.
export const TYPES = ['soldier', 'horse', 'archer'];
export const COLORS = ['#69ad59', '#287bbd', '#d34c4c', '#23974c', '#e2b81f', '#8f41be', '#26282d'];
export const NAMES = ['Neutral', 'Blau', 'Rot', 'Grün', 'Gelb', 'Lila', 'Schwarz'];
const clone = s => structuredClone(s);
const cloneState = s => {const {links,corners,...dynamic}=s;return {...clone(dynamic),links,corners};};
export const total = p => TYPES.reduce((n,t) => n+p[t], 0);
export const strength = p => p.soldier+p.horse;
export const available = (p,t) => Math.max(0, p[t]-(t==='horse'?p.horseExhausted:t==='soldier'?p.arrived:p.archerArrived));
export const active = (s,id) => id>0 && id<=s.players && s.flags[id]!==-2 && s.p.some(p=>p.owner===id) && (s.flags[id]<0 || s.p[s.flags[id]].owner===id);
export const winner = s => s.phase==='draft'||s.players===1 ? null : Array.from({length:s.players},(_,i)=>i+1).filter(id=>active(s,id)).filter((_,i,a)=>a.length===1)[0]??null;
export const wallKey = (p,n) => `${p}:${n}`;
export const undoOwner = s => s.undo?.at(-1)?.actor??0;
export function createState(world, players=4, starter=players) {
  starter=Math.max(1,Math.min(players,starter));
  return {players, starter, player:starter%players+1, phase:'draft', drafted:0, turns:0, pool:0, drawn:false, flags:Array(players+1).fill(-1),
    walls:[], towers:[], cooldown:{}, lastShots:[], p:world.provinces.map(()=>({owner:0,soldier:1,horse:0,archer:0,
      arrived:0,horseOnce:0,horseExhausted:0,archerArrived:0,soldierTwice:0,archerTwice:0,barracks:false})),
    links:world.links, corners:world.corners.map(c=>c.provinces)};
}
export function chooseStart(s,id) {
  if(s.phase!=='draft'||!s.p[id]||s.p[id].owner!==0) throw Error('Wähle eine freie Provinz.');
  const n=cloneState(s),starter=s.starter??s.players,rank=(starter-s.player+s.players)%s.players;
  const counts={1:[5],2:[4,5],3:[4,4,5],4:[4,4,4,5],5:[4,4,4,5,5],6:[4,4,4,5,5,5]};
  Object.assign(n.p[id],{owner:s.player,soldier:counts[s.players][rank]}); n.flags[s.player]=id; n.drafted++;
  if(n.drafted===n.players){n.phase='play';n.player=starter;} else n.player=n.player%n.players+1;
  return n;
}
export function divisor(s,from,to) {
  if(s.p[from].owner===s.p[to].owner)return 1;
  return (s.links[from].some(l=>l.target===to&&l.river)?2:1)*(s.walls.includes(wallKey(to,from))?2:1);
}
export function legal(s,a) {
  if(a.kind==='undo')return s.phase==='play'&&undoOwner(s)>0&&undoOwner(s)===(a.player??s.player);
  if(s.phase!=='play'||s.drawn||winner(s)!==null)return false;
  const p=s.p[a.source], own=p?.owner===s.player;
  if(s.pool>0)return a.kind==='deploy'&&own&&Number.isInteger(a.amount)&&a.amount>0&&a.amount<=s.pool;
  if(a.kind==='deploy')return false;
  if(a.kind==='pass')return true;
  if(!own)return false;
  if(a.kind==='convert')return ({horse:p.soldier>=3,archer:p.soldier>=5,footHorse:p.horse>=1,footArcher:p.archer>=1})[a.conversion]===true;
  if(a.kind==='shoot')return Number.isInteger(a.amount)&&a.amount>0&&a.amount<=available(p,'archer')&&s.links[a.source].some(l=>l.target===a.target)&&s.p[a.target].owner>0&&s.p[a.target].owner!==s.player&&total(s.p[a.target])>0;
  if(a.kind==='demolishBarracks')return p.barracks===true;
  if(a.kind==='barracks')return !p.barracks&&p.soldier>=10;
  if(a.kind==='flag')return s.flags[s.player]>=0&&s.flags[s.player]!==a.source&&p.soldier>=10;
  if(a.kind==='tower'||a.kind==='demolishTower')return s.corners[a.target]?.includes(a.source)&&
    (a.kind==='tower'?s.corners[a.target].filter(id=>id!==a.source&&!s.links[a.source].some(l=>l.target===id)).length<2&&!s.towers.some(t=>t.corner===a.target&&t.province===a.source)&&p.soldier>=5:s.towers.some(t=>t.corner===a.target&&t.province===a.source));
  if(a.kind==='wall'||a.kind==='demolishWall')return s.links[a.source].some(l=>l.target===a.target)&&
    (a.kind==='wall'?!s.walls.includes(wallKey(a.source,a.target))&&p.soldier>=5:s.walls.includes(wallKey(a.source,a.target)));
  return a.kind==='move'&&TYPES.includes(a.type)&&s.p[a.target]&&Number.isInteger(a.amount)&&a.amount>0&&a.amount<=available(p,a.type)&&
    s.links[a.source].some(l=>l.target===a.target)&&(a.type!=='archer'||s.p[a.target].owner===s.player);
}
function budget(p,t){return t==='horse'?[p.horseOnce,p.horseExhausted]:t==='soldier'?[p.arrived-p.soldierTwice,p.soldierTwice]:[p.archerArrived-p.archerTwice,p.archerTwice];}
function setBudget(p,t,one,two){if(t==='horse'){p.horseOnce=one;p.horseExhausted=two;}else if(t==='soldier'){p.arrived=one+two;p.soldierTwice=two;}else{p.archerArrived=one+two;p.archerTwice=two;}}
function remove(p,t,n,moving=false){const [one,two]=budget(p,t), spentTwo=moving?0:Math.min(n,two),spentOne=moving&&t!=='horse'?0:Math.min(n-spentTwo,one);setBudget(p,t,one-spentOne,two-spentTwo);p[t]-=n;return [spentOne,spentTwo];}
function add(p,t,n,one=0,two=0){const b=budget(p,t);p[t]+=n;setBudget(p,t,b[0]+one,b[1]+two);}
function spend(p,n){p.soldier-=n;p.arrived=Math.min(p.arrived,p.soldier);p.soldierTwice=Math.min(p.soldierTwice,p.arrived);}
export function shots(s,player) {
  const remaining=s.p.map(p=>({...p})), out=[];
  const enemy=id=>s.p[id].owner>0&&s.p[id].owner!==player&&total(remaining[id])>0;
  function hit(source,target,tower=null){const type=TYPES.find(t=>remaining[target][t]>0);remaining[target][type]--;out.push({source,target,type,tower,arrow:tower===null});}
  [...s.towers].sort((a,b)=>a.corner-b.corner||a.province-b.province).forEach(t=>{
    if(s.p[t.province].owner!==player)return;
    const waiting=s.cooldown[`${t.province}:${t.corner}`]??s.cooldown[t.corner];if(waiting&&waiting!==player&&active(s,waiting))return;
    const target=[...s.corners[t.corner]].sort((a,b)=>a-b).find(enemy);if(target!==undefined)hit(t.province,target,t.corner);
  });
  return out;
}
function applyRaw(s,a) {
  if(!legal(s,a))throw Error('Diese Aktion ist hier nicht möglich.');
  const n=cloneState(s),p=n.p[a.source];n.lastShots=[];
  if(a.kind==='deploy'){p.soldier+=a.amount;n.pool-=a.amount;return n;}
  if(a.kind==='shoot'){p.archerArrived+=a.amount;const target=n.p[a.target];for(let i=0;i<a.amount&&total(target)>0;i++){const type=TYPES.find(t=>target[t]>0);remove(target,type,1);n.lastShots.push({source:a.source,target:a.target,type,tower:null,arrow:true});}return n;}
  if(a.kind==='pass'){
    let next=s.player;for(let i=1;i<=s.players;i++){const id=((s.player-1-i)%s.players+s.players)%s.players+1;if(active(s,id)){next=id;break;}}
    n.player=next;n.turns++;n.pool=0;n.drawn=n.turns>=150*n.players;
    n.p.forEach(p=>{if(p.owner===next){if(n.turns>=n.players)n.pool+=p.barracks?2:1;for(const k of ['arrived','soldierTwice','horseOnce','horseExhausted','archerArrived','archerTwice'])p[k]=0;}});
    for(const corner of Object.keys(n.cooldown))if(n.cooldown[corner]===next||!active(s,n.cooldown[corner]))delete n.cooldown[corner];
    n.lastShots=shots(s,next);n.lastShots.forEach(shot=>{remove(n.p[shot.target],shot.type,1);if(shot.tower!==null)n.cooldown[`${shot.source}:${shot.tower}`]=s.p[shot.target].owner;});return n;
  }
  if(a.kind==='convert'){
    const [from,to,cost,produced]=({horse:['soldier','horse',3,1],archer:['soldier','archer',5,1],footHorse:['horse','soldier',1,2],footArcher:['archer','soldier',1,3]})[a.conversion];
    const b=remove(p,from,cost);add(p,to,produced,b[1]===0&&b[0]>0?produced:0,b[1]>0?produced:0);return n;
  }
  if(a.kind==='demolishBarracks'){p.barracks=false;add(p,'soldier',5,0,5);return n;}
  if(a.kind==='barracks'){spend(p,10);p.barracks=true;return n;}
  if(a.kind==='flag'){spend(p,10);n.flags[s.player]=a.source;return n;}
  if(a.kind==='wall'){spend(p,5);n.walls.push(wallKey(a.source,a.target));return n;}
  if(a.kind==='demolishWall'){add(p,'soldier',2,0,2);n.walls=n.walls.filter(w=>w!==wallKey(a.source,a.target));return n;}
  if(a.kind==='tower'){spend(p,5);n.towers.push({province:a.source,corner:a.target});return n;}
  if(a.kind==='demolishTower'){add(p,'soldier',2,0,2);n.towers=n.towers.filter(t=>!(t.province===a.source&&t.corner===a.target));return n;}
  const target=n.p[a.target],spent=remove(p,a.type,a.amount,true),fresh=a.amount-spent[0];
  if(target.owner===s.player)add(target,a.type,a.amount,fresh,spent[0]);else{
    const effective=Math.floor(a.amount/divisor(s,a.source,a.target)),defence=strength(target),losses=Math.min(effective,defence),foot=Math.min(losses,target.soldier);
    remove(target,'soldier',foot);remove(target,'horse',losses-foot);
    if(effective>defence){target.owner=s.player;remove(target,'archer',target.archer);const survivors=effective-losses,once=Math.min(fresh,survivors);add(target,a.type,survivors,once,survivors-once);}
  }
  for(let id=1;id<=s.players;id++)if(s.flags[id]===a.target&&target.owner!==id){
    n.flags[id]=-2;n.p.forEach(p=>{if(p.owner===id){p.owner=s.player;for(const k of ['soldier','horse','archer','arrived','horseOnce','horseExhausted','archerArrived','soldierTwice','archerTwice'])p[k]=0;}});
  }return n;
}
export function apply(s,a){
  if(a.kind==='undo'){
    if(!legal(s,a))throw Error('Nur eigene Aktionen können zurückgenommen werden.');
    const n=clone(s),entry=n.undo.pop();Object.assign(n,entry.fields);for(const [id,p] of entry.provinces)n.p[id]=p;return n;
  }
  const n=applyRaw({...s,undo:[]},a),fields={},provinces=[];
  for(const key of Object.keys(s))if(!['undo','p','links','corners'].includes(key)&&JSON.stringify(s[key])!==JSON.stringify(n[key]))fields[key]=clone(s[key]);
  for(let id=0;id<s.p.length;id++)if(JSON.stringify(s.p[id])!==JSON.stringify(n.p[id]))provinces.push([id,clone(s.p[id])]);
  const history=undoOwner(s)===s.player?(s.undo||[]):[];n.undo=[...history,{actor:s.player,fields,provinces}].slice(-128);return n;
}
export function shade(p,t,index,player){if(p.owner!==player)return 0;const b=budget(p,t),fresh=p[t]-b[0]-b[1];return index<fresh?0:t==='horse'&&index<fresh+b[0]?1:2;}

// Search-only transition without UI undo history; identical rule execution.
export function simulate(s,a){return applyRaw(s,a);}
