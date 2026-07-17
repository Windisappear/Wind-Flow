export type NodeKind='text'|'image'|'video'|'audio'|'file';
export type RunState='draft'|'ready'|'awaiting_confirmation'|'queued'|'running'|'succeeded'|'failed'|'stale';
export interface CanvasNodeData extends Record<string,unknown>{kind:NodeKind;title:string;prompt:string;model:string;provider:string;state:RunState;progress?:number;preview?:string;}
export interface ModelItem{value:string;label:string;provider:string;kind:NodeKind;disabled?:boolean;}
