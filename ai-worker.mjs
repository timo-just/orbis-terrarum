import {chooseAction} from './ai-v2.mjs';
import {weights} from './ai-v2-model.mjs';
self.onmessage=({data})=>{try{self.postMessage({id:data.id,action:chooseAction(data.state,weights)});}catch(error){self.postMessage({id:data.id,error:error.message});}};
