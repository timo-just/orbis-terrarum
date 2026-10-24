import {chooseAction} from './ai.mjs';
import {weights} from './ai-model.mjs';
self.onmessage=({data})=>{try{self.postMessage({id:data.id,action:chooseAction(data.state,weights)});}catch(error){self.postMessage({id:data.id,error:error.message});}};
