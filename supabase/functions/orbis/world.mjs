// Complete irregular Voronoi provinces, cell-based lakes, connected edge rivers.
export function rng(seed=Date.now()){let a=seed>>>0;return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
export const dist2=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
export function inside(p,polygon){let yes=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[i],b=polygon[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;
}return yes;}
export function segmentDistance(p,a,b){const d=dist2(a,b),t=d?Math.max(0,Math.min(1,((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/d)):0;return dist2(p,{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}
export const center=poly=>({x:poly.reduce((n,p)=>n+p.x,0)/poly.length,y:poly.reduce((n,p)=>n+p.y,0)/poly.length});
export const area=poly=>Math.abs(poly.reduce((n,a,i)=>{const b=poly[(i+1)%poly.length];return n+a.x*b.y-a.y*b.x;},0))/2;
const key=p=>`${p.x.toFixed(6)},${p.y.toFixed(6)}`;
const edgeKey=(a,b)=>[key(a),key(b)].sort().join('|');
const pick=(a,r)=>a[Math.floor(r()*a.length)];
const shuffle=(a,r)=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
function clip(poly,a,b){const dx=b.x-a.x,dy=b.y-a.y,mx=(a.x+b.x)/2,my=(a.y+b.y)/2,side=p=>(p.x-mx)*dx+(p.y-my)*dy,out=[];
  poly.forEach((p,i)=>{const q=poly[(i+1)%poly.length],dp=side(p),dq=side(q);if(dp<=0)out.push(p);if((dp<=0)!==(dq<=0)){const t=dp/(dp-dq);out.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});}});return out;
}
function topology(cells){const map=new Map(),adj=cells.map(()=>new Set()),coast=new Set();
  cells.forEach((cell,id)=>cell.forEach((a,j)=>{const b=cell[(j+1)%cell.length],k=edgeKey(a,b);if(!map.has(k))map.set(k,{a,b,provinces:[]});map.get(k).provinces.push(id);}));
  for(const e of map.values()){if(e.provinces.length===1)coast.add(e.provinces[0]);else{const [a,b]=e.provinces;adj[a].add(b);adj[b].add(a);}}
  return {edges:[...map.values()],adj,coast};
}
function connected(adj,removed){const start=adj.findIndex((_,i)=>!removed.has(i));if(start<0)return false;const seen=new Set([start]),q=[start];for(let i=0;i<q.length;i++)for(const n of adj[q[i]])if(!removed.has(n)&&!seen.has(n)){seen.add(n);q.push(n);}return seen.size===adj.length-removed.size;}
export function generateWorld(options={}) {
  const seed=options.seed??Date.now(),r=rng(seed),lakeCount=Number(options.lakes??5),riverCount=Number(options.rivers??2),mountains=Number(options.mountains??3),provinceCount=Math.max(40,Math.min(200,Math.round(options.provinces??100))),sites=[];
  let attempts=0;
  while(sites.length<400){if(++attempts>300000)throw Error('Karte konnte nicht erzeugt werden. Bitte erneut versuchen.');const p={x:r()*22,y:r()*22};if(sites.every(q=>dist2(p,q)>.75**2))sites.push(p);}
  function tessellate(){return sites.map((a,i)=>{let poly=[{x:0,y:0},{x:22,y:0},{x:22,y:22},{x:0,y:22}];sites.forEach((b,j)=>{if(i!==j&&Math.abs(a.x-b.x)<4&&Math.abs(a.y-b.y)<4)poly=clip(poly,a,b);});return poly;});}
  for(let iteration=0;iteration<2;iteration++){const cells=tessellate();sites.forEach((p,i)=>{const c=center(cells[i]);sites[i]={x:p.x*.7+c.x*.3,y:p.y*.7+c.y*.3};});}
  const all=tessellate(),eligible=new Set(sites.map((p,i)=>p.x>2&&p.x<20&&p.y>2&&p.y<20?i:-1).filter(i=>i>=0));
  const adj=all.map((poly,i)=>poly.map((a,j)=>{const b=poly[(j+1)%poly.length],m={x:(a.x+b.x)/2,y:(a.y+b.y)/2};let nearest=-1,d=Infinity;sites.forEach((p,k)=>{const v=dist2(m,p);if(k!==i&&v<d){d=v;nearest=k;}});return eligible.has(nearest)&&Math.abs(d-dist2(m,sites[i]))<.002&&dist2(a,b)>.0001?nearest:-1;}).filter(i=>i>=0));
  const start=[...eligible].sort((a,b)=>dist2(sites[a],{x:11,y:11})-dist2(sites[b],{x:11,y:11}))[0],selected=new Set([start]),wanted=provinceCount+lakeCount*3;
  for(let arm=0,arms=3+Math.floor(r()*3);arm<arms;arm++){let current=pick([...selected],r),angle=r()*Math.PI*2;for(let step=0,length=8+Math.floor(r()*9);step<length;step++){
    angle+=(r()-.5)*.9;const options=adj[current].map(id=>{const dx=sites[id].x-sites[current].x,dy=sites[id].y-sites[current].y;return {id,score:(dx*Math.cos(angle)+dy*Math.sin(angle))/Math.hypot(dx,dy)+r()*.45};}).sort((a,b)=>b.score-a.score);
    if(options.length&&selected.size<wanted){current=options[0].id;selected.add(current);}
  }}
  while(selected.size<wanted){const frontier=[...new Set([...selected].flatMap(i=>adj[i]))].filter(i=>!selected.has(i));if(!frontier.length)throw Error('Unvollständige Landmasse.');const scored=frontier.map(id=>({id,score:adj[id].filter(i=>selected.has(i)).length*.3+r()})).sort((a,b)=>b.score-a.score);selected.add(scored[0].id);}
  const raw=[...selected].map(i=>all[i]),vertices=raw.flat(),xs=vertices.map(p=>p.x),ys=vertices.map(p=>p.y),left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys),scale=Math.min(.9/(right-left),.9/(bottom-top));
  // Snap shared vertices identically: hit testing, coast, river and wall topology agree.
  const normalize=p=>({x:+(.5+(p.x-(left+right)/2)*scale).toFixed(6),y:+(.5+(p.y-(top+bottom)/2)*scale).toFixed(6)});
  const cells=raw.map(poly=>poly.map(normalize)),topo=topology(cells),water=new Set(),lakes=[];
  for(let l=0;l<lakeCount;l++){
    const possible=cells.map((_,i)=>i).filter(i=>!water.has(i)&&!topo.coast.has(i)),root=shuffle(possible,r).find(i=>connected(topo.adj,new Set([...water,i])));if(root===undefined)continue;
    const lake=new Set([root]),size=1+Math.floor(r()*3);while(lake.size<size){const next=shuffle([...new Set([...lake].flatMap(i=>[...topo.adj[i]]))],r).find(i=>!water.has(i)&&!lake.has(i)&&!topo.coast.has(i)&&connected(topo.adj,new Set([...water,...lake,i])));if(next===undefined)break;lake.add(next);}lake.forEach(i=>water.add(i));lakes.push([...lake]);
  }
  const removed=new Set(water),trimmed=new Set();
  while(cells.length-removed.size>provinceCount){const candidates=cells.map((_,i)=>i).filter(i=>!removed.has(i)&&(topo.coast.has(i)||[...topo.adj[i]].some(n=>trimmed.has(n)))).sort((a,b)=>dist2(center(cells[b]),{x:.5,y:.5})-dist2(center(cells[a]),{x:.5,y:.5}));const next=candidates.find(i=>connected(topo.adj,new Set([...removed,i])));if(next===undefined)throw Error('Karte konnte nicht verkleinert werden.');removed.add(next);trimmed.add(next);}
  const land=cells.map((_,i)=>i).filter(i=>!removed.has(i)),provinces=land.map(i=>({cell:cells[i],home:center(cells[i]),biome:r()<.34?'forest':r()<.25?'dry':'meadow'}));
  const landTopo=topology(provinces.map(p=>p.cell)),corners=[],cornerMap=new Map();
  provinces.forEach((p,id)=>p.cell.forEach(point=>{const k=key(point);if(!cornerMap.has(k)){cornerMap.set(k,corners.length);corners.push({point,provinces:[]});}const corner=corners[cornerMap.get(k)];if(!corner.provinces.includes(id))corner.provinces.push(id);}));
  const edges=landTopo.edges.filter(e=>e.provinces.length===2).map(e=>({...e,river:false,mountain:false,vertices:[cornerMap.get(key(e.a)),cornerMap.get(key(e.b))]}));
  const coastVertices=new Set(landTopo.edges.filter(e=>e.provinces.length===1).flatMap(e=>[cornerMap.get(key(e.a)),cornerMap.get(key(e.b))]));
  const graph=corners.map(()=>[]);edges.forEach((e,i)=>{const [a,b]=e.vertices;graph[a].push([b,i]);graph[b].push([a,i]);});
  for(let river=0;river<riverCount;river++){let route=null;for(const start of shuffle(coastVertices,r)){
    const q=[start],previous=new Map(),distance=new Map([[start,0]]);for(let i=0;i<q.length;i++){const current=q[i];if(current!==start&&coastVertices.has(current))continue;for(const [next,edge] of shuffle(graph[current],r))if(!edges[edge].river&&!distance.has(next)){distance.set(next,distance.get(current)+1);previous.set(next,[current,edge]);q.push(next);}}
    const ends=[...coastVertices].filter(id=>(distance.get(id)??0)>=2).sort((a,b)=>distance.get(b)-distance.get(a));if(!ends.length)continue;route=[];let current=ends[0];while(current!==start){const [parent,edge]=previous.get(current);route.push(edge);current=parent;}break;
  }if(route)route.forEach(i=>edges[i].river=true);}
  function canBlock(blocked){const adj=provinces.map(()=>[]);edges.forEach(e=>{if(e!==blocked&&!e.mountain){const[a,b]=e.provinces;adj[a].push(b);adj[b].push(a);}});const seen=new Set([0]),q=[0];for(let i=0;i<q.length;i++)for(const next of adj[q[i]])if(!seen.has(next)){seen.add(next);q.push(next);}return seen.size===provinces.length;}
  for(let chain=0;chain<mountains;chain++){let current=Math.floor(r()*provinces.length);const seen=new Set([current]);for(let step=0,length=3+Math.floor(r()*4);step<length;step++){
    const candidates=edges.filter(e=>!e.river&&!e.mountain&&e.provinces.includes(current)&&!seen.has(e.provinces.find(id=>id!==current))&&canBlock(e));if(!candidates.length)break;const edge=pick(candidates,r);edge.mountain=true;current=edge.provinces.find(id=>id!==current);seen.add(current);
  }}
  const links=provinces.map(()=>[]);edges.filter(e=>!e.mountain).forEach(e=>{const [a,b]=e.provinces;links[a].push({target:b,river:e.river});links[b].push({target:a,river:e.river});});
  return {seed,provinces,edges,corners,links,lakeCells:[...water].map(i=>cells[i]),lakes:lakes.map(ids=>ids.map(i=>cells[i])),coast:landTopo.edges.filter(e=>e.provinces.length===1)};
}
