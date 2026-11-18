(function(root){
 const levels=['A1','A2','B1','B2'],idPattern=/^cefrj16-[a-f0-9]{16}$/;
 function day(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
 function validDay(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;}
 function validate(data){
  if(data===undefined)return;
  if(!data||typeof data!=='object'||Array.isArray(data)||!levels.includes(data.level)||!data.progress||typeof data.progress!=='object'||Array.isArray(data.progress)||Object.keys(data.progress).length>8000)throw Error('Invalid library progress');
  for(const [id,item] of Object.entries(data.progress)){
   if(!idPattern.test(id)||!item||!['learning','mastered'].includes(item.status)||!Number.isSafeInteger(item.reviews)||item.reviews<0||item.reviews>100000||!validDay(item.due)||!validDay(item.startedAt)||!validDay(item.updatedAt))throw Error('Invalid library word progress');
  }
 }
 function rate(previous,rating,date=new Date()){
  if(!['again','know','use'].includes(rating))throw Error('Invalid rating');
  const next=new Date(date);next.setDate(next.getDate()+({again:1,know:3,use:7}[rating]));const today=day(date);
  return {status:rating==='use'?'mastered':'learning',reviews:(previous?.reviews||0)+1,due:day(next),startedAt:previous?.startedAt||today,updatedAt:today};
 }
 function status(progress,id){return progress?.[id]?.status||'new';}
 function due(progress,id,date=new Date()){return Boolean(progress?.[id]&&progress[id].due<=day(date));}
 function posLabel(pos){return ({'be-verb':'auxiliary verb','do-verb':'auxiliary verb','have-verb':'auxiliary verb','modal auxiliary':'modal verb','infinitive-to':'infinitive marker'}[pos]||pos);}
 root.SpeakiLibraryProgress={levels,idPattern,validate,rate,status,due,day,posLabel};
})(globalThis);
