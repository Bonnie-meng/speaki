(() => {
 const labels = new Map(Object.entries({
  'Loading your space…':'正在加载…','Sign in':'登录','Signed in':'已登录','Sign out':'退出登录','Create an account':'注册','Create account':'注册','Already have an account?':'已有账号？','New here?':'第一次使用？','Let your English grow.':'每天进步一点，让英语慢慢成长。','Phone number':'手机号','Mobile number':'请输入手机号','Password':'密码','Confirm password':'确认密码','Forgot password?':'忘记密码？','6–8 letters or numbers':'6–8 位字母或数字','Enter your password':'请输入密码','Re-enter your password':'请再次输入密码','Please contact your administrator to reset your password.':'请联系管理员重置密码。','Your account':'我的账号','Change password':'修改密码','Close':'关闭','Cancel':'取消','Save':'保存','Try again':'重试','Your space':'学习空间','Today':'今日','Vocabulary':'词汇','Speaking':'口语','Listening':'听力','Ready to review':'待复习','Words collected':'已收录单词','Listening time':'听力时长','My words':'我的生词','Word library':'分级词库','＋ Add a word':'＋ 添加生词','Add a word':'添加生词','Edit card':'编辑词卡','Delete word':'删除单词','Save word':'保存单词','Practise this word ↗':'练习这个单词 ↗','Usage':'用法','Common phrases':'常用短语','Example':'例句','Try it':'试一试','Today’s plan':'今日计划','Notes & prompts':'笔记与练习提示','Let’s talk.':'来聊一聊。','Choose a topic and start a voice call.':'选择一个话题，开始语音通话。','Start call':'开始通话','End call':'结束通话','Hang up':'挂断','Mute':'静音','Unmute':'取消静音','Done speaking':'说完了','Feedback':'反馈','Your feedback':'你的反馈','Expression feedback':'表达反馈','Listen & repeat':'听后跟读','Scene':'场景','All scenes':'全部场景','Level':'级别','All levels':'全部级别','Voice':'声音类型','All voices':'全部声音','Human voices':'真人录音','AI practice':'AI 练习','Generated English voice':'AI 合成英语','Speaker origin':'说话者地区','All origins':'全部地区','Sort by':'排序','Scene, then level':'按场景，再按级别','Level · easy to hard':'按难度从低到高','Lesson':'课程','Voice / origin':'声音 / 地区','Length':'时长','Studied':'已学习','studied':'已学习','total listening':'听力总时长','Play':'播放','Pause':'暂停','Continue':'继续','Start ↗':'开始 ↗','Continue ↗':'继续 ↗','Speed':'语速','Transcript':'原文','← Listening library':'← 返回听力库','Script':'原文','Audio':'音频','Accent':'口音','Country / region':'国家或地区','About this material':'关于此素材','Check the answers':'查看答案','Useful expressions':'实用表达','Changed elsewhere · keep backup & reload':'同步冲突 · 备份并重新载入','Not saved · retry':'未保存 · 重试'
 }));
 labels.set("Daily plan","每日计划");
 labels.set("Review words","复习单词");
 labels.set("Learn new words","学习新词");
 labels.set("Review ↗","开始复习 ↗");
 labels.set("Add a word ↗","添加生词 ↗");
 labels.set("Listen & speak","听说练习");
 labels.set("Listen ↗","练习听力 ↗");
 labels.set("Speak ↗","练习口语 ↗");
 labels.set("Recent words","最近添加");
 labels.set("View all ↗","查看全部 ↗");
 labels.set("Start with your own words or choose a word library.","添加自己的生词，或从分级词库开始。");
 labels.set("Explore word libraries ↗","浏览分级词库 ↗");
 labels.set("↻ Review words","↻ 复习单词");
 labels.set("Added","添加日期");
 labels.set("All dates","全部日期");
 labels.set("Last 7 days","最近 7 天");
 labels.set("Last 30 days","最近 30 天");
 labels.set("Choose a date","选择日期");
 labels.set("Progress","学习进度");
 labels.set("All stages","所有阶段");
 labels.set("Needs details","待补充释义");
 labels.set("New discovery","新词");
 labels.set("Learning","学习中");
 labels.set("Can use","会使用");
 labels.set("No words here yet.","这里还没有单词。");
 labels.set("Try another filter, or capture a new discovery.","换个筛选条件，或添加一个生词。");
 labels.set("Search vocabulary…","搜索词汇…");
 labels.set("Search word library","搜索分级词库");
 labels.set("Search this level…","搜索当前级别…");
 labels.set("Choose your level. Your progress is saved to your account.","选择适合你的级别。学习进度会保存到你的账号。");
 labels.set("← All levels","← 返回全部级别");
 labels.set("Study next","继续学词");
 labels.set("No words match these filters.","没有符合筛选条件的单词。");
 labels.set("Previous","上一页");
 labels.set("Next","下一页");
 labels.set("Preparing your learning card…","正在准备词卡…");
 labels.set("Again · 1 day","再练习 · 1 天后");
 labels.set("Remembered · 3 days","已记住 · 3 天后");
 labels.set("Can use · 7 days","会使用 · 7 天后");
 labels.set("Word list source","词表来源");
 labels.set("Source & usage terms ↗","来源与使用条款 ↗");
 labels.set("Learning cards use AI-generated explanations and original examples. They are not official CEFR-J definitions.","词卡释义和例句由 AI 生成，并非 CEFR-J 官方释义。");
 labels.set("Your speaking notes","你的口语笔记");
 labels.set("Your notes…","写下你的笔记…");
 labels.set("Sample answer","参考回答");
 labels.set("In a meeting","工作会议");
 labels.set("Start voice call","开始语音通话");
 labels.set("Ready when you are","随时可以开始");
 labels.set("Connecting…","正在连接…");
 labels.set("Listening to you","正在听你说");
 labels.set("Preparing a reply…","正在准备回复…");
 labels.set("Stella’s turn","Stella 正在说");
 labels.set("Microphone muted","麦克风已静音");
 labels.set("Call ended","通话已结束");
 labels.set("Ready for your message","可以发送消息了");
 labels.set("Paused — your reply is kept","已暂停，你的回复已保留");
 labels.set("About voice practice","关于语音练习");
 labels.set("Conversation scenario","对话场景");
 labels.set("Conversation transcript","对话记录");
 labels.set("Conversation feedback","对话反馈");
 labels.set("Pronunciation practice","发音练习");
 labels.set("Pronunciation assessment","发音评测");
 labels.set("You said","你说的是");
 labels.set("Try this","试试这样说");
 labels.set("Listen to this expression","听一听这个表达");
 labels.set("Feedback appears after your first speaking turn.","完成第一轮对话后会显示反馈。");
 labels.set("↻ Replay","↻ 重播");
 labels.set("Interrupt","打断");
 labels.set("Retry this turn","重试这轮");
 labels.set("Read aloud","朗读");
 labels.set("Save conversation to my notes ↗","将对话保存到笔记 ↗");
 labels.set("Find your next listen.","选择下一篇听力素材。");
 labels.set("Preparing audio…","正在加载音频…");
 labels.set("Restart listening audio","重新播放");
 labels.set("Start from the beginning","从头播放");
 labels.set("Playback speed","播放速度");
 labels.set("Audio position","播放进度");
 labels.set("No lessons match these filters. Try another scene or level.","没有符合条件的素材，试试其他场景或级别。");
 labels.set("What did you catch?","你听懂了什么？");
 labels.set("Original source ↗","查看原始来源 ↗");
 labels.set("Usage terms ↗","使用条款 ↗");
 labels.set("Credit","来源署名");
 labels.set("Use","使用方式");
 labels.set("Preparing the meaning in this sentence…","正在查询句中的词义…");
 labels.set("IN THIS SENTENCE","在这句话中");
 labels.set("FROM YOUR LISTENING","听力生词");
 labels.set("Try again ↻","重试 ↻");
 labels.set("Done","完成");
 labels.set("Review complete.","复习完成。");
 labels.set("Review library words ↗","复习词库单词 ↗");
 labels.set("Reveal expression ↗","显示答案 ↗");
 labels.set("Word or expression","单词或短语");
 labels.set("Original sentence or context","原句或上下文");
 labels.set("Optional","选填");
 labels.set("Edit learning details","编辑词卡内容");
 labels.set("American IPA","美式音标");
 labels.set("Part of speech","词性");
 labels.set("Not added yet","尚未添加");
 labels.set("Category","类别");
 labels.set("Everyday","日常英语");
 labels.set("Product & Work","产品与职场");
 labels.set("Register","语体");
 labels.set("Neutral","中性");
 labels.set("Informal","非正式");
 labels.set("Formal","正式");
 labels.set("Simple English meaning","简明英文释义");
 labels.set("Chinese meaning","中文释义");
 labels.set("Example sentence","例句");
 labels.set("Save word ↗","保存单词 ↗");
 labels.set("Generate card ↗","生成词卡 ↗");
 labels.set("Practise word ↗","练习这个单词 ↗");
 labels.set("Another everyday meaning","另一个常见含义");
 labels.set("Users","用户管理");
 labels.set("Set a new password","设置新密码");
 labels.set("Confirm new password","确认新密码");
 labels.set("Save new password","保存新密码");
 labels.set("Temporary password","临时密码");
 labels.set("Reset password","重置密码");
 labels.set("Loading users…","正在加载用户…");
 labels.set("Please sign in to continue.","请先登录。");
 labels.set("Your passwords do not match.","两次输入的密码不一致。");
 labels.set("noun","名词");
 labels.set("verb","动词");
 labels.set("adjective","形容词");
 labels.set("adverb","副词");
 labels.set("phrasal verb","短语动词");
 labels.set("expression","表达");
 labels.set("pronoun","代词");
 labels.set("preposition","介词");
 labels.set("determiner","限定词");
 labels.set("conjunction","连词");
 labels.set("number","数词");
 labels.set("modal verb","情态动词");
 labels.set("infinitive marker","不定式标记");
 labels.set("interjection","感叹词");
 labels.set("auxiliary verb","助动词");
 for(const [key,value] of Object.entries({
  'All words':'全部单词','Not started':'未开始','Mastered':'已掌握','Due for review':'待复习',
  'Beginner':'入门','Elementary':'初级','Intermediate':'中级','Upper intermediate':'中高级',
  'Date not recorded':'未记录日期','Search vocabulary':'搜索词汇','Filter by category':'按类别筛选',
  'Filter by date added':'按添加日期筛选','Date added':'添加日期','Filter by learning progress':'按学习进度筛选',
  'Filter library learning progress':'按词库学习进度筛选','Rate this word':'评价掌握程度',
  'Close library word':'关闭词库词卡','Filter listening by scene':'按场景筛选','Filter listening by level':'按级别筛选',
  'Filter listening by voice':'按声音类型筛选','Filter listening by speaker origin':'按说话者地区筛选',
  'Sort listening materials':'听力素材排序','Recording length':'录音时长','Time studied':'已学时长',
  'Play listening audio':'播放听力音频','Close word lookup':'关闭查词',
  'End voice call':'结束语音通话','Mute microphone':'关闭麦克风','Unmute microphone':'打开麦克风',
  'English conversation with Stella':'与 Stella 练习英语对话','Feedback available':'有新反馈','Close feedback':'关闭反馈',
  'Type your message…':'输入消息…','Your message':'你的消息','You':'你',
  'Hear your last recording':'播放上一次录音','Words to revisit':'建议复习的词',
  'Close account':'关闭账号窗口','Close dialog':'关闭窗口','Account':'账号','Main navigation':'主导航'
 }))labels.set(key,value);
 let language='en';
 try { language=localStorage.getItem('speaki-ui-language')==='zh'?'zh':'en'; } catch {}
 const originals=new WeakMap();
 const attrs=['placeholder','title','aria-label'];
 const calendarChinese=new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long',day:'numeric'});
 const todayChinese=new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'});
 const translate=(value,element)=>{
  const date=element?.matches('time[datetime]')&&/^(\d{4})-(\d{2})-(\d{2})$/.exec(element.dateTime);
  if(date){
   const [,year,month,day]=date;
   const local=new Date(+year,+month-1,+day);
   const prefix=value.startsWith('Today · ')?'今日 · ':value.startsWith('Yesterday · ')?'昨日 · ':'';
   return prefix+(element.id==='today-date'?todayChinese:calendarChinese).format(local);
  }
  const key=value.trim();
  const count=/^(\d+) of (\d+) lessons$/.exec(key);
  const studied=/^([\d:]+) studied$/.exec(key);
  const dynamic=[
   [/^(\d+) min$/,n=>n+' 分钟'],
   [/^([\d,]+) entries( · [\d–]+)?$/, (n,range='')=>n+' 个词条'+range],
   [/^Page (\d+) of (\d+)$/, (page,total)=>'第 '+page+' / '+total+' 页'],
   [/^Review (\d+)$/, n=>'复习 '+n+' 个'],
   [/^([\d,]+) expressions?$/, n=>n+' 个表达'],
   [/^(?:(\d+) )?studied · (\d+) mastered$/, (n,m)=>(n?'已学习 '+n:'已学习')+' · 已掌握 '+m],
   [/^(.+?) · (.+)$/, (label,rest)=>labels.has(label)?labels.get(label)+' · '+rest:null]
  ];
  const match=dynamic.map(([pattern,format])=>{const parts=pattern.exec(key);return parts&&format(...parts.slice(1));}).find(Boolean);
  const translated=labels.get(key)||(studied&&`已学习 ${studied[1]}`)||(count&&`显示 ${count[1]} / ${count[2]} 节课`)||match;
  return translated?value.replace(key,translated):value;
 };
 function apply(node,key,current,write){
  let records=originals.get(node);
  if(!records)originals.set(node,records={});
  const previous=records[key];
  const source=previous?.shown===current?previous.source:current;
  const shown=language==='zh'?translate(source,node.parentElement):source;
  records[key]={source,shown};
  if(shown!==current)write(shown);
 }
 function refresh(){
  document.documentElement.lang=language==='zh'?'zh-CN':'en';
  for(const b of document.querySelectorAll('[data-language-toggle]')){
   const label=language==='zh'?'EN':'中文';
   if(b.textContent!==label)b.textContent=label;
  }
  for(const root of document.querySelectorAll('#auth-panel,.sidebar,.topbar,#app,dialog')){
   const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
   while(walker.nextNode()){
    const node=walker.currentNode;
    if(!node.data.trim()||node.parentElement?.closest('script,style,textarea,[contenteditable],[data-language-toggle],blockquote,.transcript,.example,.call-message > p,.notes-prompt,.library-word-name strong,.word-name,.detail-word'))continue;
    const option=node.parentElement?.closest('option');
    if(option&&!option.hasAttribute('value')&&language==='zh'&&translate(node.data)!==node.data)option.value=option.value;
    apply(node,'text',node.data,v=>{node.data=v;});
   }
   for(const el of root.querySelectorAll('[placeholder],[title],[aria-label]')){
    if(el.hasAttribute('data-language-toggle'))continue;
    for(const name of attrs)if(el.hasAttribute(name))apply(el,name,el.getAttribute(name),v=>el.setAttribute(name,v));
   }
  }
 }
 document.addEventListener('click',event=>{
  if(!event.target.closest('[data-language-toggle]'))return;
  language=language==='zh'?'en':'zh';
  try{localStorage.setItem('speaki-ui-language',language);}catch{}
  refresh();
 });
 new MutationObserver(refresh).observe(document.body,{subtree:true,childList:true,characterData:true});
 refresh();
})();
