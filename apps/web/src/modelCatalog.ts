import type { ModelItem } from './types';
export const models:ModelItem[]=[
 {kind:'text',provider:'DeepSeek',value:'deepseek-chat',label:'DeepSeek Chat'},{kind:'text',provider:'智谱 AI',value:'glm-4.5',label:'GLM 4.5'},{kind:'text',provider:'Moonshot',value:'kimi-k2',label:'Kimi K2'},{kind:'text',provider:'OpenAI',value:'gpt-5',label:'GPT-5'},
 {kind:'image',provider:'Google',value:'nano-banana-pro',label:'Nano Banana Pro'},{kind:'image',provider:'OpenAI',value:'image-2',label:'Image 2'},{kind:'image',provider:'Volcengine',value:'seedream-5.0',label:'Seedream 5.0'},{kind:'image',provider:'Volcengine',value:'seedream-4.5',label:'Seedream 4.5'},{kind:'image',provider:'Volcengine',value:'seedream-4.0',label:'Seedream 4.0'},
 {kind:'video',provider:'火山方舟',value:'seedance-1.5-pro',label:'Seedance 1.5 Pro'},
 {kind:'audio',provider:'尚未接入',value:'audio-empty',label:'暂无可用模型',disabled:true}
];
