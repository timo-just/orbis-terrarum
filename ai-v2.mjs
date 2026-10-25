// CPU policy with graph planning, exact tactical simulation and trainable action features.
// Kept separate from ai.mjs so training always has an immutable previous opponent.
import {available,strength,total,divisor,legal,winner,active} from './engine.mjs';
import {candidates as oldCandidates,nextState} from './ai.mjs';
export const DEFAULT_WEIGHTS=[12,7,1.4,1.1,1000,18,1.3,1.7,2.1,1.5,2.6,2.5,1.8,.45,.8,1.2];
export {nextState};
const counts=p=>p.soldier+p.horse;
function distances(s,starts){const d=Array(s.p.length).fill(999),queue=[];for(const id of starts){d[id]=0;queue.push(id);}for(const id of queue)for(const l of s.links[id])if(d[l.target]>d[id]+1){d[l.target]=d[id]+1;queue.push(l.target);}return d;}
export function context(s){
 const player=s.player,own=[],front=[],enemyFlags=[];
 for(let id=0;id<s.p.length;id++){if(s.p[id].owner===player){own.push(id);if(s.links[id].some(l=>s.p[l.target].owner!==player))front.push(id);}}
 for(let id=1;id<=s.players;id++)if(id!==player&&active(s,id)&&s.flags[id]>=0)enemyFlags.push(s.flags[id]);
 const frontDistance=distances(s,front),flagDistance=distances(s,enemyFlags),threat=s.p.map((p,id)=>Math.max(0,...s.links[id].filter(l=>s.p[l.target].owner>0&&s.p[l.target].owner!==player).map(l=>Math.floor(strength(s.p[l.target])/divisor(s,l.target,id)))));
 return {player,own,front,frontDistance,flagDistance,threat,flag:s.flags[player]};
}
function vulnerability(s,id,player){if(id<0||s.p[id].owner!==player)return 0;const p=s.p[id];let worst=0;for(const l of s.links[id]){const q=s.p[l.target];if(q.owner>0&&q.owner!==player){let attack=strength(q);for(const step of s.links[l.target]){const r=s.p[step.target];if(step.target!==id&&r.owner===q.owner)attack+=Math.floor(r.horse/divisor(s,step.target,l.target));}worst=Math.max(worst,Math.floor(attack/divisor(s,l.target,id))-strength(p)+1);}}return Math.max(0,worst);}
export function candidates(s,c=context(s)){
 if(s.phase==='draft')return oldCandidates(s);
 if(s.pool){const out=[];for(const source of c.own){const p=s.p[source],attackNeed=Math.min(...s.links[source].filter(l=>s.p[l.target].owner!==c.player).map(l=>(strength(s.p[l.target])+2)*divisor(s,source,l.target)-strength(p))),need=Math.max(1,c.threat[source]+2-strength(p),Number.isFinite(attackNeed)?attackNeed:1);for(const amount of new Set([s.pool,Math.min(s.pool,Math.ceil(s.pool/3)),Math.min(s.pool,need)]))out.push({kind:'deploy',source,amount});}return out;}
 const actions=oldCandidates(s);
 // Thin a unit from an exhausted garrison to a vulnerable neighbouring flag.
 for(const source of c.own)for(const l of s.links[source]){if(s.p[l.target].owner===c.player)for(const type of ['soldier','horse']){const amount=Math.min(available(s.p[source],type),Math.max(1,c.threat[l.target]+2-strength(s.p[l.target])));const a={kind:'move',source,target:l.target,type,amount};if(legal(s,a))actions.push(a);}else{const free=available(s.p[source],'soldier'),amount=Math.min(free,Math.max(1,free-c.threat[source]-1));const a={kind:'move',source,target:l.target,type:'soldier',amount};if(legal(s,a))actions.push(a);}}
 return [...new Map(actions.map(a=>[JSON.stringify(a),a])).values()];
}
export function actionFeatures(s,a,c=context(s)){
 const f=Array(16).fill(0),p=s.p[a.source],q=s.p[a.target],own=c.player;
 if(a.kind==='pass'){f[13]=-.08;return f;}
 if(a.kind==='deploy'){
  const before=counts(p),border=s.links[a.source].filter(l=>s.p[l.target].owner!==own),needed=Math.max(1,c.threat[a.source]+2-before);
  f[5]=a.source===c.flag?Math.min(a.amount,vulnerability(s,c.flag,own))*2:0;
  const targets=border.map(l=>({need:(counts(s.p[l.target])+2)*divisor(s,a.source,l.target)-before,id:l.target}));
  f[7]=border.length?Math.min(a.amount,Math.max(needed,...targets.map(t=>t.need)))*.35:0;
  f[8]=Math.sqrt(a.amount)/(1+c.frontDistance[a.source])+(a.source===c.flag?Math.min(a.amount,needed)*.25:0);
  for(const t of targets)if(t.need>0&&t.need<=a.amount)f[8]+=2+(s.flags.includes(t.id)?8:0);
  return f;
 }
 if(a.kind==='shoot'){f[2]=Math.min(a.amount,total(q));f[13]=-.01;return f;}
 if(a.kind==='move'){
  if(q.owner===own){const direction=c.frontDistance[a.source]-c.frontDistance[a.target];f[6]=direction*Math.sqrt(a.amount);f[7]=(c.flagDistance[a.source]-c.flagDistance[a.target])*Math.sqrt(a.amount)*.3;
   if(a.target===c.flag)f[5]+=Math.min(a.amount,vulnerability(s,c.flag,own))*2;
   if(a.source===c.flag)f[5]-=Math.max(0,c.threat[a.source]-(counts(p)-a.amount)+1)-vulnerability(s,c.flag,own);
   f[13]=-.1;
  }else{
   const d=divisor(s,a.source,a.target),effective=Math.floor(a.amount/d),loss=Math.min(effective,counts(q)),capture=effective>counts(q);
   f[0]=capture?1:0;f[1]=capture&&q.owner>0?1:0;f[2]=loss+(capture?q.archer*2:0);f[3]=-(a.amount-(capture?effective-loss:0));
   f[4]=capture&&s.flags.includes(a.target)?1:0;
   if(capture){f[7]=Math.max(0,c.flagDistance[a.source]-c.flagDistance[a.target]);f[6]=s.links[a.target].filter(l=>s.p[l.target].owner!==own&&l.target!==a.source).length*.25;}
   if(a.source===c.flag)f[5]-=Math.max(0,c.threat[a.source]-(counts(p)-a.amount)+1)-vulnerability(s,c.flag,own);
  }
  return f;
 }
 const border=s.links[a.source].filter(l=>s.p[l.target].owner!==own),enemy=border.filter(l=>s.p[l.target].owner>0),safe=Math.max(0,counts(p)-c.threat[a.source]-2);
 if(a.kind==='barracks'){f[3]=-10;f[9]=Math.min(12,Math.max(0,150-s.turns/s.players))*(enemy.length? .55:1);}
 if(a.kind==='tower'){const enemyIds=s.corners[a.target].filter(id=>s.p[id].owner>0&&s.p[id].owner!==own);f[3]=-5;f[10]=enemyIds.length?Math.min(6,Math.max(...enemyIds.map(id=>total(s.p[id])))):0;}
 if(a.kind==='wall'){f[3]=-5;f[11]=q.owner>0&&q.owner!==own?Math.min(6,c.threat[a.source]/2):0;}
 if(a.kind==='convert'){
  if(a.conversion==='horse'){f[3]=-2;f[12]=c.frontDistance[a.source]>0?Math.min(3,c.frontDistance[a.source]):border.some(l=>available(p,'horse')>0&&s.flags.includes(l.target))?2:.25;}
  if(a.conversion==='archer'){f[3]=-5;f[12]=enemy.length?Math.min(5,Math.max(...enemy.map(l=>total(s.p[l.target])))):0;}
  if(a.conversion==='footHorse'){f[3]=1;f[12]=-2;}
  if(a.conversion==='footArcher'){f[3]=3;f[12]=enemy.length?-5:-1;}
 }
 if(a.kind.startsWith('demolish')){f[3]=a.kind==='demolishBarracks'?5:2;f[14]=a.kind==='demolishBarracks'?-12:a.kind==='demolishTower'?-6:-4;}
 if(a.kind==='flag'){f[3]=-10;f[5]=vulnerability(s,c.flag,own)-vulnerability(s,a.source,own);f[14]=-4;}
 const cost=a.kind==='barracks'||a.kind==='flag'?10:a.kind==='convert'?(a.conversion==='archer'?5:a.conversion==='horse'?3:0):['tower','wall'].includes(a.kind)?5:0;
 f[15]=-Math.max(0,cost-safe);return f;
}
const dot=(f,w)=>f.reduce((v,x,i)=>v+x*w[i],0);
export function rankedActions(s,w=DEFAULT_WEIGHTS){const c=context(s);return candidates(s,c).map(a=>({action:a,score:dot(actionFeatures(s,a,c),w)})).sort((a,b)=>b.score-a.score);}
export function chooseAction(s,w=DEFAULT_WEIGHTS,random=()=>.5,explore=0,search=true){
 if(w.length!==16)w=DEFAULT_WEIGHTS;
 // Do not leave a defendable flag exposed while allocating the mandatory pool.
 // This tactical constraint is independent of evolved material/expansion weights.
 if(s.phase==='play'&&s.pool>0){const flag=s.flags[s.player];if(flag>=0&&s.p[flag]?.owner===s.player){const needed=vulnerability(s,flag,s.player);if(needed>0&&needed<=s.pool)return {kind:'deploy',source:flag,amount:needed};}}
 if(s.phase==='draft'){
  const enemy=s.flags.filter(id=>id>=0),distance=distances(s,enemy);let best=null,score=-Infinity;
  for(let source=0;source<s.p.length;source++)if(s.p[source].owner===0){const links=s.links[source],space=links.reduce((v,l)=>v+s.links[l.target].length,0),d=enemy.length?distance[source]:4;
   const v=links.length*2+space*.15+Math.min(d,5)*1.5-(d<3?20:0)-Math.max(0,d-7)*.4+random()*.001;if(v>score){score=v;best={kind:'draft',source};}}
  return best;
 }
 const ranked=rankedActions(s,w);if(!ranked.length)return null;
 if(random()<explore)return ranked[Math.floor(random()*Math.min(4,ranked.length))].action;
 let best=ranked[0].action,score=-Infinity;
 // Exact top-four two-action lookahead, including fatal counterattack checks.
 for(const entry of ranked.slice(0,search&&!s.pool?4:1)){
  const a=entry.action,n=nextState(s,a);if(winner(n)===s.player)return a;
  let v=entry.score;
  if(a.kind!=='pass'){
   const flag=n.flags[s.player];v-=(vulnerability(n,flag,s.player)-vulnerability(s,s.flags[s.player],s.player))*w[5]*2;
   if(search&&!s.pool){const follow=rankedActions(n,w)[0];if(follow)v+=Math.max(0,follow.score)*.45;}
  }
  if(v>score){score=v;best=a;}
 }
 return best;
}
