/** Summary: Serve the existing UI contract using validated browser-local learning events. */
import {Domain} from './pages-domain.js';
import {BrowserStore,allowedTypes,stable,fail} from './pages-store.js';
export const storageMode='browser';
let initialization;
export function createPagesClient({storage,key,content,architecture={nodes:[],edges:[],files:[],diagrams:{}}}){
  const store=new BrowserStore(storage,key),domain=new Domain(store,content);
  store.validateEvents=events=>{
    const state=domain.fold([]);
    for(const e of events){
      const result=domain.validate(e.type,e.payload,state,e.ts);
      if(stable(result)!==stable(e.result))fail('CORRUPT_STORE','Resultado de evento local invalido; dados preservados.');
      domain.apply(state,e);
    }
  };
  store.check();
  return async function handle(path,options={}){
    const method=options.method||'GET';
    if(method==='GET'&&path==='/api/bootstrap')return{...domain.bootstrap(),storage:'browser'};
    if(method==='GET'&&path==='/api/export')return domain.export();
    if(method==='GET'&&path==='/api/architecture')return architecture;
    if(method!=='POST')fail('NOT_FOUND','Rota indisponivel nesta edicao.',404);
    if(typeof options.body!=='string'||new TextEncoder().encode(options.body).length>2*1024*1024)fail('BODY_LIMIT','Requisicao invalida ou maior que 2 MB.');
    const data=JSON.parse(options.body);
    if(path==='/api/command'){
      if(!allowedTypes.has(data.type)||data.type==='learner.import')fail('LOCAL_ONLY','O tracker de engenharia e privado. Use a importacao de progresso para restaurar seu estudo.');
      return domain.execute(data,'aprendiz');
    }
    if(path==='/api/import')return domain.import(data.id,data.document,'aprendiz');
    fail('NOT_FOUND','Rota indisponivel nesta edicao.',404);
  };
}
async function client(){
  if(!initialization)initialization=(async()=>{
    const get=async file=>{const r=await fetch(new URL(file,import.meta.url));if(!r.ok)throw new Error(`Falha ao carregar ${file}: HTTP${r.status}`);return r.json();};
    const [curriculum,rewards,architecture]=await Promise.all(['curriculum.json','rewards.json','architecture.json'].map(get));
    return createPagesClient({storage:window.localStorage,key:`oficina-ia-pages-v1:${new URL('.',import.meta.url).pathname}`,content:{curriculum,rewards},architecture});
  })().catch(error=>{initialization=null;throw error;});
  return initialization;
}
export async function fetchResource(path,options={}){
  try{
    const action=async()=>{const handler=await client();return handler(path,options);};
    const data=options.method==='POST'&&globalThis.navigator?.locks
      ?await navigator.locks.request(`oficina-ia:${new URL('.',import.meta.url).pathname}`,action):await action();
    return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
  }catch(error){return new Response(JSON.stringify({ok:false,error:{code:error.code||'BROWSER',message:error.message}}),{status:error.status||400,headers:{'Content-Type':'application/json'}});}
}
