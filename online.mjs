import * as serverConfig from './online-config.mjs';
import {RevisionChannel} from './sync.mjs?v=cavalry-29';
import {apply,chooseStart,undoOwner} from './engine.mjs?v=cavalry-29';
const advance=(state,action)=>action.kind==='draft'?chooseStart(state,action.source):apply(state,action);
export class OnlineGame {
  constructor(onUpdate,onError,configuration=serverConfig){this.defaultURL=configuration.ONLINE_URL;this.apiURL=this.defaultURL;this.legacyURL=configuration.LEGACY_ONLINE_URL;this.onUpdate=onUpdate;this.onError=onError;this.room=null;this.snapshot=null;this.confirmed=null;this.sending=false;this.timer=null;this.pending=[];this.batch=null;this.flushTimer=null;this.flushing=false;this.retryDelay=500;this.epoch=0;}
  get configured(){return Boolean(this.defaultURL);}
  get color(){return this.snapshot?.you||0;}
  get myTurn(){return !this.closed&&this.snapshot?.status==='play'&&this.snapshot.state.player===this.color;}
  get saving(){return this.pending.length>0;}
  token(id){const key=`orbis-seat:${id}`;let token=localStorage.getItem(key);if(!token){token=crypto.randomUUID()+crypto.randomUUID();localStorage.setItem(key,token);}return token;}
  async request(kind,data={}){
    if(!this.configured)throw Error('Onlinepartien benötigen noch die Server-Einrichtung. Lokal spielen funktioniert bereits.');
    if(this.channel?.ready&&this.channel.request)return this.channel.request(kind,data);
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
    try{const payload=JSON.stringify({kind,room:this.room,token:this.token(this.room||'pending'),compact:Boolean(this.confirmed),delta:Boolean(this.confirmed),...data}),send=url=>fetch(url,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:payload,signal:controller.signal});let r=await send(this.apiURL||this.defaultURL);
      if(r.status===404&&!this.confirmed&&['read','join'].includes(kind)&&this.legacyURL&&this.apiURL!==this.legacyURL){r=await send(this.legacyURL);if(r.ok)this.apiURL=this.legacyURL;}
      const body=await r.json();if(!r.ok){const error=Error(body.error||'Server nicht erreichbar.');error.status=r.status;throw error;}return body;}finally{clearTimeout(timeout);}
  }
  receive(data){
    if(data.closed){this.closed=true;this.channel?.close();clearTimeout(this.timer);this.onUpdate(this.snapshot,{closed:true});return;}
    if(data.unchanged)return;
    if(this.confirmed&&data.revision<this.confirmed.revision)return;
    const previous=this.confirmed;
    if(data.delta){if(!previous){this.onError('Full synchronization required.');return;}const p=previous.state.p.slice();for(const [id,province] of data.provinces||[])p[id]=province;data={...data,state:{...previous.state,...data.state,p}};}
    this.confirmed={...data,sync:data.sync??previous?.sync,world:data.world??previous?.world,state:{...data.state,links:data.state.links??previous?.state.links,corners:data.state.corners??previous?.state.corners}};
    const acknowledged=new Set(data.acknowledgedRequests||[]);
    const acknowledgedOwn=this.pending.some(p=>acknowledged.has(p.batch));
    this.pending=this.pending.filter(p=>!acknowledged.has(p.batch));
    if(this.batch&&acknowledged.has(this.batch.id))this.batch=null;
    const seen=new Set((previous?.recentBattles||[]).map(b=>b.id)),battles=previous?(data.recentBattles||[]).filter(b=>b.owner!==data.you&&!seen.has(b.id)):[];
    this.project({event:'sync',battles,changed:!previous||previous.revision!==data.revision,remote:Boolean(previous&&!acknowledgedOwn&&data.lastActionRevision!==previous.lastActionRevision)});
  }
  project(meta={}){
    if(!this.confirmed)return;
    let state=this.confirmed.state;const kept=[];
    for(const entry of this.pending){try{if(state.player!==this.confirmed.you&&!(entry.action.kind==='undo'&&undoOwner(state)===this.confirmed.you))throw Error();state=advance(state,entry.action);kept.push(entry);}catch{this.onError('Der Spielstand wurde aktualisiert. Eine noch unbestätigte Aktion wurde verworfen.');}}
    if(kept.length!==this.pending.length){this.batch=null;kept.forEach(p=>p.batch=null);}
    this.pending=kept;this.snapshot={...this.confirmed,state};this.onUpdate(this.snapshot,{...meta,saving:this.saving});
  }
  enqueue(action){
    if(!this.myTurn&&!(action.kind==='undo'&&undoOwner(this.snapshot.state)===this.color))throw Error('Du bist nicht am Zug.');
    if(this.pending.length>=128)throw Error('Bitte kurz warten, bis die Aktionen gespeichert sind.');
    const state=advance(this.snapshot.state,action);this.pending.push({action:structuredClone(action),batch:null});
    this.snapshot={...this.snapshot,state};this.onUpdate(this.snapshot,{event:'action',action,saving:true});this.scheduleFlush(35);
  }
  scheduleFlush(delay){if(this.flushTimer||this.flushing)return;this.flushTimer=setTimeout(()=>{this.flushTimer=null;this.flush();},delay);}
  async flush(){
    if(this.flushing||!this.room||!this.pending.length)return;
    const room=this.room,epoch=this.epoch;this.flushing=true;
    if(!this.batch){const entries=this.pending.slice(0,64),id=crypto.randomUUID();entries.forEach(p=>p.batch=id);this.batch={id,revision:this.confirmed.revision,actions:entries.map(p=>p.action)};}
    const batch=this.batch;
    try{const result=await this.request('actions',{requestId:batch.id,revision:batch.revision,actions:batch.actions});if(this.epoch!==epoch)return;this.receive(result);this.retryDelay=500;}
    catch(error){
      if(this.epoch!==epoch)return;
      if(error.status===409){this.batch=null;this.pending.forEach(p=>p.batch=null);this.retryDelay=1000;await this.poll(true);}
      else if(error.status&&error.status<500){this.pending=[];this.batch=null;await this.poll(true);this.project();this.onError(error.message);}
      else{this.onError('Verbindung unterbrochen. Aktionen werden erneut gespeichert …');this.retryDelay=Math.min(8000,this.retryDelay*2);}
    }finally{if(this.epoch===epoch){this.flushing=false;if(this.pending.length)this.scheduleFlush(this.retryDelay===500?0:this.retryDelay);}}
  }
  async create(settings,name,save){this.leave();const room=crypto.randomUUID();this.room=room;try{this.receive(await this.request('create',{settings,name,...(save?{save}: {})}));this.watch();}catch(e){this.room=null;throw e;}}
  async join(room,name){this.leave();this.room=room;this.receive(await this.request('join',{name}));this.watch();}
  async resume(room){this.leave();this.room=room;this.receive(await this.request('read'));this.watch();}
  async send(kind,data={}){if(this.sending||this.saving)throw Error('Bitte warten, bis die Aktionen gespeichert sind.');const room=this.room;this.sending=true;try{const result=await this.request(kind,{revision:this.confirmed.revision,...data});if(this.room===room)this.receive(result);}catch(e){await this.poll();throw e;}finally{this.sending=false;}}
  async poll(force=false){if(!this.room||this.closed||this.polling||this.flushing&&!force)return;const epoch=this.epoch;this.polling=true;try{const result=await this.request('read',{revision:this.confirmed?.revision});if(this.epoch===epoch)this.receive(result);}catch(e){if(this.epoch===epoch){if(e.status===404)this.receive({closed:true});else this.onError(e.message);}}finally{if(this.epoch===epoch)this.polling=false;}}
  notify(revision){if(this.closed||revision<=this.confirmed?.revision)return;this.notifiedRevision=Math.max(this.notifiedRevision||0,revision);if(this.notifyTimer)return;const epoch=this.epoch;this.notifyTimer=setTimeout(async()=>{this.notifyTimer=null;if(this.epoch!==epoch)return;if(this.polling||this.flushing){this.notify(this.notifiedRevision);return;}this.notifiedRevision=0;await this.poll();},120);}
  pollDelay(){return this.channel?.ready?60000:globalThis.document?.hidden?30000:5000;}
  watch(){clearTimeout(this.timer);this.channel?.close();const epoch=this.epoch,config=this.confirmed?.sync;
    if(config?.type==='orbis-ws')import('./cloudflare-channel.mjs?v=cavalry-29').then(({CloudflareChannel})=>{if(this.epoch!==epoch)return;this.channel=new CloudflareChannel(config,this.room,this.token(this.room),()=>this.confirmed?.revision??0,data=>{if(this.epoch===epoch)this.receive(data);},()=>this.poll());}).catch(error=>this.onError(error.message));
    else if(config?.url&&config?.key)this.channel=new RevisionChannel(config,this.room,revision=>this.notify(revision),()=>this.poll());
    this.wake=()=>{if(!globalThis.document?.hidden)this.poll();};globalThis.document?.addEventListener('visibilitychange',this.wake);globalThis.addEventListener?.('online',this.wake);
    const tick=async()=>{await this.poll();if(this.room&&!this.closed&&this.epoch===epoch)this.timer=setTimeout(tick,this.pollDelay());};this.timer=setTimeout(tick,this.pollDelay());
  }
  leave(){this.epoch++;this.apiURL=this.defaultURL;this.channel?.close();this.channel=null;globalThis.document?.removeEventListener('visibilitychange',this.wake);globalThis.removeEventListener?.('online',this.wake);clearTimeout(this.notifyTimer);this.notifyTimer=null;this.notifiedRevision=0;this.polling=false;this.closed=false;clearTimeout(this.timer);clearTimeout(this.flushTimer);this.flushTimer=null;this.room=null;this.snapshot=null;this.confirmed=null;this.pending=[];this.batch=null;this.flushing=false;this.retryDelay=500;}
  get link(){const url=new URL(location.href);url.hash=`room=${this.room}`;return url.href;}
  get recoveryLink(){const url=new URL(this.link);url.hash+=`&seat=${this.token(this.room)}`;return url.href;}
}
