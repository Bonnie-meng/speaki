(function(root){
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const mic='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>';
 const phone='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 3H3a1 1 0 0 0-1 1c0 10 8 18 18 18a1 1 0 0 0 1-1v-3l-5-2-2 2a15 15 0 0 1-8-8l2-2-2-5Z"/></svg>';
 const topics={everyday:{title:'Everyday life',opening:'Hi! I’m Stella. Let’s have a relaxed chat. What was the best part of your day?'},meeting:{title:'Product & work',opening:'Hi! Let’s practise a product meeting. What is one problem your team is trying to solve?'},ielts:{title:'IELTS warm-up',opening:'Hi! Let’s warm up with a short speaking question. What do you enjoy about your work?'}};
 class VoiceCall{
  constructor({onSave=()=>{},onPractice=()=>{},onAudioStart=()=>{}}={}){
   Object.assign(this,{onSave,onPractice,onAudioStart,scenario:'meeting',active:false,status:'idle',epoch:0,messages:[],feedback:null,assessment:null,config:{assessment:false},assessEnabled:false,muted:false,draft:'',error:'',started:0,elapsed:0,turns:0,practiceTarget:'',lastClip:null,recording:false,feedbackOpen:false,showTyping:false});
   this.detector=new root.DaylightVoiceUtils.TurnDetector();this.requests=new Set();this.pendingTurn=null;
  }
  view(){
   const labels={idle:'Ready when you are',connecting:'Connecting…',listening:'Listening to you',thinking:'Preparing a reply…',speaking:'Stella’s turn',muted:'Microphone muted',ready:'Ready for your message',ended:'Call ended',paused:'Paused — your reply is kept'};
   const feedback=this.feedback,assessment=this.assessment;
   const transcript=this.messages.map((m,i)=>`<div class="call-message ${m.role}"><div class="call-message-label">${m.role==='user'?'You':'Stella'}${m.practice?' · Read-aloud':''}</div><p>${escape(m.content)}</p>${m.role==='assistant'?`<button class="text-button" data-call="replay" data-index="${i}" aria-label="Replay Stella’s message">↻ Replay</button>`:''}</div>`).join('');
   const scores=assessment?['accuracy','fluency','prosody'].filter(k=>assessment[k]!==null).map(k=>`<div><strong>${Math.round(assessment[k])}<small>/100</small></strong><span>${k[0].toUpperCase()+k.slice(1)}</span></div>`).join(''):'';
   const words=assessment?.words.filter(w=>w.accuracy!==null&&(w.accuracy<70||w.error!=='None')).slice(0,5)||[];
   const coaching=`<section class="practice-card"><span class="eyebrow">ONE USEFUL CHANGE AT A TIME</span><h2>A little coaching.</h2>${feedback?.correction?`<div class="correction-before"><small>You said</small><p>${escape(feedback.correction.original)}</p></div><div class="correction-after"><small>Try this</small><p>${escape(feedback.correction.better)}</p></div><p class="coach-why">${escape(feedback.correction.why)}</p><button class="button secondary" data-call="listen-correction">Listen to this expression</button>`:`<p class="muted">${this.turns?'No wording change suggested for your last turn. Keep the conversation going.':'After your turn, you’ll see one useful grammar or wording suggestion here.'}</p>`}<p class="notice">Expression feedback comes from recognised text. You can type a correction if the transcript is wrong.</p></section><section class="practice-card"><span class="eyebrow">LISTEN. SAY IT AGAIN.</span><h3>Pronunciation practice</h3>${feedback?.practice?`<p class="practice-word">${escape(feedback.practice.word)}</p><p class="muted">${escape(feedback.practice.tip)}</p>`:'<p class="muted">Listen to a short model sentence, then try it in your own voice.</p>'}${this.practiceTarget?`<p class="call-reference">${escape(this.practiceTarget)}</p>`:''}<button class="button secondary" data-call="practice" ${!this.active||this.status==='thinking'?'disabled':''}>Listen & repeat</button>${this.lastClip?'<button class="text-button" data-call="hear-self">Hear your last recording</button>':''}<p class="notice">Practice tips are suggestions, not detected pronunciation errors.</p></section><section class="practice-card assessment-card"><span class="eyebrow">FEEDBACK FROM YOUR RECORDING</span><h3>Pronunciation assessment</h3>${this.config.assessment?`<label class="check-line"><input id="call-assessment" type="checkbox" ${this.assessEnabled?'checked':''}>Assess my recorded turns with Azure Speech</label><p class="notice">When enabled, your recording and reference text are also sent to Azure. Scores are automated estimates, not an IELTS band.</p>`:'<p class="muted">Not connected yet. Conversation and listen-and-repeat practice are available.</p><a class="text-button" href="https://speech.microsoft.com/portal/pronunciationassessmenttool" target="_blank" rel="noopener noreferrer">Try Azure pronunciation assessment ↗</a><p class="notice">Your current speech-to-text service does not assess pronunciation. No pronunciation score is inferred from a transcript.</p>'}${assessment?`<div class="pronunciation-scores">${scores}</div><p class="notice">Azure Speech · ${escape(assessment.referenceBasis)}</p><p class="notice">Reference: ${escape(assessment.reference)}</p>${words.length?'<h3>Words to revisit</h3>'+words.map(w=>`<div class="assessed-word"><b>${escape(w.word)}</b><span>${Math.round(w.accuracy)}/100</span>${w.phonemes.filter(p=>p.accuracy!==null&&p.accuracy<70).slice(0,4).map(p=>`<small>${escape(p.phoneme)} · ${Math.round(p.accuracy)}</small>`).join('')}</div>`).join(''):''}`:''}</section>`;
   const controls=!this.active?`<button class="button primary" data-call="start">${phone} Start voice call</button>`:`<button class="call-round ${this.muted?'is-muted':''}" data-call="mute" aria-label="${this.muted?'Unmute microphone':'Mute microphone'}">${mic}<span>${this.muted?'Unmute':'Mute'}</span></button><button class="call-round hangup" data-call="end" aria-label="End voice call">${phone}<span>Hang up</span></button>${this.status==='speaking'?'<button class="call-quiet-button" data-call="interrupt">Interrupt</button>':''}${this.status==='listening'?'<button class="call-quiet-button" data-call="finish">Done speaking</button>':''}`;
   const typing=this.active&&this.showTyping;
   return `<div id="voice-call-shell" class="${this.active?'is-active':'is-idle'}" role="${this.active?'dialog':'region'}" ${this.active?'aria-modal="true"':''} aria-label="English conversation with Stella">
    <section class="call-workspace">
     <header class="call-header">
      <div class="call-identity"><span class="call-avatar-mini" aria-hidden="true">S</span><div><h2>Stella</h2><p id="call-state" role="status" aria-live="polite">${labels[this.status]||this.status}</p></div></div>
      ${this.active?`<span class="call-topic-label">${topics[this.scenario].title}</span>`:`<select id="call-scenario" aria-label="Conversation scenario">${Object.entries(topics).map(([k,t])=>`<option value="${k}" ${k===this.scenario?'selected':''}>${t.title}</option>`).join('')}</select>`}
      <span id="call-clock" class="call-clock">${this.clock()}</span>
      <button class="call-feedback-toggle ${this.feedbackOpen?'selected':''}" data-call="feedback" aria-expanded="${this.feedbackOpen}" aria-controls="call-feedback-panel">Feedback${feedback?.correction||assessment?'<span class="feedback-dot" aria-label="Feedback available"></span>':''}</button>
     </header>
     ${!this.active&&!this.messages.length?'<div class="call-welcome"><h3>A little more you can say.</h3><p>Start a conversation. We’ll take it one turn at a time.</p></div>':''}
     ${this.error?`<div class="call-error" role="alert">${escape(this.error)}${this.active?`${this.pendingTurn?'<button class="text-button" data-call="retry">Retry this turn</button>':''}<button class="text-button" data-call="resume">Continue</button>`:''}</div>`:''}
     <div class="call-content">
      <div class="call-transcript" role="log" aria-label="Conversation transcript" aria-live="polite" aria-relevant="additions text" tabindex="0"><div class="call-feed">${transcript||'<div class="call-empty"><p>Your conversation will appear here.</p></div>'}</div></div>
      ${this.feedbackOpen?`<aside id="call-feedback-panel" class="call-feedback-drawer" aria-label="Conversation feedback"><div class="call-feedback-heading"><h3>Your feedback</h3><button class="icon-button" data-call="feedback" aria-label="Close feedback">×</button></div><div class="call-coaching">${coaching}</div></aside>`:''}
     </div>
     <footer class="call-footer">
      ${this.practiceTarget?`<p class="call-readalong"><span>Read aloud</span>${escape(this.practiceTarget)}</p>`:''}
      ${typing?`<form id="call-text-form" class="call-text-form"><label for="call-text-input" class="sr-only">Your message</label><input id="call-text-input" maxlength="2400" placeholder="Type your message…" value="${escape(this.draft)}" ${['connecting','thinking'].includes(this.status)?'disabled':''}><button class="button secondary" type="submit" ${['connecting','thinking'].includes(this.status)?'disabled':''}>Send ↗</button></form>`:''}
      <div class="call-bottom-bar"><span class="call-footer-hint">${this.active?(this.status==='listening'?'Speak naturally. Pause when you’re done.':'AI voice · Stella'):'AI voice · DeepSeek Stella'}</span><div class="call-controls">${controls}</div>${this.active?`<button class="call-quiet-button" data-call="typing" aria-expanded="${typing}">${typing?'Hide keyboard':'Type instead'}</button>`:''}</div>
      ${!this.active?`<details class="call-privacy"><summary>About voice practice</summary><p>Microphone access starts only when you call. Your spoken turns go to DeepSeek for recognition and replies. Audio is not saved to your notes.</p></details>${this.messages.length?'<div class="call-session-actions"><button class="text-button" data-call="save">Save conversation to my notes ↗</button></div>':''}`:''}
     </footer>
    </section>
   </div>`;
  }
  mount(){
   this.host=document.querySelector('#voice-call-shell');if(!this.host)return;
   this.syncFocusMode();this.bind();this.followLatest();if(!this.configLoaded){this.configLoaded=true;fetch('/api/voice/config').then(r=>r.json()).then(c=>{this.config=c;this.paint();}).catch(()=>{});}
  }
  bind(){
   this.host.onclick=e=>{const b=e.target.closest('[data-call]');if(!b)return;const action=b.dataset.call;
    if(action==='feedback'){this.feedbackOpen=!this.feedbackOpen;this.paint();}if(action==='typing'){this.showTyping=!this.showTyping;this.paint();this.host?.querySelector('#call-text-input')?.focus();}if(action==='start')this.start();if(action==='end')this.end();if(action==='mute')this.toggleMute();if(action==='finish')this.finish();if(action==='interrupt')this.interrupt();if(action==='resume')this.resume();if(action==='retry')this.retry();if(action==='replay')this.speak(this.messages[Number(b.dataset.index)]?.content);if(action==='save')this.save();if(action==='listen-correction')this.speak(this.feedback?.correction?.better);if(action==='practice')this.practice();if(action==='hear-self'&&this.lastClip)this.playBlob(this.lastClip,true).catch(e=>{this.error=e.message;this.status='paused';this.paint();});
   };
   const scenario=this.host.querySelector('#call-scenario');if(scenario)scenario.onchange=e=>{if(!this.active){this.scenario=e.target.value;this.paint();}};
   const form=this.host.querySelector('#call-text-form');if(form)form.onsubmit=e=>{e.preventDefault();const text=this.draft.trim();if(!text||!this.active||this.status==='thinking')return;this.draft='';this.textTurn(text);};
   const input=this.host.querySelector('#call-text-input');if(input)input.oninput=e=>{this.draft=e.target.value;};
   const checkbox=this.host.querySelector('#call-assessment');if(checkbox)checkbox.onchange=e=>{this.assessEnabled=e.target.checked;};
  }
  syncFocusMode(){
   document.body?.classList?.toggle('voice-call-active',this.active);
   for(const element of document.querySelectorAll?.('.sidebar,.topbar,.main-footer,.speaking-notebook,#app>.page-heading')||[])element.inert=this.active;
  }
  followLatest(){
   const log=this.host?.querySelector('.call-transcript'),feed=this.host?.querySelector('.call-feed');if(!log)return;
   const scroll=()=>{if(log.isConnected===false)return;log.scrollTop=log.scrollHeight;};
   // Scroll after layout, not while newly replaced DOM is still being measured.
   const frame=root.requestAnimationFrame||((fn)=>setTimeout(fn,0));frame(()=>{scroll();frame(scroll);});
   this.resizeObserver?.disconnect();
   if(root.ResizeObserver&&feed){this.resizeObserver=new ResizeObserver(scroll);this.resizeObserver.observe(feed);}
  }
  paint(){
   const host=document.querySelector('#voice-call-shell');if(!host)return;
   const input=host.querySelector('#call-text-input'),focus=input===document.activeElement,selection=input?.selectionStart;
   host.outerHTML=this.view();this.mount();
   if(focus){const next=this.host?.querySelector('#call-text-input');next?.focus({preventScroll:true});if(next)next.setSelectionRange(selection,selection);}
  }
  clock(){const seconds=this.active?Math.floor((Date.now()-this.started)/1000):this.elapsed;return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
  async request(url,options={}){
   const controller=new AbortController();this.requests.add(controller);const timeout=setTimeout(()=>controller.abort(),60000);
   try{const response=await fetch(url,{...options,signal:controller.signal});if(!response.ok){let error;try{error=await response.json();}catch{}throw Error(error?.error||'The connection could not complete this turn. Please try again.');}return response;}finally{clearTimeout(timeout);this.requests.delete(controller);}
  }
  async start(){
   if(this.active)return;this.end(false);this.epoch++;const epoch=this.epoch;
   Object.assign(this,{active:true,status:'connecting',started:Date.now(),elapsed:0,turns:0,assessedTurn:0,feedbackOpen:false,showTyping:false,messages:[],feedback:null,assessment:null,error:'',muted:false,draft:'',practiceTarget:'',lastClip:null,pendingTurn:null});this.onAudioStart();this.paint();
   this.timer=setInterval(()=>{const clock=document.querySelector('#call-clock');if(clock)clock.textContent=this.clock();},1000);
   try{
     if(!navigator.mediaDevices?.getUserMedia||!window.AudioWorkletNode)throw Error('Voice calls are unavailable in this browser. Try a current Chrome or Edge browser with microphone support.');
     const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
     if(epoch!==this.epoch){stream.getTracks().forEach(t=>t.stop());return;}this.stream=stream;
     this.context=new AudioContext();await this.context.audioWorklet.addModule('/pcm-recorder.js');if(epoch!==this.epoch)return;
     await this.context.resume();this.source=this.context.createMediaStreamSource(stream);this.recorder=new AudioWorkletNode(this.context,'daylight-pcm-recorder');this.recorder.port.onmessage=e=>this.samples(new Float32Array(e.data));this.source.connect(this.recorder);this.recorder.connect(this.context.destination);
    if(epoch!==this.epoch)return;
    const opening=topics[this.scenario].opening;this.messages.push({role:'assistant',content:opening});await this.speak(opening);
   }catch(error){if(epoch!==this.epoch)return;this.end(false);this.error=error.name==='NotAllowedError'?'Microphone access was not allowed. Enable microphone access for this page, then start the call again.':error.message;this.paint();}
  }
  samples(chunk){
   if(!this.active||this.muted||this.status!=='listening'||Date.now()<(this.listenAfter||0))return;
   const level=root.DaylightVoiceUtils.rms(chunk);const wave=document.querySelector('.call-wave');if(wave)wave.style.setProperty('--voice-level',String(Math.min(2.8,.5+level*30)));
   const result=this.detector.push(chunk,this.context.sampleRate);if(result)this.audioTurn(root.DaylightVoiceUtils.wavBlob(root.DaylightVoiceUtils.concat(result),this.context.sampleRate));
  }
  finish(){if(this.status!=='listening')return;const result=this.detector.finish();if(result)this.audioTurn(root.DaylightVoiceUtils.wavBlob(root.DaylightVoiceUtils.concat(result),this.context.sampleRate));else{this.error='No clear speech captured yet. Speak a little closer to your microphone.';this.paint();}}
  async audioTurn(blob){
   if(!this.active||this.status==='thinking')return;this.stopPlayback();this.lastClip=blob;this.status='thinking';this.error='';this.paint();const epoch=this.epoch;
   this.pendingTurn={blob,reference:this.practiceTarget};
   try{
    const response=await this.request('/api/voice/transcribe',{method:'POST',headers:{'Content-Type':'audio/wav'},body:blob});const recognised=await response.json();if(epoch!==this.epoch)return;
    const practice=Boolean(this.practiceTarget);this.messages.push({role:'user',content:recognised.text,practice});this.turns++;this.paint();
    if(this.assessEnabled&&this.config.assessment)this.runAssessment(blob,this.practiceTarget||recognised.text,epoch,practice,this.turns);
    if(practice){this.pendingTurn=null;this.practiceTarget='';this.error='Read-aloud captured. Compare your recording with the model sentence. Without a connected assessment, this is practice rather than a pronunciation diagnosis.';this.resume(false);return;}
    await this.reply(recognised.text,epoch);
   }catch(error){if(epoch!==this.epoch)return;this.error=error.name==='AbortError'?'This turn took too long. Your recording is kept for retry.':error.message;this.status='paused';this.paint();}
  }
  async textTurn(text){
   if(!this.active)return;this.stopPlayback();this.practiceTarget='';this.status='thinking';this.error='';this.messages.push({role:'user',content:text});this.turns++;this.pendingTurn={text};this.paint();const epoch=this.epoch;
   try{await this.reply(text,epoch);}catch(error){if(epoch!==this.epoch)return;this.error=error.name==='AbortError'?'This turn took too long. Please retry.':error.message;this.status='paused';this.paint();}
  }
  async reply(text,epoch){
   this.pendingTurn={text};const history=this.messages.slice(0,-1).filter(m=>!m.practice).slice(-24).map(m=>({role:m.role,content:m.content}));
   const response=await this.request('/api/voice/conversation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scenario:this.scenario,history,text})});const result=await response.json();if(epoch!==this.epoch)return;
   this.feedback=result;this.messages.push({role:'assistant',content:result.reply});this.pendingTurn=null;this.paint();await this.speak(result.reply);
  }
  async runAssessment(blob,reference,epoch,practice,turn){
   try{const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    const response=await this.request('/api/voice/assessment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({audio:btoa(binary),reference,referenceBasis:practice?'read-aloud':'recognised transcript'})});const result=await response.json();if(epoch!==this.epoch||turn<(this.assessedTurn||0))return;this.assessedTurn=turn;this.assessment=result;this.paint();
   }catch(error){if(epoch===this.epoch&&error.name!=='AbortError'){this.error='Conversation can continue. '+error.message;this.paint();}}
  }
  stopPlayback(){this.audioEpoch=(this.audioEpoch||0)+1;if(this.audio){this.audio.onended=null;this.audio.pause();this.audio.src='';this.audio=null;}if(this.audioUrl){URL.revokeObjectURL(this.audioUrl);this.audioUrl=null;}}
  async speak(text){
   if(!text)return;this.onAudioStart();this.stopPlayback();const audioEpoch=this.audioEpoch,epoch=this.epoch;this.detector.reset();this.status='speaking';this.paint();
   try{const response=await this.request('/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});const blob=await response.blob();if(epoch!==this.epoch||audioEpoch!==this.audioEpoch)return;await this.playBlob(blob,false,audioEpoch);
   }catch(error){if(epoch!==this.epoch||audioEpoch!==this.audioEpoch)return;this.error=error.name==='NotAllowedError'?'The reply is ready. Use Replay to hear it.':error.message;this.status='paused';this.paint();}
  }
  async playBlob(blob,own=false,expected=null){
   if(expected===null)this.stopPlayback();const id=this.audioEpoch;
   if(own){this.status='speaking';this.detector.reset();this.paint();}
   const url=URL.createObjectURL(blob),audio=new Audio(url);this.audio=audio;this.audioUrl=url;
   audio.onended=()=>{if(id!==this.audioEpoch)return;this.audio=null;URL.revokeObjectURL(url);this.audioUrl=null;if(this.active)this.resume(false);else{this.status='ended';this.paint();}};
   audio.onerror=()=>{if(id===this.audioEpoch){this.error='The audio could not play. Please use Replay or continue the conversation.';this.status='paused';this.paint();}};
   await audio.play();
  }
  resume(clear=true){if(!this.active)return;if(clear)this.error='';this.detector.reset();this.listenAfter=Date.now()+350;this.status=this.muted?'muted':'listening';this.paint();}
  interrupt(){this.stopPlayback();this.practiceTarget='';this.resume();}
  toggleMute(){this.muted=!this.muted;this.stream?.getAudioTracks().forEach(t=>{t.enabled=!this.muted;});this.detector.reset();if(!['thinking','speaking'].includes(this.status))this.status=this.muted?'muted':'listening';this.paint();}
  retry(){if(!this.active||!this.pendingTurn)return;const turn=this.pendingTurn;this.error='';this.status='paused';if(turn.text){this.status='thinking';this.paint();this.reply(turn.text,this.epoch).catch(e=>{this.error=e.message;this.status='paused';this.paint();});}else if(turn.blob){this.practiceTarget=turn.reference;this.audioTurn(turn.blob);}}
  async practice(){if(!this.active||this.status==='thinking')return;this.practiceTarget=this.feedback?.correction?.better||'Could you clarify the requirements before we discuss the solution?';await this.speak(this.practiceTarget);}
  save(){const text=this.messages.map(m=>`${m.role==='user'?'You':'Stella'}: ${m.content}`).join('\n\n');this.onSave(topics[this.scenario].title,text,this.feedback?.correction);this.error='Conversation saved to your notes. Audio recordings are not saved.';this.paint();}
  clearPrivateState(){
   this.end(false);
   Object.assign(this,{scenario:'meeting',status:'idle',messages:[],feedback:null,assessment:null,assessEnabled:false,draft:'',error:'',started:0,elapsed:0,turns:0,practiceTarget:'',lastClip:null,feedbackOpen:false,showTyping:false,pendingTurn:null});
  }
  end(paint=true){
   const wasActive=this.active;this.elapsed=this.started?Math.floor((Date.now()-this.started)/1000):0;this.active=false;this.epoch++;clearInterval(this.timer);for(const request of this.requests)request.abort();this.requests.clear();this.stopPlayback();this.detector.reset();
   this.recorder?.disconnect();this.source?.disconnect();this.stream?.getTracks().forEach(t=>t.stop());this.context?.close().catch(()=>{});this.stream=null;this.context=null;this.source=null;this.recorder=null;this.status='ended';this.pendingTurn=null;this.practiceTarget='';this.resizeObserver?.disconnect();this.syncFocusMode();if(wasActive&&this.turns)this.onPractice();if(paint)this.paint();
  }
 }
 root.DaylightVoiceCall=VoiceCall;
})(globalThis);
