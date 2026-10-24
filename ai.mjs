// Shared by browser worker and CPU self-play trainer. Only legal engine actions.
import {simulate,chooseStart,legal,available,strength,total,divisor,winner,active} from './engine.mjs';
export const DEFAULT_WEIGHTS=[9,1.2,2.4,1.7,2,1.4,1,3,1,2];
export function features(s,player){
 const own=s.p.flatMap((p,i)=>p.owner===player?[i]:[]),enemies=s.p.filter(p=>p.owner>0&&p.owner!==player);
 let force=0,economy=0,front=0,risk=0,pressure=0,mobility=0;
 for(const id of own){const p=s.p[id],links=s.links[id],border=links.filter(l=>s.p[l.target].owner!==player);
  force+=p.soldier+3*p.horse+4*p.archer;economy+=p.barracks?6:0;front+=border.length?Math.min(strength(p),12):0;
  mobility+=available(p,'soldier')+1.5*available(p,'horse')+.5*available(p,'archer');
  for(const l of border){const q=s.p[l.target];pressure+=Math.max(0,Math.min(4,strength(p)/divisor(s,id,l.target)-strength(q)));if(q.owner>0)pressure+=Math.min(p.archer,total(q))*.6;}
  if(s.flags[player]===id)risk=Math.max(0,...border.map(l=>strength(s.p[l.target])/divisor(s,l.target,id)-strength(p)+2));
 }
 return [own.length,force,economy,front,-risk,pressure,mobility,s.towers.filter(t=>s.p[t.province].owner===player).length,s.walls.filter(w=>s.p[+w.split(':')[0]].owner===player).length,-enemies.reduce((n,p)=>n+p.soldier+2*p.horse+2.5*p.archer,0)/Math.max(1,s.players-1)];
}
export function value(s,player,w=DEFAULT_WEIGHTS){if(!active(s,player))return -1e6;if(winner(s)===player)return 1e6;return features(s,player).reduce((n,v,i)=>n+v*w[i],0);}
export function candidates(s){
 const out=[],add=a=>{if(legal(s,a))out.push(a);};
 if(s.phase==='draft')return s.p.flatMap((p,i)=>p.owner===0?[{kind:'draft',source:i}]:[]);
 for(let source=0;source<s.p.length;source++){
  const p=s.p[source];if(p.owner!==s.player)continue;
  if(s.pool){add({kind:'deploy',source,amount:s.pool});continue;}
  for(const l of s.links[source]){
   const q=s.p[l.target];
   for(const type of ['soldier','horse','archer']){
    const n=available(p,type);if(!n)continue;
    if(type==='archer'&&q.owner!==s.player){add({kind:'shoot',source,target:l.target,amount:Math.min(n,total(q))});continue;}
    for(const amount of new Set([n,Math.max(1,n-1),Math.min(n,(strength(q)+1)*divisor(s,source,l.target))]))add({kind:'move',source,target:l.target,type,amount});
   }
   if(q.owner!==s.player){add({kind:'wall',source,target:l.target});add({kind:'demolishWall',source,target:l.target});}
  }
  for(const conversion of ['horse','archer','footHorse','footArcher'])add({kind:'convert',source,conversion});
  for(const kind of ['barracks','demolishBarracks','flag'])add({kind,source});
  s.corners.forEach((ids,target)=>{if(ids.includes(source)){add({kind:'tower',source,target});add({kind:'demolishTower',source,target});}});
 }
 if(!s.pool)add({kind:'pass'});return out;
}
export function nextState(s,a){const n=a.kind==='draft'?chooseStart(s,a.source):simulate({...s,undo:[]},a);n.undo=[];return n;}
export function chooseAction(s,w=DEFAULT_WEIGHTS,random=()=>.5,explore=0){
 const actions=candidates(s);if(!actions.length)return null;
 if(s.phase==='draft'){
  let best=null,score=-Infinity;
  for(const a of actions){const links=s.links[a.source],distance=Math.min(10,...s.flags.filter(f=>f>=0).map(f=>{const queue=[[a.source,0]],seen=new Set([a.source]);for(const [id,d]of queue){if(id===f)return d;for(const l of s.links[id])if(!seen.has(l.target)){seen.add(l.target);queue.push([l.target,d+1]);}}return 10;}));const v=links.length+distance*.6+random()*.05;if(v>score){score=v;best=a;}}return best;
 }
 if(random()<explore)return actions[Math.floor(random()*actions.length)];
 const base=value(s,s.player,w);let best={kind:'pass'},score=-Infinity;
 for(const a of actions){const n=nextState(s,a);let v=value(n,s.player,w)-base;
  if(a.kind==='pass')v=-.02;
  // Moving to the front must improve distance, rather than shuffle troops forever.
  if(a.kind==='move'&&s.p[a.target].owner===s.player){const dist=id=>{const queue=[[id,0]],seen=new Set([id]);for(const [at,d]of queue){if(s.links[at].some(l=>s.p[l.target].owner!==s.player))return d;for(const l of s.links[at])if(!seen.has(l.target)){seen.add(l.target);queue.push([l.target,d+1]);}}return 0;};v+=(dist(a.source)-dist(a.target))*a.amount*.5;}
  if(a.kind==='tower')v+=s.corners[a.target].filter(id=>s.p[id].owner>0&&s.p[id].owner!==s.player).length*3;
  if(a.kind==='wall')v+=Math.min(4,strength(s.p[a.target])/(strength(n.p[a.source])+1));
  if(a.kind==='flag')v-=2;
  if(a.kind.startsWith('demolish'))v-=4;
  v+=random()*.0001;if(v>score){score=v;best=a;}
 }
 return score<-.01&&!s.pool?{kind:'pass'}:best;
}
