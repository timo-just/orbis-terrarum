// Direct authenticated game socket. Only enabled by the prototype server.
export class CloudflareChannel {
  constructor(config,room,token,getRevision,onState,onReady){this.config=config;this.room=room;this.token=token;this.getRevision=getRevision;this.onState=onState;this.onReady=onReady;this.pending=new Map();this.delay=500;this.serial=0;this.ready=false;this.closed=false;this.connect();}
  connect(){
    if(this.closed||typeof WebSocket==='undefined')return;
    const url=new URL(this.config.url);url.searchParams.set('revision',String(this.getRevision()));
    const socket=this.socket=new WebSocket(url,['orbis',`seat.${this.token}`]);
    this.joinTimer=setTimeout(()=>socket.close(),15000);
    socket.onmessage=event=>{
      if(this.closed||this.socket!==socket)return;
      if(event.data==='pong'){this.awaitingPong=false;return;}
      let message;try{message=JSON.parse(event.data);}catch{return;}
      if(message.event==='ready'){
        clearTimeout(this.joinTimer);this.ready=true;this.delay=500;this.onReady();
        this.heartbeat=setInterval(()=>{if(this.awaitingPong){socket.close();return;}if(socket.readyState===1){this.awaitingPong=true;socket.send('ping');}},25000);
      }else if(message.event==='state')this.onState(message.data);
      else if(message.id){const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);clearTimeout(pending.timer);if(message.error)pending.reject(Object.assign(Error(message.error.message),{status:message.error.status}));else pending.resolve(message.data);}
    };
    socket.onerror=()=>socket.close();
    socket.onclose=()=>{
      if(this.socket!==socket)return;this.ready=false;this.awaitingPong=false;clearInterval(this.heartbeat);clearTimeout(this.joinTimer);
      for(const pending of this.pending.values()){clearTimeout(pending.timer);pending.reject(Error('Connection interrupted. Retrying safely.'));}this.pending.clear();
      if(!this.closed){this.retry=setTimeout(()=>this.connect(),this.delay+Math.random()*300);this.delay=Math.min(15000,this.delay*2);}
    };
  }
  request(kind,data){
    if(!this.ready||this.socket.readyState!==1)return Promise.reject(Error('Socket not ready.'));
    const id=String(++this.serial);
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('Server response timed out.'));this.socket.close();},15000);
      this.pending.set(id,{resolve,reject,timer});
      try{this.socket.send(JSON.stringify({id,kind,compact:true,delta:true,...data}));}catch(error){clearTimeout(timer);this.pending.delete(id);reject(error);}
    });
  }
  close(){this.closed=true;this.ready=false;clearTimeout(this.retry);clearTimeout(this.joinTimer);clearInterval(this.heartbeat);for(const pending of this.pending.values()){clearTimeout(pending.timer);pending.reject(Error('Room disconnected.'));}this.pending.clear();this.socket?.close();}
}
