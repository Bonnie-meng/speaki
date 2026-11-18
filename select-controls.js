(function(root){
 // Keep the native picker, keyboard behavior and accessible name. A separate
 // visual value lets compact text coexist with 16px native mobile controls.
 function sync(select){
  const copy=select.parentElement?.querySelector(':scope > .select-copy');if(!copy)return;
  const value=select.selectedOptions[0]?.textContent||'';
  const text=copy.firstElementChild;if(text.textContent!==value)text.textContent=value;
 }
 function refresh(host=document){
  for(const select of host?.querySelectorAll('select')||[]){
   if(select.multiple||select.size>1)continue;
   if(!select.parentElement.classList.contains('compact-select')){
    const wrapper=document.createElement('span'),copy=document.createElement('span');
    wrapper.className='compact-select';copy.className='select-copy';copy.setAttribute('aria-hidden','true');copy.append(document.createElement('span'));
    select.before(wrapper);wrapper.append(select,copy);
   }
   sync(select);
  }
 }
 document.addEventListener('change',event=>{if(event.target.matches('select'))sync(event.target);},true);
 document.addEventListener('DOMContentLoaded',()=>refresh());
 root.SpeakiControls={refresh};
})(globalThis);
