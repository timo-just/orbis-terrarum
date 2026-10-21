import {createState,chooseStart,apply} from './engine.mjs';
import {generateWorld} from './world.mjs';
const fail=(message,status=400)=>{const e=Error(message);e.status=status;throw e;};
const validId=s=>typeof s==='string'&&/^[a-f0-9-]{36}$/.test(s);
const nameOf=s=>typeof s==='string'&&s.trim()?s.trim().slice(0,28):'Spieler';
export function createRoomService(store,cryptoApi=globalThis.crypto){
  async function hash(token){const data=await cryptoApi.subtle.digest('SHA-256',new TextEncoder().encode(token));return Array.from(new Uint8Array(data),b=>b.toString(16).padStart(2,'0')).join('');}
  function view(row,you){const {seats,...snapshot}=row.snapshot;return {room:row.id,revision:row.revision,...snapshot,seats:seats.map(({color,name})=>({color,name})),you};}
  return async function handle(input){
    const {kind,room,token}=input;
    if(!validId(room)||typeof token!=='string'||token.length<60||token.length>200)fail('Ungültiger Raum oder Spielerschlüssel.');
    const secret=await hash(token);
    if(kind==='create'){
      const opts=input.settings||{},settings={};for(const [key,min,max] of [['players',2,6],['rivers',0,8],['mountains',0,10],['lakes',0,12]]){const v=opts[key];if(!Number.isInteger(v)||v<min||v>max)fail('Ungültige Karteneinstellungen.');settings[key]=v;}
      if(Number.isSafeInteger(opts.seed)&&opts.seed>=0)settings.seed=opts.seed;
      const world=generateWorld(settings),row={id:room,revision:0,snapshot:{status:'lobby',settings,world,state:createState(world,settings.players),seats:[{color:1,name:nameOf(input.name),secret}]}};
      if(!await store.create(row))fail('Diese Lobby existiert bereits.',409);return view(row,1);
    }
    for(let attempt=0;attempt<5;attempt++){
      const row=await store.get(room);if(!row)fail('Partie nicht gefunden.',404);
      const seat=row.snapshot.seats.find(s=>s.secret===secret);let color=seat?.color;
      if(kind==='read'){if(!seat)fail('Bitte zuerst der Lobby beitreten.',403);if(input.revision===row.revision)return {room,revision:row.revision,unchanged:true};return view(row,color);}
      const next=structuredClone(row);
      if(kind==='join'){
        if(seat)return view(row,color);
        if(row.snapshot.status!=='lobby')fail('Die Partie läuft bereits. Nutze auf deinem bisherigen Gerät denselben Link oder deinen persönlichen Fortsetzungslink.',403);
        if(row.snapshot.seats.length>=row.snapshot.settings.players)fail('Die Lobby ist voll.',409);
        color=row.snapshot.seats.length+1;next.snapshot.seats.push({color,name:nameOf(input.name),secret});
      }else{
        if(!seat)fail('Kein Zugriff auf diese Farbe.',403);
        if(input.revision!==row.revision)fail('Der Spielstand hat sich geändert. Bitte erneut versuchen.',409);
        if(kind==='start'){
          if(color!==1)fail('Nur der Gastgeber kann starten.',403);
          if(row.snapshot.status!=='lobby'||row.snapshot.seats.length!==row.snapshot.settings.players)fail('Warte, bis alle Spieler beigetreten sind.');
          next.snapshot.status='play';
        }else if(kind==='action'){
          if(row.snapshot.status!=='play'||row.snapshot.state.player!==color)fail('Du bist nicht am Zug.',403);
          const action=input.action;if(!action||typeof action!=='object')fail('Aktion fehlt.');
          next.snapshot.state=action.kind==='draft'?chooseStart(row.snapshot.state,action.source):apply(row.snapshot.state,action);
          if(action.kind==='draft'&&row.snapshot.state.phase!=='draft')fail('Die Startprovinzen sind bereits gewählt.');
          next.snapshot.lastAction=action;
        }else fail('Unbekannte Aktion.');
      }
      next.revision++;if(await store.compareAndSwap(next,row.revision))return view(next,color);
    }fail('Eine andere Aktion war schneller. Bitte erneut versuchen.',409);
  };
}
