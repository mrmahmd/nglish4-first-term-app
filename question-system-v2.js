/*
  English Primary 4 — Grouped Question System V2
  This file changes only the question engine. It intentionally reuses the original
  application's visual system, progress model, Supabase connection, rewards, and navigation.
*/
(function(){
'use strict';

const QS2_BANK=window.ENGLISH4_QUESTION_BANK_V2;
if(!QS2_BANK){console.error('English 4 Question System V2: question bank is missing.');return}

const QS2_VERSION='english4-qsv2-20260722';
const QS2_ORDER=QS2_BANK.sectionOrder||['choose','complete','correct','reorder','match','sort','listening_phonics','write'];
const QS2_META={
  choose:{label:'Choose',icon:'✅',instruction:'Choose the correct answer.'},
  complete:{label:'Complete',icon:'✍️',instruction:'Complete the sentence with the correct word.'},
  correct:{label:'Correct',icon:'🛠️',instruction:'Write the correct word only.'},
  reorder:{label:'Reorder',icon:'🔀',instruction:'Put the words or events in the correct order.'},
  match:{label:'Match',icon:'🔗',instruction:'Match each item with the correct answer.'},
  sort:{label:'Sort',icon:'🗂️',instruction:'Put each item in the correct group.'},
  listening_phonics:{label:'Listening / Phonics',icon:'🔊',instruction:'Listen carefully, then answer.'},
  write:{label:'Write',icon:'📝',instruction:'Complete the guided writing task.'}
};
const QS2_GRAMMAR_PATTERNS={
  u1l2:/present simple|grammar|verb|plural subject|base form|third person|agreement|sentence production/i,
  u2l2:/present simple|negative|question|short answer|helper|grammar|error correction|sentence function|correct forms|controlled grammar/i,
  u3l2:/comparative|adjective|grammar|complete comparisons|correct forms/i,
  u4l2:/preposition|place sentence|between|next to|correct place|map description|grammar|clue and preposition/i,
  u5l2:/superlative|adjective|grammar|correct forms/i
};

function qs2EnsureState(target){
  target.questionV2Scores=target.questionV2Scores||{lesson:{},grammar:{},bank:{}};
  target.questionV2Scores.lesson=target.questionV2Scores.lesson||{};
  target.questionV2Scores.grammar=target.questionV2Scores.grammar||{};
  target.questionV2Scores.bank=target.questionV2Scores.bank||{};
  target.questionV2Finished=target.questionV2Finished||{lesson:{},grammar:{},bank:{}};
  target.questionV2Finished.lesson=target.questionV2Finished.lesson||{};
  target.questionV2Finished.grammar=target.questionV2Finished.grammar||{};
  target.questionV2Finished.bank=target.questionV2Finished.bank||{};
  target.questionV2Progress=target.questionV2Progress||{};
  target.questionV2Writing=target.questionV2Writing||{};
  target.questionV2Version=QS2_VERSION;
  return target;
}
baseState.questionV2Scores={lesson:{},grammar:{},bank:{}};
baseState.questionV2Finished={lesson:{},grammar:{},bank:{}};
baseState.questionV2Progress={};
baseState.questionV2Writing={};
baseState.questionV2Version=QS2_VERSION;

const qs2NormaliseStateCore=normaliseState;
normaliseState=function(saved={}){return qs2EnsureState(qs2NormaliseStateCore(saved))};
const qs2MergeStatesCore=mergeEnglish4States;
mergeEnglish4States=function(local,remote){
  local=qs2EnsureState(local||{});remote=qs2EnsureState(remote||{});
  const merged=qs2EnsureState(qs2MergeStatesCore(local,remote));
  ['lesson','grammar','bank'].forEach(mode=>{
    merged.questionV2Scores[mode]=mergeNumberMaps(local.questionV2Scores[mode],remote.questionV2Scores[mode]);
    merged.questionV2Finished[mode]={...local.questionV2Finished[mode],...remote.questionV2Finished[mode]};
  });
  merged.questionV2Progress={};
  Object.keys({...local.questionV2Progress,...remote.questionV2Progress}).forEach(key=>{
    const a=local.questionV2Progress[key],b=remote.questionV2Progress[key];
    merged.questionV2Progress[key]=!a?b:!b?a:Number(b.updatedAt||0)>Number(a.updatedAt||0)?b:a;
  });
  merged.questionV2Writing={...local.questionV2Writing,...remote.questionV2Writing};
  return merged;
};
state=normaliseState(state);

function qs2UnitData(id){return (QS2_BANK.units||[]).find(u=>u.id===id)}
function qs2LessonData(id){for(const u of QS2_BANK.units||[]){const l=(u.lessons||[]).find(x=>x.id===id);if(l)return l}return null}
function qs2ReviewData(id){return (QS2_BANK.termReviews||[]).find(r=>r.id===id)}
function qs2SectionMap(sections=[]){const map={};sections.forEach(s=>map[s.type]=s);return map}
function qs2GrammarQuestion(lessonId,raw){const p=QS2_GRAMMAR_PATTERNS[lessonId];return !!(p&&p.test(String(raw.skill||'')))}
function qs2Convert(raw,sectionType,sectionInstruction,sectionQuestionIndex,sectionTotal){
  const q={
    id:raw.id,
    type:sectionType,
    question:raw.prompt||'',
    answer:raw.answer,
    skill:raw.skill||QS2_META[sectionType]?.label||'Practice',
    sourcePage:raw.sourcePage,
    sectionType,
    sectionInstruction:sectionInstruction||QS2_META[sectionType]?.instruction||'',
    sectionQuestionIndex,
    sectionTotal,
    raw
  };
  if(raw.options)q.options=shuffle(raw.options,raw.id+'-options');
  if(raw.wordBank)q.wordBank=shuffle(raw.wordBank,raw.id+'-wordbank');
  if(raw.tokens)q.tokens=raw.tokens;
  if(raw.events)q.events=raw.events;
  if(raw.pairs)q.pairs=raw.pairs;
  if(raw.categories)q.categories=raw.categories;
  if(raw.audioText)q.audio=raw.audioText;
  if(raw.wrongWord)q.wrongWord=raw.wrongWord;
  if(raw.correctedSentence)q.correctedSentence=raw.correctedSentence;
  if(raw.occurrence)q.occurrence=raw.occurrence;
  if(raw.scaffold)q.scaffold=raw.scaffold;
  if(raw.checklist)q.checklist=raw.checklist;
  if(raw.expectedExamples)q.expectedExamples=raw.expectedExamples;
  return q;
}
function qs2BuildFromSections(sections=[],predicate=()=>true){
  const map=qs2SectionMap(sections),out=[];
  QS2_ORDER.forEach(type=>{
    const section=map[type];if(!section)return;
    const selected=(section.questions||[]).filter(q=>predicate(q,type));
    selected.forEach((raw,index)=>out.push(qs2Convert(raw,type,section.instruction,index+1,selected.length)));
  });
  return out;
}
function qs2LessonAll(lessonId){const l=qs2LessonData(lessonId);return l?qs2BuildFromSections(l.sections):[]}
function makeLessonQuestions(l){
  const data=qs2LessonData(l.id);if(!data)return[];
  if(!l.grammar)return qs2BuildFromSections(data.sections);
  return qs2BuildFromSections(data.sections,raw=>!qs2GrammarQuestion(l.id,raw));
}
function makeGrammarQuestions(l){
  const data=qs2LessonData(l.id);if(!data||!l.grammar)return[];
  return qs2BuildFromSections(data.sections,raw=>qs2GrammarQuestion(l.id,raw));
}
function qs2CombinedReviewSections(unit){
  const sources=[];if(unit&&unit.unitReview)sources.push(unit.unitReview.sections||[]);
  if(unit&&unit.id==='u3'){const r=qs2ReviewData('review1');if(r)sources.push(r.sections||[])}
  if(unit&&unit.id==='u6'){const r=qs2ReviewData('review2');if(r)sources.push(r.sections||[])}
  const merged={};
  sources.flat().forEach(section=>{
    if(!merged[section.type])merged[section.type]={type:section.type,instruction:section.instruction,questions:[]};
    merged[section.type].questions.push(...(section.questions||[]));
  });
  return QS2_ORDER.map(type=>merged[type]).filter(Boolean);
}
function makeUnitBank(u){const data=qs2UnitData(u.id);return data?qs2BuildFromSections(qs2CombinedReviewSections(data)):[]}
function qs2LessonCount(l){return makeLessonQuestions(l).length}
function qs2GrammarCount(l){return l.grammar?makeGrammarQuestions(l).length:0}
function qs2BankCount(u){return makeUnitBank(u).length}

activityScore=function(mode,id){return Number((state.questionV2Scores?.[mode]||{})[id])||undefined};
isActivityFinished=function(mode,id){return !!(state.questionV2Finished?.[mode]||{})[id]};
markActivityFinished=function(mode,id){qs2EnsureState(state);state.questionV2Finished[mode][id]=true};
quizActivityId=function(mode,unit,lesson){return mode==='bank'?unit.id:lesson.id};
quizActivityKey=function(qz=quiz){if(!qz)return'';return `qsv2:${qz.mode}:${quizActivityId(qz.mode,qz.unit,qz.lesson)}`};
getQuizProgress=function(mode,id){qs2EnsureState(state);const p=state.questionV2Progress[`qsv2:${mode}:${id}`];return !p||isActivityFinished(mode,id)?null:p};
clearQuizProgress=function(mode,id,persist=true){qs2EnsureState(state);delete state.questionV2Progress[`qsv2:${mode}:${id}`];if(persist)save()};
quizProgressText=function(mode,id,total){const p=getQuizProgress(mode,id);if(!p)return'';const n=Math.min(Number(p.index||0)+1,Number(total||p.total||1));return `Question ${n} of ${Number(total||p.total||1)}`};
saveQuizProgress=function(savedIndex=quiz?quiz.index:0,awaiting=quiz?quiz.awaitingGotIt:false){
  if(!quiz||quiz.finished)return;qs2EnsureState(state);
  const activityId=quizActivityId(quiz.mode,quiz.unit,quiz.lesson);
  state.questionV2Progress[`qsv2:${quiz.mode}:${activityId}`]={
    mode:quiz.mode,activityId,index:Number(savedIndex||0),correct:Number(quiz.correct||0),
    awaitingGotIt:!!awaiting,currentAttempts:Number(quiz.currentAttempts||0),
    questionIds:quiz.questions.map(q=>q.id),total:quiz.questions.length,updatedAt:Date.now()
  };save();
};
function qs2RestoreOrder(questions,ids){
  if(!Array.isArray(ids)||!ids.length)return questions;
  const map=new Map(questions.map(q=>[q.id,q])),ordered=ids.map(id=>map.get(id)).filter(Boolean);
  if(ordered.length<Math.min(questions.length,Math.floor(ids.length*.7)))return questions;
  const used=new Set(ordered.map(q=>q.id));return [...ordered,...questions.filter(q=>!used.has(q.id))];
}
createOrResumeQuiz=function(mode,unit,lesson,questions){
  const activityId=quizActivityId(mode,unit,lesson),saved=getQuizProgress(mode,activityId);
  state.lastRoute={type:'quiz',mode,activityId};save();
  const ordered=saved?qs2RestoreOrder(questions,saved.questionIds):questions;
  quiz={mode,unit,lesson,questions:ordered,index:0,correct:0,answered:false,awaitingGotIt:false,currentAttempts:0,resumed:false,finished:false};
  if(saved){
    quiz.index=Math.max(0,Number(saved.index||0));quiz.correct=Math.max(0,Number(saved.correct||0));
    quiz.awaitingGotIt=!!saved.awaitingGotIt;quiz.answered=quiz.awaitingGotIt;quiz.currentAttempts=Number(saved.currentAttempts||0);quiz.resumed=true;
    if(quiz.index>=quiz.questions.length){clearQuizProgress(mode,activityId);quiz.index=0;quiz.correct=0;quiz.awaitingGotIt=false;quiz.answered=false}
    renderQuiz();toast(`Welcome back! Continuing from question ${quiz.index+1}.`);return;
  }
  saveQuizProgress(0,false);renderQuiz();
};

const qs2RenderLessonPanelCore=renderLessonPanel;
renderLessonPanel=function(l,t){
  if(t==='overview'){
    const lessonCount=qs2LessonCount(l),grammarCount=qs2GrammarCount(l);
    return `<h2>🎯 Your Mission</h2><p class="question-text" style="font-size:1.5rem">Master <b>${esc(l.title)}</b>, earn XP, and unlock the next level.</p><div class="tag-row"><span class="tag">📚 ${l.vocab.length} vocabulary cards</span><span class="tag">📝 ${lessonCount} grouped activities</span>${l.grammar?`<span class="tag">🧠 ${grammarCount} grammar activities</span>`:''}</div><div class="summary-list">${l.summary.bullets.slice(0,3).map((x,i)=>`<div class="summary-item"><b>${i+1}</b><span>${esc(x)}</span></div>`).join('')}</div>`;
  }
  if(t==='practice'){
    const lessonCount=qs2LessonCount(l),grammarCount=qs2GrammarCount(l);
    const lessonFinished=isActivityFinished('lesson',l.id),grammarFinished=l.grammar&&isActivityFinished('grammar',l.id);
    const lessonProgress=getQuizProgress('lesson',l.id),grammarProgress=l.grammar?getQuizProgress('grammar',l.id):null;
    const lessonLabel=lessonFinished?'✅ FINISHED — Lesson Challenge':lessonProgress?`▶ RESUME — ${quizProgressText('lesson',l.id,lessonCount)}`:`Start Lesson Challenge — ${lessonCount} Activities`;
    const grammarLabel=grammarFinished?'✅ FINISHED — Grammar Challenge':grammarProgress?`▶ RESUME — ${quizProgressText('grammar',l.id,grammarCount)}`:`Grammar Challenge — ${grammarCount} Activities`;
    return `<h2>🎮 Ready for the Challenge?</h2><p>Questions are organised by type. Your exact place is saved automatically after every answer.</p><div class="action-row"><button class="big-action ${lessonFinished?'finished-btn':lessonProgress?'resume-btn':''}" ${lessonFinished?'disabled':''} onclick="startLessonQuiz('${l.id}')">${lessonLabel}</button>${l.grammar?`<button class="big-action grammar ${grammarFinished?'finished-btn':grammarProgress?'resume-btn':''}" ${grammarFinished?'disabled':''} onclick="startGrammarQuiz('${l.id}')">${grammarLabel}</button>`:''}</div>${lessonProgress&&!lessonFinished?`<div class="resume-note">💾 Lesson Challenge saved at ${quizProgressText('lesson',l.id,lessonCount)}.</div>`:''}${grammarProgress&&!grammarFinished?`<div class="resume-note">💾 Grammar Challenge saved at ${quizProgressText('grammar',l.id,grammarCount)}.</div>`:''}${lessonFinished||grammarFinished?'<div class="finished-note">✅ A passed exercise is marked FINISHED and cannot award the same rewards again.</div>':''}<div class="attempt-note">💡 Sections appear in this order: Choose → Complete → Correct → Reorder → Match → Sort → Listening / Phonics → Write. Empty sections are skipped.</div><p>${activityScore('lesson',l.id)!=null?`Lesson best: <b>${activityScore('lesson',l.id)}%</b>`:''} ${l.grammar&&activityScore('grammar',l.id)!=null?`Grammar best: <b>${activityScore('grammar',l.id)}%</b>`:''}</p>`;
  }
  return qs2RenderLessonPanelCore(l,t);
};

renderUnit=function(){
  const u=current.unit,available=visibleUnitLessons(u),allDone=unitDone(u.number)||(available.length>0&&available.every(l=>lessonDone(l.id)));
  const bank=activityScore('bank',u.id),bankFinished=isActivityFinished('bank',u.id),bankProgress=getQuizProgress('bank',u.id),bankCount=qs2BankCount(u);
  const lessons=available.map(l=>{const i=u.lessons.indexOf(l),status=lessonTeacherStatus(l.id),open=isLessonUnlocked(u,i+1),label=lessonDone(l.id)?'✅ Completed':status==='locked'?'🔒 Locked by your teacher':open?'▶ Start lesson':'🔒 Locked';return `<button class="lesson-card glass ${open?'':'locked'}" onclick="openLesson('${l.id}')"><span class="lesson-cover"><img src="${lessonCover(l)}" alt="${esc(l.title)} cover"><span class="step">LEVEL ${i+1}</span></span><span class="lesson-card-body"><h3>${esc(l.title)}</h3><p class="muted">${esc(l.kind)}</p><span class="tag-row"><span class="tag">📚 ${l.vocab.length} words</span>${l.grammar?'<span class="tag">🧠 Grammar</span>':''}</span><p>${label}</p></span></button>`}).join('');
  let bankText='Complete all available lessons first 🔒';if(allDone)bankText=bankFinished?'✅ FINISHED — Unit Question Bank':bankProgress?`▶ RESUME — ${quizProgressText('bank',u.id,bankCount)}`:`Start Unit Bank — ${bankCount} Activities`;
  const content=`<section class="unit-hero glass"><img class="unit-hero-cover" src="${unitCover(u)}" alt=""><div class="unit-hero-copy"><div class="muted">UNIT ${u.number}</div><h1 class="rainbow">${esc(u.title)}</h1><p>${esc(u.theme)}</p><div class="tag-row">${u.lifeSkills.map(x=>`<span class="tag">🌟 ${esc(x)}</span>`).join('')}</div></div></section><div class="section-title"><h2>Choose a Lesson</h2><b>${available.filter(l=>lessonDone(l.id)).length}/${available.length} completed</b></div><div class="lesson-grid">${lessons}</div><section class="glass panel" style="margin-top:20px"><h2>🏦 Unit Question Bank</h2><p>${bankCount} grouped activities from the whole unit. Score 70% to unlock the next unit.</p><button class="big-action bank ${bankFinished?'finished-btn':bankProgress?'resume-btn':''}" ${(!allDone||bankFinished)?'disabled':''} onclick="startUnitBank('${u.id}')">${bankText}</button>${bankProgress&&!bankFinished?`<div class="resume-note">💾 Your progress is saved. You will continue from ${quizProgressText('bank',u.id,bankCount)}.</div>`:''}${bankFinished?'<div class="finished-note">✅ This question bank is finished and locked. It cannot award points again.</div>':''}${bank!=null?`<p><b>Best score: ${bank}%</b></p>`:''}</section><div class="action-row"><button class="secondary" onclick="goHome()">← Unit Map</button></div>`;
  document.getElementById('app').innerHTML=pageLayout(content,u.id);
};

startLessonQuiz=function(id){clearPendingAdvance();if(isActivityFinished('lesson',id)){playTone('wrong');toast('This lesson challenge is already FINISHED.');return}const g=getLesson(id),questions=makeLessonQuestions(g.lesson);if(!questions.length){toast('No lesson questions were found.');return}createOrResumeQuiz('lesson',g.unit,g.lesson,questions)};
startGrammarQuiz=function(id){clearPendingAdvance();if(isActivityFinished('grammar',id)){playTone('wrong');toast('This grammar challenge is already FINISHED.');return}const g=getLesson(id),questions=makeGrammarQuestions(g.lesson);if(!questions.length){toast('No grammar questions were found.');return}createOrResumeQuiz('grammar',g.unit,g.lesson,questions)};
startUnitBank=function(id){clearPendingAdvance();const u=CURRICULUM.units.find(x=>x.id===id);if(!u)return;if(isActivityFinished('bank',id)){playTone('wrong');toast('This unit bank is already FINISHED.');return}const questions=makeUnitBank(u);if(!questions.length){toast('No unit questions were found.');return}createOrResumeQuiz('bank',u,null,questions)};

function qs2Sections(qs){const seen=new Set(),list=[];qs.forEach(q=>{if(!seen.has(q.sectionType)){seen.add(q.sectionType);list.push(q.sectionType)}});return list}
function qs2SectionRange(qs,type){const indices=[];qs.forEach((q,i)=>{if(q.sectionType===type)indices.push(i)});return {first:indices[0]??0,last:indices[indices.length-1]??0,total:indices.length}}
function qs2CurrentSectionStats(){const q=quiz.questions[quiz.index],range=qs2SectionRange(quiz.questions,q.sectionType),within=quiz.index-range.first+1;return {q,range,within}}
function qs2SectionChips(){
  const currentType=quiz.questions[quiz.index].sectionType;
  return qs2Sections(quiz.questions).map(type=>{const r=qs2SectionRange(quiz.questions,type),done=quiz.index>r.last,current=type===currentType,meta=QS2_META[type]||{label:type,icon:'•'};return `<span class="qs-section-chip ${done?'done':current?'current':''}">${done?'✓':meta.icon} ${esc(meta.label)}</span>`}).join('');
}
function qs2HighlightWrong(q){
  const sentence=String(q.question||''),wrong=String(q.wrongWord||'');if(!wrong)return esc(sentence);
  let found=0;const target=Math.max(1,Number(q.occurrence||1));
  const escapedWrong=wrong.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),pattern=new RegExp(/^\w+$/.test(wrong)?`\\b${escapedWrong}\\b`:escapedWrong,'gi');
  let last=0,out='',m;while((m=pattern.exec(sentence))){found++;out+=esc(sentence.slice(last,m.index));out+=found===target?`<span class="qs-wrong-word">${esc(m[0])}</span>`:esc(m[0]);last=m.index+m[0].length}out+=esc(sentence.slice(last));return out;
}
function qs2PageLabel(q){return q.sourcePage?`<span class="qs-question-source">Book p. ${esc(q.sourcePage)}</span>`:''}
function qs2ModeTitle(){return quiz.mode==='grammar'?'Grammar Challenge':quiz.mode==='bank'?'Unit Question Bank':'Lesson Challenge'}

renderQuiz=function(){
  const q=quiz.questions[quiz.index],overallPct=Math.round(quiz.index/quiz.questions.length*100),stats=qs2CurrentSectionStats(),sectionPct=Math.round((stats.within-1)/Math.max(1,stats.range.total)*100),meta=QS2_META[q.sectionType]||{label:q.sectionType,icon:'•',instruction:q.sectionInstruction};
  const prompt=q.type==='correct'?`<div class="qs-wrong-sentence">${qs2HighlightWrong(q)}</div>`:`<div class="question-text">${esc(q.question)}</div>`;
  document.getElementById('app').innerHTML=`${topbar()}<main class="shell"><section class="quiz-wrap glass"><div class="quiz-top"><button class="secondary" onclick="quitQuiz()">✕ Exit</button><h2>${qs2ModeTitle()} <span class="resume-chip">💾 Auto-saved</span></h2><span class="pill">${quiz.index+1}/${quiz.questions.length}</span></div><div class="qs-section-nav">${qs2SectionChips()}</div><div class="qs-section-heading"><div><h3>${meta.icon} ${esc(meta.label)}</h3><p>${esc(q.sectionInstruction||meta.instruction||'')}</p></div><span class="pill">${stats.within}/${stats.range.total}</span></div><div class="qs-progress-row"><div class="qs-progress-box"><div class="qs-progress-label"><span>Current section</span><span>${sectionPct}%</span></div><div class="qs-mini-track"><div class="qs-mini-fill" style="width:${sectionPct}%"></div></div></div><div class="qs-progress-box"><div class="qs-progress-label"><span>Overall challenge</span><span>${overallPct}%</span></div><div class="qs-mini-track"><div class="qs-mini-fill" style="width:${overallPct}%"></div></div></div></div><article class="question-card"><span class="skill-label">${esc(q.skill)}</span>${qs2PageLabel(q)}${q.type==='listening_phonics'?`<button class="secondary" style="float:right" onclick="speak('${esc(q.audio||'').replace(/'/g,"\\'")}')">🔊 Listen</button>`:''}${prompt}${questionInput(q)}<div id="feedback" class="feedback"></div></article></section></main>`;
  if(quiz.awaitingGotIt){requestAnimationFrame(()=>restoreAwaitingGotIt(q))}else saveQuizProgress(quiz.index,false);
};

function questionInput(q){
  if(q.type==='choose'||q.type==='listening_phonics')return `<div class="options">${(q.options||[]).map((o,i)=>`<button class="option" data-answer="${esc(o)}" onclick="answerOption(this,'${encodeURIComponent(o)}')"><b>${String.fromCharCode(65+i)}.</b> ${esc(o)}</button>`).join('')}</div>`;
  if(q.type==='complete')return `<div class="qs-instruction">Type the missing word${q.wordBank?.length?' or choose it from the word bank':''}.</div>${q.wordBank?.length?`<div class="qs-word-bank">${q.wordBank.map(w=>`<button class="qs-word-chip" onclick="qs2FillText('${encodeURIComponent(w)}')">${esc(w)}</button>`).join('')}</div>`:''}<input id="textAnswer" class="answer-input" autocomplete="off" placeholder="Type the missing word"><button id="checkAnswerBtn" class="primary" style="margin-top:12px" onclick="answerText()">Check Answer</button>`;
  if(q.type==='correct')return `<div class="qs-instruction">Write the correct word only. Do not rewrite the full sentence.</div><input id="textAnswer" class="answer-input" autocomplete="off" placeholder="Correct word only"><button id="checkAnswerBtn" class="primary" style="margin-top:12px" onclick="answerText()">Check Answer</button>`;
  if(q.type==='reorder'){
    const values=shuffle([...(q.tokens||q.events||[])],q.id+'-reorder');
    return `<p class="qs-instruction">Tap a card to move it. You can tap it again to return it.</p><div id="orderAnswer" class="qs-reorder-answer"></div><div id="orderBank" class="qs-reorder-bank">${values.map(w=>`<button class="token ${q.events?'qs-event-token':''}" onclick="pickToken(this,'${encodeURIComponent(w)}')">${esc(w)}</button>`).join('')}</div><button id="checkOrderBtn" class="primary" onclick="checkOrder()">Check Order</button>`;
  }
  if(q.type==='match')return qs2MatchInput(q);
  if(q.type==='sort')return qs2SortInput(q);
  if(q.type==='write')return qs2WriteInput(q);
  return '';
}
window.qs2FillText=function(encoded){const input=document.getElementById('textAnswer');if(input){input.value=decodeURIComponent(encoded);input.focus()}};

function qs2MatchInput(q){
  const rights=shuffle(q.pairs.map(p=>p[1]),q.id+'-match');
  return `<p class="qs-instruction">Tap an answer, then tap its matching box. You can also drag an answer to a box.</p><div class="qs-match-grid"><div class="qs-match-left">${q.pairs.map((p,i)=>`<div class="qs-match-row"><div class="qs-match-label">${esc(p[0])}</div><div class="qs-drop-slot" data-match-index="${i}" data-match-value="" onclick="qs2AssignMatch(${i})" ondragover="event.preventDefault()" ondrop="qs2DropMatch(event,${i})">Tap here</div></div>`).join('')}</div><div class="qs-match-bank">${rights.map((r,i)=>`<button class="qs-bank-chip" draggable="true" data-match-option="${esc(r)}" onclick="qs2SelectMatch(this,'${encodeURIComponent(r)}')" ondragstart="event.dataTransfer.setData('text/plain','${encodeURIComponent(r)}')">${esc(r)}</button>`).join('')}</div></div><button id="checkMatchBtn" class="primary" onclick="checkMatch()">Check Matches</button>`;
}
let qs2SelectedMatch='';
window.qs2SelectMatch=function(btn,encoded){if(quiz?.answered)return;document.querySelectorAll('[data-match-option]').forEach(b=>b.classList.remove('selected'));qs2SelectedMatch=decodeURIComponent(encoded);btn.classList.add('selected')};
function qs2PutMatch(index,value){
  const slot=document.querySelector(`[data-match-index="${index}"]`);if(!slot)return;
  const old=slot.dataset.matchValue;if(old){const oldBtn=[...document.querySelectorAll('[data-match-option]')].find(b=>b.dataset.matchOption===old);if(oldBtn)oldBtn.classList.remove('used')}
  slot.dataset.matchValue=value;slot.textContent=value;slot.classList.add('filled');
  const btn=[...document.querySelectorAll('[data-match-option]')].find(b=>b.dataset.matchOption===value);if(btn){btn.classList.add('used');btn.classList.remove('selected')}
  qs2SelectedMatch='';
}
window.qs2AssignMatch=function(index){if(!qs2SelectedMatch){toast('Choose an answer first.');return}qs2PutMatch(index,qs2SelectedMatch)};
window.qs2DropMatch=function(event,index){event.preventDefault();const value=decodeURIComponent(event.dataTransfer.getData('text/plain')||'');if(value)qs2PutMatch(index,value)};
window.checkMatch=function(){
  if(quiz.answered)return;const q=quiz.questions[quiz.index],slots=[...document.querySelectorAll('[data-match-index]')];
  if(slots.some(s=>!s.dataset.matchValue)){toast('Complete every match first.');return}
  const correct=slots.every(s=>normalize(s.dataset.matchValue)===normalize(q.pairs[Number(s.dataset.matchIndex)][1]));
  const status=finishAnswer(correct,q.pairs);if(status!=='retry')qs2DisableInteractive();
};

function qs2SortInput(q){
  const items=[];Object.entries(q.categories).forEach(([category,values])=>values.forEach(value=>items.push({category,value})));
  const shuffled=shuffle(items,q.id+'-sort');
  return `<p class="qs-instruction">Tap an item, then tap its group. You can also drag items.</p><div id="qsSortBank" class="qs-sort-bank">${shuffled.map((item,i)=>`<button class="qs-bank-chip" draggable="true" data-sort-item="${esc(item.value)}" onclick="event.stopPropagation();qs2SelectSort(this,'${encodeURIComponent(item.value)}')" ondragstart="event.dataTransfer.setData('text/plain','${encodeURIComponent(item.value)}')">${esc(item.value)}</button>`).join('')}</div><div class="qs-sort-categories">${Object.keys(q.categories).map((category,i)=>`<section class="qs-sort-category" data-sort-category="${esc(category)}" onclick="qs2AssignSort('${encodeURIComponent(category)}')" ondragover="event.preventDefault()" ondrop="qs2DropSort(event,'${encodeURIComponent(category)}')"><h4>${esc(category)}</h4><div class="qs-sort-items"></div></section>`).join('')}</div><button id="checkSortBtn" class="primary" style="margin-top:12px" onclick="checkSort()">Check Groups</button>`;
}
let qs2SelectedSort='';
window.qs2SelectSort=function(btn,encoded){if(quiz?.answered)return;document.querySelectorAll('[data-sort-item]').forEach(b=>b.classList.remove('selected'));qs2SelectedSort=decodeURIComponent(encoded);btn.classList.add('selected')};
function qs2PutSort(category,value){
  const box=[...document.querySelectorAll('[data-sort-category]')].find(x=>x.dataset.sortCategory===category);if(!box)return;
  let chip=[...document.querySelectorAll('[data-sort-item]')].find(x=>x.dataset.sortItem===value);
  if(!chip)return;box.querySelector('.qs-sort-items').appendChild(chip);chip.classList.remove('selected');qs2SelectedSort='';
}
window.qs2AssignSort=function(encodedCategory){if(!qs2SelectedSort){toast('Choose an item first.');return}qs2PutSort(decodeURIComponent(encodedCategory),qs2SelectedSort)};
window.qs2DropSort=function(event,encodedCategory){event.preventDefault();const value=decodeURIComponent(event.dataTransfer.getData('text/plain')||'');if(value)qs2PutSort(decodeURIComponent(encodedCategory),value)};
window.checkSort=function(){
  if(quiz.answered)return;const q=quiz.questions[quiz.index],all=[...document.querySelectorAll('[data-sort-item]')];
  if(all.some(chip=>!chip.closest('[data-sort-category]'))){toast('Put every item in a group first.');return}
  const correct=all.every(chip=>{const category=chip.closest('[data-sort-category]').dataset.sortCategory;return (q.categories[category]||[]).some(v=>normalize(v)===normalize(chip.dataset.sortItem))});
  const status=finishAnswer(correct,q.categories);if(status!=='retry')qs2DisableInteractive();
};

function qs2WriteInput(q){
  const saved=state.questionV2Writing[q.id]||'';
  return `<div class="qs-write-box">${q.scaffold?`<div class="qs-scaffold"><b>Writing help:</b> ${esc(q.scaffold)}</div>`:''}${q.checklist?.length?`<div class="qs-checklist"><b>Check your work:</b>${q.checklist.map(item=>`<label><span>☐</span><span>${esc(item)}</span></label>`).join('')}</div>`:''}<textarea id="writingAnswer" placeholder="Write your answer here..." oninput="qs2SaveWriting('${q.id}')">${esc(saved)}</textarea><div class="qs-writing-saved" id="writingSaved">${saved?'Saved ✓':''}</div><button id="checkWritingBtn" class="primary" style="margin-top:12px" onclick="checkWriting()">Save and Continue</button></div>`;
}
window.qs2SaveWriting=function(id){qs2EnsureState(state);const text=document.getElementById('writingAnswer')?.value||'';state.questionV2Writing[id]=text;const note=document.getElementById('writingSaved');if(note)note.textContent='Saved ✓';save()};
function qs2WritingChecks(q,text){
  const checklist=(q.checklist||[]).join(' ').toLowerCase(),trim=text.trim(),words=trim.split(/\s+/).filter(Boolean);
  const problems=[];if(words.length<3)problems.push('Write at least three words.');
  if(/capital/.test(checklist)&&trim&&!/^[A-Z]/.test(trim))problems.push('Start with a capital letter.');
  if(/full stop|punctuation|question mark/.test(checklist)&&trim&&!/[.!?]$/.test(trim))problems.push('End with correct punctuation.');
  const numberWords={one:1,two:2,three:3,four:4,five:5,six:6};
  for(const [word,n] of Object.entries(numberWords)){if(new RegExp(`${word} sentence`).test(String(q.question).toLowerCase())){const count=(trim.match(/[.!?]+(?=\s|$)/g)||[]).length;if(count<n)problems.push(`Write at least ${n} complete sentence${n>1?'s':''}.`);break}}
  return problems;
}
window.checkWriting=function(){
  if(quiz.answered)return;const q=quiz.questions[quiz.index],text=document.getElementById('writingAnswer')?.value||'';qs2SaveWriting(q.id);const problems=qs2WritingChecks(q,text);
  if(problems.length){const f=document.getElementById('feedback');f.className='feedback bad';f.innerHTML=`<div class="qs-feedback-try">${problems.map(p=>`• ${esc(p)}`).join('<br>')}</div>`;playTone('wrong');return}
  const status=finishAnswer(true,'Your writing has been saved.');if(status!=='retry')qs2DisableInteractive();
};

function qs2StrictCapitalisation(q){return q.type==='correct'&&((q.answer&&q.wrongWord&&/^[A-Z]/.test(String(q.answer))&&!/^[A-Z]/.test(String(q.wrongWord)))||/capital|proper noun/i.test(String(q.skill||'')))}
function qs2AnswerEqual(q,value){if(/phonics/i.test(String(q.skill||''))){const clean=x=>String(x).trim().replace(/^\/|\/$/g,'').toLowerCase();return clean(value)===clean(q.answer)}if(qs2StrictCapitalisation(q))return String(value).trim()===String(q.answer).trim();return normalize(value)===normalize(q.answer)}
answerOption=function(btn,val){
  if(quiz.answered)return;const q=quiz.questions[quiz.index],selected=decodeURIComponent(val),correct=qs2AnswerEqual(q,selected),status=finishAnswer(correct,q.answer);
  if(correct||status==='reveal'){document.querySelectorAll('.option').forEach(b=>{b.disabled=true;if(normalize(b.dataset.answer)===normalize(q.answer))b.classList.add('correct')});if(!correct)btn.classList.add('wrong')}
  else{btn.classList.add('wrong');btn.disabled=true}
};
answerText=function(){
  if(quiz.answered)return;const q=quiz.questions[quiz.index],input=document.getElementById('textAnswer'),value=input?.value.trim()||'';if(!value){toast('Type your answer first.');return}
  if(q.type==='correct'&&value.split(/\s+/).length!==1){toast('Write one correct word only.');input.focus();return}
  const correct=qs2AnswerEqual(q,value),status=finishAnswer(correct,q.answer);
  if(correct||status==='reveal'){input.disabled=true;const btn=document.getElementById('checkAnswerBtn');if(btn)btn.disabled=true}else{input.value='';input.focus()}
};
pickToken=function(btn,w){if(quiz.answered)return;btn.dataset.word=decodeURIComponent(w);btn.onclick=()=>toggleOrderToken(btn);document.getElementById('orderAnswer').appendChild(btn)};
toggleOrderToken=function(btn){if(quiz.answered)return;const answer=document.getElementById('orderAnswer'),bank=document.getElementById('orderBank');(btn.parentElement===answer?bank:answer).appendChild(btn)};
checkOrder=function(){
  if(quiz.answered)return;const q=quiz.questions[quiz.index],chosen=[...document.querySelectorAll('#orderAnswer .token')].map(x=>x.textContent),needed=q.tokens||q.events||[];
  if(chosen.length!==needed.length){toast('Use all the cards first.');return}
  const expected=Array.isArray(q.answer)?q.answer:String(q.answer).split(/\s+/),correct=chosen.length===expected.length&&chosen.every((v,i)=>normalize(v)===normalize(expected[i]));
  const status=finishAnswer(correct,q.answer);if(status!=='retry')qs2DisableInteractive();
};

function qs2DisableInteractive(){document.querySelectorAll('.option,.token,.qs-bank-chip,.qs-word-chip,.qs-drop-slot,.qs-sort-category,button[id^="check"]').forEach(el=>el.disabled=true);const input=document.getElementById('textAnswer');if(input)input.disabled=true;const writing=document.getElementById('writingAnswer');if(writing)writing.disabled=true}
function qs2AnswerDisplay(q,answer){
  if(q.type==='correct')return `<strong>${esc(String(q.answer))}</strong>${q.correctedSentence?`<span class="qs-corrected-sentence">${esc(q.correctedSentence)}</span>`:''}`;
  if(q.type==='match')return q.pairs.map(p=>`${esc(p[0])} → ${esc(p[1])}`).join('<br>');
  if(q.type==='sort')return Object.entries(q.categories).map(([c,items])=>`<b>${esc(c)}:</b> ${items.map(esc).join(', ')}`).join('<br>');
  if(q.type==='reorder')return (Array.isArray(answer)?answer:[answer]).map(esc).join(q.events?'<br>':' ');
  return `<strong>${esc(String(answer))}</strong>`;
}
finishAnswer=function(correct,answer){
  if(!quiz||quiz.answered)return'blocked';state.answerEvents=Number(state.answerEvents||0)+1;
  const f=document.getElementById('feedback'),q=quiz.questions[quiz.index],key=quizActivityKey();state.rewardedQuestions=state.rewardedQuestions||{};const rewarded=state.rewardedQuestions[key]||(state.rewardedQuestions[key]=[]);
  if(correct){
    quiz.answered=true;quiz.awaitingGotIt=false;quiz.currentAttempts=0;quiz.correct++;
    const isNewReward=!rewarded.includes(q.id);if(isNewReward){rewarded.push(q.id);state.xp+=10;state.streak++;if(state.streak%5===0)state.coins+=5}
    f.className='feedback good';f.innerHTML=`${isNewReward?['Great job! ⭐','Excellent! 🌟','Amazing work! 🎉'][quiz.correct%3]:'Correct! ✅ This question was already rewarded.'}${q.type==='correct'&&q.correctedSentence?`<span class="qs-corrected-sentence">${esc(q.correctedSentence)}</span>`:''}`;
    playTone('correct');saveQuizProgress(quiz.index+1,false);scheduleQuizAdvance(900);return'correct';
  }
  quiz.currentAttempts=Number(quiz.currentAttempts||0)+1;state.streak=0;
  if(quiz.currentAttempts<2){
    quiz.answered=false;quiz.awaitingGotIt=false;f.className='feedback bad';f.innerHTML='<div class="qs-feedback-try">Not quite. Try one more time. 💪</div>';playTone('wrong');saveQuizProgress(quiz.index,false);return'retry';
  }
  quiz.answered=true;quiz.awaitingGotIt=true;f.className='feedback bad';f.innerHTML=`<div class="answer-reveal"><div>Not quite. Please review the correct answer:</div>${qs2AnswerDisplay(q,answer)}<span class="wait-note">The next question will not open until you press the button.</span><div class="got-it-wrap"><button class="got-it-btn" onclick="gotItAndContinue(this)">Got it ✓</button></div></div>`;playTone('wrong');saveQuizProgress(quiz.index,true);requestAnimationFrame(()=>f.scrollIntoView({behavior:'smooth',block:'center'}));return'reveal';
};
restoreAwaitingGotIt=function(q){
  qs2DisableInteractive();const f=document.getElementById('feedback');if(f){f.className='feedback bad';f.innerHTML=`<div class="answer-reveal"><div>You answered this question incorrectly before leaving. Please review the correct answer:</div>${qs2AnswerDisplay(q,q.answer)}<span class="wait-note">Press Got it to continue from your saved place.</span><div class="got-it-wrap"><button class="got-it-btn" onclick="gotItAndContinue(this)">Got it ✓</button></div></div>`}
};

advanceQuizQuestion=function(force=false){
  if(!quiz||quiz.finished)return;if(quiz.awaitingGotIt&&!force)return;clearPendingAdvance();
  const previous=quiz.questions[quiz.index],nextIndex=quiz.index+1;quiz.awaitingGotIt=false;quiz.currentAttempts=0;
  if(nextIndex>=quiz.questions.length){finishQuiz();return}
  const next=quiz.questions[nextIndex];quiz.index=nextIndex;quiz.answered=false;saveQuizProgress(quiz.index,false);playTone('next');
  if(previous.sectionType!==next.sectionType)renderSectionComplete(previous,next);else renderQuiz();
};
function renderSectionComplete(previous,next){
  const done=QS2_META[previous.sectionType]||{label:previous.sectionType,icon:'✅'},upcoming=QS2_META[next.sectionType]||{label:next.sectionType,icon:'➡️'};
  document.getElementById('app').innerHTML=`${topbar()}<main class="shell"><section class="qs-section-complete glass"><div class="trophy">🏅</div><h1 class="rainbow">${esc(done.label)} Complete!</h1><p class="question-text">Great work! You finished every ${esc(done.label)} activity in this section.</p><div class="qs-next-section">Next: ${upcoming.icon} ${esc(upcoming.label)}</div><div><button class="primary" onclick="continueAfterSection()">Start ${esc(upcoming.label)} →</button></div></section></main>`;playTone('complete');confetti(28);
}
window.continueAfterSection=function(){if(!quiz)return;renderQuiz()};

finishQuiz=function(){
  clearPendingAdvance();const score=Math.round(quiz.correct/Math.max(1,quiz.questions.length)*100),mode=quiz.mode,l=quiz.lesson,u=quiz.unit,activityId=quizActivityId(mode,u,l),wasFinished=isActivityFinished(mode,activityId);
  clearQuizProgress(mode,activityId,false);qs2EnsureState(state);state.questionV2Scores[mode][activityId]=Math.max(Number(state.questionV2Scores[mode][activityId]||0),score);
  const passed=score>=70,newlyFinished=passed&&!wasFinished;if(newlyFinished){markActivityFinished(mode,activityId);state.stars+=mode==='grammar'?2:mode==='bank'?3:1;state.xp+=mode==='bank'?100:40;playTone('complete');confetti(mode==='bank'?80:45)}
  if(l)checkLessonCompletion(l,u);if(mode==='bank'&&passed)completeUnit(u);save();const old={...quiz,newlyFinished};quiz={...quiz,finished:true,score,newlyFinished};renderQuizResult(old,score,passed);
};
checkLessonCompletion=function(l,u){
  const normal=Number(activityScore('lesson',l.id)||0)>=70,gram=!l.grammar||Number(activityScore('grammar',l.id)||0)>=70;
  if(normal&&gram&&!state.completedLessons[l.id]){state.completedLessons[l.id]=true;const idx=u.lessons.findIndex(x=>x.id===l.id);if(idx+1<u.lessons.length){const arr=state.unlockedLessons[u.id]||(state.unlockedLessons[u.id]=[1]);if(!arr.includes(idx+2))arr.push(idx+2)}state.badges.push('Lesson: '+l.title);playTone('badge')}
};

validate=function(){
  const rows=[];let total=0,errors=[];
  CURRICULUM.units.forEach(u=>{
    u.lessons.forEach(l=>{const lesson=makeLessonQuestions(l),grammar=makeGrammarQuestions(l);rows.push([l.id,lesson.length,grammar.length]);total+=lesson.length+grammar.length;if(!lesson.length)errors.push(`${l.id}: no lesson questions`)});
    const bank=makeUnitBank(u);rows.push([u.id+' bank',bank.length,0]);total+=bank.length;if(!bank.length)errors.push(`${u.id}: no unit bank questions`);
  });
  console.table(rows);console.info(`English 4 Question System V2 loaded ${total} accessible activities. Full reviewed bank contains 1649 activities.`);if(errors.length)console.error(errors);return {rows,total,errors};
};

window.makeLessonQuestions=makeLessonQuestions;
window.makeGrammarQuestions=makeGrammarQuestions;
window.makeUnitBank=makeUnitBank;
console.info('English 4 Grouped Question System V2 ready. Original design and Supabase configuration preserved.');
})();
