(function(root){
 const P=root.SpeakiLibraryProgress,escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const names={A1:'Beginner',A2:'Elementary',B1:'Intermediate',B2:'Upper intermediate'};
 const posLabel=P.posLabel;
 const speaker='<svg class="speaker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14"/></svg>';
 class WordLibrary{
  constructor(options){Object.assign(this,options);this.catalog=null;this.catalogJob=null;this.catalogController=null;this.catalogEpoch=0;this.cardController=null;this.token=0;this.loading=false;this.error='';this.reset();}
  data(){return this.getData()||{level:'A1',progress:{}};}
  progress(){return this.data().progress||{};}
  stats(level){const entries=this.catalog?.entries.filter(e=>e.level===level)||[],progress=this.progress();return {total:entries.length,studied:entries.filter(e=>progress[e.id]).length,mastered:entries.filter(e=>progress[e.id]?.status==='mastered').length,due:entries.filter(e=>P.due(progress,e.id)).length};}
  dueCount(){return Object.values(this.progress()).filter(item=>item.due<=P.day()).length;}
  sourceView(){return `<details class="word-library-source"><summary>Word list source</summary><p>CEFR-J Wordlist v1.6 · Compiled by Yukio Tono, Tokyo University of Foreign Studies. Levels and parts of speech follow the source; alternative spellings are grouped together.</p><p>Learning cards use AI-generated explanations and original examples. They are not official CEFR-J definitions.</p><a href="https://cefr-j.org/download.html" target="_blank" rel="noopener noreferrer">Source & usage terms ↗</a></details>`;}
  view(){
   if(!this.catalog)return `<section id="word-library"><div class="library-loading" role="status">${this.error?`<p>${escape(this.error)}</p><button class="button secondary" data-library-action="retry-catalog">Try again</button>`:'Loading word libraries…'}</div></section>`;
   if(!this.level)return `<section id="word-library"><p class="word-library-intro">Choose your level. Your progress is saved to your account.</p><div class="word-levels">${P.levels.map(level=>{const stats=this.stats(level);return `<button class="word-level" data-library-level="${level}"><div><strong>${level}</strong><span>${names[level]}</span></div><span class="word-level-count">${stats.total.toLocaleString('en-US')} entries</span><progress max="${stats.total}" value="${stats.studied}" aria-label="${level} studied entries"></progress><small>${stats.studied} studied · ${stats.mastered} mastered</small><span class="word-level-arrow" aria-hidden="true">↗</span></button>`;}).join('')}</div>${this.sourceView()}</section>`;
   return `<section id="word-library"><div class="word-level-header"><button class="text-button" data-library-action="levels">← All levels</button><h2>${this.level} <span>${names[this.level]}</span></h2></div><div class="word-level-summary">${this.summaryView()}</div><div class="word-library-toolbar"><label class="search-box"><span aria-hidden="true">⌕</span><input id="library-search" type="search" aria-label="Search word library" placeholder="Search this level…" value="${escape(this.query)}"></label><label class="word-library-status">Progress<select id="library-status" aria-label="Filter library learning progress">${[['all','All words'],['new','Not started'],['learning','Learning'],['mastered','Mastered'],['due','Due for review']].map(([value,label])=>`<option value="${value}" ${this.filter===value?'selected':''}>${label}</option>`).join('')}</select></label></div><div id="library-results">${this.resultsView()}</div>${this.sourceView()}</section>`;
  }
  summaryView(){const s=this.stats(this.level);return `<div><strong>${s.studied} / ${s.total.toLocaleString('en-US')}</strong><span>studied · ${s.mastered} mastered</span></div><div class="library-study-actions">${s.due?`<button class="button secondary" data-library-action="review">Review ${s.due}</button>`:''}<button class="button primary" data-library-action="study">Study next</button></div>`;}
  filtered(){const query=this.query.trim().toLowerCase(),progress=this.progress();return this.catalog.entries.filter(e=>e.level===this.level&&(!query||[e.word,...(e.aliases||[])].some(word=>word.toLowerCase().includes(query)))&&(this.filter==='all'||(this.filter==='due'?P.due(progress,e.id):P.status(progress,e.id)===this.filter)));}
  resultsView(){
   const rows=this.filtered(),pages=Math.max(1,Math.ceil(rows.length/40));this.page=Math.max(1,Math.min(this.page,pages));const progress=this.progress(),shown=rows.slice((this.page-1)*40,this.page*40);
   return `<div class="word-library-result-count">${rows.length.toLocaleString('en-US')} entries${rows.length?` · ${(this.page-1)*40+1}–${Math.min(this.page*40,rows.length)}`:''}</div><div class="word-library-list">${shown.map(e=>{const s=P.status(progress,e.id),due=P.due(progress,e.id);return `<button class="word-library-row" data-library-word="${e.id}"><span class="library-word-name"><strong>${escape(e.word)}</strong><small>${escape(posLabel(e.pos))}${e.aliases?.length?' · '+escape(e.aliases.join(' / ')):''}</small></span><span class="library-word-status ${s}">${due?'Due for review':s==='new'?'Not started':s==='mastered'?'Mastered':'Learning'}</span><span class="library-row-arrow" aria-hidden="true">↗</span></button>`;}).join('')||'<p class="word-library-empty">No words match these filters.</p>'}</div>${pages>1?`<div class="word-library-pagination"><button class="button secondary" data-library-action="previous" ${this.page===1?'disabled':''}>Previous</button><span>Page ${this.page} of ${pages}</span><button class="button secondary" data-library-action="next-page" ${this.page===pages?'disabled':''}>Next</button></div>`:''}`;
  }
  mount(){
   this.host=document.querySelector('#word-library');if(!this.host)return;
   this.host.onclick=event=>{
    const b=event.target.closest('button');if(!b)return;
    if(b.dataset.libraryLevel){this.level=b.dataset.libraryLevel;this.query='';this.filter='all';this.page=1;this.onChange({...this.data(),level:this.level});this.paint();return;}
    if(b.dataset.libraryWord){this.open(b.dataset.libraryWord);return;}
    const action=b.dataset.libraryAction;
    if(action==='retry-catalog')this.load();if(action==='levels'){this.level=null;this.paint();}if(action==='study')this.start();if(action==='review')this.start(true);if(action==='previous'){this.page--;this.paintResults();this.host.querySelector('.word-library-toolbar')?.scrollIntoView({block:'start'});}if(action==='next-page'){this.page++;this.paintResults();this.host.querySelector('.word-library-toolbar')?.scrollIntoView({block:'start'});}
   };
   const search=this.host.querySelector('#library-search');if(search)search.oninput=e=>{this.query=e.target.value;this.page=1;this.paintResults();};
   const filter=this.host.querySelector('#library-status');if(filter)filter.onchange=e=>{this.filter=e.target.value;this.page=1;this.paintResults();};
   root.SpeakiControls?.refresh(this.host);
   if(!this.catalog&&!this.loading&&!this.error)this.load();
  }
  async load(){
   if(this.catalog)return this.catalog;if(this.catalogJob)return this.catalogJob;
   const owner=this.getOwner(),epoch=++this.catalogEpoch;this.catalogController=new AbortController();this.loading=true;this.error='';if(this.host?.isConnected)this.paint();
   const job=(async()=>{try{const response=await fetch('/api/word-library',{signal:this.catalogController.signal});if(!response.ok)throw Error('The word library could not load. Please try again.');const data=await response.json();if(epoch!==this.catalogEpoch||owner!==this.getOwner())return null;if(!Array.isArray(data.entries)||!data.source||!data.entries.every(e=>P.idPattern.test(e.id)&&P.levels.includes(e.level)))throw Error('The word library data could not be read.');this.catalog=data;return data;}catch(error){if(epoch===this.catalogEpoch&&owner===this.getOwner()&&error.name!=='AbortError')this.error=error.message;return null;}finally{if(epoch===this.catalogEpoch){this.loading=false;this.catalogJob=null;this.catalogController=null;if(this.host?.isConnected)this.paint();}}})();
   this.catalogJob=job;return job;
  }
  paint(){const host=document.querySelector('#word-library');if(!host)return;host.outerHTML=this.view();this.mount();}
  paintResults(){const results=this.host?.querySelector('#library-results');if(results)results.innerHTML=this.resultsView();const summary=this.host?.querySelector('.word-level-summary');if(summary)summary.innerHTML=this.summaryView();}
  async start(review=false,allLevels=false){
   const owner=this.getOwner();if(!this.catalog)await this.load();if(!this.catalog||owner!==this.getOwner())return;
   const progress=this.progress(),base=this.catalog.entries.filter(e=>allLevels||e.level===(this.level||this.data().level));
   const due=base.filter(e=>P.due(progress,e.id)).sort((a,b)=>progress[a.id].due.localeCompare(progress[b.id].due));
   const fresh=base.filter(e=>!progress[e.id]);this.queue=(review?due:[...due,...fresh]).slice(0,20).map(e=>e.id);
   if(!this.queue.length){this.notify(review?'No words are due for review.':'You’re up to date. Browse a word to practise anytime.');return;}
   this.sessionIndex=0;this.openCard(this.queue[0]);
  }
  open(id){const entry=this.catalog.entries.find(e=>e.id===id);if(!entry)return;this.queue=[id];this.sessionIndex=0;this.openCard(id);}
  async openCard(id){
   this.stopAudio();this.cardController?.abort();const token=++this.token,owner=this.getOwner();this.entry=this.catalog.entries.find(e=>e.id===id);if(!this.entry)return;
   this.card=null;this.cardError='';this.rated=false;this.loadingCard=true;this.cardController=new AbortController();this.paintCard();
   const dialog=document.querySelector('#library-word-dialog');if(!dialog.open)dialog.showModal();
   try{
    const signal=this.cardController.signal;let response=await fetch('/api/word-library/'+id,{signal});let result=await response.json();
    if(!response.ok)throw Error(result.error||'The word card could not load.');
    if(token!==this.token||owner!==this.getOwner()||!dialog.open)return;
    if(!result.card){response=await fetch('/api/word-library/'+id,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal});result=await response.json();if(!response.ok)throw Error(result.error||'The word card could not be prepared.');}
    if(token!==this.token||owner!==this.getOwner()||!dialog.open)return;
    if(result.entry?.id!==id||!result.card?.meaning||!Array.isArray(result.card.phrases))throw Error('The word card could not be read.');this.card=result.card;
   }catch(error){if(token===this.token&&owner===this.getOwner()&&error.name!=='AbortError')this.cardError=error.message;}finally{if(token===this.token&&owner===this.getOwner()){this.loadingCard=false;if(dialog.open)this.paintCard();}}
  }
  paintCard(){
   const dialog=document.querySelector('#library-word-dialog'),entry=this.entry;if(!entry||!dialog)return;
   const c=this.card,progress=this.progress()[entry.id],owner=this.getOwner();
   dialog.innerHTML=`<div class="modal-heading"><span class="tag">${entry.level} · Word library</span>${this.queue.length>1?`<span class="library-session-position">${this.sessionIndex+1} / ${this.queue.length}</span>`:''}<button class="icon-button" data-library-close aria-label="Close library word">×</button></div><h2 class="detail-word">${escape(entry.word)}</h2><div class="library-card-pos">${escape(posLabel(entry.pos))}${entry.aliases?.length?' · '+escape(entry.aliases.join(' / ')):''}</div>${this.loadingCard?'<div class="library-card-loading" role="status"><span class="loading-spinner" aria-hidden="true"></span><p>Preparing your learning card…</p></div>':this.cardError?`<p class="capture-note" role="alert">${escape(this.cardError)}</p><button class="button primary" data-library-retry>Try again</button>`:c?`<div class="detail-pronunciation"><span class="ipa">${escape(c.ipa)}</span><button class="audio-button" data-library-play>${speaker} Play</button></div><p class="library-card-meaning">${escape(c.meaning)}</p><details><summary>中文释义</summary><p>${escape(c.zh)}</p></details><div class="detail-section"><h3>Common phrases</h3><div class="phrase-list">${c.phrases.map(p=>`<span>${escape(p)}</span>`).join('')}</div></div><div class="detail-section"><h3>Example</h3><p class="example">${escape(c.example)}</p><button class="audio-button" data-library-example>${speaker} Listen</button></div><div class="detail-section"><h3>Usage</h3><p>${escape(c.register)} · ${escape(c.usage)}</p></div><div class="library-rating-buttons" aria-label="Rate this word"><button class="button secondary" data-library-rate="again" ${this.rated?'disabled':''}>Again · 1 day</button><button class="button secondary" data-library-rate="know" ${this.rated?'disabled':''}>Remembered · 3 days</button><button class="button primary" data-library-rate="use" ${this.rated?'disabled':''}>Can use · 7 days</button></div>${this.rated?`<p class="library-next-due" role="status">Review scheduled for ${escape(progress.due)}.</p>`:''}<div class="library-card-actions"><button class="text-button" data-library-save ${this.hasSaved(entry)?'disabled':''}>${this.hasSaved(entry)?'Added to My words':'＋ Add to My words'}</button>${this.queue.length>1?`<button class="button secondary" data-library-next>${this.sessionIndex+1<this.queue.length?'Next word ↗':'Finish'}</button>`:''}</div>`:''}`;
   dialog.querySelector('[data-library-close]').onclick=()=>dialog.close();dialog.onclose=()=>this.closeStudy();
   const retry=dialog.querySelector('[data-library-retry]');if(retry)retry.onclick=()=>this.openCard(entry.id);
   dialog.querySelectorAll('[data-library-rate]').forEach(b=>b.onclick=()=>{if(this.rated||owner!==this.getOwner())return;const data=this.data(),next=P.rate(data.progress[entry.id],b.dataset.libraryRate);this.onChange({...data,progress:{...data.progress,[entry.id]:next}});this.onReview();this.rated=true;this.paintResults();this.paintCard();});
   const play=dialog.querySelector('[data-library-play]');if(play)play.onclick=()=>this.speak({...c,word:entry.word,inContext:this.catalog.entries.some(other=>other.word.toLowerCase()===entry.word.toLowerCase()&&other.pos!==entry.pos)},play);
   const example=dialog.querySelector('[data-library-example]');if(example)example.onclick=()=>this.speakExample(c.example,example);
   const save=dialog.querySelector('[data-library-save]');if(save)save.onclick=()=>{if(owner!==this.getOwner())return;this.onSave(entry,c);save.disabled=this.hasSaved(entry);save.textContent=save.disabled?'Added to My words':'＋ Add to My words';};
   const next=dialog.querySelector('[data-library-next]');if(next)next.onclick=()=>{if(owner!==this.getOwner())return;if(++this.sessionIndex>=this.queue.length)dialog.close();else this.openCard(this.queue[this.sessionIndex]);};
  }
  closeStudy(){const hadCard=Boolean(this.entry||this.cardController);this.token++;this.cardController?.abort();this.cardController=null;this.entry=null;this.card=null;this.cardError='';this.loadingCard=false;if(hadCard)this.stopAudio();}
  stop(){const dialog=document.querySelector('#library-word-dialog');if(dialog?.open)dialog.close();this.closeStudy();this.catalogEpoch++;this.catalogController?.abort();this.catalogController=null;this.catalogJob=null;this.loading=false;}
  reset(){this.stop();this.host=null;this.level=null;this.query='';this.filter='all';this.page=1;this.queue=[];this.sessionIndex=0;this.error='';}
 }
 root.SpeakiWordLibrary=WordLibrary;
})(globalThis);
