import {createState,chooseStart,apply} from './engine.mjs';
import {generateWorld} from './world.mjs';
import {validateSave} from './offline.mjs';
const fail=(message,status=400)=>{const e=Error(message);e.status=status;throw e;};
const validId=s=>typeof s==='string'&&/^[a-f0-9-]{36}$/.test(s);
const nameOf=s=>typeof s==='string'&&s.trim()?s.trim().slice(0,28):'Spieler';
export function createRoomService(store,cryptoApi=globalThis.crypto,random=Math.random){
  async function hash(token){const data=await cryptoApi.subtle.digest('SHA-256',new TextEncoder().encode(token));return Array.from(new Uint8Array(data),b=>b.toString(16).padStart(2,'0')).join('');}
  function view(row,you,compact=false,revision=-1,deltaMode=false){
    const {seats,recentRequests=[],recentChanges=[],...snapshot}=row.snapshot;
    if(snapshot.status==='lobby')snapshot.settings={...snapshot.settings,players:snapshot.restoredPlayers||6};
    if(compact&&!snapshot.delta){
      delete snapshot.world;
      const {links,corners,...state}=snapshot.state;
      const history=recentChanges.filter(c=>c.revision>revision);
      const delta=deltaMode&&history.length>0&&history[0].revision===revision+1&&history.at(-1).revision===row.revision;
      const undo=state.undo?.at(-1)?.actor===you?state.undo:[];
      if(delta){const fields={},provinces=new Map();for(const change of history){Object.assign(fields,change.fields);for(const [id,p] of change.provinces)provinces.set(id,p);}snapshot.state={...fields,undo};snapshot.provinces=[...provinces];snapshot.delta=true;}
      else snapshot.state={...state,undo};
    }
    return {room:row.id,revision:row.revision,...snapshot,seats:seats.map(({color,name})=>({color,name})),acknowledgedRequests:recentRequests.filter(r=>r.player===you&&(r.revision===undefined||r.revision>revision)).map(r=>r.id),you};
  }
  return async function handle(input){
    const {kind,room,token}=input;
    if(!validId(room)||typeof token!=='string'||token.length<60||token.length>200)fail('Ungültiger Raum oder Spielerschlüssel.');
    const secret=await hash(token);
    if(kind==='create'){
      await store.cleanup?.();
      const opts=input.settings||{},settings={};for(const [key,min,max] of [['players',2,6],['rivers',0,8],['mountains',0,10],['lakes',0,12]]){const v=opts[key];if(!Number.isInteger(v)||v<min||v>max)fail('Ungültige Karteneinstellungen.');settings[key]=v;}
      if(Number.isInteger(opts.starter)&&opts.starter>=1&&opts.starter<=6)settings.starter=opts.starter;
      if(Number.isSafeInteger(opts.seed)&&opts.seed>=0)settings.seed=opts.seed;
      settings.provinces=opts.provinces??100;if(!Number.isInteger(settings.provinces)||settings.provinces<40||settings.provinces>200)fail('Ungültige Provinzanzahl.');
      settings.players=6;
      let restored=null;if(input.save){try{restored=validateSave(input.save);}catch{fail('Invalid save.');}if(restored.state.players<2)fail('An online save needs at least two players.');}
      const world=restored?structuredClone(restored.world):generateWorld(settings),row={id:room,revision:0,snapshot:{status:'lobby',settings,world,state:restored?structuredClone(restored.state):createState(world,settings.players),...(restored?{restoredPlayers:restored.state.players}:{}),seats:[{color:1,name:nameOf(input.name),secret}]}};
      if(!await store.create(row))fail('Diese Lobby existiert bereits.',409);return view(row,1);
    }
    if(kind==='read'&&Number.isSafeInteger(input.revision)&&store.getHead){
      const head=await store.getHead(room);if(!head)fail('Partie nicht gefunden.',404);
      if(!head.seats.some(s=>s.secret===secret))fail('Bitte zuerst der Lobby beitreten.',403);
      if(head.revision===input.revision)return {room,revision:head.revision,unchanged:true};
    }
    for(let attempt=0;attempt<5;attempt++){
      const row=kind==='read'&&input.compact===true&&input.delta===true&&Number.isSafeInteger(input.revision)&&store.getDelta?await store.getDelta(room,input.revision,secret):await store.get(room,input.compact===true&&kind!=='start');if(!row)fail('Partie nicht gefunden.',404);
      const seat=row.snapshot.seats.find(s=>s.secret===secret);let color=seat?.color;
      if(kind==='read'){if(!seat)fail('Bitte zuerst der Lobby beitreten.',403);if(input.revision===row.revision)return {room,revision:row.revision,unchanged:true};return view(row,color,input.compact===true,input.revision??-1,input.delta===true);}
      const next=structuredClone(row);
      if(kind==='join'){
        if(seat)return view(row,color);
        if(row.snapshot.status!=='lobby')fail('Die Partie läuft bereits. Nutze auf deinem bisherigen Gerät denselben Link oder deinen persönlichen Fortsetzungslink.',403);
        if(row.snapshot.seats.length>=(row.snapshot.restoredPlayers||6))fail('Die Lobby ist voll.',409);
        color=row.snapshot.seats.length+1;next.snapshot.seats.push({color,name:nameOf(input.name),secret});
      }else{
        if(!seat)fail('Kein Zugriff auf diese Farbe.',403);
        if(kind==='actions'&&row.snapshot.recentRequests?.some(r=>r.id===input.requestId&&r.player===color))return view(row,color,input.compact===true,input.revision??-1,input.delta===true);
        if(input.revision!==row.revision)fail('Der Spielstand hat sich geändert. Bitte erneut versuchen.',409);
        if(kind==='start'){
          if(color!==1)fail('Nur der Gastgeber kann starten.',403);
          if(row.snapshot.status!=='lobby'||row.snapshot.seats.length<2)fail('Zum Starten werden mindestens zwei Spieler benötigt.');
          next.snapshot.settings.players=next.snapshot.seats.length;
          if(next.snapshot.restoredPlayers&&next.snapshot.seats.length!==next.snapshot.restoredPlayers)fail(`This save needs ${next.snapshot.restoredPlayers} players.`);
          if(!next.snapshot.restoredPlayers)next.snapshot.state=createState(next.snapshot.world,next.snapshot.seats.length,(next.snapshot.settings.starter?((next.snapshot.settings.starter-1)%next.snapshot.seats.length)+1:1+Math.floor(random()*next.snapshot.seats.length)));
          next.snapshot.status='play';
        }else if(kind==='close'){
          if(color!==1)fail('Only the host can close the room.',403);
          if(!store.remove)fail('Room closing is unavailable.',503);
          if(!await store.remove(room,row.revision))fail('The game changed. Download a fresh save and try again.',409);
          return {room,closed:true};
        }else if(kind==='rename'){
          if(typeof input.name!=='string'||!input.name.trim())fail('Bitte einen Namen eingeben.');
          next.snapshot.seats.find(s=>s.color===color).name=nameOf(input.name);
        }else if(kind==='action'||kind==='actions'){
          if(row.snapshot.status!=='play')fail('Die Partie läuft noch nicht.',403);
          const actions=kind==='actions'?input.actions:[input.action];
          if(!Array.isArray(actions)||actions.length<1||actions.length>64)fail('Ungültige Aktionsliste.');
          if(kind==='actions'&&!validId(input.requestId))fail('Ungültige Aktionskennung.');
          for(const [index,action] of actions.entries()){
            if(next.snapshot.state.player!==color&&!(action?.kind==='undo'&&next.snapshot.state.undo?.at(-1)?.actor===color))fail('Du bist nicht am Zug.',403);
            if(!action||typeof action!=='object')fail('Aktion fehlt.');
            const before=next.snapshot.state;
            try{next.snapshot.state=action.kind==='draft'?chooseStart(next.snapshot.state,action.source):apply(next.snapshot.state,{...action,player:color});}catch(error){fail(error.message);}
            if(action.kind==='move')next.snapshot.recentBattles=[...(next.snapshot.recentBattles||[]),{id:`${row.revision+1}:${index}`,action,owner:color,before:before.p[action.target],after:next.snapshot.state.p[action.target]}].slice(-24);
            if(action.kind==='undo')next.snapshot.recentBattles=[];
            next.snapshot.lastAction=action;
          }
          if(kind==='actions')next.snapshot.recentRequests=[...(next.snapshot.recentRequests||[]),{id:input.requestId,player:color,revision:row.revision+1}].slice(-128);
          next.snapshot.lastActionRevision=row.revision+1;
        }else fail('Unbekannte Aktion.');
      }
      next.revision++;
      const before=row.snapshot.state,after=next.snapshot.state,fields={},provinces=[];
      for(const key of Object.keys(after))if(!['p','links','corners','undo'].includes(key)&&JSON.stringify(before[key])!==JSON.stringify(after[key]))fields[key]=after[key];
      for(let id=0;id<after.p.length;id++)if(JSON.stringify(before.p[id])!==JSON.stringify(after.p[id]))provinces.push([id,after.p[id]]);
      next.snapshot.recentChanges=[...(row.snapshot.recentChanges||[]),{revision:next.revision,fields,provinces}].slice(-32);
      if(await store.compareAndSwap(next,row.revision))return view(next,color,input.compact===true,input.revision??-1,input.delta===true);
    }fail('Eine andere Aktion war schneller. Bitte erneut versuchen.',409);
  };
}
