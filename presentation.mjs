export const preferredUnit=p=>['soldier','horse','archer'].find(t=>p[t]>0)||'soldier';
export const unitEnabled=(p,type)=>Boolean(p&&p[type]>0);
export const provinceCount=p=>p.soldier+p.horse+p.archer;
export const factionName=(seats,id,fallback)=>seats?.find(s=>s.color===id)?.name||fallback;
export function animationEnd(battles,volleys){return Math.max(0,...battles.map(b=>b.start+b.duration),...volleys.map(v=>v.start+v.duration));}
export function groupBadges(counts,positions){return ['soldier','horse','archer'].flatMap(type=>{const count=counts[type],points=positions[type]?.slice(0,count)||[];return count>5&&points.length?[{type,count,x:points.reduce((n,p)=>n+p.x,0)/points.length,y:points.reduce((n,p)=>n+p.y,0)/points.length}]:[];});}
