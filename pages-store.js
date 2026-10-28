/** Summary: Browser-local event persistence for the public static learning edition.
 * The browser owner controls this data; validation is educational, not certification.
 */
export class AppError extends Error {
  constructor(code,message,status=400){super(message);this.code=code;this.status=status;}
}
export function fail(code,message,status=400){throw new AppError(code,message,status);}
export function inside(){fail('LOCAL_ONLY','Arquivos de engenharia pertencem ao projeto local.');}
export function stable(value){
  if(Array.isArray(value))return `[${value.map(stable).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const allowedTypes=new Set(['profile.update','lesson.complete','quiz.submit','practice.submit','study.log','note.save','reward.redeem','learner.import']);
export class BrowserStore {
  constructor(storage,key){this.storage=storage;this.key=key;this.validateEvents=null;this.check();}
  read(){
    let raw;
    try{raw=this.storage.getItem(this.key);}catch{fail('STORAGE','O navegador bloqueou o armazenamento. Nenhum progresso foi gravado.');}
    if(raw===null)return [];
    try{
      const data=JSON.parse(raw);
      if(data.version!==1||!Array.isArray(data.events)||data.events.length>20000)throw new Error('schema');
      const ids=new Set();
      for(const [i,e]of data.events.entries()){
        if(!e||e.seq!==i+1||typeof e.commandId!=='string'||ids.has(e.commandId)||!allowedTypes.has(e.type)||typeof e.actor!=='string'||!e.payload||typeof e.result!=='object'||typeof e.ts!=='string'||!Number.isFinite(Date.parse(e.ts)))throw new Error('event');
        ids.add(e.commandId);
      }
      return data.events;
    }catch{fail('CORRUPT_STORE','Dados locais invalidos. O arquivo do navegador foi preservado; restaure uma exportacao valida em um perfil separado.');}
  }
  events(){return this.read();}
  check(){const events=this.read();if(this.validateEvents)this.validateEvents(events);return{ok:true,revision:events.length};}
  transact(command,build){
    this.check();const events=this.events(),prior=events.find(e=>e.commandId===command.id);
    if(prior){
      if(stable({type:prior.type,payload:prior.payload,actor:prior.actor})!==stable({type:command.type,payload:command.payload,actor:command.actor}))fail('ID_CONFLICT','Identificador ja utilizado com outro comando.',409);
      return{result:prior.result,duplicate:true};
    }
    if(!allowedTypes.has(command.type))fail('LOCAL_ONLY','O tracker de engenharia permanece privado no aplicativo local.');
    const ts=new Date().toISOString(),result=build(events,ts);
    const event={seq:events.length+1,commandId:command.id,actor:command.actor,type:command.type,payload:command.payload,ts,result};
    const next=JSON.stringify({version:1,events:[...events,event]});
    if(new TextEncoder().encode(next).length>4*1024*1024)fail('STORAGE_LIMIT','Limite local de 4 MB atingido. Exporte uma copia antes de continuar.');
    try{this.storage.setItem(this.key,next);}catch{fail('STORAGE','Nao foi possivel salvar. O progresso anterior foi preservado; verifique o espaco e as permissoes do navegador.');}
    return{result,duplicate:false};
  }
}
