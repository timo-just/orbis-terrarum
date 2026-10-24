import {createRoomService} from './room-service.mjs';
const url=Deno.env.get('SUPABASE_URL')!;
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const headers={'apikey':key,'Authorization':`Bearer ${key}`,'Content-Type':'application/json','Prefer':'return=representation'};
function broadcast(id:string,revision:number){
  // A hint only: every subsequent state read still authenticates the seat token.
  const task=fetch(`${url}/realtime/v1/api/broadcast`,{method:'POST',headers,body:JSON.stringify({messages:[{topic:`orbis:${id}`,event:'revision',payload:{revision},private:false}]})}).then(r=>{if(!r.ok)console.warn('Revision notification failed:',r.status);}).catch(()=>console.warn('Revision notification unavailable.'));
  EdgeRuntime.waitUntil(task);
}
async function database(path:string,method='GET',body?:unknown){const endpoint=path.startsWith('/rpc/')?path:`/orbis_rooms${path}`;const response=await fetch(`${url}/rest/v1${endpoint}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});if(!response.ok){if(response.status===409)return null;throw Error('Datenbank nicht verfügbar.');}return await response.json();}
const service=createRoomService({
  async create(row:{id:string;revision:number}){return Boolean(await database('?select=id','POST',row));},
  async getHead(id:string){return (await database(`?id=eq.${id}&select=id,revision,seats:snapshot->seats`))[0]||null;},
  async get(id:string,compact=false){return await database('/rpc/orbis_read_room','POST',{room_id:id,compact});},
  async getDelta(id:string,revision:number,secret:string){return await database('/rpc/orbis_read_delta','POST',{room_id:id,since_revision:revision,seat_secret:secret});},
  async compareAndSwap(row:{id:string;revision:number;snapshot:unknown},revision:number){const ok=await database('/rpc/orbis_update_room','POST',{room_id:row.id,expected_revision:revision,room_snapshot:row.snapshot});if(ok){broadcast(row.id,row.revision);return true;}return false;},
  async remove(id:string,revision:number){const rows=await database(`?id=eq.${id}&revision=eq.${revision}&select=id`,'DELETE');if(rows?.length===1){broadcast(id,revision+1);return true;}return false;},
  async cleanup(){await database(`?updated_at=lt.${new Date(Date.now()-7*86400000).toISOString()}&select=id`,'DELETE');}
});
const origins=new Set(['https://timo-just.github.io','http://localhost:8000','http://127.0.0.1:8000']);
Deno.serve(async request=>{
  const origin=request.headers.get('Origin')||'',cors={'Access-Control-Allow-Origin':(origins.has(origin)||/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))?origin:'https://timo-just.github.io','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Max-Age':'86400','Cache-Control':'no-store','Vary':'Origin'};
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  try{if(request.method!=='POST')return Response.json({error:'POST erforderlich.'},{status:405,headers:cors});if(Number(request.headers.get('Content-Length'))>2000000)throw Error('Anfrage zu groß.');const text=await request.text();if(text.length>2000000)throw Error('Anfrage zu groß.');const input=JSON.parse(text);const result=await service(input);if(!input.compact&&!result.closed&&!result.unchanged)result.sync={url,key:Deno.env.get('SUPABASE_ANON_KEY')};return Response.json(result,{headers:cors});}
  catch(error){const e=error as Error & {status?:number};return Response.json({error:e.status?e.message:'Server vorübergehend nicht erreichbar. Bitte erneut versuchen.'},{status:e.status||500,headers:{...cors,'Cache-Control':'no-store'}});}
});
