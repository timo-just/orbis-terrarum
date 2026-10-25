export const preferredUnit=p=>['soldier','horse','archer'].find(t=>p[t]>0)||'soldier';
export const unitEnabled=(p,type)=>Boolean(p&&p[type]>0);
export const provinceCount=p=>p.soldier+p.horse+p.archer;
export const factionName=(seats,id,fallback)=>seats?.find(s=>s.color===id)?.name||fallback;
export function animationEnd(battles,volleys){return Math.max(0,...battles.map(b=>b.start+b.duration),...volleys.map(v=>v.start+v.duration));}
