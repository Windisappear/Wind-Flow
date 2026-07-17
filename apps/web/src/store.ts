import { create } from 'zustand';
import type { Edge,Node } from '@xyflow/react';
import type { CanvasNodeData,NodeKind } from './types';

const demoNodes:Node<CanvasNodeData>[]=[
 {id:'story',type:'creative',position:{x:80,y:120},data:{kind:'text',title:'创意文案',prompt:'一支关于未来城市清晨的短片，安静、克制、真实。',provider:'DeepSeek',model:'deepseek-chat',state:'succeeded'}},
 {id:'keyframe',type:'creative',position:{x:470,y:70},data:{kind:'image',title:'城市主视觉',prompt:'清晨薄雾中的现代城市，35mm 电影摄影',provider:'Google',model:'nano-banana-pro',state:'succeeded',preview:'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=720&q=80'}},
 {id:'motion',type:'creative',position:{x:880,y:130},data:{kind:'video',title:'镜头运动',prompt:'镜头缓慢向前推进，雾气在建筑间流动',provider:'火山方舟',model:'seedance-1.5-pro',state:'ready'}},
 {id:'variant',type:'creative',position:{x:470,y:470},data:{kind:'image',title:'夜景分支',prompt:'同一城市的雨夜版本，霓虹反射',provider:'火山方舟',model:'seedream-4.0',state:'stale',preview:'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=720&q=80'}},
];
const demoEdges:Edge[]=[{id:'e1',source:'story',target:'keyframe',animated:true},{id:'e2',source:'keyframe',target:'motion',animated:true},{id:'e3',source:'story',target:'variant'}];
interface CanvasStore{nodes:Node<CanvasNodeData>[];edges:Edge[];selected?:string;setNodes:(n:Node<CanvasNodeData>[])=>void;setEdges:(e:Edge[])=>void;select:(id?:string)=>void;addNode:(kind:NodeKind)=>void;patch:(id:string,data:Partial<CanvasNodeData>)=>void;remove:(id:string)=>void;}
export const useCanvasStore=create<CanvasStore>((set,get)=>({nodes:demoNodes,edges:demoEdges,selected:'motion',setNodes:n=>set({nodes:n}),setEdges:e=>set({edges:e}),select:id=>set({selected:id}),addNode:kind=>{const id=crypto.randomUUID();const names={text:'文本对话',image:'图像生成',video:'视频生成',audio:'音频（待接入）',file:'本地素材'};set({nodes:[...get().nodes,{id,type:'creative',position:{x:220+Math.random()*500,y:160+Math.random()*350},data:{kind,title:names[kind],prompt:'',provider:'',model:'',state:'draft'}}],selected:id});},patch:(id,data)=>set({nodes:get().nodes.map(n=>n.id===id?{...n,data:{...n.data,...data}}:n)}),remove:id=>set({nodes:get().nodes.filter(n=>n.id!==id),edges:get().edges.filter(e=>e.source!==id&&e.target!==id),selected:undefined})}));
