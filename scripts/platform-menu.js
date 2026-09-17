(function(root){
  'use strict';
  let side,nav,trigger,returnFocus,frame=0;
  const mobile=()=>matchMedia('(max-width:768px)').matches;
  function attr(el,name,value){if(el&&el.getAttribute(name)!==value)el.setAttribute(name,value);}
  function sync(){
    if(!side)return;
    const area=typeof realEstateArea==='undefined'?'locacoes':realEstateArea;
    const inRealEstate=!!document.getElementById('view-realestate')?.classList.contains('active');
    nav.querySelectorAll('[data-nav]').forEach(button=>{
      if(button.dataset.navArea){
        const denied=!AccessControl.can(AccessControl.areaModule(button.dataset.navArea));
        if(button.hidden!==denied)button.hidden=denied;
        const selected=inRealEstate&&button.dataset.navArea===(area==='cantinas'?'cantinas':'locacoes');
        if(button.classList.contains('active')!==selected)button.classList.toggle('active',selected);
      }
      const label=button.querySelector('.nav-label')?.textContent.trim()||'';
      const count=button.querySelector('.pill')?.textContent.trim();
      const title=label+(count?' ('+count+')':'');
      attr(button,'title',title);attr(button,'aria-label',title);
      if(button.classList.contains('active'))attr(button,'aria-current','page');else button.removeAttribute('aria-current');
    });
    nav.querySelectorAll('.nav-group').forEach(group=>{group.hidden=![...group.querySelectorAll('[data-nav]')].some(b=>!b.hidden&&b.style.display!=='none');});
    const name=document.getElementById('foot-user-name')?.textContent.trim()||'';
    const avatar=document.getElementById('menu-avatar');
    if(avatar)avatar.textContent=name&&name!=='\u2014'?name.split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase():'R';
    const profile=typeof currentProfile==='undefined'?null:currentProfile;
    const role=document.getElementById('menu-user-role');
    if(role)role.textContent=profile?.role==='admin'?'Administrador':'Raiz Educa\u00e7\u00e3o';
    side.inert=mobile()&&!side.classList.contains('mobile-open');
    attr(trigger,'aria-expanded',String(mobile()&&side.classList.contains('mobile-open')));
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;sync();});}
  function setMobileOpen(open){
    if(!side)return;
    open=!!open&&mobile();
    const wasOpen=side.classList.contains('mobile-open');
    if(open&&!wasOpen)returnFocus=document.activeElement;
    side.classList.toggle('mobile-open',open);
    document.getElementById('side-backdrop')?.classList.toggle('show',open);
    const main=document.querySelector('.main');if(main)main.inert=open;
    if(open){attr(side,'role','dialog');attr(side,'aria-modal','true');}else{side.removeAttribute('role');side.removeAttribute('aria-modal');}
    sync();
    if(open&&!wasOpen){const target=nav.querySelector('button.active:not([hidden])')||side.querySelector('.side-close-btn');target?.focus({preventScroll:true});target?.scrollIntoView({block:'nearest'});if(target===nav.querySelector('button:not([hidden])'))nav.scrollTop=0;}
    if(!open&&wasOpen&&mobile())(returnFocus?.isConnected?returnFocus:trigger)?.focus({preventScroll:true});
  }
  function openRealEstate(area){
    if(!['locacoes','cantinas'].includes(area)||!AccessControl.can(AccessControl.areaModule(area)))return;
    const hash=area==='cantinas'?'#realestate/sublocacoes':'#realestate';
    if(location.hash!==hash)history.pushState({platform:true},'',hash);
    realEstateArea=area;
    go('realestate');
  }
  function init(){
    side=document.getElementById('sidebar');nav=document.getElementById('nav');trigger=document.getElementById('mobile-menu-trigger');if(!side||!nav)return;
    new MutationObserver(records=>{if(records.some(r=>r.target===side||r.target.closest?.('[data-nav]')||r.target.parentElement?.closest('[data-nav]')||r.target.id==='foot-user-name'||r.target.parentElement?.id==='foot-user-name'))schedule();}).observe(side,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','class','style']});
    document.addEventListener('keydown',event=>{
      if(!mobile()||!side.classList.contains('mobile-open'))return;
      if(event.key==='Escape'){event.preventDefault();setMobileOpen(false);return;}
      if(event.key!=='Tab')return;
      const targets=[...side.querySelectorAll('button:not([disabled]),a[href],[tabindex="0"]')].filter(el=>el.getClientRects().length&&!el.closest('[hidden]'));
      const first=targets[0],last=targets.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    });
    matchMedia('(max-width:768px)').addEventListener('change',()=>{setMobileOpen(false);applySideCollapsePreference();sync();});
    sync();
  }
  root.PlatformMenu={sync,setMobileOpen,openRealEstate};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
