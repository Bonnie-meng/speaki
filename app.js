const contextWords=new Set(['record','present','permit','object','conduct','produce','project','refuse','subject','content','contract','desert','minute','live','lead','read','wind','tear','close','use','bass','bow','wound']);
const speakerIcon='<svg class="speaker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>';
const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const seed = [
  {id:'clarify',word:'clarify',ipa:'/ˈklerəfaɪ/',pos:'verb',category:'Product & Work',register:'Neutral',usage:'Common in meetings and writing.',meaning:'To make something clearer or easier to understand.',zh:'澄清；解释清楚',phrases:['clarify the requirements','clarify a point','clarify what you mean'],example:'Could you clarify what you mean by “high priority”?',prompt:'Ask a teammate to explain a requirement that is unclear.',source:'Starter collection · Meeting essentials'},
  {id:'grab',word:'grab',ipa:'/ɡræb/',pos:'verb',category:'Everyday',register:'Informal',usage:'Very common in casual conversation.',meaning:'To get something quickly, such as food or a drink.',zh:'（迅速或顺便）买、吃、喝；此处为口语用法',phrases:['grab a coffee','grab lunch','grab a bite'],example:'Do you want to grab a coffee after the meeting?',prompt:'Invite a friend to get something to eat.',source:'Starter collection · Everyday moments'},
  {id:'align',word:'align',ipa:'/əˈlaɪn/',pos:'verb',category:'Product & Work',register:'Neutral',usage:'Common in business conversation and writing.',meaning:'To agree on a shared goal, plan, or way of working.',zh:'就目标或计划达成一致；对齐',phrases:['align on priorities','align with our goals','align expectations'],example:'Let’s align on the priorities before we plan the next sprint.',prompt:'Ask your team to agree on the most important work this week.',source:'Starter collection · Team collaboration'},
  {id:'figure-out',word:'figure out',ipa:'/ˈfɪɡjər aʊt/',pos:'phrasal verb',category:'Everyday',register:'Neutral',usage:'Especially common in speech; also used in everyday writing.',meaning:'To understand something or find a solution by thinking.',zh:'弄明白；想出办法',phrases:['figure out how to do it','figure out what happened','figure it out'],example:'I’m trying to figure out how to get to the station.',prompt:'Describe something you are trying to understand.',source:'Starter collection · Solving everyday problems'},
  {id:'trade-off',word:'trade-off',ipa:'/ˈtreɪd ɔːf/',pos:'noun',category:'Product & Work',register:'Neutral',usage:'Common when discussing product decisions.',meaning:'A situation where you give up one benefit to get another.',zh:'权衡；取舍',phrases:['a trade-off between speed and quality','make a trade-off','consider the trade-offs'],example:'There’s a trade-off between launching quickly and adding more features.',prompt:'Describe a trade-off in a recent product decision.',source:'Starter collection · Product decisions'},
  {id:'follow-up',word:'follow up',ipa:'/ˈfɑːloʊ ʌp/',pos:'phrasal verb',category:'Product & Work',register:'Neutral',usage:'Common in meetings, chat messages, and emails.',meaning:'To contact someone again or take the next action after something.',zh:'跟进；进一步采取行动',phrases:['follow up on the request','follow up with a colleague','follow up after a meeting'],example:'I’ll follow up with the design team and share an update tomorrow.',prompt:'Tell a colleague what you will do after the meeting.',source:'Starter collection · Following through'},
  {id:'feasible',word:'feasible',ipa:'/ˈfiːzəbəl/',pos:'adjective',category:'Product & Work',register:'Neutral',usage:'Common in professional discussion and writing.',meaning:'Possible and practical to do with the time or resources available.',zh:'可行的；行得通的',phrases:['technically feasible','a feasible solution','feasible within the timeline'],example:'Is it feasible to release this feature by the end of the month?',prompt:'Ask whether a proposed deadline is realistic.',source:'Starter collection · Planning'},
  {id:'significant',word:'significant',ipa:'/sɪɡˈnɪfɪkənt/',pos:'adjective',category:'IELTS',register:'Neutral',usage:'Common in reports and academic writing; also used in speech.',meaning:'Large or important enough to notice or have an effect.',zh:'显著的；重要的',phrases:['a significant increase','a significant difference','a significant impact'],example:'The new checkout flow led to a significant increase in completed orders.',prompt:'Describe an important change you have noticed.',source:'Starter collection · Describing change'}
].map(w=>({...w,status:'new',due:dateKey(),reviews:0,createdAt:dateKey()}));
let state = {version:1,words:structuredClone(seed),activity:{},drafts:{},focus:{day:dateKey(),seconds:0},listening:{}};
if(state.focus.day!==dateKey()) state.focus={day:dateKey(),seconds:0};
let currentPage='today',category='All words',statusFilter='all',query='',editingId=null;
let reviewQueue=[],reviewIndex=0,reviewRevealed=false,reviewResults=0;
let timerRunning=false,timerInterval=null,sessionSeconds=0;
let activeTopic='meeting';
const voiceCall=new DaylightVoiceCall({
 onAudioStart:()=>stopAudio(),
 onPractice:()=>{activity().practices++;save();},
 onSave:(title,text,correction)=>{
  const key=voiceCall.scenario;activeTopic=key;
  const feedback=correction?`\n\nExpression to practise: ${correction.better}\n${correction.why}`:'';
  state.drafts[key]=(state.drafts[key]||'')+`\n\n${title} · ${new Date().toLocaleString()}\n${text}${feedback}`;
  save();const notes=document.querySelector('#speaking-notes');if(notes)notes.value=state.drafts[key];
 }
});
const $=(s,root=document)=>root.querySelector(s);
const $$=(s,root=document)=>[...root.querySelectorAll(s)];
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function validateBackup(data){return DaylightState.validate(data);}

function save(){DaylightAccount.schedule(state);if($('#nav-count'))$('#nav-count').textContent=state.words.length;}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toast.timeout);toast.timeout=setTimeout(()=>$('#toast').classList.remove('visible'),3800);}
function activity(){return state.activity[dateKey()] ||= {reviews:0,practices:0};}
function dueWords(){return state.words.filter(w=>w.status!=='pending'&&w.due<=dateKey());}
function categoryClass(c){return c==='Product & Work'?'work':c==='IELTS'?'ielts':'';}
function tag(w){return `<span class="tag ${categoryClass(w.category)}">${esc(w.category)}</span>`;}
function wordCard(w){return `<button class="word-card" data-word="${esc(w.id)}"><div class="card-top">${tag(w)}<span class="dots" aria-hidden="true">${w.status==='usable'?'●●●':w.status==='learning'?'●●○':'●○○'}</span></div><h3 class="word-name">${esc(w.word)}</h3><span class="ipa">${esc(w.ipa||'Pronunciation to add')}</span><p class="meaning">${esc(w.meaning||'Your word is saved. Its learning details are not ready yet.')}</p><div class="card-bottom"><span class="pos">${esc(w.pos||'To enrich')}</span><span>${w.status==='pending'?'Needs details':w.status==='usable'?'Can use':w.status==='learning'?'Learning':'New discovery'} ↗</span></div></button>`;}
function heading(eyebrow,title,description,action=''){return `<div class="page-heading"><div>${eyebrow?`<span class="eyebrow">${eyebrow}</span>`:''}<h1>${title}</h1><p>${description}</p></div>${action}</div>`;}
function render(){
 if(!DaylightAccount.user)return;
 currentPage=['today','vocabulary','speaking','listening'].includes(location.hash.slice(1))?location.hash.slice(1):'today';
 $$('[data-nav]').forEach(a=>{a.classList.toggle('active',a.dataset.nav===currentPage);if(a.dataset.nav===currentPage)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 $('#breadcrumb').innerHTML=`Your space <span>/</span> ${currentPage[0].toUpperCase()+currentPage.slice(1)}`;
 $('#nav-count').textContent=state.words.length;
 $('#app').innerHTML=currentPage==='today'?todayView():currentPage==='vocabulary'?vocabularyView():currentPage==='speaking'?speakingView():listeningView();
 if(currentPage==='vocabulary') {$('#word-search').value=query;$('#word-search').addEventListener('input',e=>{query=e.target.value;renderWordGrid();});$('#status-filter').value=statusFilter;$('#status-filter').onchange=e=>{statusFilter=e.target.value;renderWordGrid();};renderWordGrid();}
 if(currentPage==='listening')listeningPlayer.mount();
 if(currentPage==='speaking'){$('#speaking-notes').addEventListener('input',e=>{state.drafts[activeTopic]=e.target.value;save();});voiceCall.mount();}
 updateTimer();updateTodayDate();
}
function updateTodayDate(){const el=$('#today-date');if(!el)return;const now=new Date();el.dateTime=dateKey(now);el.textContent=new Intl.DateTimeFormat('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'}).format(now);}
function todayView(){
 const due=dueWords().length,recent=[...state.words].reverse().slice(0,4),listeningSeconds=Object.values(state.listening||{}).reduce((sum,item)=>sum+item.seconds,0);
 const steps=[['Review your words',`${due} ready to revisit`,'15 min','review'],['Learn something new','Capture a word or expression','25 min','vocabulary'],['Listen and speak','Choose a listening lesson or start a conversation','20 min','listening']];
 return heading('','Today','<time id="today-date"></time>')+`<section class="today-summary"><button data-action="review"><strong>${due}</strong><span>Ready to review</span></button><a href="#vocabulary"><strong>${state.words.length}</strong><span>Words collected</span></a><a href="#listening"><strong>${Math.floor(listeningSeconds/60)} min</strong><span>Listening time</span></a></section><div class="dashboard-grid"><div><div class="section-heading"><h2>Your daily plan</h2><span>60 min</span></div><section class="plan">${steps.map(([title,note,duration,target],i)=>`<div class="plan-item"><span class="plan-number">${i+1}</span><div class="plan-copy"><h3>${title}</h3><p>${note}</p></div><span class="duration">${duration}</span>${target==='review'?'<button class="plan-link" data-action="review" aria-label="Review familiar words">↗</button>':`<a class="plan-link" href="#${target}" aria-label="Open ${target}">↗</a>`}</div>`).join('')}</section><div class="section-heading"><h2>Recent words</h2><a href="#vocabulary">View all ↗</a></div><div class="word-grid">${recent.map(wordCard).join('')}</div></div><aside class="dashboard-aside"><section class="side-panel"><h3>Focus time</h3><div class="focus-ring" id="focus-ring"><div><span class="timer-value" id="timer-value">00:00</span><small>of your daily hour</small></div></div><div class="timer-actions"><button class="button secondary" data-action="timer" id="timer-toggle">${timerRunning?'Pause':'Start focus'}</button><button class="button ghost" data-action="timer-reset" aria-label="Reset today’s focus timer">↺</button></div></section></aside></div>`;
}

function vocabularyView(){return heading('','Vocabulary','Words and expressions you want to use.',`<button class="button primary" data-action="add">＋ Add a word</button>`)+`<div class="toolbar"><label class="search-box"><span aria-hidden="true">⌕</span><input id="word-search" type="search" aria-label="Search vocabulary" placeholder="Search words, meanings, or phrases…"></label><button class="button secondary" data-action="review">↻ Review words</button></div><div class="filters" role="group" aria-label="Filter by category">${['All words','Everyday','Product & Work','IELTS'].map(c=>`<button class="filter ${category===c?'active':''}" data-category="${esc(c)}" aria-pressed="${category===c}">${esc(c)}</button>`).join('')}</div><div class="library-meta"><span id="result-count"></span><label>Progress <select id="status-filter" aria-label="Filter by learning progress"><option value="all">All stages</option><option value="pending">Needs details</option><option value="new">New discovery</option><option value="learning">Learning</option><option value="usable">Can use</option></select></label></div><div class="word-grid vocabulary-grid" id="word-results">${filteredWords().map(wordCard).join('')}</div><div class="mobile-backup"><button class="text-button" data-action="export">↗ Export backup</button> · <button class="text-button" data-action="import">↙ Import backup</button></div>`;}
function filteredWords(){const q=query.toLowerCase().trim();return state.words.filter(w=>(category==='All words'||w.category===category)&&(statusFilter==='all'||w.status===statusFilter)&&[w.word,w.meaning,w.zh,...w.phrases].some(t=>t.toLowerCase().includes(q)));}
function renderWordGrid(){const words=filteredWords();$('#word-results').innerHTML=words.length?words.map(wordCard).join(''):'<div class="empty"><h3>No words here yet.</h3><p>Try another filter, or capture a new discovery.</p><button class="button secondary" data-action="add">＋ Add a word</button></div>';$('#result-count').textContent=`${words.length} ${words.length===1?'expression':'expressions'} · ${dueWords().length} ready to review`;}
const speakingTopics={meeting:{label:'In a meeting',tag:'Product & Work',prompt:'A teammate proposes a feature, but the goal isn’t clear. How would you ask for more context?',steps:['Ask what problem the feature is meant to solve.','Clarify who needs it and why.','Suggest a next step.'],example:'Could you walk me through the problem we’re trying to solve? I’d like to clarify who this is for before we discuss the solution. Could we look at a few examples from user feedback?',phrases:['Could you clarify…?','What problem are we trying to solve?','Let’s align on…']},everyday:{label:'An everyday moment',tag:'Everyday',prompt:'You’ve just moved to a new neighbourhood. Invite a colleague for coffee and ask for a local recommendation.',steps:['Suggest a time to meet.','Ask about a café nearby.','Explain what kind of place you like.'],example:'Would you like to grab a coffee after work? I’m still figuring out where everything is around here. Do you know a quiet café nearby where we could sit and chat?',phrases:['Would you like to grab…?','Do you happen to know…?','I’m looking for…']},ielts:{label:'An IELTS warm-up',tag:'IELTS',prompt:'Describe a skill you would like to improve. Explain why it matters and how you plan to practise.',steps:['Say what skill you want to improve.','Explain why it is useful in your life.','Describe one practical step you can take.'],example:'I’d like to become more confident speaking English. I work as a product manager, so I need to explain ideas clearly in meetings. I plan to practise for a few minutes every day and use new expressions in real conversations.',phrases:['I’d like to become more…','It would help me…','I plan to…']}};
function speakingView(){return heading('','Speaking','Practise a real conversation.')+voiceCall.view()+'<details class="speaking-notebook"><summary>Your notes & conversation prompts</summary>'+speakingNotesView()+'</details>';}
function speakingNotesView(){const t=speakingTopics[activeTopic];return `<div class="practice-tabs">${Object.entries(speakingTopics).map(([id,t])=>`<button class="${id===activeTopic?'active':''}" data-topic="${id}" aria-pressed="${id===activeTopic}">${t.label}</button>`).join('')}</div><div class="practice-grid"><section class="practice-card"><span class="tag ${categoryClass(t.tag)}">${t.tag}</span><p class="prompt">${t.prompt}</p><ol>${t.steps.map(s=>`<li>${s}</li>`).join('')}</ol><label for="speaking-notes" class="eyebrow">YOUR NOTES · SAVED AS YOU TYPE</label><textarea id="speaking-notes" rows="6" placeholder="Try it out loud. Then write a few words or your answer here…">${esc(state.drafts[activeTopic]||'')}</textarea><button class="button primary" data-action="speaking-done">✓ I practised out loud</button><details><summary>Need a little inspiration? See a sample answer</summary><p class="transcript">${t.example}</p><button class="audio-button" data-action="speak-example">${speakerIcon} Listen to the sample</button></details><p class="notice">Keep your notes here. Share them in our chat for personal feedback.</p></section><aside class="practice-card"><span class="eyebrow">YOUR CONVERSATION TOOLKIT</span><h2>Borrow a phrase.<br>Make it your own.</h2><div class="phrase-list" style="margin-top:24px">${t.phrases.map(p=>`<span>${p}</span>`).join('')}</div><div class="detail-section" style="margin-top:26px"><h3>Try this rhythm</h3><p class="muted">Read the prompt. Speak for 30–60 seconds. Try again with one of these phrases.</p></div><details><summary>中文提示</summary><p>先开口表达，再记录。可以用简单句，不用等到所有单词都想好。把你的回答发到聊天里，我们一起修改。</p></details></aside></div>`;}
const listeningPlayer=new DaylightListening.Player({
 lessons:[...DaylightListeningLibrary].sort((a,b)=>Number(a.source.kind==='synthetic')-Number(b.source.kind==='synthetic')),initialLessonId:'voa-bottom-line',
 getProgress:id=>state.listening?.[id],
 onProgress:(id,progress)=>{state.listening||={};const previous=state.listening[id]||{seconds:0};state.listening[id]={seconds:previous.seconds+progress.seconds,position:progress.position,completed:progress.completed,updatedAt:new Date().toISOString()};save();},
 getClip:text=>speechClip(text),
 onPlaybackStart:()=>stopAudio(),
 getSavedWord:word=>state.words.find(w=>DaylightListening.normalize(w.word)===DaylightListening.normalize(word)),
 onSpeakWord:(word,button)=>sayWord(word,button),
 onPractice:()=>{activity().practices++;save();toast('Listening practice recorded.');},
 onAddWord:({word,card,sentence,lesson})=>{
  if(state.words.some(w=>DaylightListening.normalize(w.word)===DaylightListening.normalize(word)))return;
  const entry={...card,word,id:`w-${crypto.randomUUID()}`,status:'new',due:dateKey(),reviews:0,createdAt:dateKey(),source:`Listening · ${lesson.title}\n${sentence}`,listeningSource:{lessonId:lesson.id,title:lesson.title,kind:lesson.source.kind,sourceUrl:lesson.source.url,accent:lesson.source.accent}};
  try{validateBackup({...state,words:[...state.words,entry]});state.words.push(entry);save();toast(`“${word}” added to your vocabulary.`);}catch{toast('The word details were incomplete. Please try the lookup again.');}
 }
});
function listeningView(){return heading('','Listening','Choose a scene, level, or speaker origin.')+listeningPlayer.view();}

function wordDetails(w){return `<div class="modal-heading">${tag(w)}<button class="icon-button" data-close aria-label="Close word details">×</button></div><h2 class="detail-word">${esc(w.word)}</h2><div class="detail-pronunciation"><span class="ipa">${esc(w.ipa||'IPA to add')} · ${esc(w.pos||'Part of speech to add')}</span><button class="audio-button" data-say-word="${w.id}" aria-label="Hear ${esc(w.word)} pronounced" title="${contextWords.has(w.word.toLowerCase())?'Hear this word in its example sentence':'Play natural English audio'}">${speakerIcon} Play</button></div><p>${esc(w.meaning||'Your word is saved. Generate a card to discover its meaning and useful phrases.')}</p>${w.zh?`<details><summary>中文释义</summary><p>${esc(w.zh)}</p></details>`:''}<div class="detail-section" style="margin-top:20px"><h3>Where it fits</h3><span class="tag">${esc(w.register)}</span><p class="muted" style="margin-top:10px">${esc(w.usage||'Usage notes can be added as you learn.')}</p></div>${w.otherMeaning?`<div class="detail-section"><h3>Another everyday meaning</h3><p>${esc(w.otherMeaning)}</p></div>`:''}<div class="detail-section"><h3>Learn it in chunks</h3><div class="phrase-list">${w.phrases.length?w.phrases.map(p=>`<span>${esc(p)}</span>`).join(''):'<p class="muted">Common phrases to add.</p>'}</div></div>${w.example?`<div class="detail-section"><h3>In a real conversation</h3><p class="example">“${esc(w.example)}”</p><button class="audio-button" data-say-example="${w.id}">${speakerIcon} Listen to the sentence</button></div>`:''}<div class="detail-section"><h3>Make it yours</h3><p>${esc(w.prompt||`Try using “${w.word}” in a sentence about your day.`)}</p><p class="notice">Say it out loud, then share your sentence in our chat.</p></div>${w.source?`<p class="notice">Source: ${esc(w.source)}</p>`:''}${w.status==='pending'?`<div class="capture-note">This word is saved. Generate its learning details whenever you’re ready. <button class="button primary" data-generate="${w.id}">Generate card ↗</button></div>`:''}<div class="modal-actions"><button class="subtle-link danger" data-delete="${w.id}">Delete word</button><button class="button secondary" data-edit="${w.id}">Edit card</button><button class="button primary" data-practise="${w.id}" ${w.status==='pending'?'disabled':''}>Practise this word ↗</button></div>`;}
function openWord(id){const w=state.words.find(w=>w.id===id);if(!w)return;$('#detail-dialog').dataset.wordId=id;$('#detail-dialog').innerHTML=wordDetails(w);$('#detail-dialog').showModal();}
function addWord(id=null){editingId=id;const form=$('#word-form');form.reset();form.hidden=false;$('#word-save-result').hidden=true;$('#word-save-result').innerHTML='';delete $('#word-save-result').dataset.wordId;$('#word-dialog-title').textContent=id?'Make this word your own':'Capture a new word';if(id){const w=state.words.find(w=>w.id===id);for(const name of ['word','ipa','pos','category','register','meaning','zh','example','source'])form.elements[name].value=w[name]||'';form.elements.phrases.value=w.phrases.join('; ');}$('#word-details-fields').open=Boolean(id);$('#word-dialog').showModal();}
const generationJobs=new Map();
function showSaveResult(entry){
 $('#word-form').hidden=true;
 const result=$('#word-save-result');result.hidden=false;result.dataset.wordId=entry.id;
 return result;
}
function renderGenerationLoading(entry,container){
 container.setAttribute('aria-busy','true');
 container.innerHTML=`<div class="modal-heading"><span class="eyebrow">YOUR WORD IS SAVED</span><button class="icon-button" data-close aria-label="Close word card">×</button></div><div class="generation-state" role="status" aria-live="polite"><span class="loading-spinner" aria-hidden="true"></span><h2>Getting to know “${esc(entry.word)}”…</h2><p class="muted">Preparing pronunciation, meanings, useful phrases, and an example for you.</p><p class="notice">You can keep this open or close it whenever you like. Your card will stay in your collection.</p></div>`;
 container.querySelector('[data-close]').focus();
}
function renderGenerationError(entry,container,message){
 container.removeAttribute('aria-busy');
 container.innerHTML=`<div class="modal-heading"><span class="eyebrow">SAVED · DETAILS NOT READY YET</span><button class="icon-button" data-close aria-label="Close word card">×</button></div><h2 class="detail-word">${esc(entry.word)}</h2><div class="capture-note" role="alert">${esc(message)}</div><p class="notice">Your word and original sentence are kept. This window will stay open until you close it.</p><div class="modal-actions"><button class="button secondary" data-edit="${entry.id}">Edit word</button><button class="button primary" data-generate="${entry.id}">Try again ↻</button></div>`;
}
async function generateWord(entry,container){
 const accountId=DaylightAccount.user?.id;renderGenerationLoading(entry,container);
 try{
  let job=generationJobs.get(entry.id);
  if(!job){
   job=(async()=>{
    const response=await fetch('/api/enrich',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({word:entry.word,source:entry.source||''}),signal:AbortSignal.timeout(90000)});
    let payload;try{payload=await response.json();}catch{throw Error('The word-card service is unavailable. Your word is saved; please try again.');}
    if(!response.ok)throw Error(payload.error||'The card could not be completed. Your word is saved; please try again.');
    const card=payload.card;
    const strings=['ipa','pos','category','register','meaning','zh','usage','example','prompt','otherMeaning'];
    if(!card||strings.some(k=>typeof card[k]!=='string')||!card.meaning.trim()||!['Everyday','Product & Work','IELTS'].includes(card.category)||!Array.isArray(card.phrases)||card.phrases.some(p=>typeof p!=='string'))throw Error('The learning details were incomplete. Your word is saved; please try again.');
    return Object.fromEntries([...strings,'phrases'].map(k=>[k,card[k]]));
   })();
   generationJobs.set(entry.id,job);
  }
  const card=await job;if(DaylightAccount.user?.id!==accountId)return;
  const live=state.words.find(w=>w.id===entry.id);
  // A closed window or deleted/edited word must not be reopened or replaced.
  if(!live||live.word!==entry.word||live.source!==entry.source)return;
  Object.assign(live,card,{status:live.status==='pending'?'new':live.status});save();render();
  if(container.dataset.wordId===entry.id&&container.closest('dialog')?.open){container.removeAttribute('aria-busy');container.innerHTML=wordDetails(live);container.querySelector('[data-close]').focus();}
  else toast(`“${live.word}” is ready in your vocabulary.`);
 }catch(error){
  if(DaylightAccount.user?.id!==accountId)return;
  const message=error.name==='TimeoutError'?'This is taking longer than expected. Your word is saved; please try again.':error.message==='Failed to fetch'?'Could not reach the word-card service. Your word is saved; please try again.':error.message;
  if(container.dataset.wordId===entry.id&&container.closest('dialog')?.open)renderGenerationError(entry,container,message);else toast('Your word is saved. Its learning details could not be completed yet.');
 }finally{if(DaylightAccount.user?.id===accountId)generationJobs.delete(entry.id);}
}
$('#word-form').addEventListener('submit',async e=>{
 e.preventDefault();const data=Object.fromEntries(new FormData(e.target));data.word=data.word.trim();data.source=data.source.trim();if(!data.word)return;
 const duplicate=state.words.find(w=>w.id!==editingId&&w.word.toLowerCase()===data.word.toLowerCase());
 if(duplicate){toast('That expression is already in your collection.');return;}
 data.phrases=data.phrases.split(/[;；]/).map(s=>s.trim()).filter(Boolean);
 const previous=state.words.find(w=>w.id===editingId);
 const needsGeneration=!previous||previous.status==='pending'||previous.word!==data.word||previous.source!==data.source;
 const entry={...previous,...data,id:editingId||`w-${crypto.randomUUID()}`,status:needsGeneration?'pending':previous.status,due:previous?.due||dateKey(),reviews:previous?.reviews||0,createdAt:previous?.createdAt||dateKey()};
 if(previous)state.words[state.words.indexOf(previous)]=entry;else state.words.push(entry);
 save();render();const container=showSaveResult(entry);
 if(needsGeneration)await generateWord(entry,container);else{container.removeAttribute('aria-busy');container.innerHTML=wordDetails(entry);container.querySelector('[data-close]').focus();}
});

function startReview(ids=null){reviewQueue=ids?state.words.filter(w=>ids.includes(w.id)&&w.status!=='pending'):dueWords();if(!reviewQueue.length){toast('No words are due. Add a meaning to new words, or open a card to practise anytime.');return;}reviewIndex=0;reviewResults=0;reviewRevealed=false;reviewRender();$('#review-dialog').showModal();}
function reviewRender(){const w=reviewQueue[reviewIndex];if(!w){$('#review-dialog').innerHTML=`<div class="modal-heading"><span class="eyebrow">A LITTLE MORE CONFIDENT</span><button class="icon-button" data-close aria-label="Close review">×</button></div><div class="review-complete"><span class="big-check">✓</span><h2>You showed up for your English.</h2><p class="muted">${reviewResults} expressions revisited. Keep one in mind for your next conversation.</p><button class="button primary" data-close>Back to your day ↗</button></div>`;return;}$('#review-dialog').innerHTML=`<div class="modal-heading"><span class="eyebrow">RECALL BEFORE YOU REVEAL</span><button class="icon-button" data-close aria-label="Close review">×</button></div><div class="review-progress"><div style="width:${reviewIndex/reviewQueue.length*100}%"></div></div><span class="muted">${reviewIndex+1} / ${reviewQueue.length}</span><p class="review-cue">${esc(w.meaning)}</p><p class="muted">Which word or expression fits? Say it out loud.</p>${reviewRevealed?`<div class="review-answer"><h2>${esc(w.word)} <button class="audio-button" data-say-word="${w.id}">${speakerIcon} Play</button></h2><span class="ipa">${esc(w.ipa)} · ${esc(w.pos)}</span><p style="margin:14px 0">${esc(w.example)}</p><div class="phrase-list">${w.phrases.slice(0,2).map(p=>`<span>${esc(p)}</span>`).join('')}</div><p class="notice">${esc(w.prompt||'Use this expression in a sentence about your life.')}</p></div><p class="notice">How did it feel? Rate after trying your own sentence.</p><div class="rating-buttons"><button class="button secondary" data-rate="again">Still learning · 1 day</button><button class="button secondary" data-rate="know">I recalled it · 3 days</button><button class="button primary" data-rate="use">I used it · 7 days</button></div>`:`<div style="padding:30px"><button class="button primary" data-action="reveal">Reveal expression ↗</button></div>`}`;}
function rateWord(rating){if(!reviewRevealed)return;const w=reviewQueue[reviewIndex];if(!w)return;w.status=rating==='use'?'usable':'learning';w.reviews++;const due=new Date();due.setDate(due.getDate()+({again:1,know:3,use:7}[rating]));w.due=dateKey(due);activity().reviews++;reviewResults++;reviewIndex++;reviewRevealed=false;save();render();reviewRender();}
let playbackId=0,currentAudio=null,currentAudioUrl=null;
const speechClipCache=new Map(),speechJobs=new Map();
function stopAudio(){
 playbackId++;
 if(currentAudio){currentAudio.pause();currentAudio.src='';currentAudio=null;}
 if(currentAudioUrl){URL.revokeObjectURL(currentAudioUrl);currentAudioUrl=null;}
 // Cancel any old browser speech left over from an earlier page version.
 window.speechSynthesis?.cancel();
}
function audioNote(button,text,isError=false){
 if(!button?.isConnected)return;
 const container=button.closest('dialog')||button.closest('section')||button.parentElement;
 let note=container.querySelector('.pronunciation-source');
 if(!note){note=document.createElement('p');note.className='notice pronunciation-source';(container.querySelector('.detail-pronunciation')||button).insertAdjacentElement('afterend',note);}
 note.textContent=text;note.setAttribute('role',isError?'alert':'status');note.classList.toggle('audio-error',isError);
}
async function speechClip(text){
 const accountId=DaylightAccount.user?.id;
 if(speechClipCache.has(text))return speechClipCache.get(text);
 if(speechJobs.has(text))return speechJobs.get(text);
 const job=(async()=>{
  const response=await fetch('/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text}),signal:AbortSignal.timeout(55000)});
  if(!response.ok){let body;try{body=await response.json();}catch{}throw Error(body?.error||'The recording could not load. Please try again.');}
  if(!response.headers.get('content-type')?.startsWith('audio/wav'))throw Error('The recording format is not supported. Please try again.');
  const blob=await response.blob();if(DaylightAccount.user?.id!==accountId)throw new DOMException('Account changed','AbortError');if(blob.size<44)throw Error('The recording was incomplete. Please try again.');
  if(speechClipCache.size>=60)speechClipCache.delete(speechClipCache.keys().next().value);
  speechClipCache.set(text,blob);return blob;
 })();speechJobs.set(text,job);try{return await job;}finally{if(speechJobs.get(text)===job)speechJobs.delete(text);}
}
async function say(text,rate=1,button=null,{inContext=false}={}){
 if(!text?.trim())return;
 listeningPlayer.pause();
 stopAudio();const id=playbackId;
 button?.setAttribute('aria-busy','true');button?.classList.add('audio-loading');
 audioNote(button,'Preparing natural English audio…');
 try{
  const blob=await speechClip(text);if(id!==playbackId)return;
  const url=URL.createObjectURL(blob);currentAudioUrl=url;
  const audio=new Audio(url);currentAudio=audio;audio.playbackRate=rate;audio.preservesPitch=true;
  audio.onerror=()=>{if(id===playbackId)audioNote(button,'This recording could not play. Please try again.',true);};
  await audio.play();if(id!==playbackId){audio.pause();return;}
  audioNote(button,`AI-generated English voice · DeepSeek Stella${inContext?' · This word is played in its example sentence.':''}`);
 }catch(error){
  if(id!==playbackId)return;
  const message=error.name==='TimeoutError'?'The voice service took too long. Please try again.':error.name==='NotAllowedError'?'The audio is ready. Tap the speaker again to play.':error.message;
  audioNote(button,message,true);toast(message);
 }finally{button?.removeAttribute('aria-busy');button?.classList.remove('audio-loading');}
}
function sayWord(word,button){
 const entry=typeof word==='string'?{word}:word;
 if(contextWords.has(entry.word.toLowerCase())&&!entry.example){audioNote(button,'This word has more than one pronunciation. Add an example sentence first so you can hear the intended meaning.',true);return;}
 const inContext=contextWords.has(entry.word.toLowerCase())&&Boolean(entry.example);
 return say(inContext?entry.example:entry.word,1,button,{inContext});
}

function updateTimer(){const elapsed=state.focus.day===dateKey()?state.focus.seconds:0;if($('#timer-value'))$('#timer-value').textContent=`${String(Math.floor(elapsed/60)).padStart(2,'0')}:${String(elapsed%60).padStart(2,'0')}`;if($('#focus-ring'))$('#focus-ring').style.background=`conic-gradient(#8ca471 ${Math.min(elapsed/3600,1)*360}deg,#edf0e6 0deg)`;if($('#timer-toggle'))$('#timer-toggle').textContent=timerRunning?'Pause':'Start focus';}
function toggleTimer(){if(timerRunning){clearInterval(timerInterval);timerRunning=false;save();}else{timerRunning=true;timerInterval=setInterval(()=>{if(state.focus.day!==dateKey())state.focus={day:dateKey(),seconds:0};state.focus.seconds++;sessionSeconds++;if(sessionSeconds%10===0)save();updateTimer();},1000);}updateTimer();}
function exportData(){listeningPlayer.sampleTime();listeningPlayer.flushProgress(true);const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`daylight-backup-${dateKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Backup exported. Keep it somewhere safe.');}
$('#export-data').onclick=exportData;
$('#import-data').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>5*1024*1024)throw Error('Too large');const imported=JSON.parse(await file.text());validateBackup(imported);if(!confirm(`Replace this browser’s collection with ${imported.words.length} words from the backup? Export your current data first if you want to keep it.`))return;listeningPlayer.resetAudio();listeningPlayer.completed.clear();state=imported;listeningPlayer.position=listeningPlayer.stats().position||0;if(state.focus.day!==dateKey())state.focus={day:dateKey(),seconds:0};save();render();toast('Your collection has been restored.');}catch(err){toast('Could not import this file. Choose a valid Daylight backup (under 5 MB).');}finally{e.target.value='';}});
document.addEventListener('click',e=>{const b=e.target.closest('button,[data-word]');if(!b)return;
 if(b.hasAttribute('data-close')){stopAudio();b.closest('dialog')?.close();return;}
 if(b.dataset.word){openWord(b.dataset.word);return;}
 if(b.dataset.category){category=b.dataset.category;render();renderWordGrid();return;}
 if(b.dataset.topic){activeTopic=b.dataset.topic;render();return;}
 if(b.dataset.edit){b.closest('dialog')?.close();addWord(b.dataset.edit);return;}
 if(b.dataset.generate){const entry=state.words.find(w=>w.id===b.dataset.generate);if(entry){const container=b.closest('#word-save-result')||$('#detail-dialog');container.dataset.wordId=entry.id;generateWord({...entry},container);}return;}
 if(b.dataset.delete){const w=state.words.find(w=>w.id===b.dataset.delete);if(w&&confirm(`Delete “${w.word}” from your collection?`)){state.words=state.words.filter(v=>v.id!==w.id);save();b.closest('dialog')?.close();render();toast('Word deleted.');}return;}
 if(b.dataset.practise){b.closest('dialog')?.close();startReview([b.dataset.practise]);return;}
 if(b.dataset.sayWord){const word=state.words.find(w=>w.id===b.dataset.sayWord);if(word)sayWord(word,b);return;}
 if(b.dataset.sayExample){say(state.words.find(w=>w.id===b.dataset.sayExample)?.example||'',1,b);return;}
 if(b.dataset.rate){rateWord(b.dataset.rate);return;}
 switch(b.dataset.action){case 'add':addWord();break;case 'review':startReview();break;case 'reveal':reviewRevealed=true;reviewRender();break;case 'timer':toggleTimer();break;case 'timer-reset':if(confirm('Reset today’s focus timer to zero?')){state.focus={day:dateKey(),seconds:0};save();updateTimer();}break;case 'say-phrase':say('Could you walk me through it?',1,b);break;case 'speak-example':say(speakingTopics[activeTopic].example,1,b);break;case 'stop-audio':stopAudio();break;case 'speaking-done':case 'listening-done':activity().practices++;save();toast('Practice recorded. A little more confident.');break;case 'export':exportData();break;case 'import':$('#import-data').click();break;}
});
window.addEventListener('hashchange',()=>{stopAudio();if(location.hash!=='#listening')listeningPlayer.leave();if(location.hash!=='#speaking'&&voiceCall.active)voiceCall.end(false);render();window.scrollTo(0,0);});
window.addEventListener('pagehide',()=>{save();stopAudio();voiceCall.end(false);listeningPlayer.destroy();DaylightAccount.flush(true);});
$$('dialog').forEach(dialog=>dialog.addEventListener('close',stopAudio));
DaylightAccount.start({
 read:()=>state,
 fresh:()=>({version:1,words:structuredClone(seed),activity:{},drafts:{},focus:{day:dateKey(),seconds:0},listening:{}}),
 validate:validateBackup,
 apply:data=>{validateBackup(data);$('#word-form').reset();$('#word-save-result').innerHTML='';$('#detail-dialog').innerHTML='';$('#review-dialog').innerHTML='';$('#account-dialog').innerHTML='';editingId=null;voiceCall.clearPrivateState();listeningPlayer.resetAudio();listeningPlayer.lookupCard=null;listeningPlayer.lookupToken=null;state=structuredClone(data);if(state.focus.day!==dateKey())state.focus={day:dateKey(),seconds:0};listeningPlayer.completed.clear();listeningPlayer.lookupCache.clear();listeningPlayer.libraryOpen=true;listeningPlayer.position=listeningPlayer.stats().position||0;query='';category='All words';statusFilter='all';reviewQueue=[];render();},
 stop:()=>{clearInterval(timerInterval);timerRunning=false;stopAudio();voiceCall.end(false);listeningPlayer.destroy();generationJobs.clear();speechJobs.clear();speechClipCache.clear();},
 sample:()=>{listeningPlayer.sampleTime();listeningPlayer.flushProgress(true);}
});


setInterval(updateTodayDate,30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateTodayDate();});
