
/* myTIME quality-of-life layer: analytics, local recovery snapshot, theme, install */
(function(){
 'use strict';
 const $id=id=>document.getElementById(id);
 const AUTO_KEY='foss-time-recovery-snapshot-v1';
 const THEME_KEY='foss-time-theme-v1';
 const themeBtn=$id('themeToggle'),installBtn=$id('installAppBtn');
 function setTheme(mode){
  window.myTimeApplyTheme=setTheme;
  const dark=mode==='dark';
  document.body.classList.toggle('dark-mode',dark);
  document.documentElement.style.colorScheme=dark?'dark':'light';
  if(themeBtn){themeBtn.textContent=dark?'☀ Light mode':'☾ Dark mode';themeBtn.setAttribute('aria-pressed',String(dark));themeBtn.title=dark?'Switch to light theme':'Switch to dark theme'}
  const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=dark?'#0b1220':'#09266f';
 }
 let savedTheme='light';try{savedTheme=localStorage.getItem(THEME_KEY)||'light'}catch{}
 setTheme(savedTheme);
 if(themeBtn)themeBtn.addEventListener('click',()=>{const mode=document.body.classList.contains('dark-mode')?'light':'dark';setTheme(mode);try{localStorage.setItem(THEME_KEY,mode)}catch{}if(window.myTimeQueueCloudSync)window.myTimeQueueCloudSync()});
 let installPrompt=null;
 const isInstalledApp=()=>window.matchMedia('(display-mode: standalone)').matches||window.matchMedia('(display-mode: fullscreen)').matches||window.navigator.standalone===true;
 function syncInstallButton(){
  if(!installBtn)return;
  if(isInstalledApp()){installBtn.hidden=true;installBtn.setAttribute('aria-hidden','true');installBtn.title='myTIME is running as an installed app';return}
  installBtn.removeAttribute('aria-hidden');
  if(installPrompt){installBtn.hidden=false;installBtn.textContent='＋ Install app';installBtn.title='Install myTIME on this computer'}
  else{installBtn.hidden=false;installBtn.textContent='＋ Install app';installBtn.title='Use your browser menu to install myTIME'}
 }
 syncInstallButton();
 const standaloneQuery=window.matchMedia('(display-mode: standalone)');
 if(standaloneQuery.addEventListener)standaloneQuery.addEventListener('change',syncInstallButton);
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;syncInstallButton()});
 window.addEventListener('appinstalled',()=>{installPrompt=null;syncInstallButton()});
 if(installBtn)installBtn.addEventListener('click',async()=>{if(isInstalledApp()){installBtn.hidden=true;return}if(installPrompt){installPrompt.prompt();const choice=await installPrompt.userChoice;installPrompt=null;if(choice?.outcome==='accepted')installBtn.hidden=true;else syncInstallButton()}else{alert('myTIME may already be installed. Open it from your computer’s Start menu or app launcher. To install from this browser, open the browser menu and choose “Install myTIME” or “Apps → Install this site as an app.”');syncInstallButton()}});
 /* Service-worker registration is centralized in the update checker. */
/* Update checker: detects new webpage deployments without requiring F5. */
 (function(){
  const banner=document.getElementById('updateNotice'),button=document.getElementById('applyUpdateBtn');
  if(!banner||!button)return;
  let initialTag='',updateFound=false,checking=false;
  function announce(){updateFound=true;banner.classList.add('visible')}
  async function getTag(){
   try{
    const r=await fetch('/index.html?mytime-update-check='+Date.now(),{method:'GET',cache:'no-store',credentials:'same-origin'});
    if(!r.ok)return '';
    const html=await r.text();
    // Hash the actual deployed page: CDN validators can remain unchanged across cached responses.
    let hash=2166136261;for(let i=0;i<html.length;i++){hash^=html.charCodeAt(i);hash=Math.imul(hash,16777619)}
    return 'html-'+(hash>>>0).toString(16);
   }catch{return ''}
  }
  async function checkPage(){
   if(checking||document.visibilityState==='hidden')return;checking=true;
   try{const tag=await getTag();if(tag){if(!initialTag)initialTag=tag;else if(tag!==initialTag)announce()}}finally{checking=false}
  }
  button.addEventListener('click',async()=>{
   if(!confirm('Reload myTIME to install the update? Please make sure your latest changes have been saved first.'))return;
   button.disabled=true;button.textContent='Updating…';
   try{
    if('serviceWorker' in navigator){const reg=await navigator.serviceWorker.getRegistration();if(reg?.waiting){reg.waiting.postMessage({type:'SKIP_WAITING'});await new Promise(resolve=>{const timer=setTimeout(resolve,2500);navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(timer);resolve()},{once:true})})}}
    location.reload();
   }catch{location.reload()}
  });
  if('serviceWorker' in navigator&&location.protocol==='https:'){
   window.addEventListener('load',async()=>{
    try{const reg=await navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'});if(reg.waiting)announce();
     reg.addEventListener('updatefound',()=>{const worker=reg.installing;if(!worker)return;worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)announce()})});
     setInterval(()=>reg.update().catch(()=>{}),30000);
    }catch{}
   });
  }
  window.addEventListener('load',()=>{checkPage();setInterval(checkPage,30000)});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkPage()});
 })();
 
 function allDates(){return Object.keys(data||{}).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)).sort()}
 function paidMinutesFor(k){const rec=data[k];if(!rec||!Array.isArray(rec.punches)||!rec.punches.length)return 0;const out=[...rec.punches].reverse().find(p=>p.type==='out');return Math.round(paidMs(rec,out?.ts||(k===todayKey()?Date.now():rec.punches[rec.punches.length-1]?.ts||Date.now()))/60000)}
 function formatHours(min){return (min/60).toLocaleString(undefined,{minimumFractionDigits:1,maximumFractionDigits:2})+' h'}
 function validationIssues(){
  const issues=[];
  allDates().forEach(k=>{const ps=(data[k]?.punches||[]).filter(p=>p&&Number.isFinite(Number(p.ts))).slice().sort((a,b)=>a.ts-b.ts);let active=false,lunch=false,last=null;
   ps.forEach(p=>{if(last&&p.ts<last.ts)issues.push(k+': punch timestamps are out of order');if(p.type==='in'){if(active)issues.push(k+': another clock-in appears before the previous clock-out');active=true}
    else if(p.type==='lunch-start'){if(!active)issues.push(k+': lunch-out without an active work period');if(lunch)issues.push(k+': duplicate lunch-out');lunch=true;active=false}
    else if(p.type==='lunch-end'){if(!lunch)issues.push(k+': lunch-in without a lunch-out');lunch=false;active=true}
    else if(p.type==='out'){if(!active)issues.push(k+': clock-out without a matching clock-in');active=false}
    last=p;
   });
   if(lunch)issues.push(k+': lunch-out has no matching lunch-in');
   if(active&&k!==todayKey())issues.push(k+': work period has no clock-out');
   const times=ps.map(p=>p.ts);if(times.some(t=>!Number.isFinite(t)))issues.push(k+': invalid punch timestamp');
   if(new Set(ps.map(p=>p.type+'|'+p.ts)).size<ps.length)issues.push(k+': duplicate punch entries detected');
  });
  return [...new Set(issues)];
 }
 function renderAnalytics(){
  const root=$id('myTimeAnalytics');if(!root)return;
  const now=new Date(),days=allDates(),month=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0'),monthDays=days.filter(k=>k.startsWith(month)),weekStart=new Date(now);weekStart.setHours(0,0,0,0);weekStart.setDate(weekStart.getDate()-((weekStart.getDay()+6)%7));const weekKey=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');const weekDays=days.filter(k=>{const d=new Date(k+'T12:00:00');return d>=weekStart&&d<=now});
  const mins=keys=>keys.reduce((n,k)=>n+paidMinutesFor(k),0),today=paidMinutesFor(todayKey()),w=mins(weekDays),m=mins(monthDays),goal=Math.max(1,Number(settings.goalHours||8)*60),allIssues=validationIssues();
  const dayLabels=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];const bars=dayLabels.map((label,i)=>{const d=new Date(weekStart);d.setDate(d.getDate()+i);const k=weekKey(d),v=paidMinutesFor(k);return {label,value:v}});const max=Math.max(goal,...bars.map(b=>b.value),1);
  root.innerHTML='<div class="section-head"><div><div class="metric-label">YOUR TIME, AT A GLANCE</div><h2 style="margin:4px 0">Work analytics</h2><p class="sub">Calculated from records loaded from your signed-in Cloudflare account. Open shifts are estimates and may change as you punch.</p></div><button type="button" class="quiet" id="refreshAnalytics">Refresh</button></div>'+
   '<div class="analytics-grid"><article class="card"><div class="metric-label">TODAY</div><div class="metric">'+formatHours(today)+'</div><div class="sub">Paid time recorded</div></article><article class="card"><div class="metric-label">THIS WEEK</div><div class="metric">'+formatHours(w)+'</div><div class="sub">'+weekDays.length+' day(s) with records</div></article><article class="card"><div class="metric-label">THIS MONTH</div><div class="metric">'+formatHours(m)+'</div><div class="sub">'+monthDays.length+' day(s) with records</div></article><article class="card"><div class="metric-label">DATA CHECKS</div><div class="metric">'+allIssues.length+'</div><div class="sub">'+(allIssues.length?'item(s) to review':'No obvious punch sequence issues')+'</div></article></div>'+
   '<div class="layout" style="margin-top:14px"><article class="card"><div class="section-head"><h3 style="margin:0">This week</h3><span class="tag">PAID HOURS</span></div><div class="analytics-chart">'+bars.map(b=>'<div class="analytics-bar"><strong>'+ (b.value?formatHours(b.value):'—')+'</strong><div class="analytics-bar-fill" style="height:'+Math.max(3,Math.round(b.value/max*90))+'px" title="'+b.label+': '+formatHours(b.value)+'"></div><small>'+b.label+'</small></div>').join('')+'</div><p class="sub">Daily goal reference: '+formatHours(goal)+'. Compare recorded hours with your schedule; this is not payroll approval.</p></article><article class="card"><div class="section-head"><h3 style="margin:0">Record quality</h3><span class="tag">'+(allIssues.length?'REVIEW':'CHECKED')+'</span></div><p class="sub">Automatic checks look for unmatched punches and duplicate or incomplete sequences.</p>'+(allIssues.length?'<div class="analytics-warning">Review these records before exporting.</div><ul id="analyticsErrorList">'+allIssues.slice(0,8).map(x=>'<li>'+x.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</li>').join('')+'</ul>'+(allIssues.length>8?'<p class="sub">Showing 8 of '+allIssues.length+' findings.</p>':''):'<p>✓ No obvious punch sequence issues found.</p>')+'<div class="settings-actions"><button type="button" class="quiet" id="goImportChecks">Import &amp; export</button><button type="button" class="quiet" id="downloadRecoveryNow">Download backup</button></div></article></div>';
  $id('refreshAnalytics').onclick=renderAnalytics;$id('goImportChecks').onclick=()=>window.myTimeShowPage&&window.myTimeShowPage('import');$id('downloadRecoveryNow').onclick=()=>download('myTIME-recovery-'+todayKey()+'.json',JSON.stringify({app:'FOSS myTIME',version:3,exportedAt:new Date().toISOString(),settings,data,bankEntries,profile:typeof profile!=='undefined'?profile:null,theme:localStorage.getItem(THEME_KEY)||'light'},null,2),'application/json');
 }
 function mountAnalytics(){
  const dash=document.getElementById('page-dashboard');if(!dash||$id('myTimeAnalytics'))return;
  const sec=document.createElement('section');sec.id='myTimeAnalytics';sec.className='card';sec.style.marginTop='18px';dash.appendChild(sec);renderAnalytics();
 }
 function snapshot(){
  try{const existing=JSON.parse(localStorage.getItem(AUTO_KEY)||'null');const hasRecords=Object.keys(data||{}).length>0;const hasBank=Array.isArray(bankEntries)&&bankEntries.length>0;if(existing&&existing.data&&Object.keys(existing.data).length>0&&!hasRecords&&!hasBank)return;const snap={app:'FOSS myTIME',version:3,createdAt:new Date().toISOString(),settings,data,bankEntries,profile:typeof profile!=='undefined'?profile:null,theme:localStorage.getItem(THEME_KEY)||'light'};localStorage.setItem(AUTO_KEY,JSON.stringify(snap));localStorage.setItem(AUTO_KEY+'-status',new Date().toISOString())}catch(e){/* quota/privacy mode: manual export remains available */}
 }
 const previousSave=save;save=function(){previousSave();snapshot();renderAnalytics()};
 const previousSaveSet=saveSet;saveSet=function(){previousSaveSet();snapshot();renderAnalytics()};
 const priorRender=render;render=function(){priorRender();snapshot();renderAnalytics()};
 // Offer recovery if records were cleared but an earlier automatic snapshot remains.
 try{
  const raw=localStorage.getItem(AUTO_KEY),current=JSON.parse(localStorage.getItem(KEY)||'{}');
  if(raw&&(!current||!Object.keys(current).length)){const backup=JSON.parse(raw);if(backup.data&&Object.keys(backup.data).length&&confirm('myTIME found an automatic recovery snapshot from '+new Date(backup.createdAt||Date.now()).toLocaleString()+'. Restore those local records?')){data=backup.data;if(backup.settings)settings=backup.settings;if(Array.isArray(backup.bankEntries))bankEntries=backup.bankEntries;save();saveSet();localStorage.setItem(BANKKEY,JSON.stringify(bankEntries));applySettings();render()}}
 }catch{}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountAnalytics);else mountAnalytics();
 // Refresh analytics when navigating back to the dashboard.
 document.getElementById('appTabs')?.addEventListener('click',e=>{if(e.target.closest('[data-tab="dashboard"]'))setTimeout(renderAnalytics,0)});
 window.addEventListener('storage',e=>{if(e.key===KEY||e.key===SETKEY){try{data=load(KEY,{});settings=load(SETKEY,settings);renderAnalytics()}catch{}}});
})();
