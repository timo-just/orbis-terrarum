import {ONLINE_URL} from './online-config.mjs';
import {apply,chooseStart,undoOwner} from './engine.mjs?v=expansion-6';
const advance=(state,action)=>action.kind==='draft'?chooseStart(state,action.source):apply(state,action);
export class OnlineGame {
  constructor(onUpdate,onError){this.onUpdate=onUpdate;this.onError=onError;this.room=null;this.snapshot=null;this.confirmed=null;this.sending=false;this.timer=null;this.pending=[];this.batch=null;this.flushTimer=null;this.flushing=false;this.retryDelay=500;this.epoch=0;}
  get configured(){return Boolean(ONLINE_URL);}
  get color(){return this.snapshot?.you||0;}
  get myTurn(){return this.snapshot?.status==='play'&&this.snapshot.state.player===this.color;}
  get saving(){return this.pending.length>0;}
  token(id){const key=`orbis-seat:${id}`;let token=localStorage.getItem(key);if(!token){token=crypto.randomUUID()+crypto.randomUUID();localStorage.setItem(key,token);}return token;}
  async request(kind,data={}){
    if(!this.configured)throw Error('Onlinepartien benötigen noch die Server-Einrichtung. Lokal spielen funktioniert bereits.');
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
    try{const r=await fetch(ONLINE_URL,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,room:this.room,token:this.token(this.room||'pending'),compact:Boolean(this.confirmed),...data}),signal:controller.signal});const body=await r.json();if(!r.ok){const error=Error(body.error||'Server nicht erreichbar.');error.status=r.status;throw error;}return body;}finally{clearTimeout(timeout);}
  }
  receive(data){
    if(data.unchanged)return;
    if(this.confirmed&&data.revision<this.confirmed.revision)return;
    const previous=this.confirmed;
    this.confirmed={...data,world:data.world??previous?.world,state:{...data.state,links:data.state.links??previous?.state.links,corners:data.state.corners??previous?.state.corners}};
    const acknowledged=new Set(data.acknowledgedRequests||[]);
    const acknowledgedOwn=this.pending.some(p=>acknowledged.has(p.batch));
    this.pending=this.pending.filter(p=>!acknowledged.has(p.batch));
    if(this.batch&&acknowledged.has(this.batch.id))this.batch=null;
    this.project({event:'sync',changed:!previous||previous.revision!==data.revision,remote:Boolean(previous&&!acknowledgedOwn&&data.lastActionRevision!==previous.lastActionRevision)});
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
  async create(settings,name){this.leave();const room=crypto.randomUUID();this.room=room;try{this.receive(await this.request('create',{settings,name}));this.watch();}catch(e){this.room=null;throw e;}}
  async join(room,name){this.leave();this.room=room;this.receive(await this.request('join',{name}));this.watch();}
  async resume(room){this.leave();this.room=room;this.receive(await this.request('read'));this.watch();}
  async send(kind,data={}){if(this.sending||this.saving)throw Error('Bitte warten, bis die Aktionen gespeichert sind.');const room=this.room;this.sending=true;try{const result=await this.request(kind,{revision:this.confirmed.revision,...data});if(this.room===room)this.receive(result);}catch(e){await this.poll();throw e;}finally{this.sending=false;}}
  async poll(force=false){if(!this.room||this.flushing&&!force)return;const epoch=this.epoch;try{const result=await this.request('read',{revision:this.confirmed?.revision});if(this.epoch===epoch)this.receive(result);}catch(e){if(this.epoch===epoch)this.onError(e.message);}}
  watch(){clearTimeout(this.timer);const epoch=this.epoch,tick=async()=>{await this.poll();if(this.room&&this.epoch===epoch)this.timer=setTimeout(tick,document.hidden?10000:1000);};this.timer=setTimeout(tick,1000);}
  leave(){this.epoch++;clearTimeout(this.timer);clearTimeout(this.flushTimer);this.flushTimer=null;this.room=null;this.snapshot=null;this.confirmed=null;this.pending=[];this.batch=null;this.flushing=false;this.retryDelay=500;}
  get link(){const url=new URL(location.href);url.hash=`room=${this.room}`;return url.href;}
  get recoveryLink(){const url=new URL(this.link);url.hash+=`&seat=${this.token(this.room)}`;return url.href;}
}
