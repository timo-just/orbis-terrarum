import {createRoomService} from './room-service.mjs';
const url=Deno.env.get('SUPABASE_URL')!;
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const headers={'apikey':key,'Authorization':`Bearer ${key}`,'Content-Type':'application/json','Prefer':'return=representation'};
async function database(path:string,method='GET',body?:unknown){const response=await fetch(`${url}/rest/v1/orbis_rooms${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});if(!response.ok){if(response.status===409)return null;throw Error('Datenbank nicht verfügbar.');}return await response.json();}
const service=createRoomService({
  async create(row:unknown){return Boolean(await database('','POST',row));},
  async get(id:string){return (await database(`?id=eq.${id}&select=*`))[0]||null;},
  async compareAndSwap(row:{id:string;revision:number;snapshot:unknown},revision:number){const rows=await database(`?id=eq.${row.id}&revision=eq.${revision}`,'PATCH',{revision:row.revision,snapshot:row.snapshot,updated_at:new Date().toISOString()});return rows?.length===1;}
});
const origins=new Set(['https://timo-just.github.io','http://localhost:8000','http://127.0.0.1:8000']);
Deno.serve(async request=>{
  const origin=request.headers.get('Origin')||'',cors={'Access-Control-Allow-Origin':origins.has(origin)?origin:'https://timo-just.github.io','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  try{if(request.method!=='POST')return Response.json({error:'POST erforderlich.'},{status:405,headers:cors});if(Number(request.headers.get('Content-Length'))>20000)throw Error('Anfrage zu groß.');const text=await request.text();if(text.length>20000)throw Error('Anfrage zu groß.');return Response.json(await service(JSON.parse(text)),{headers:cors});}
  catch(error){const e=error as Error & {status?:number};return Response.json({error:e.status?e.message:'Server vorübergehend nicht erreichbar. Bitte erneut versuchen.'},{status:e.status||500,headers:{...cors,'Cache-Control':'no-store'}});}
});
