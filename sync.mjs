// Revision notifications contain no game state or player credentials.
export class RevisionChannel {
  constructor(config,room,onRevision,onReady){this.config=config;this.room=room;this.onRevision=onRevision;this.onReady=onReady;this.closed=false;this.ready=false;this.ref=0;this.delay=1000;this.connect();}
  connect(){
    if(this.closed||typeof WebSocket==='undefined')return;
    const url=new URL(this.config.url);url.protocol='wss:';url.pathname='/realtime/v1/websocket';url.search=new URLSearchParams({apikey:this.config.key,vsn:'1.0.0'});
    const socket=this.socket=new WebSocket(url);const topic=`realtime:orbis:${this.room}`;
    const send=(event,payload={},channel=topic,ref=String(++this.ref))=>{if(socket.readyState===1)socket.send(JSON.stringify({topic:channel,event,payload,ref,join_ref:'1'}));};
    socket.onopen=()=>{send('phx_join',{config:{private:false,broadcast:{self:false,ack:false},presence:{enabled:false},postgres_changes:[]}},topic,'1');this.joinTimer=setTimeout(()=>socket.close(),10000);};
    socket.onmessage=event=>{if(this.closed||this.socket!==socket)return;let m;try{m=JSON.parse(event.data);}catch{return;}
      if(m.topic===topic&&m.event==='phx_reply'&&m.ref==='1'&&m.payload?.status==='ok'){clearTimeout(this.joinTimer);this.ready=true;this.delay=1000;this.onReady();this.heartbeat=setInterval(()=>{if(this.awaitingHeartbeat){socket.close();return;}this.awaitingHeartbeat=true;send('heartbeat',{},'phoenix');},25000);}
      if(m.topic==='phoenix'&&m.event==='phx_reply')this.awaitingHeartbeat=false;
      if(m.topic===topic&&m.event==='broadcast'&&m.payload?.event==='revision'){const revision=m.payload.payload?.revision;if(Number.isSafeInteger(revision)&&revision>=0)this.onRevision(revision);}
      if(m.event==='phx_error'||m.event==='phx_close')socket.close();
    };
    socket.onerror=()=>socket.close();
    socket.onclose=()=>{if(this.socket!==socket)return;this.ready=false;this.awaitingHeartbeat=false;clearTimeout(this.joinTimer);clearInterval(this.heartbeat);if(!this.closed){this.retry=setTimeout(()=>this.connect(),this.delay+Math.random()*500);this.delay=Math.min(30000,this.delay*2);}};
  }
  close(){this.closed=true;this.ready=false;clearTimeout(this.retry);clearTimeout(this.joinTimer);clearInterval(this.heartbeat);this.socket?.close();}
}
