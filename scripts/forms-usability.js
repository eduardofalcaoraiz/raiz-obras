/* Associate existing form labels without changing business data or field values. */
window.FormUsability=(()=>{
  let scheduled=false;
  function improve(){
    scheduled=false;
    document.querySelectorAll('.overlay').forEach(overlay=>{
      const modal=overlay.querySelector('.modal');
      const heading=overlay.querySelector('.mhead h2');
      if(modal&&heading){
        if(!heading.id)heading.id=overlay.id+'-heading';
        modal.setAttribute('role','dialog');
        modal.setAttribute('aria-modal','true');
        modal.setAttribute('aria-labelledby',heading.id);
      }
      overlay.querySelectorAll('.frow').forEach(row=>{
        const label=row.querySelector('label');
        const controls=row.querySelectorAll('input:not([type="hidden"]),select,textarea');
        if(label&&controls.length===1&&controls[0].id&&!label.htmlFor)label.htmlFor=controls[0].id;
      });
      overlay.querySelectorAll('.mhead .x').forEach(button=>{
        button.setAttribute('aria-label','Fechar');button.type='button';
      });
    });
  }
  function init(){
    improve();
    new MutationObserver(()=>{
      if(!scheduled){scheduled=true;requestAnimationFrame(improve);}
    }).observe(document.body,{subtree:true,childList:true});
    document.addEventListener('input',event=>event.target.removeAttribute?.('aria-invalid'));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  return {improve};
})();
