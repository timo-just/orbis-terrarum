import {ONLINE_URL} from './online-config.mjs';
export class OnlineGame {
  constructor(onUpdate,onError){this.onUpdate=onUpdate;this.onError=onError;this.room=null;this.snapshot=null;this.sending=false;this.timer=null;}
  get configured(){return Boolean(ONLINE_URL);}
  get color(){return this.snapshot?.you||0;}
  get myTurn(){return this.snapshot?.status==='play'&&this.snapshot.state.player===this.color;}
  token(id){const key=`orbis-seat:${id}`;let token=localStorage.getItem(key);if(!token){token=crypto.randomUUID()+crypto.randomUUID();localStorage.setItem(key,token);}return token;}
  async request(kind,data={}){
    if(!this.configured)throw Error('Onlinepartien benötigen noch die Server-Einrichtung. Lokal spielen funktioniert bereits.');
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
    try{const r=await fetch(ONLINE_URL,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,room:this.room,token:this.token(this.room||'pending'),...data}),signal:controller.signal});const body=await r.json();if(!r.ok){const error=Error(body.error||'Server nicht erreichbar.');error.status=r.status;throw error;}return body;}finally{clearTimeout(timeout);}
  }
  receive(data){if(data.unchanged)return;if(this.snapshot&&data.revision<this.snapshot.revision)return;const changed=!this.snapshot||data.revision!==this.snapshot.revision;this.snapshot=data;if(changed)this.onUpdate(data);}
  async create(settings,name){this.leave();const room=crypto.randomUUID();this.room=room;try{this.receive(await this.request('create',{settings,name}));this.watch();}catch(e){this.room=null;throw e;}}
  async join(room,name){this.leave();this.room=room;this.receive(await this.request('join',{name}));this.watch();}
  async resume(room){this.leave();this.room=room;this.receive(await this.request('read'));this.watch();}
  async send(kind,data={}){if(this.sending)throw Error('Die vorige Aktion wird noch gespeichert.');const room=this.room;this.sending=true;try{const result=await this.request(kind,{revision:this.snapshot.revision,...data});if(this.room===room)this.receive(result);}catch(e){await this.poll();throw e;}finally{this.sending=false;}}
  async poll(){if(!this.room)return;const room=this.room;try{const result=await this.request('read',{revision:this.snapshot?.revision});if(this.room===room)this.receive(result);}catch(e){if(this.room===room)this.onError(e.message);}}
  watch(){clearTimeout(this.timer);const tick=async()=>{await this.poll();if(this.room)this.timer=setTimeout(tick,document.hidden?10000:1500);};this.timer=setTimeout(tick,1500);}
  leave(){clearTimeout(this.timer);this.room=null;this.snapshot=null;}
  get link(){const url=new URL(location.href);url.hash=`room=${this.room}`;return url.href;}
  get recoveryLink(){const url=new URL(this.link);url.hash+=`&seat=${this.token(this.room)}`;return url.href;}
}
