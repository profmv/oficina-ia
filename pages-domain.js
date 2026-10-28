/** Generated from the validated local domain; browser owner controls this educational data. */
import {fail,inside} from './pages-store.js';
function pathEvidence(){fail('LOCAL_ONLY','Arquivos privados pertencem ao projeto local.');}
/** Deterministic learner progress and engineering tracker command rules. */

const ROUTES = ['consultoria', 'emprego', 'produto'];
const STATUSES = ['backlog', 'todo', 'in_progress', 'in_review', 'blocked', 'done'];
const LEARNER_TYPES = ['profile.update', 'lesson.complete', 'quiz.submit', 'practice.submit', 'study.log', 'note.save', 'reward.redeem'];
const own = (v, k) => Object.hasOwn(v, k);
function object(v, name = 'Dados') { if (!v || typeof v !== 'object' || Array.isArray(v)) fail('VALIDATION', `${name}: objeto esperado.`); return v; }
function keys(v, allowed) { object(v); for (const k of Object.keys(v)) if (!allowed.includes(k)) fail('VALIDATION', `Campo desconhecido: ${k}.`); }
function text(v, name, min = 1, max = 2000) { if (typeof v !== 'string' || v.trim().length < min || v.length > max || v.includes('\0')) fail('VALIDATION', `${name}: texto entre ${min} e ${max} caracteres esperado.`); return v.trim(); }
function integer(v, name, min, max) { if (!Number.isInteger(v) || v < min || v > max) fail('VALIDATION', `${name}: inteiro de ${min} a ${max} esperado.`); return v; }
function list(v, name, max = 100) { if (!Array.isArray(v) || v.length > max) fail('VALIDATION', `${name}: lista invalida.`); return v; }
function identifier(v, name = 'Identificador') { if (typeof v !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,119}$/.test(v)) fail('VALIDATION', `${name} invalido.`); return v; }
function initial() {
  return { profile: { name: 'Aprendiz', weeklyHours: 6, route: 'consultoria', goal: '', capstone: '' }, completedLessons: {}, practices: {}, quizResults: {}, studySessions: [], notes: {}, redeemedRewards: {}, tracker: { tasks: [], events: [] }, activityEvents: [] };
}
export function localDate(iso) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)); }
function weekOf(iso) {
  const date = new Date(`${localDate(iso)}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}
function grade(module, answers, ts) {
  list(answers, 'Respostas', 100);
  const questions = module.quiz.questions;
  if (answers.length !== questions.length || !questions.length) fail('VALIDATION', 'Responda todas as questoes.');
  const feedback = questions.map((q, i) => {
    integer(answers[i], 'Alternativa', 0, q.choices.length - 1);
    return { questionId: q.id, correct: answers[i] === q.answer, correctAnswer: q.answer, explanation: q.explanation };
  });
  const score = Math.round(100 * feedback.filter(f => f.correct).length / questions.length);
  return { answers: [...answers], score, passed: score >= 80, feedback, submittedAt: ts };
}
function addActivity(state, event) {
  state.activityEvents.push({ id: event.seq || state.activityEvents.length + 1, type: event.type, ts: event.ts, actor: event.actor || 'marcos', payload: event.payload });
  state.activityEvents = state.activityEvents.slice(-150);
}
function taskOf(state, id) { const task = state.tracker.tasks.find(t => t.id === id); if (!task) fail('NOT_FOUND', 'Tarefa nao encontrada.', 404); return task; }
function cycleCheck(tasks) {
  const seen = new Set(), stack = new Set();
  function visit(task) {
    if (stack.has(task.id)) fail('DEPENDENCY', 'Dependencias formam um ciclo.');
    if (seen.has(task.id)) return;
    stack.add(task.id);
    for (const id of task.dependencies) {
      const dependency = tasks.find(t => t.id === id);
      if (!dependency) fail('DEPENDENCY', `Dependencia desconhecida: ${id}.`);
      visit(dependency);
    }
    stack.delete(task.id); seen.add(task.id);
  }
  tasks.forEach(visit);
}

export class Domain {
  constructor(store, content) {
    this.store = store;
    this.curriculum = content.curriculum;
    this.rewards = Array.isArray(content.rewards) ? content.rewards : content.rewards.rewards;
    if (!this.curriculum || !Array.isArray(this.curriculum.modules) || !Array.isArray(this.rewards) || !this.curriculum.modules.length) fail('CONTENT', 'Conteudo local invalido ou sem modulos.', 500);
    const moduleIds = this.curriculum.modules.map(m => m.id);
    const lessonIds = this.curriculum.modules.flatMap(m => m.lessons.map(l => l.id));
    if (new Set(moduleIds).size !== moduleIds.length || new Set(lessonIds).size !== lessonIds.length) fail('CONTENT', 'Identificadores de conteudo duplicados.', 500);
    for (const m of this.curriculum.modules) {
      if (!m.quiz?.questions?.length || !m.practice?.acceptance?.length) fail('CONTENT', 'Quiz ou rubrica ausente.', 500);
      for (const q of m.quiz.questions) integer(q.answer, 'Gabarito', 0, q.choices.length - 1);
    }
    for (const r of this.rewards) integer(r.cost, 'Custo da recompensa', 0, 100000);
  }
  module(id) { const m = this.curriculum.modules.find(m => m.id === id); if (!m) fail('CONTENT_ID', 'Modulo desconhecido.'); return m; }
  metrics(state, now = new Date().toISOString()) {
    const modules = {}, completedModules = [];
    let xp = 0;
    for (const module of this.curriculum.modules) {
      const lessonsCompleted = module.lessons.filter(l => own(state.completedLessons, l.id)).length;
      const quizPassed = !!state.quizResults[module.id]?.passed;
      const practiceSubmitted = !!state.practices[module.id];
      const completed = lessonsCompleted === module.lessons.length && quizPassed && practiceSubmitted;
      xp += lessonsCompleted * 20 + (quizPassed ? 60 : 0) + (practiceSubmitted ? 100 : 0) + (completed ? 80 : 0);
      if (completed) completedModules.push(module.id);
      modules[module.id] = { lessonsCompleted, lessonsTotal: module.lessons.length, quizPassed, quizBestScore: state.quizResults[module.id]?.bestScore || 0, practiceSubmitted, completed, percent: Math.round(100 * (lessonsCompleted + Number(quizPassed) + Number(practiceSubmitted)) / (module.lessons.length + 2)) };
    }
    const coinsEarned = Math.floor(xp / 10);
    const spent = Object.values(state.redeemedRewards).reduce((n, r) => n + r.cost, 0);
    const weeks = new Set(state.studySessions.map(s => s.week));
    const thisWeek = weekOf(now);
    let cursor = thisWeek, streakWeeks = 0;
    if (!weeks.has(cursor)) cursor = new Date(new Date(`${cursor}T12:00:00Z`).getTime() - 7 * 86400000).toISOString().slice(0, 10);
    while (weeks.has(cursor)) { streakWeeks++; cursor = new Date(new Date(`${cursor}T12:00:00Z`).getTime() - 7 * 86400000).toISOString().slice(0, 10); }
    const level = Math.floor(xp / 400) + 1;
    const levelNames = ['Explorador', 'Construtor', 'Investigador', 'Integrador', 'Entregador', 'Mentor em pratica'];
    const badges = [];
    if (Object.keys(state.completedLessons).length) badges.push({ id: 'first-lesson', title: 'Primeiro passo', description: 'Uma licao registrada.' });
    if (completedModules.length) badges.push({ id: 'first-module', title: 'Ciclo completo', description: 'Estudo, quiz e pratica reunidos.' });
    if (completedModules.length >= 6) badges.push({ id: 'six-modules', title: 'Construcao consistente', description: 'Seis modulos completos.' });
    if (streakWeeks >= 3) badges.push({ id: 'three-weeks', title: 'Ritmo sustentado', description: 'Tres semanas com estudo registrado.' });
    return { xp, coinsEarned, coinsAvailable: coinsEarned - spent, level, levelName: levelNames[Math.min(levelNames.length - 1, level - 1)], completedModules, modules, totalStudyMinutes: state.studySessions.reduce((n, s) => n + s.minutes, 0), weeklyMinutes: state.studySessions.filter(s => s.week === thisWeek).reduce((n, s) => n + s.minutes, 0), weeklyTargetMinutes: state.profile.weeklyHours * 60, activeWeeks: weeks.size, streakWeeks, badges };
  }
  apply(state, event) {
    const p = event.payload, ts = event.ts;
    switch (event.type) {
      case 'profile.update': Object.assign(state.profile, p); break;
      case 'lesson.complete': if (!own(state.completedLessons, p.lessonId)) state.completedLessons[p.lessonId] = { completedAt: ts }; break;
      case 'quiz.submit': {
        const attempt = grade(this.module(p.moduleId), p.answers, ts);
        const previous = state.quizResults[p.moduleId] || { attempts: [], bestScore: 0, passed: false, passedAt: null };
        previous.attempts.push(attempt); previous.bestScore = Math.max(previous.bestScore, attempt.score);
        if (attempt.passed && !previous.passed) previous.passedAt = ts;
        previous.passed ||= attempt.passed; state.quizResults[p.moduleId] = previous; break;
      }
      case 'practice.submit': state.practices[p.moduleId] = { ...p, submittedAt: ts, label: 'learner-declared' }; break;
      case 'study.log': state.studySessions.push({ ...p, loggedAt: ts, date: localDate(ts), week: weekOf(ts) }); break;
      case 'note.save': state.notes[p.moduleId] = { text: p.text, updatedAt: ts }; break;
      case 'reward.redeem': state.redeemedRewards[p.rewardId] = { redeemedAt: ts, cost: this.rewards.find(r => r.id === p.rewardId).cost }; break;
      case 'learner.import': {
        const fresh = initial();
        for (const imported of p.events) { this.apply(fresh, imported); addActivity(fresh, imported); }
        for (const key of ['profile', 'completedLessons', 'practices', 'quizResults', 'studySessions', 'notes', 'redeemedRewards', 'activityEvents']) state[key] = fresh[key];
        break;
      }
      case 'tracker.create': state.tracker.tasks.push({ ...p, status: 'backlog', acceptance: p.acceptance.map(text => ({ text, checked: false })), evidence: [], comments: [], history: [], createdAt: ts, updatedAt: ts }); break;
      case 'tracker.update': {
        const task = taskOf(state, p.taskId);
        for (const key of ['title', 'description', 'assignee', 'dependencies']) if (own(p, key)) task[key] = p[key];
        if (own(p, 'acceptance')) task.acceptance = p.acceptance.map(text => ({ text, checked: false }));
        break;
      }
      case 'tracker.transition': {
        const task = taskOf(state, p.taskId); task.status = p.status;
        if (p.reason) task.reason = p.reason;
        if (p.verification) task.verification = { text: p.verification, actor: event.actor, ts };
        if (p.evidence) task.evidence.push({ text: p.evidence, addedAt: ts, actor: event.actor });
        break;
      }
      case 'tracker.evidence': taskOf(state, p.taskId).evidence.push({ ...p, ...event.result?.file, addedAt: ts, actor: event.actor }); break;
      case 'tracker.check': taskOf(state, p.taskId).acceptance[p.index].checked = p.checked; break;
      case 'tracker.comment': taskOf(state, p.taskId).comments.push({ text: p.text, ts, actor: event.actor }); break;
      case 'system.record': state.tracker.events.push({ type: event.type, actor: event.actor, ts, payload: p, revision: event.seq }); break;
      default: fail('EVENT_TYPE', `Evento desconhecido: ${event.type}.`, 500);
    }
    if (event.type.startsWith('tracker.')) {
      const task = taskOf(state, p.taskId || p.id);
      const history = { type: event.type, actor: event.actor, ts, payload: p };
      task.updatedAt = ts; task.history.push(history); state.tracker.events.push({ ...history, taskId: task.id, revision: event.seq });
    }
    if (LEARNER_TYPES.includes(event.type)) addActivity(state, event);
  }
  fold(events = this.store.events()) { const state = initial(); for (const e of events) this.apply(state, e); return state; }
  validate(type, p, state, ts, { importing = false } = {}) {
    object(p, 'Conteudo');
    switch (type) {
      case 'profile.update':
        keys(p, ['name', 'weeklyHours', 'route', 'goal', 'capstone']);
        if (!Object.keys(p).length) fail('VALIDATION', 'Informe uma alteracao de perfil.');
        if (own(p, 'name')) text(p.name, 'Nome', 1, 100);
        if (own(p, 'weeklyHours')) { if (typeof p.weeklyHours !== 'number' || !Number.isFinite(p.weeklyHours) || p.weeklyHours < 1 || p.weeklyHours > 40) fail('VALIDATION', 'Horas semanais devem ficar entre 1 e 40.'); }
        if (own(p, 'route') && !ROUTES.includes(p.route)) fail('VALIDATION', 'Rota profissional invalida.');
        for (const key of ['goal', 'capstone']) if (own(p, key)) text(p[key], key, 0, 3000);
        return { updated: true };
      case 'lesson.complete':
        keys(p, ['lessonId']);
        if (!this.curriculum.modules.some(m => m.lessons.some(l => l.id === p.lessonId))) fail('CONTENT_ID', 'Licao desconhecida.');
        return { alreadyCompleted: own(state.completedLessons, p.lessonId) };
      case 'quiz.submit': keys(p, ['moduleId', 'answers']); return grade(this.module(p.moduleId), p.answers, ts);
      case 'practice.submit': {
        keys(p, ['moduleId', 'evidence', 'rubric', 'assistance']);
        const module = this.module(p.moduleId);
        text(p.evidence, 'Evidencia da pratica', 20, 12000); text(p.assistance, 'Assistencia utilizada', 3, 3000);
        list(p.rubric, 'Rubrica', 100);
        if (p.rubric.length !== module.practice.acceptance.length || p.rubric.some(v => v !== true)) fail('RUBRIC', 'Todos os criterios da pratica precisam ser reconhecidos.');
        return { label: 'learner-declared', alreadySubmitted: own(state.practices, p.moduleId) };
      }
      case 'study.log':
        keys(p, ['moduleId', 'minutes', 'reflection']); this.module(p.moduleId); integer(p.minutes, 'Minutos', 1, 360); text(p.reflection, 'Reflexao', 10, 6000);
        if (state.studySessions.filter(s => s.date === localDate(ts)).reduce((n, s) => n + s.minutes, 0) + p.minutes > 720) fail('STUDY_LIMIT', 'Limite diario de 720 minutos excedido.');
        return { recorded: true, xpAwarded: 0 };
      case 'note.save': keys(p, ['moduleId', 'text']); this.module(p.moduleId); text(p.text, 'Nota', 0, 20000); return { saved: true };
      case 'reward.redeem': {
        keys(p, ['rewardId']); const reward = this.rewards.find(r => r.id === p.rewardId);
        if (!reward) fail('CONTENT_ID', 'Recompensa desconhecida.');
        if (own(state.redeemedRewards, p.rewardId)) fail('REDEEMED', 'Recompensa ja resgatada.', 409);
        if (this.metrics(state, ts).coinsAvailable < reward.cost) fail('BALANCE', 'Moedas insuficientes.', 409);
        return { rewardId: reward.id, cost: reward.cost };
      }
      case 'tracker.create': {
        keys(p, ['id', 'title', 'description', 'wave', 'assignee', 'dependencies', 'acceptance']);
        identifier(p.id); if (state.tracker.tasks.some(t => t.id === p.id)) fail('EXISTS', 'Tarefa ja existe.', 409);
        text(p.title, 'Titulo', 3, 200); text(p.description, 'Descricao', 0, 6000); text(p.wave, 'Onda', 1, 100); text(p.assignee, 'Responsavel', 1, 100);
        list(p.dependencies, 'Dependencias'); p.dependencies.forEach(id => identifier(id));
        if (new Set(p.dependencies).size !== p.dependencies.length) fail('DEPENDENCY', 'Dependencias duplicadas.');
        list(p.acceptance, 'Criterios'); if (!p.acceptance.length) fail('ACCEPTANCE', 'Informe pelo menos um criterio.'); p.acceptance.forEach(a => text(a, 'Criterio', 3, 1000));
        cycleCheck([...state.tracker.tasks, p]); return { taskId: p.id };
      }
      case 'tracker.update': {
        keys(p, ['taskId', 'title', 'description', 'assignee', 'acceptance', 'dependencies']);
        const task = taskOf(state, p.taskId); if (task.status === 'done') fail('DONE', 'Reabra a tarefa antes de alterar seus criterios.');
        for (const key of ['title', 'assignee']) if (own(p, key)) text(p[key], key, 1, 200);
        if (own(p, 'description')) text(p.description, 'Descricao', 0, 6000);
        if (own(p, 'acceptance')) { list(p.acceptance, 'Criterios'); if (!p.acceptance.length) fail('ACCEPTANCE', 'Informe criterios.'); p.acceptance.forEach(a => text(a, 'Criterio', 3, 1000)); }
        if (own(p, 'dependencies')) { list(p.dependencies, 'Dependencias'); p.dependencies.forEach(id => identifier(id)); if (new Set(p.dependencies).size !== p.dependencies.length) fail('DEPENDENCY', 'Dependencias duplicadas.'); }
        cycleCheck(state.tracker.tasks.map(t => t.id === p.taskId ? { ...t, ...p } : t)); return { taskId: p.taskId };
      }
      case 'tracker.transition': {
        keys(p, ['taskId', 'status', 'reason', 'evidence', 'verification']); const task = taskOf(state, p.taskId);
        if (!STATUSES.includes(p.status)) fail('STATUS', 'Estado de tarefa invalido.');
        if (task.status === 'done' && p.status !== 'done' && state.tracker.tasks.some(t => t.status === 'done' && t.dependencies.includes(task.id))) fail('DEPENDENCY', 'Reabra primeiro as tarefas concluidas que dependem desta.');
        for (const key of ['reason', 'evidence', 'verification']) if (own(p, key)) text(p[key], key, 3, 6000);
        if (p.status === 'blocked' && !p.reason) fail('REASON', 'O bloqueio exige um motivo.');
        if (['in_progress', 'in_review', 'done'].includes(p.status) && task.dependencies.some(id => taskOf(state, id).status !== 'done')) fail('DEPENDENCY', 'Conclua as dependencias antes de avancar.');
        if (p.status === 'done') {
          if (task.acceptance.some(a => !a.checked)) fail('ACCEPTANCE', 'Verifique todos os criterios antes de concluir.');
          if (!task.evidence.length && !p.evidence) fail('EVIDENCE', 'Conclusao exige evidencia.');
          text(p.verification, 'Verificacao explicita', 10, 6000);
          const latestFiles = new Map(task.evidence.filter(r => r.path).map(r => [r.path, r]));
          for (const record of latestFiles.values()) if (pathEvidence(record.path).hash !== record.hash) fail('EVIDENCE_CHANGED', 'Arquivo de evidencia mudou; registre a evidencia atual.');
        }
        return { taskId: task.id, status: p.status };
      }
      case 'tracker.evidence': keys(p, ['taskId', 'text', 'path']); taskOf(state, p.taskId); text(p.text, 'Evidencia', 10, 6000); return { recorded: true, ...(p.path ? { file: pathEvidence(p.path) } : {}) };
      case 'tracker.check': {
        keys(p, ['taskId', 'index', 'checked']); const task = taskOf(state, p.taskId);
        if (task.status === 'done') fail('DONE', 'Reabra a tarefa antes de alterar seus criterios.');
        integer(p.index, 'Indice do criterio', 0, task.acceptance.length - 1); if (typeof p.checked !== 'boolean') fail('VALIDATION', 'Marcacao deve ser booleana.'); return { checked: p.checked };
      }
      case 'tracker.comment': keys(p, ['taskId', 'text']); taskOf(state, p.taskId); text(p.text, 'Comentario', 3, 6000); return { recorded: true };
      case 'system.record':
        keys(p, ['kind', 'message', 'paths']); text(p.kind, 'Tipo', 1, 100); text(p.message, 'Registro', 3, 10000);
        if (p.paths) { list(p.paths, 'Caminhos', 40); p.paths.forEach(v => inside(v)); } return { recorded: true };
      case 'learner.import': {
        if (importing) fail('IMPORT', 'Importacoes aninhadas nao sao permitidas.');
        keys(p, ['events']); list(p.events, 'Eventos importados', 10000); const fresh = initial(); let previousTime = '';
        for (const e of p.events) {
          keys(e, ['type', 'payload', 'ts']); if (!LEARNER_TYPES.includes(e.type)) fail('IMPORT', 'O arquivo contem eventos de engenharia ou tipos desconhecidos.');
          if (typeof e.ts !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(e.ts) || !Number.isFinite(Date.parse(e.ts)) || Date.parse(e.ts) > Date.now() + 86400000) fail('IMPORT', 'Data de evento invalida.');
          if (e.ts < previousTime) fail('IMPORT', 'Eventos importados fora de ordem cronologica.');
          previousTime = e.ts;
          this.validate(e.type, e.payload, fresh, e.ts, { importing: true }); this.apply(fresh, e);
        }
        return { importedEvents: p.events.length };
      }
      default: fail('COMMAND_TYPE', 'Tipo de comando desconhecido.');
    }
  }
  execute(command, actor = 'marcos') {
    keys(command, ['id', 'type', 'payload', 'actor']); identifier(command.id, 'Identificador do comando'); text(command.type, 'Tipo de comando', 1, 100); object(command.payload);
    actor = command.actor || actor; text(actor, 'Ator', 1, 100);
    const normalized = { id: command.id, type: command.type, payload: JSON.parse(JSON.stringify(command.payload)), actor };
    const saved = this.store.transact(normalized, (events, ts) => this.validate(normalized.type, normalized.payload, this.fold(events), ts));
    return { ok: true, result: { ...saved.result, duplicate: saved.duplicate }, ...this.snapshot() };
  }
  snapshot() { this.store.check(); const events = this.store.events(); const state = this.fold(events); return { state, metrics: this.metrics(state), revision: events.length }; }
  bootstrap(csrfToken = '') {
    const curriculum = structuredClone(this.curriculum);
    for (const m of curriculum.modules) for (const q of m.quiz.questions) { delete q.answer; delete q.explanation; }
    return { schemaVersion: 1, csrfToken, curriculum, rewards: this.rewards, ...this.snapshot() };
  }
  export() {
    this.store.check();
    let events = [];
    for (const e of this.store.events()) {
      if (e.type === 'learner.import') events = structuredClone(e.payload.events);
      else if (LEARNER_TYPES.includes(e.type)) events.push({ type: e.type, payload: e.payload, ts: e.ts });
    }
    return { schemaVersion: 1, kind: 'oficina-ia-learner', exportedAt: new Date().toISOString(), events };
  }
  import(id, document, actor = 'marcos') {
    keys(document, ['schemaVersion', 'kind', 'exportedAt', 'events']);
    if (document.schemaVersion !== 1 || document.kind !== 'oficina-ia-learner') fail('IMPORT', 'Formato de progresso desconhecido.');
    text(document.exportedAt, 'Data de exportacao', 1, 100);
    return this.execute({ id, type: 'learner.import', payload: { events: document.events } }, actor);
  }
}
