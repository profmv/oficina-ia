/** Summary: Shared learning UI with validated SQLite or browser-local persistence through its transport. */
import { unitEconomics, confusionMetrics, formatDuration } from './tools.js';
import {fetchResource,storageMode} from './transport.js';
const isPages=storageMode==='browser';

const $ = selector => document.querySelector(selector);
const main = $('#main');
let S = null, currentTab = 'learn', toastTimer, taskFocus = null;
const labels = {dashboard:'Visao geral',path:'Minha trilha',module:'Minha trilha',lab:'Laboratorio',career:'Carreira e renda',library:'Biblioteca',rewards:'Conquistas',tracker:'Tracker de acoes',architecture:'Mapa do sistema',settings:'Meu plano e dados'};
const statuses = {backlog:'Backlog',todo:'A fazer',in_progress:'Em andamento',in_review:'Em revisao',blocked:'Bloqueado',done:'Concluido'};
const money = n => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
const percent = n => `${Math.round(Number(n) || 0)}%`;
const date = value => value ? new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(value)) : '';

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key,value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'on') for (const [event,handler] of Object.entries(value)) node.addEventListener(event,handler);
    else if (key === 'text') node.textContent = value;
    else if (key === 'value') node.value = value;
    else if (key === 'style') for (const declaration of String(value).split(';')) { const at=declaration.indexOf(':'); if(at>0)node.style.setProperty(declaration.slice(0,at).trim(),declaration.slice(at+1).trim()); }
    else if (key === 'checked' || key === 'disabled' || key === 'required' || key === 'open') node[key] = Boolean(value);
    else node.setAttribute(key,String(value));
  }
  const append = child => { if (Array.isArray(child)) child.forEach(append); else if (child !== null && child !== undefined && child !== false) node.append(child instanceof Node ? child : document.createTextNode(String(child))); };
  children.forEach(append);
  return node;
}
function button(text, action, classes = '', attrs = {}) { return el('button',{type:'button',class:`button ${classes}`,on:{click:action},...attrs},text); }
function link(text, href, classes = '', external = false) { return el('a',{href,class:classes,...(external?{target:'_blank',rel:'noopener noreferrer'}:{})},text); }
function tag(text, style = '') { return el('span',{class:`chip ${style}`},text); }
function track(value) { return el('div',{class:'progress-track',role:'progressbar','aria-valuemin':0,'aria-valuemax':100,'aria-valuenow':Math.round(value),'aria-label':'Progresso'},el('span',{style:`width:${Math.max(0,Math.min(100,value))}%`})); }
function insight(text,title) { return el('div',{class:'insight'},title?el('div',{class:'callout-title'},title):null,text); }
function field(label, input, hint, full = false) { const id = input.id || `f-${crypto.randomUUID()}`; input.id=id; return el('div',{class:`field${full?' full':''}`},el('label',{for:id},label),input,hint?el('small',{},hint):null); }
function input(name,value='',attrs={}) { return el('input',{name,value,...attrs}); }
function textarea(name,value='',attrs={}) { return el('textarea',{name,...attrs},value); }
function select(name,options,value) { const node=el('select',{name},options.map(o=>el('option',{value:typeof o==='string'?o:o.value},typeof o==='string'?o:o.label))); node.value=value; return node; }
function card(...nodes) { return el('section',{class:'card'},nodes); }
function heading(eyebrow,title,description) { return el('div',{class:'page-heading'},el('div',{class:'eyebrow'},eyebrow),el('h1',{},title),description?el('p',{class:'intro-copy'},description):null); }
function sectionHeading(title,description,action) { return el('div',{class:'section-heading'},el('div',{},el('h2',{},title),description?el('p',{},description):null),action); }
function formSubmit(form,handler) { form.addEventListener('submit',async event=>{event.preventDefault();const submit=form.querySelector('[type=submit]');if(submit)submit.disabled=true;try{await handler(new FormData(form),form);}catch(error){notify(error.message,true);}finally{if(submit)submit.disabled=false;}}); return form; }
function notify(text,error=false) { const box=$('#toast');box.textContent=text;box.classList.toggle('error',error);box.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.hidden=true,error?10000:5000); if(error&&$('#task-dialog').open){$('#task-dialog .dialog-error')?.remove();const alert=el('div',{class:'error-panel dialog-error',role:'alert'},text);$('#task-dialog .dialog-header').insertAdjacentElement('afterend',alert);} }
function modules() { return S.curriculum.modules; }
function moduleBy(id) { return modules().find(m=>m.id===id); }
function moduleMetrics(id) { return S.metrics.modules[id] || {lessonsCompleted:0,lessonsTotal:4,quizBestScore:0,percent:0}; }
function source(id) { return S.curriculum.sources.find(s=>s.id===id); }
function route() { return (location.hash.slice(1)||'dashboard').split('/'); }

async function request(path,options={}) {
  const response=await fetchResource(path,options);
  let data;try{data=await response.json();}catch{throw new Error('O servidor retornou uma resposta inesperada. Seus registros anteriores permanecem no computador.');}
  if(!response.ok||data.ok===false)throw new Error(data.error?.message||`Falha HTTP ${response.status}.`);
  return data;
}
async function reload() { S=await request('/api/bootstrap');updateChrome();return S; }
function updateChrome() { $('#sidebar-hours').textContent=`${S.state.profile.weeklyHours} horas / semana`;$('#save-status').textContent=`${isPages?'Salvo neste navegador':'Salvo no computador'} / rev ${S.revision}`;$('.avatar').textContent=(S.state.profile.name||'Marcos').slice(0,1).toUpperCase(); }
async function command(type,payload,message='Registro salvo.',rerender=true) {
  $('#save-status').textContent='Salvando';
  try { const data=await request('/api/command',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':S.csrfToken},body:JSON.stringify({id:crypto.randomUUID(),type,payload})});
    S.state=data.state;S.metrics=data.metrics;S.revision=data.revision;updateChrome();if(message)notify(message);if(rerender)render();return data;
  }catch(error){$('#save-status').textContent='Registro nao salvo';throw error;}
}
function guarded(handler) { return async()=>{try{await handler();}catch(error){notify(error.message,true);}}; }
async function saveNotebook(moduleId,title,text) {
  const old=S.state.notes[moduleId]?.text||'';
  const value=[old,`## ${title}\n${text}`].filter(Boolean).join('\n\n');
  return command('note.save',{moduleId,text:value},'Atividade adicionada ao caderno do modulo.',false);
}

function render() {
  if(!S)return;const [page,id]=route();
  document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===(page==='module'?'path':page)));
  $('#page-label').textContent=labels[page]||labels.dashboard;$('#sidebar').classList.remove('open');$('#menu-toggle').setAttribute('aria-expanded','false');
  main.replaceChildren();
  const views={dashboard:renderDashboard,path:renderPath,module:()=>renderModule(id),lab:renderLab,career:renderCareer,library:renderLibrary,rewards:renderRewards,tracker:renderTracker,architecture:renderArchitecture,settings:renderSettings};
  (views[page]||renderDashboard)();
}

function moduleCard(m) {
  const p=moduleMetrics(m.id);
  return linkNode(el('a',{href:`#module/${m.id}`,class:'module-card'},
    el('div',{class:'module-top'},el('span',{class:'module-number'},m.id.slice(1)),el('span',{},`SEMANAS ${m.weeks.join(' - ')}`)),
    el('h3',{},m.title),el('p',{},m.subtitle),track(p.percent),el('div',{class:'module-bottom'},el('span',{},`${p.lessonsCompleted}/4 leituras / ${p.practiceSubmitted?'pratica registrada':'pratica pendente'}`),el('span',{},p.completed?'Concluido':percent(p.percent)))));
}
function linkNode(node){return node;}
function renderDashboard() {
  const p=S.state.profile,metrics=S.metrics,done=metrics.completedModules.length,total=modules().length;
  const next=modules().find(m=>!moduleMetrics(m.id).completed)||modules()[total-1];
  const hero=el('section',{class:'hero'},el('div',{},el('div',{class:'eyebrow'},`SUA TRILHA / ${p.name||'MARCOS'}`),el('h1',{},'Capacidade tecnica.',el('br'),el('em',{},'Valor demonstrado.')),el('p',{class:'intro-copy'},'Sua experiencia com IA ja tem amplitude. Agora, transforme uma promessa pequena em uma entrega que voce consegue explicar, reproduzir e sustentar.'),el('div',{class:'meta-line'},el('span',{},'24 semanas'),el('span',{},`${p.weeklyHours} horas por semana`),el('span',{},'Um capstone continuo')),el('div',{class:'button-row'},link(done?'Continuar minha evolucao':'Comecar minha trilha',`#module/${next.id}`,'button'),link('Ajustar meu plano','#settings','button button-secondary'))),
    el('div',{class:'hero-aside'},el('div',{class:'progress-ring',style:`--progress:${done/total*100}%`},el('div',{class:'progress-ring-content'},el('strong',{},`${done}/${total}`),el('small',{},'MODULOS'))),el('div',{},el('b',{},`Nivel ${metrics.level}`),el('p',{},metrics.levelName||'Aprendiz de entrega'),el('p',{},`${metrics.xp} XP conquistados`),tag('Progresso com evidencia','chip-success'))));
  const stats=el('div',{class:'stats-grid'},stat('TEMPO DE PRATICA',formatDuration(metrics.totalStudyMinutes),'Sessoes declaradas por voce'),stat('QUIZZES DOMINADOS',Object.values(S.state.quizResults).filter(q=>q.passed).length,'Melhor resultado >= 80%'),stat('EVIDENCIAS PRATICAS',Object.keys(S.state.practices).length,'Declaradas pelo aprendiz'),stat('MOEDAS DISPONIVEIS',metrics.coinsAvailable,'Recompensas opcionais'));
  const nextCard=el('section',{class:'card next-card'},el('div',{class:'tiny-label'},'SEU PROXIMO PASSO'),el('h2',{},next.title),el('p',{},next.why),el('div',{class:'chip-row'},tag(`Semanas ${next.weeks.join(' e ')}`),tag('12 horas sugeridas'),tag('Pratica + verificacao')),link('Abrir o modulo',`#module/${next.id}`,'button'));
  const weekly=el('section',{class:'card week-card'},el('div',{class:'tiny-label'},'RITMO SUSTENTAVEL'),el('h3',{class:'section-space'},'Esta semana'),el('div',{class:'large-number'},formatDuration(metrics.weeklyMinutes),el('small',{},` de ${formatDuration(metrics.weeklyTargetMinutes||p.weeklyHours*60)}`)),track(metrics.weeklyMinutes/(metrics.weeklyTargetMinutes||p.weeklyHours*60)*100),el('p',{class:'micro'},'O tempo ajuda a organizar a rotina. A compreensao e a entrega exigem evidencias proprias.'),link('Registrar uma sessao',`#module/${next.id}`,'text-link'));
  main.append(hero,stats,el('div',{class:'dashboard-columns'},nextCard,weekly),sectionHeading('A trilha, em pequenas entregas','Estude, construa, tente quebrar e explique o que aconteceu.',link('Ver os 12 modulos','#path','text-link')),el('div',{class:'module-grid'},modules().slice(0,3).map(moduleCard)),
    insight('O debate identificou integracao e coordenacao elaboradas, com maturidade desigual. Esta trilha converte as lacunas de evidencia em verificacoes. Ela nao presume incapacidade nem confere uma certificacao.','Seu ponto de partida e uma hipotese verificavel.'),
    el('div',{class:'split'},card(el('div',{class:'tiny-label'},'UM PROJETO POR VEZ'),el('h3',{class:'section-space'},p.capstone||'Escolha seu capstone'),el('p',{},p.capstone?'Mantenha o mesmo problema durante a trilha. Ajuste o escopo pelos testes e pelo aceite.':'Uma tarefa recorrente, dados sinteticos ou autorizados e um usuario-alvo. O modulo 1 ajuda a definir a promessa.'),link('Definir a promessa','#lab','text-link')),card(el('div',{class:'tiny-label'},'QUATRO BLOCOS POR SEMANA'),el('ul',{class:'checklist'},[['90 min','Estudo dirigido e previsao'],['180 min','Implementacao do capstone'],['60 min','Falhas e recuperacao'],['30 min','Explicacao e retrospectiva']].map(([a,b])=>el('li',{},el('span',{class:'check-code'},a),b))))));
}
function stat(label,value,caption){return el('div',{class:'stat'},el('div',{class:'stat-label'},label),el('div',{class:'stat-value'},value),el('div',{class:'stat-caption'},caption));}
function renderPath() {
  main.append(heading('24 SEMANAS / 144 HORAS DE REFERENCIA','Uma trilha. Um capstone.','Aumente a qualidade da mesma entrega a cada modulo. A agenda pode ser estendida; a meta de seis horas semanais e ajustavel e nao cria prazo de dominio garantido.'),
    insight('Cada semana reserva 90 minutos para estudar, 180 para construir, 60 para verificar falhas e 30 para explicar. Com outra disponibilidade, distribua os blocos por mais semanas; os criterios de aceite permanecem.'),el('div',{class:'module-grid'},modules().map(moduleCard)));
}
function renderModule(id) {
  const m=moduleBy(id);if(!m){main.append(heading('TRILHA','Modulo nao encontrado.','Escolha um modulo existente.'),link('Voltar a trilha','#path','button'));return;}
  const p=moduleMetrics(id);
  main.append(link('Voltar a trilha','#path','text-link'),heading(`MODULO ${id.slice(1)} / SEMANAS ${m.weeks.join(' E ')}`,m.title,m.why),el('div',{class:'chip-row'},m.skills.map(s=>tag(s)),p.completed?tag('Modulo concluido','chip-success'):tag(`${percent(p.percent)} do percurso`)));
  const tabs=el('div',{class:'tabs',role:'tablist','aria-label':'Atividades do modulo'});
  const panel=el('div',{id:'module-panel',role:'tabpanel'});
  const renderPanel=()=>{tabs.replaceChildren();for(const [key,title]of [['learn','Aprender'],['practice','Praticar e provar'],['quiz','Quiz'],['notes','Caderno e reflexao']])tabs.append(button(title,()=>{currentTab=key;renderPanel();},`tab ${currentTab===key?'active':''}`,{role:'tab','aria-selected':currentTab===key,'aria-controls':'module-panel'}));panel.replaceChildren();if(currentTab==='learn')renderLessons(m,panel);else if(currentTab==='practice')renderPractice(m,panel);else if(currentTab==='quiz')renderQuiz(m,panel);else renderNotes(m,panel);};
  const aside=el('aside',{class:'card side-card'},el('div',{class:'tiny-label'},'CRITERIO DE FECHAMENTO'),el('h3',{class:'section-space'},'O que conta como progresso'),el('ul',{class:'checklist'},[
    [p.lessonsCompleted===4,`${p.lessonsCompleted}/4 leituras registradas`],[p.quizPassed,`Quiz: melhor nota ${percent(p.quizBestScore)}`],[p.practiceSubmitted,'Evidencia e rubrica declaradas']].map(([ok,t])=>el('li',{},el('span',{class:'check-code'},ok?'[OK]':'[ ]'),t))),el('p',{class:'micro'},'Leitura nao equivale a dominio. A pratica e autodeclarada; o quiz e corrigido automaticamente. Validacao externa precisa de outro registro.'),m.weekPlans.map(w=>el('div',{class:'week-plan'},el('h4',{},`Semana ${w.week}`),w.blocks.map(b=>el('p',{},el('b',{},`${b.minutes} min / `),b.instructions)))),studyForm(m));
  main.append(tabs,el('div',{class:'module-layout'},panel,aside));renderPanel();
}
function renderLessons(m,panel) {
  panel.append(...m.lessons.map((l,index)=>{const completed=Boolean(S.state.completedLessons[l.id]);return el('details',{class:'lesson',open:index===0},el('summary',{},el('span',{class:`lesson-marker ${completed?'done':''}`},completed?'OK':String(index+1).padStart(2,'0')),el('span',{class:'lesson-title'},l.title),el('span',{class:'lesson-duration'},`${l.minutes} min`)),el('div',{class:'lesson-body'},l.body.map(p=>el('p',{},p)),el('h4',{},'Antes de seguir'),el('ul',{},l.checklist.map(c=>el('li',{},c))),el('div',{class:'lesson-source'},l.sourceIds.map(sid=>{const s=source(sid);return s?link(`${sid} / ${s.provider}`,s.url,'',true):null;})),button(completed?'Leitura registrada':'Registrar esta leitura',guarded(()=>command('lesson.complete',{lessonId:l.id},'Leitura registrada. Use a pratica para demonstrar compreensao.')),'button-secondary',{disabled:completed})))}));
}
function renderPractice(m,panel) {
  const saved=S.state.practices[m.id];
  const form=el('form',{},el('h2',{},m.practice.title),el('p',{class:'intro-copy'},m.practice.brief),el('ol',{class:'step-list'},m.practice.steps.map(s=>el('li',{},s))),el('h3',{class:'section-space'},'Entregaveis'),el('ul',{},m.practice.deliverables.map(d=>el('li',{},d))),field('Sua evidencia',textarea('evidence',saved?.evidence||'',{required:true,minlength:30,maxlength:12000,rows:7}),'Descreva o que fez, o resultado esperado/obtido e onde esta a prova. Um caminho digitado aqui nao verifica o arquivo.'),field('Como a IA participou?',select('assistance',[{value:'none',label:'Sem IA nesta atividade'},{value:'hints',label:'Pistas e explicacoes'},{value:'copilot',label:'Copiloto com revisao minha'},{value:'delegated',label:'Execucao delegada com verificacao'}],saved?.assistance||'copilot')),
    el('h3',{class:'section-space'},'Rubrica de aceite autodeclarado'),m.practice.acceptance.map((a,i)=>el('label',{class:'checkbox-row'},input(`rubric-${i}`,'yes',{type:'checkbox',required:true,checked:saved?.rubric?.[i]}),el('span',{},a))),insight('Marcar esta rubrica declara a sua avaliacao. Para afirmar aceitacao por outra pessoa, inclua quem avaliou, o criterio e o resultado, sem dados pessoais desnecessarios.'),el('button',{type:'submit',class:'button'},saved?'Atualizar evidencia declarada':'Registrar evidencia e rubrica'));
  formSubmit(form,async(data)=>command('practice.submit',{moduleId:m.id,evidence:String(data.get('evidence')),assistance:String(data.get('assistance')),rubric:m.practice.acceptance.map((_,i)=>data.get(`rubric-${i}`)==='yes')},'Pratica registrada como evidencia declarada.'));
  panel.append(card(form),el('section',{class:'card section-space'},el('div',{class:'tiny-label'},'DESAFIO DE FECHAMENTO'),el('h3',{class:'section-space'},m.boss.title),el('p',{},m.boss.scenario),el('ul',{},m.boss.criteria.map(c=>el('li',{},c)))));
}
function renderQuiz(m,panel) {
  const result=S.state.quizResults[m.id];
  panel.append(insight('O quiz e formativo: tente novamente e estude a explicacao. O dominio exige >= 80% (neste modulo de tres questoes, 3/3). O XP de aprovacao so e concedido uma vez.'));
  if(result?.attempts?.length){const last=result.attempts[result.attempts.length-1];panel.append(quizFeedback(last));}
  const form=el('form',{},m.quiz.questions.map((q,index)=>el('fieldset',{class:'quiz-question'},el('legend',{},`${index+1}. ${q.prompt}`),q.choices.map((choice,i)=>el('label',{class:'quiz-choice'},input(q.id,String(i),{type:'radio',required:true}),el('span',{},choice))))),el('button',{type:'submit',class:'button'},'Corrigir e entender o resultado'));
  formSubmit(form,async data=>{const answers=m.quiz.questions.map(q=>Number(data.get(q.id)));await command('quiz.submit',{moduleId:m.id,answers},'Tentativa registrada. Leia as explicacoes.');});panel.append(form);
}
function quizFeedback(attempt) {
  return el('section',{class:`feedback-card ${attempt.passed?'':'needs-work'}`},el('h3',{},`${percent(attempt.score)} / ${attempt.passed?'Criterio do quiz atingido':'Revise e tente novamente'}`),el('p',{},'Esta nota vale para estas questoes; nao certifica dominio geral.'),(attempt.feedback||[]).map((f,i)=>el('div',{class:'feedback-item'},el('b',{},`${i+1}. ${f.correct?'Resposta correta.':'Revise este conceito.'}`),el('div',{},f.explanation))));
}
function renderNotes(m,panel) {
  const note=S.state.notes[m.id]?.text||'';
  const form=el('form',{},el('h2',{},'Seu raciocinio, em palavras'),el('p',{class:'intro-copy'},'Registre previsoes antes de executar. Depois compare com o que observou. A explicacao revela o que precisa estudar a seguir.'),el('ul',{},m.reflection.prompts.map(p=>el('li',{},p))),field('Caderno persistente',textarea('text',note,{rows:16,maxlength:20000}),'Salvo no banco local pelo servidor. Preserve dados sensiveis fora deste caderno.'),el('button',{type:'submit',class:'button'},'Salvar meu caderno'));
  formSubmit(form,async data=>command('note.save',{moduleId:m.id,text:String(data.get('text'))},'Caderno salvo.'));panel.append(card(form));
}
function studyForm(m) {
  const form=el('form',{class:'session-card'},el('h3',{},'Registrar uma sessao'),field('Minutos de estudo',input('minutes',30,{type:'number',min:1,max:360,required:true})),field('O que ficou mais claro?',textarea('reflection','',{rows:3,minlength:10,maxlength:1000,required:true})),el('button',{type:'submit',class:'button button-secondary compact'},'Salvar sessao'));
  formSubmit(form,async data=>command('study.log',{moduleId:m.id,minutes:Number(data.get('minutes')),reflection:String(data.get('reflection'))},'Sessao registrada. Tempo nao gera XP isoladamente.'));return form;
}

function renderLab() {
  main.append(heading('PENSAR ANTES DE EXECUTAR','Laboratorio de decisoes','Experimentos pequenos para praticar as distincoes que mais importam: promessa e aceite, custo e resultado, metrica e limite. Salve suas observacoes no caderno do modulo correspondente.'));
  const grid=el('div',{class:'tool-grid'});main.append(grid);
  const economics=card(el('div',{class:'tiny-label'},'MODULO 10 / ECONOMIA'),el('h2',{class:'section-space'},'Quanto custa uma tarefa aceita?'),el('p',{},'Inclua tentativas reprovadas e revisao. O valor do seu tempo e uma hipotese informada por voce; nao e uma recomendacao de preco de mercado.'));
  const ef=el('form',{},el('div',{class:'form-grid'},field('Tentativas',input('attempts',10,{type:'number',min:0,step:1})),field('Tarefas aceitas',input('accepted',8,{type:'number',min:0,step:1})),field('Desembolso total (R$)',input('cash',20,{type:'number',min:0,step:.01})),field('Tempo humano total (min)',input('humanMinutes',120,{type:'number',min:0,step:1})),field('Valor hipotetico da hora (R$)',input('hourlyValue',50,{type:'number',min:0,step:.01}),'Separe desembolso de tempo valorizado.')));
  const er=el('div',{class:'calculation','aria-live':'polite'});let economicsValue;
  const calc=()=>{try{economicsValue=unitEconomics(Object.fromEntries(new FormData(ef)));er.replaceChildren(el('strong',{},economicsValue.perAccepted===null?'Sem aceite':`${money(economicsValue.perAccepted)} / aceite`),el('p',{},`Total estimado: ${money(economicsValue.total)}. Tempo valorizado: ${money(economicsValue.valuedTime)}. ${economicsValue.perAccepted===null?'Custo por aceita indefinido enquanto nao houver aceite.':'As reprovacoes continuam no custo.'}`));}catch(e){economicsValue=null;er.replaceChildren(el('p',{},e.message));}};ef.addEventListener('input',calc);economics.append(ef,er,button('Salvar a hipotese no modulo 10',guarded(async()=>{if(!economicsValue)throw new Error('Corrija os valores primeiro.');await saveNotebook('m10','Experimento de custo',JSON.stringify(economicsValue,null,2)+'\nEstimativa; nao e retorno observado.');}),'button-secondary'));grid.append(economics);calc();
  const confusion=card(el('div',{class:'tiny-label'},'MODULO 08 / AVALIACAO'),el('h2',{class:'section-space'},'Uma metrica conta toda a historia?'),el('p',{},'Exemplo: detectar um registro que precisa de revisao. Preencher uma matriz ensina o calculo; nao valida um modelo em producao.'));
  const cf=el('form',{},el('div',{class:'form-grid'},field('Verdadeiros positivos',input('tp',8,{type:'number',min:0,step:1})),field('Falsos positivos',input('fp',2,{type:'number',min:0,step:1})),field('Falsos negativos',input('fn',4,{type:'number',min:0,step:1})),field('Verdadeiros negativos',input('tn',16,{type:'number',min:0,step:1}))));
  const cr=el('div',{class:'calculation','aria-live':'polite'});let cv;const cm=()=>{try{cv=confusionMetrics(Object.fromEntries(new FormData(cf)));const pct=n=>n===null?'Nao aplicavel':percent(n*100);cr.replaceChildren(el('strong',{},`Precisao: ${pct(cv.precision)}`),el('p',{},`Recall: ${pct(cv.recall)} / Acuracia: ${pct(cv.accuracy)} / Casos: ${cv.total}`),el('p',{},'Denominador zero produz nao aplicavel. Qual erro traz maior dano ao seu usuario?'));}catch(e){cv=null;cr.replaceChildren(el('p',{},e.message));}};cf.addEventListener('input',cm);confusion.append(cf,cr,button('Salvar a interpretacao no modulo 08',guarded(async()=>{if(!cv)throw new Error('Corrija os valores primeiro.');await saveNotebook('m08','Matriz de confusao',JSON.stringify(cv,null,2)+'\nDescreva o dano relativo de FP e FN.');}),'button-secondary'));grid.append(confusion);cm();
  const promise=card(el('div',{class:'tiny-label'},'MODULO 01 / PROMESSA'),el('h2',{class:'section-space'},'Delimite uma entrega que vale verificar'),el('p',{},'Escolha uma rotina concreta e uma falha de maior consequencia. Mantenha este problema ao longo da trilha.'));
  const pf=el('form',{},el('div',{class:'form-grid'},field('Quem tem qual problema?',textarea('problem','',{required:true,minlength:10,rows:3})),field('Entradas e saidas',textarea('io','',{required:true,minlength:10,rows:3})),field('Criterio de aceite',textarea('acceptance','',{required:true,minlength:10,rows:3})),field('Falha prioritaria e limite de escopo',textarea('risk','',{required:true,minlength:10,rows:3}))),el('button',{type:'submit',class:'button'},'Salvar a promessa no modulo 01'));formSubmit(pf,async data=>saveNotebook('m01','Canvas da promessa',[...data].map(([k,v])=>`${k}: ${v}`).join('\n')));promise.append(pf);promise.classList.add('wide-card');grid.append(promise);
  const scenario=card(el('div',{class:'tiny-label'},'MODULO 09 / ESCOLHA DE ARQUITETURA'),el('h2',{class:'section-space'},'Funcao, workflow ou agente?'),el('p',{},'Um CSV precisa ser validado contra regras fixas. O formato e conhecido e nao ha necessidade de decidir novos passos. Qual primeira alternativa testar?'));
  const feedback=el('p',{'aria-live':'polite'});for(const [i,text]of ['Funcao deterministica com testes','Cinco agentes em debate','Agente com acesso irrestrito'].entries())scenario.append(button(text,()=>{feedback.textContent=i===0?'Boa primeira hipotese: regras fixas pedem a alternativa simples. Compare resultado e custo antes de ampliar autonomia.':'Mais autonomia nao resolve por si uma regra fixa. Teste primeiro uma funcao e so amplie quando a avaliacao justificar.';},'button-secondary compact'));scenario.append(feedback,link('Estudar o modulo 09','#module/m09','text-link'));grid.append(scenario);
}

function renderCareer() {
  const active=S.state.profile.route;
  main.append(heading('CONFIANCA QUE GERA OPORTUNIDADE','Torne seu valor demonstravel.','Combine dominio do negocio, engenharia verificavel, comunicacao e confiabilidade. Nenhum profissional e literalmente insubstituivel; sua contribuicao pode se tornar dificil de substituir por resultados e criterio.'),insight('A rota inicial e uma hipotese editavel. Renda e contratacao dependem de mercado, capacidade de entrega e contexto; o sistema acompanha suas tentativas e evidencias, sem garantir resultado.'));
  main.append(el('div',{class:'route-grid'},S.curriculum.routes.map(r=>el('section',{class:`card route-card ${active===r.id?'selected':''}`},tag(active===r.id?'Sua rota atual':'Rota disponivel',active===r.id?'chip-success':''),el('h3',{},r.title),el('p',{},r.summary),el('ol',{class:'step-list'},r.steps.map(s=>el('li',{},el('b',{},s.title),el('p',{},s.action),el('small',{class:'micro'},`Evidencia: ${s.evidence}`)))),el('p',{},el('b',{},'Exemplo de promessa: '),r.offerExample),button(active===r.id?'Rota selecionada':'Escolher esta rota',guarded(()=>command('profile.update',{route:r.id},'Rota atualizada.')),'button-secondary',{disabled:active===r.id})))));
  const r=S.curriculum.routes.find(r=>r.id===active)||S.curriculum.routes[0];
  main.append(sectionHeading('Seu experimento comercial','Registre a hipotese antes de procurar uma confirmacao.'),el('div',{class:'split'},card(el('h3',{},'Limites que protegem sua credibilidade'),el('ul',{},r.risks.map(x=>el('li',{},x))),insight('Entrevistas, propostas e candidaturas sao atividades a serem realizadas por voce. Este aplicativo nao envia mensagens nem se candidata em seu nome.')),careerNotebook(r)));
}
function careerNotebook(r) {
  const f=el('form',{},el('h3',{},r.id==='emprego'?'Matriz requisito - evidencia':r.id==='produto'?'Experimento de problema e uso':'Rascunho de oferta com escopo'),field(r.id==='emprego'?'Requisito e evidencia que ja tenho':'Problema e usuario-alvo',textarea('problem','',{required:true,minlength:10,rows:3})),field(r.id==='emprego'?'Lacuna e demonstracao que farei':'Promessa, exclusoes e criterio de aceite',textarea('proof','',{required:true,minlength:10,rows:4})),field('Proximo teste e condicao para continuar',textarea('next','',{required:true,minlength:10,rows:3})),el('button',{type:'submit',class:'button'},'Guardar no modulo 11'));
  formSubmit(f,async data=>saveNotebook('m11',`Experimento da rota ${r.title}`,[...data].map(([k,v])=>`${k}: ${v}`).join('\n')));return card(f);
}
function renderLibrary() {
  main.append(heading('18 FONTES PRIMARIAS / ESTUDO DIRIGIDO','Uma biblioteca com proposito.','Use a fonte para responder a uma pergunta do seu capstone. Ler todos os materiais integralmente nao e requisito da trilha. Alguns cursos e laboratorios pedem conta, e servicos de inferencia podem ter custo.'),insight('Links consultados em 28/10/2026. Acesso de leitura gratuito nao implica certificado, computacao ou servico gratuito. Materiais em ingles podem exigir leitura tecnica assistida.'));
  const search=input('search','',{type:'search',placeholder:'Buscar assunto, fonte ou idioma','aria-label':'Buscar fontes'}),grid=el('div',{class:'source-grid'});
  const draw=()=>{const q=search.value.toLowerCase();grid.replaceChildren(...S.curriculum.sources.filter(s=>[s.title,s.provider,s.purpose,s.language].join(' ').toLowerCase().includes(q)).map(s=>el('article',{class:'card source-card'},el('div',{class:'provider'},`${s.id} / ${s.provider}`),el('h3',{},s.title),el('p',{},s.purpose),el('div',{class:'chip-row'},tag(s.language),tag(`Consulta ${s.checkedOn}`)),el('p',{class:'micro'},s.access),link('Abrir a fonte oficial',s.url,'text-link',true))));};search.addEventListener('input',draw);main.append(el('div',{class:'search-row'},search),grid);draw();
}
function renderRewards() {
  main.append(heading('INCENTIVOS QUE RESPEITAM SEU RITMO','Celebre cada passo com evidencia.','XP e moedas reconhecem objetivos distintos, uma unica vez. Tempo declarado, cliques repetidos e novas tentativas do mesmo quiz nao geram XP adicional. As recompensas sao escolhas pessoais, sem valor financeiro.'),
    el('div',{class:'coins-panel'},el('div',{},el('h3',{},`Nivel ${S.metrics.level} / ${S.metrics.levelName||'Em evolucao'}`),el('p',{},`${S.metrics.xp} XP totais / ${S.metrics.coinsEarned} moedas ganhas`)),el('div',{},el('strong',{},S.metrics.coinsAvailable),el('div',{class:'tiny-label'},'MOEDAS DISPONIVEIS'))),
    sectionHeading('Seu acervo de conquistas','Marcos de aprendizagem, sem equivalencia a certificacao profissional.'),el('div',{class:'badge-grid'},S.metrics.badges.length?S.metrics.badges.map((b,i)=>el('article',{class:'card badge-card'},el('div',{class:'badge-symbol'},String(i+1).padStart(2,'0')),el('h3',{},b.title),el('p',{},b.description))):el('div',{class:'empty-state'},'Sua primeira conquista comeca com uma leitura registrada e uma pratica explicada. O servidor acompanha os criterios automaticamente.')),
    sectionHeading('Recompensas opcionais','Cada item pode ser resgatado uma vez. Voce administra o privilegio escolhido.'),el('div',{class:'module-grid'},S.rewards.map(r=>{const redeemed=Boolean(S.state.redeemedRewards[r.id]);return el('article',{class:'card reward-card'},tag(`${r.cost} moedas`,'chip-warm'),el('h3',{class:'section-space'},r.title),el('p',{},r.description),button(redeemed?'Resgatada':'Resgatar recompensa',guarded(()=>command('reward.redeem',{rewardId:r.id},'Recompensa registrada. Aproveite sua escolha.')),'button-secondary',{disabled:redeemed||S.metrics.coinsAvailable<r.cost}));})),
    insight('Uma leitura rende 20 XP; o primeiro quiz aprovado, 60; uma pratica declarada com rubrica, 100; um modulo fechado, mais 80. A cada 10 XP voce recebe uma moeda. A conclusao pratica continua autodeclarada, mesmo quando rende XP.'));
}

function renderTracker() {
  if(isPages){main.append(heading('GOVERNANCA / EDICAO PUBLICA','Seu estudo fica com voce.','O tracker de engenharia, diarios e evidencias privadas permanecem no projeto local. Esta publicacao guarda apenas seu progresso de aprendizagem neste navegador.'),insight('Nenhum registro pessoal e enviado ao GitHub. Exporte seu progresso em Meu plano e dados para levar o estudo a outro navegador.'));return;}
  main.append(heading('FONTE DE VERDADE / ENGENHARIA','Acoes que deixam rastro.','Este quadro organiza o projeto do aplicativo. Ele e separado do seu progresso de estudo. CLI e interface gravam no mesmo ledger local; dependencias, aceite, evidencias e verificacao controlam o encerramento.'),
    el('div',{class:'tracker-toolbar'},el('div',{class:'chip-row'},tag(`Revisao ${S.revision}`),tag(`${S.state.tracker.tasks.length} tarefas`),tag('Historico persistente','chip-success')),button('Criar tarefa',()=>openTask(null))));
  const board=el('div',{class:'kanban','aria-label':'Quadro de tarefas'});
  for(const [status,label]of Object.entries(statuses)){const tasks=S.state.tracker.tasks.filter(t=>t.status===status);board.append(el('section',{class:'kanban-column'},el('div',{class:'kanban-heading'},label,el('span',{},tasks.length)),tasks.map(t=>el('button',{type:'button',class:'task-card',on:{click:()=>openTask(t.id)}},el('span',{class:'task-id'},t.id),el('b',{},t.title),tag(t.wave),el('small',{},t.assignee||'Sem responsavel'),el('small',{},`${t.evidence?.length||0} evidencia(s)`)))));}main.append(board,sectionHeading('Atividade recente','A sequencia do ledger preserva a historia das decisoes.'),activityTable(S.state.tracker.events));
}
function activityTable(events) {
  if(!events?.length)return el('div',{class:'empty-state'},'Nenhuma atividade de engenharia registrada.');
  return el('div',{class:'table-wrap card'},el('table',{},el('thead',{},el('tr',{},['Evento','Acao','Ator','Registro'].map(t=>el('th',{},t)))),el('tbody',{},events.slice(-25).reverse().map(e=>el('tr',{},el('td',{},e.revision||e.id||e.seq||''),el('td',{},e.type||e.kind||''),el('td',{},e.actor||''),el('td',{},e.payload?.message||e.payload?.taskId||e.taskId||e.message||e.ts||''))))));
}
function openTask(id) {
  taskFocus=id;const dialog=$('#task-dialog'),content=$('#task-dialog-content');content.replaceChildren();
  const task=S.state.tracker.tasks.find(t=>t.id===id);
  const body=el('div',{class:'dialog-body'},el('div',{class:'dialog-header'},el('div',{},el('div',{class:'tiny-label'},task?`${task.id} / ${task.wave}`:'NOVA TAREFA'),el('h2',{id:'task-dialog-title',class:'section-space'},task?.title||'Um resultado verificavel')),button('Fechar',()=>dialog.close(),'button-quiet compact')));content.append(body);
  if(!task){const f=el('form',{},field('Identificador',input('id',`P${Date.now().toString(36)}`,{required:true,maxlength:60})),field('Titulo',input('title','',{required:true,minlength:5,maxlength:200})),field('Descricao',textarea('description','',{required:true,minlength:10})),el('div',{class:'form-grid'},field('Onda',input('wave','W4',{required:true})),field('Responsavel',input('assignee','marcos',{required:true}))),field('Criterios de aceite (um por linha)',textarea('acceptance','',{required:true,minlength:5})),field('Dependencias (IDs separados por virgula)',input('dependencies','')),el('button',{type:'submit',class:'button'},'Criar no tracker'));formSubmit(f,async data=>{await command('tracker.create',{id:String(data.get('id')),title:String(data.get('title')),description:String(data.get('description')),wave:String(data.get('wave')),assignee:String(data.get('assignee')),acceptance:String(data.get('acceptance')).split('\n').filter(x=>x.trim()),dependencies:String(data.get('dependencies')).split(',').map(x=>x.trim()).filter(Boolean)},'Tarefa criada.');dialog.close();});body.append(f);}
  else {
    body.append(el('p',{},task.description),el('div',{class:'chip-row'},tag(statuses[task.status]||task.status),tag(task.assignee||'Sem responsavel')),el('p',{class:'micro'},`Dependencias: ${task.dependencies?.join(', ')||'nenhuma'}`));
    const acceptance=el('section',{class:'dialog-section'},el('h3',{},'Aceite verificavel'),(task.acceptance||[]).map((a,i)=>el('label',{class:'checkbox-row'},input(`check-${i}`,'yes',{type:'checkbox',checked:a.checked,on:{change:async event=>{try{await command('tracker.check',{taskId:id,index:i,checked:event.target.checked},'Criterio atualizado.',false);}catch(error){event.target.checked=!event.target.checked;notify(error.message,true);}}}}),el('span',{},a.text||String(a)))));body.append(acceptance);
    const ef=el('form',{class:'dialog-section'},el('h3',{},'Adicionar evidencia'),field('Metodo e resultado observado',textarea('text','',{required:true,minlength:10,rows:3})),field('Arquivo relativo ao projeto (opcional)',input('path','',{placeholder:'artifacts/proofs/relatorio.json'})),el('button',{type:'submit',class:'button button-secondary compact'},'Registrar evidencia'));
    formSubmit(ef,async data=>{await command('tracker.evidence',{taskId:id,text:String(data.get('text')),...(data.get('path')?{path:String(data.get('path'))}:{})},'Evidencia registrada.',false);openTask(id);});body.append(ef);
    if(task.evidence?.length)body.append(el('ul',{class:'micro'},task.evidence.map(e=>el('li',{},e.text||'',e.path?` / ${e.path}`:'',(e.hash||e.sha256)?` / SHA256 ${(e.hash||e.sha256).slice(0,12)}`:''))));
    const tf=el('form',{class:'dialog-section'},el('h3',{},'Mover com justificativa'),field('Novo estado',select('status',Object.entries(statuses).map(([value,label])=>({value,label})),task.status)),field('Motivo / impedimento',textarea('reason','',{rows:2})),field('Verificacao para concluir',textarea('verification','',{rows:3}),'Concluir exige dependencias prontas, aceite marcado, evidencia e metodo de verificacao.'),el('button',{type:'submit',class:'button'},'Registrar transicao'));
    formSubmit(tf,async data=>{const reason=String(data.get('reason')).trim(),verification=String(data.get('verification')).trim();await command('tracker.transition',{taskId:id,status:String(data.get('status')),...(reason?{reason}:{}),...(verification?{verification}:{})},'Transicao registrada.');dialog.close();});body.append(tf);
    const cf=el('form',{class:'dialog-section'},el('h3',{},'Comentario de acompanhamento'),field('Comentario',textarea('text','',{required:true,minlength:3,rows:2})),el('button',{type:'submit',class:'button button-secondary compact'},'Salvar comentario'));formSubmit(cf,async data=>{await command('tracker.comment',{taskId:id,text:String(data.get('text'))},'Comentario salvo.',false);openTask(id);});body.append(cf);
    if(task.history?.length)body.append(el('details',{class:'dialog-section'},el('summary',{},'Historico desta tarefa'),el('pre',{class:'code-block'},JSON.stringify(task.history,null,2))));
  }
  if(!dialog.open)dialog.showModal();
}

async function renderArchitecture() {
  main.append(heading('MAPA NAVEGAVEL / EVIDENCIA DE CODIGO','Entenda o sistema que guarda sua trilha.','O mapa adapta os conceitos do engineMapper: contexto, componentes, dados, processo e evidencias de arquivo/linha. Extracao estatica e curadoria sao rotuladas; um diagrama nao prova comportamento em execucao.'));
  const host=el('section',{class:'card'});main.append(host);
  try{const model=await request('/api/architecture');if(route()[0]!=='architecture')return;const nodes=model.nodes||[],edges=model.edges||[];
    const choices=el('div',{class:'filter-row'}),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 1000 520');svg.setAttribute('class','architecture-svg');svg.setAttribute('role','group');svg.setAttribute('aria-label','Componentes e conexoes do aplicativo');
    const detail=el('div',{class:'code-block'},'Selecione um componente para consultar sua evidencia.');
    const primary=['browser','server','domain','store','sqlite','cli','boot','plugins','mapper'];const selected=nodes.filter(n=>primary.includes(n.id));const layout=new Map(selected.map((n,i)=>[n.id,{x:45+(i%3)*325,y:32+Math.floor(i/3)*165}]));
    for(const edge of edges){const a=layout.get(edge.source),b=layout.get(edge.target);if(!a||!b)continue;const l=document.createElementNS(svg.namespaceURI,'path');l.setAttribute('d',`M${a.x+125},${a.y+54} L${b.x+125},${b.y+54}`);l.setAttribute('class','map-edge');svg.append(l);}
    for(const n of selected){const xy=layout.get(n.id),g=document.createElementNS(svg.namespaceURI,'g');g.setAttribute('class','map-node');g.setAttribute('tabindex','0');g.setAttribute('role','button');g.setAttribute('aria-label',`Inspecionar ${n.label}`);g.setAttribute('transform',`translate(${xy.x},${xy.y})`);const rect=document.createElementNS(svg.namespaceURI,'rect');rect.setAttribute('width','250');rect.setAttribute('height','105');rect.setAttribute('rx','7');g.append(rect);const title=document.createElementNS(svg.namespaceURI,'text');title.setAttribute('x','18');title.setAttribute('y','38');title.setAttribute('font-size','16');title.textContent=n.label;g.append(title);const sub=document.createElementNS(svg.namespaceURI,'text');sub.setAttribute('x','18');sub.setAttribute('y','65');sub.setAttribute('font-size','10');sub.textContent=n.file||n.kind||'';g.append(sub);const inspect=()=>{svg.querySelectorAll('.map-node').forEach(x=>x.classList.remove('selected'));g.classList.add('selected');detail.textContent=JSON.stringify({component:n.label,kind:n.kind,origin:n.origin,file:n.file,evidence:n.evidence,connections:edges.filter(e=>e.source===n.id||e.target===n.id)},null,2);};g.addEventListener('click',inspect);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();inspect();}});svg.append(g);}
    const diagram=el('pre',{class:'code-block'});for(const [key,text]of Object.entries(model.diagrams||{}))choices.append(button(key,()=>{diagram.textContent=text;},'filter-chip'));const first=Object.values(model.diagrams||{})[0]||'';diagram.textContent=first;
    host.append(el('div',{class:'chip-row'},tag(`${nodes.length} nos`),tag(`${edges.length} ligacoes`),tag(`${model.files?.length||0} arquivos`)),svg,el('div',{class:'split section-space'},el('div',{},el('h3',{},'Evidencia do componente'),detail),el('div',{},el('h3',{},'Diagramas em formato aberto'),choices,diagram)),el('p',{class:'method-note'},typeof model.method==='string'?model.method:'Extracao estatica de imports, exports e assets com arquivo, linha e hash; relacoes de arquitetura curadas sao identificadas separadamente. Nao e um grafo completo de execucao.'),el('ul',{class:'micro'},(model.warnings||[]).map(w=>el('li',{},w))));
  }catch(error){host.append(el('div',{class:'empty-state'},`Mapa ainda nao disponivel: ${error.message}`),el('p',{class:'micro'},'A geracao local e feita pelo comando de mapeamento descrito no guia do projeto.'));}
}

function renderSettings() {
  const p=S.state.profile;
  main.append(heading('SEU PLANO / SEUS REGISTROS','Uma rotina que cabe na vida real.',isPages?'O plano usa seis horas por semana. Seu progresso fica apenas neste navegador e neste dispositivo. Exporte uma copia antes de limpar os dados do site, usar outro navegador ou trocar de computador.':'O plano de referencia usa seis horas por semana. Altere o compromisso e a rota sem perder seu progresso. Os dados ficam neste projeto, neste computador; exportacoes sao sua ponte para outro ambiente.'));
  const profile=el('form',{},el('h2',{},'Plano pessoal'),field('Como devo chamar voce?',input('name',p.name,{required:true,maxlength:80})),el('div',{class:'form-grid'},field('Horas por semana',input('weeklyHours',p.weeklyHours,{type:'number',min:1,max:40,step:.5,required:true})),field('Rota atual',select('route',S.curriculum.routes.map(r=>({value:r.id,label:r.title})),p.route))),field('Objetivo concreto',textarea('goal',p.goal||'',{rows:3,maxlength:1000}),'Exemplo: demonstrar uma rotina de conciliacao com instalacao reproduzida e aceite.'),field('Meu capstone',textarea('capstone',p.capstone||'',{rows:3,maxlength:1000}),'Um problema recorrente; descreva usuario, entrada e resultado.'),el('button',{type:'submit',class:'button'},'Salvar meu plano'));
  formSubmit(profile,async data=>command('profile.update',{name:String(data.get('name')),weeklyHours:Number(data.get('weeklyHours')),route:String(data.get('route')),goal:String(data.get('goal')),capstone:String(data.get('capstone'))},'Plano atualizado.'));
  const dataCard=card(el('h2',{},'Persistencia e portabilidade'),el('p',{},isPages?'Esta edicao publica salva eventos no armazenamento deste navegador. Recarregar a pagina preserva o progresso; limpar dados do site ou sair do modo privado pode remove-lo. Nao ha sincronizacao automatica nem envio de notas ao GitHub. A exportacao JSON tambem funciona no aplicativo local.':'O servidor guarda registros em SQLite no projeto. Reabrir o navegador ou reiniciar o aplicativo preserva o estado. A importacao restaura apenas o progresso de aprendizagem e conserva o historico de engenharia.'),button('Exportar meu progresso',guarded(exportProgress),'button-secondary'),el('div',{class:'section-space'}),el('h3',{},'Importar uma exportacao'),el('p',{},'A importacao substitui o progresso de aprendizagem atual depois de validar todos os eventos. Salve uma exportacao antes. O XP e recalculado; valores fornecidos pelo arquivo nao sao aceitos como autoridade.'));
  const file=input('import','',{type:'file',accept:'.json,application/json'}),status=el('p',{class:'micro','aria-live':'polite'}),importForm=el('form',{},field('Arquivo de progresso',file),el('label',{class:'checkbox-row'},input('confirm','yes',{type:'checkbox',required:true}),el('span',{},'Entendi que o progresso de aprendizagem sera substituido.')),el('button',{type:'submit',class:'button button-secondary'},'Validar e importar'),status);
  formSubmit(importForm,async()=>{const chosen=file.files?.[0];if(!chosen)throw new Error('Selecione uma exportacao JSON.');if(chosen.size>2*1024*1024)throw new Error('O arquivo excede 2 MB.');let document;try{document=JSON.parse(await chosen.text());}catch{throw new Error('O arquivo nao e um JSON valido. Nenhum registro foi alterado.');}await request('/api/import',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':S.csrfToken},body:JSON.stringify({id:crypto.randomUUID(),document})});await reload();notify('Progresso importado e recalculado. Historico de engenharia preservado.');render();});dataCard.append(importForm);
  if(!isPages)dataCard.append(
    el('div',{class:'section-space'}),el('h3',{},'Copia consistente do banco'),el('p',{},'A copia inclui registros do projeto. Ela e criada pelo mecanismo de backup do SQLite e fica no diretorio de artefatos. Restauracao operacional e descrita no guia; o aplicativo nao troca o banco em uso.'),button('Criar copia local consistente',guarded(async()=>{const result=await request('/api/backup',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':S.csrfToken},body:JSON.stringify({id:crypto.randomUUID()})});notify(`Copia criada: ${result.result?.path||result.result?.id||result.backupId||'consulte o registro no servidor'}.`);await reload();render();}),'button-secondary'));
  else dataCard.append(insight('Use Exportar meu progresso para fazer uma copia. Guarde o arquivo em um lugar seguro; o site nao tem acesso ao banco SQLite do computador.'));
  main.append(el('div',{class:'split'},card(profile),dataCard),insight(isPages?'O conteudo e publico; seu progresso fica no navegador. O GitHub recebe requisicoes para hospedar a pagina, mas suas notas nao sao enviadas por este aplicativo. Nao registre credenciais ou dados pessoais de clientes. XP e quizzes sao formativos, sem certificacao ou validacao independente.':'Este e um aplicativo pessoal local. Nao ha sincronizacao entre dispositivos, autenticacao multiusuario ou promessa de validacao externa. Nao exponha a porta na rede e nao registre credenciais ou dados pessoais de clientes.'));
}
async function exportProgress() {
  const document=await request('/api/export');const blob=new Blob([JSON.stringify(document,null,2)],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob),a=el('a',{href:url,download:`oficina-ia-progresso-${new Date().toISOString().slice(0,10)}.json`});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Exportacao preparada pelo navegador. Guarde-a em local seguro.');
}
function fatal(error) { main.replaceChildren(el('div',{class:'error-panel'},el('h1',{},'A oficina precisa de uma verificacao.'),el('p',{},error.message),el('p',{},isPages?'Os registros existentes nao foram substituidos. Verifique se este navegador permite armazenamento do site. Preserve seus dados e uma exportacao antes de qualquer recuperacao.':'Os registros existentes nao foram substituidos. Confira o terminal do servidor, mantenha uma copia dos dados e reabra o aplicativo depois da correcao.'),button('Tentar carregar novamente',guarded(async()=>{await reload();render();}),'button-secondary')));$('#save-status').textContent='Conexao indisponivel'; }
$('#menu-toggle').addEventListener('click',()=>{const open=$('#sidebar').classList.toggle('open');$('#menu-toggle').setAttribute('aria-expanded',String(open));});
$('#export-top').addEventListener('click',guarded(exportProgress));
$('#task-dialog').addEventListener('click',event=>{if(event.target===$('#task-dialog'))$('#task-dialog').close();});
window.addEventListener('hashchange',()=>{currentTab='learn';render();window.scrollTo({top:0});});
try{await reload();render();}catch(error){fatal(error);}
setInterval(async()=>{if(!S||document.hidden||$('#task-dialog').open||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;try{const latest=await request('/api/bootstrap');if(latest.revision!==S.revision){S=latest;updateChrome();if(['dashboard','tracker','rewards'].includes(route()[0]))render();}}catch{$('#save-status').textContent='Sem conexao / dados locais preservados';}},20000);
