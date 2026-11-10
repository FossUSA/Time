
const $=id=>document.getElementById(id);const KEY='foss-time-v1';const SETKEY='foss-time-settings-v1';const todayKey=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};let data=load(KEY,{}),settings=load(SETKEY,{startTime:'08:00',endTime:'17:00',lunchStart:'11:30',lunchEnd:'12:30',morningBreakTime:'10:00',afternoonBreakTime:'15:00',goalHours:8,timezone:'local'});function load(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}
let cloudSyncReady=false,cloudSyncBusy=false,cloudSyncDirty=false,cloudSyncTimer=null,cloudSyncBlocked=false,cloudRevision=0,cloudHydrating=false,cloudBasePayload=null,cloudSyncRetryCount=0,cloudSyncRetryPending=false;
const nativeStorageSetItem=Storage.prototype.setItem;
function shouldSyncCloudStorageKey(key){
 const name=String(key);
 return name.startsWith('foss-time-')&&name!=='foss-time-recovery-snapshot-v1'&&name!=='foss-time-recovery-snapshot-v1-status';
}
Storage.prototype.setItem=function(key,value){nativeStorageSetItem.call(this,key,value);if(this===localStorage&&shouldSyncCloudStorageKey(key)&&!cloudHydrating)queueCloudSync()};
const nativeStorageRemoveItem=Storage.prototype.removeItem;
Storage.prototype.removeItem=function(key){nativeStorageRemoveItem.call(this,key);if(this===localStorage&&shouldSyncCloudStorageKey(key)&&!cloudHydrating)queueCloudSync()};

function cloudLocalState(){const state={};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&shouldSyncCloudStorageKey(key))state[key]=localStorage.getItem(key)}return state}
function cloudPayload(){return {records:data,settings,bankEntries:typeof bankEntries!=='undefined'?bankEntries:load('foss-time-bank-v1',[]),profile:load('foss-time-profile-v1',null),theme:localStorage.getItem('foss-time-theme-v1')||'light',localState:cloudLocalState()}}
function mergeLegacyRecords(local,remote){const merged={...(remote||{})};for(const [date,lr] of Object.entries(local||{})){const rr=merged[date];if(!rr){merged[date]=lr;continue}const all=[...(rr.punches||[]),...(lr.punches||[])],seen=new Set();merged[date]={...rr,punches:all.filter(x=>{const k=String(x.type)+'|'+String(x.ts);if(seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>Number(a.ts)-Number(b.ts)),audit:[...(rr.audit||[]),...(lr.audit||[]).filter(x=>!(rr.audit||[]).some(y=>JSON.stringify(y)===JSON.stringify(x)))],breakStatus:{...(rr.breakStatus||{}),...(lr.breakStatus||{})},breakTimes:{...(rr.breakTimes||{}),...(lr.breakTimes||{})}}}return merged}
function applyCloudPayload(remote){
 cloudHydrating=true;
 try{
  /* D1 is authoritative. Replace this browser's myTIME cache with the exact
     cloud snapshot, even for older cloud payloads without localState. */
  const state=remote.localState&&typeof remote.localState==='object'&&!Array.isArray(remote.localState)?remote.localState:{};
  for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if(key&&key.startsWith('foss-time-')&&!Object.prototype.hasOwnProperty.call(state,key))localStorage.removeItem(key)}
  for(const [key,value] of Object.entries(state)){if(key.startsWith('foss-time-')&&typeof value==='string')localStorage.setItem(key,value)}
  data=remote.records&&typeof remote.records==='object'&&!Array.isArray(remote.records)?remote.records:{};
  settings=remote.settings&&typeof remote.settings==='object'&&!Array.isArray(remote.settings)?remote.settings:{startTime:'08:00',endTime:'17:00',lunchStart:'11:30',lunchEnd:'12:30',morningBreakTime:'10:00',afternoonBreakTime:'15:00',goalHours:8,timezone:'local'};
  bankEntries=Array.isArray(remote.bankEntries)?remote.bankEntries:[];
  if(typeof profile!=='undefined'){const restoredProfile=remote.profile&&typeof remote.profile==='object'?remote.profile:{name:'',email:typeof authenticatedUserEmail==='string'?authenticatedUserEmail:'',photo:''};profile={name:typeof restoredProfile.name==='string'?restoredProfile.name:'',email:typeof restoredProfile.email==='string'?restoredProfile.email:'',photo:typeof restoredProfile.photo==='string'?restoredProfile.photo:''};}
  if(remote.theme==='dark'||remote.theme==='light'){localStorage.setItem('foss-time-theme-v1',remote.theme);if(typeof window.myTimeApplyTheme==='function')window.myTimeApplyTheme(remote.theme)}
  localStorage.setItem(KEY,JSON.stringify(data));localStorage.setItem(SETKEY,JSON.stringify(settings));
  localStorage.setItem('foss-time-bank-v1',JSON.stringify(bankEntries));
  if(typeof profile!=='undefined')localStorage.setItem('foss-time-profile-v1',JSON.stringify(profile));
 }finally{cloudHydrating=false}
 if(typeof applySettings==='function')applySettings();
 if(typeof renderProfile==='function')renderProfile();
 if(typeof updateProfileButton==='function')updateProfileButton();
 if(typeof render==='function')render();
 if(typeof renderMyTimeCalendar==='function'&&document.getElementById('myTimeCalendarRoot'))renderMyTimeCalendar();
}
function setCloudStartupGate(loaded,message='Loading your timecard from Cloudflare D1…'){
 const gate=$('cloudStartupGate'),note=$('cloudStartupMessage'),retry=$('cloudStartupRetry');
 if(loaded){document.documentElement.classList.remove('mytime-cloud-pending');if(gate)gate.hidden=true;return}
 document.documentElement.classList.add('mytime-cloud-pending');
 if(gate)gate.hidden=false;
 if(note)note.textContent=message;
 if(retry)retry.hidden=!/could not load|unavailable|failed/i.test(message);
}
function setSaveStatus(ok,message){const root=$('saveStatus'),label=$('saveStatusText');if(!root||!label)return;root.classList.toggle('save-status-error',!ok);root.classList.toggle('save-status-ok',!!ok);label.textContent=message;root.title=ok?'Confirmed saved in your Cloudflare D1 account.':'Not confirmed in Cloudflare. Your browser copy is only temporary recovery data.'}
let cloudAuthRequired=false;
const MYTIME_ACCESS_LOGIN='/cdn-cgi/access/login/be13baf6dd40cfd1cbb67658f27069c13b65ada283abe5e93ed1c6bcbacb3ee5';
async function cloudRequest(path,options){
 const response=await fetch(path,{...options,redirect:'manual'});
 const contentType=String(response.headers.get('content-type')||'').toLowerCase();
 if(response.status===401||response.status===403||response.status===302||response.type==='opaqueredirect'||response.redirected||contentType.includes('text/html')){
  cloudAuthRequired=true;
  const error=new Error('Your Cloudflare Access session needs to be renewed. Pending changes are being kept in this browser.');
  error.authRequired=true;error.status=response.status;throw error;
 }
 let body=null;
 try{body=await response.json()}catch{
  const error=new Error('Cloudflare returned a response that was not valid JSON (HTTP '+response.status+').');
  error.status=response.status;error.retryable=response.status>=500||response.status===0;throw error;
 }
 if(!body||typeof body!=='object'){
  const error=new Error('Cloudflare returned an empty or invalid response (HTTP '+response.status+').');
  error.status=response.status;error.retryable=response.status>=500||response.status===0;throw error;
 }
 if(response.status!==409&&!body.conflict&&(!response.ok||body.ok!==true)){
  const error=new Error(String(body.error||('Cloudflare request failed (HTTP '+response.status+').')).slice(0,260));
  error.status=response.status;error.retryable=response.status>=500||response.status===408||response.status===429||response.status===0;throw error;
 }
 cloudAuthRequired=false;
 return {response,body};
}
function startMyTimeAccessLogin(){
 setSaveStatus(false,'Sign-in required · reconnect to Cloudflare to save pending changes');
 window.location.assign(MYTIME_ACCESS_LOGIN);
}
function cloneCloudValue(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value))}
function cloudValueEqual(a,b){return JSON.stringify(a)===JSON.stringify(b)}
function isCloudObject(value){return !!value&&typeof value==='object'&&!Array.isArray(value)}
function mergeCloudValue(base,local,remote,key){
 if(cloudValueEqual(local,base))return cloneCloudValue(remote);
 if(cloudValueEqual(remote,base))return cloneCloudValue(local);
 if(cloudValueEqual(local,remote))return cloneCloudValue(local);
 if(Array.isArray(local)&&Array.isArray(remote)&&(key==='punches'||key==='audit')){
  const merged=[],seen=new Set();
  for(const item of [...remote,...local]){
   const id=key==='punches'?String(item?.type||'')+'|'+String(item?.ts||''):JSON.stringify(item);
   if(!seen.has(id)){seen.add(id);merged.push(cloneCloudValue(item))}
  }
  if(key==='punches')merged.sort((a,b)=>Number(a?.ts||0)-Number(b?.ts||0));
  return merged;
 }
 if(isCloudObject(local)&&isCloudObject(remote)){
  const baseObject=isCloudObject(base)?base:{},out={};
  const keys=new Set([...Object.keys(baseObject),...Object.keys(local),...Object.keys(remote)]);
  for(const name of keys){
   const bh=Object.prototype.hasOwnProperty.call(baseObject,name);
   const lh=Object.prototype.hasOwnProperty.call(local,name);
   const rh=Object.prototype.hasOwnProperty.call(remote,name);
   if(!lh){
    if(!rh)continue;
    if(!bh||!cloudValueEqual(remote[name],baseObject[name]))out[name]=cloneCloudValue(remote[name]);
    continue;
   }
   if(!rh){
    if(!bh||!cloudValueEqual(local[name],baseObject[name]))out[name]=cloneCloudValue(local[name]);
    continue;
   }
   out[name]=mergeCloudValue(bh?baseObject[name]:undefined,local[name],remote[name],name);
  }
  return out;
 }
 return cloneCloudValue(local);
}
function mergeCloudPayload(base,local,remote){
 return mergeCloudValue(base||{},local||{},remote||{},'payload');
}
function emptyCloudPayload(){
 return {records:{},settings:{startTime:'08:00',endTime:'17:00',lunchStart:'11:30',lunchEnd:'12:30',morningBreakTime:'10:00',afternoonBreakTime:'15:00',goalHours:8,timezone:'local'},bankEntries:[],profile:{name:'',email:typeof authenticatedUserEmail==='string'?authenticatedUserEmail:'',photo:''},theme:'light',localState:{}};
}
function queueCloudSync(){if(!cloudSyncReady||cloudSyncBlocked)return;cloudSyncDirty=true;cloudSyncRetryPending=false;clearTimeout(cloudSyncTimer);cloudSyncTimer=setTimeout(syncCloudNow,500)}
async function syncCloudNow(){
 if(!cloudSyncReady||cloudSyncBlocked)return false;
 if(cloudSyncBusy){cloudSyncDirty=true;return false}
 clearTimeout(cloudSyncTimer);cloudSyncRetryPending=false;
 cloudSyncBusy=true;cloudSyncDirty=false;
 try{
  let payload=cloneCloudValue(cloudPayload());
  for(let attempt=0;attempt<4;attempt++){
   const {response:r,body:j}=await cloudRequest('/api/records',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({payload,expectedRevision:cloudRevision})});
   if(r.status===409||j.conflict){
    if(attempt===3)throw new Error('Cloud kept changing while saving. Your edits are still here; automatic retry is scheduled.');
    setSaveStatus(false,'Cloud updated elsewhere · merging changes safely…');
    const {body:latest}=await cloudRequest('/api/records',{method:'GET',credentials:'same-origin',cache:'no-store'});
    const remote=latest.payload&&typeof latest.payload==='object'?latest.payload:emptyCloudPayload();
    const localNow=cloneCloudValue(cloudPayload());
    const rebased=mergeCloudPayload(cloudBasePayload||emptyCloudPayload(),localNow,remote);
    cloudRevision=Number(latest.revision||0);
    cloudBasePayload=cloneCloudValue(remote);
    applyCloudPayload(rebased);
    payload=cloneCloudValue(cloudPayload());
    continue;
   }
   if(!r.ok||!j.ok)throw new Error(j.error||('HTTP '+r.status));
   cloudRevision=Number(j.revision||cloudRevision+1);
   cloudBasePayload=cloneCloudValue(payload);
   cloudSyncRetryCount=0;cloudSyncRetryPending=false;
   window.myTimeAutoCloudConnected=true;
   const root=$('saveStatus'),label=$('saveStatusText');
   if(root&&label){root.classList.remove('save-status-error');root.classList.add('save-status-ok');label.textContent='Cloud saved · '+(j.email||'your FOSS account');root.title='Confirmed saved in your Cloudflare D1 account. Latest cloud revision '+cloudRevision+'.'}
   return true;
  }
  throw new Error('Cloud save retry limit reached. Your edits have not been discarded.');
 }catch(e){
  window.myTimeAutoCloudConnected=false;
  cloudSyncDirty=true;
  const root=$('saveStatus'),label=$('saveStatusText');
  if(e?.authRequired||cloudAuthRequired){
   cloudSyncRetryPending=false;clearTimeout(cloudSyncTimer);
   if(root&&label){root.classList.remove('save-status-ok');root.classList.add('save-status-error');label.textContent='Sign-in required · pending changes kept';root.title=e.message+' Click to renew Cloudflare Access.'}
   console.warn('myTIME Cloudflare sign-in required:',e);
   return false;
  }
  if(e?.retryable===false){
   cloudSyncRetryPending=false;clearTimeout(cloudSyncTimer);
   if(root&&label){root.classList.remove('save-status-ok');root.classList.add('save-status-error');label.textContent='Cloud save blocked · '+String(e.message||'check save details').slice(0,72);root.title=e.message||'The server rejected this save. Pending edits are retained.'}
   console.error('myTIME Cloudflare rejected a save:',e);
   return false;
  }
  cloudSyncRetryCount=Math.min(cloudSyncRetryCount+1,6);
  cloudSyncRetryPending=true;
  const delay=Math.min(30000,1000*Math.pow(2,cloudSyncRetryCount));
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer=setTimeout(()=>{cloudSyncRetryPending=false;syncCloudNow()},delay);
  if(root&&label){root.classList.remove('save-status-ok');root.classList.add('save-status-error');label.textContent='Cloud save failed · retrying';root.title=(e?.message||'Cloudflare save failed')+' · automatic retry in '+Math.round(delay/1000)+' seconds.'}
  console.warn('myTIME Cloudflare save failed; retry scheduled:',e);
  return false;
 }finally{
  cloudSyncBusy=false;
  if(cloudSyncDirty&&!cloudSyncBlocked&&!cloudSyncRetryPending){clearTimeout(cloudSyncTimer);cloudSyncTimer=setTimeout(syncCloudNow,300)}
 }
}
window.myTimeFlushCloudSync=async function(){
 if(!cloudSyncReady)throw new Error('Cloudflare is not ready; the change has not been confirmed saved.');
 for(let attempt=0;attempt<8;attempt++){
  clearTimeout(cloudSyncTimer);cloudSyncRetryPending=false;
  while(cloudSyncBusy)await new Promise(resolve=>setTimeout(resolve,50));
  if(cloudSyncBlocked)throw new Error('Cloud updates are paused until the latest cloud copy is loaded.');
  if(cloudSyncDirty){
   const saved=await syncCloudNow();
   if(!saved)throw new Error('Cloud save failed. Your edit is retained locally and will retry automatically.');
   continue;
  }
  if(!window.myTimeAutoCloudConnected)throw new Error('Cloudflare has not confirmed the latest save.');
  if(!cloudSyncBusy&&!cloudSyncDirty)return true;
 }
 throw new Error('Cloud kept changing during the save. Your edit is retained and will retry automatically.');
};
async function initCloudSync() {
 clearTimeout(cloudSyncTimer);
 cloudSyncReady=false;
 cloudSyncBlocked=true;
 cloudSyncDirty=false;
 while(cloudSyncBusy)await new Promise(resolve=>setTimeout(resolve,50));
 try{
  setCloudStartupGate(false,'Loading the latest timecard directly from Cloudflare D1…');
  setSaveStatus(false,'Loading your latest Cloudflare D1 data…');
  const {body:j}=await cloudRequest('/api/records',{method:'GET',credentials:'same-origin',cache:'no-store'});
  cloudRevision=Number(j.revision||0);
  cloudBasePayload=cloneCloudValue(j.payload||emptyCloudPayload());
  if(j.payload){
   /* Never merge a stale browser copy into a cloud snapshot. */
   applyCloudPayload(j.payload);
   cloudSyncDirty=false;
   cloudSyncBlocked=false;
   window.myTimeAutoCloudConnected=true;
   cloudSyncReady=true;
   setSaveStatus(true,'Cloud loaded · revision '+cloudRevision);
   setCloudStartupGate(true);
  }else{
   /* A new cloud account starts empty; do not seed it from this browser. */
   const defaults={startTime:'08:00',endTime:'17:00',lunchStart:'11:30',lunchEnd:'12:30',morningBreakTime:'10:00',afternoonBreakTime:'15:00',goalHours:8,timezone:'local'};
   applyCloudPayload({records:{},settings:defaults,bankEntries:[],profile:{name:'',email:typeof authenticatedUserEmail==='string'?authenticatedUserEmail:'',photo:''},theme:'light',localState:{}});
   cloudSyncDirty=false;
   cloudSyncBlocked=false;
   window.myTimeAutoCloudConnected=true;
   cloudSyncReady=true;
   setSaveStatus(true,'Cloud account ready · no records saved yet');
   setCloudStartupGate(true);
  }
  return true;
 }catch(e){
  cloudSyncReady=false;
  cloudSyncBlocked=false;
  window.myTimeAutoCloudConnected=false;
  if(e?.authRequired||cloudAuthRequired){
   setSaveStatus(false,'Sign-in required · pending changes kept');
   setCloudStartupGate(false,'Your Cloudflare Access session needs to be renewed. Select the retry control to sign in again. Pending browser changes have not been cleared.');
  }else{
   setSaveStatus(false,'Cloud load failed · '+String(e?.message||'retry needed').slice(0,78));
   setCloudStartupGate(false,'Cloudflare could not load this account: '+String(e?.message||'Unknown error')+'. Pending browser changes have not been cleared.');
  }
  console.warn('myTIME Cloudflare load failed:',e);
  return false;
 }
}
window.myTimeQueueCloudSync=queueCloudSync;
let cloudRetryBusy=false;
async function retryCloudSync(){
 const root=$('saveStatus'),label=$('saveStatusText');
 if(cloudRetryBusy)return;
 if(cloudAuthRequired){startMyTimeAccessLogin();return}
 cloudRetryBusy=true;
 if(root)root.setAttribute('aria-busy','true');
 try{
  if(cloudSyncReady&&cloudSyncDirty){
   /* A retry click must save pending edits first, never replace them with a
      cloud snapshot. The normal sync path also performs a safe 409 rebase. */
   cloudSyncBlocked=false;cloudSyncRetryPending=false;clearTimeout(cloudSyncTimer);
   if(label)label.textContent='Retrying your pending save safely…';
   let saved=false;
   for(let attempt=0;attempt<8;attempt++){
    while(cloudSyncBusy)await new Promise(resolve=>setTimeout(resolve,50));
    if(!cloudSyncDirty){saved=true;break}
    saved=await syncCloudNow();
    if(!saved)break;
   }
   if(!saved||cloudSyncDirty||!window.myTimeAutoCloudConnected)throw new Error('Your pending changes are still retained. Cloudflare will retry automatically.');
  }else{
   if(label)label.textContent='Loading the latest Cloudflare D1 copy…';
   const loaded=await initCloudSync();
   if(!loaded)throw new Error('The latest Cloudflare copy could not be loaded. No local data was uploaded.');
  }
 }catch(error){
  window.myTimeAutoCloudConnected=false;
  setSaveStatus(false,'Cloud connection needs attention · pending data kept');
  console.warn('myTIME cloud retry failed:',error);
 }finally{
  cloudRetryBusy=false;
  if(root)root.removeAttribute('aria-busy');
 }
}
(function attachCloudRetry(){const root=$('saveStatus');if(root){root.addEventListener('click',retryCloudSync);root.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();retryCloudSync()}});root.title='Click to load the latest Cloudflare D1 data or retry connection'}const retry=$('cloudStartupRetry');if(retry)retry.addEventListener('click',retryCloudSync)})();
function save(){try{localStorage.setItem(KEY,JSON.stringify(data));setSaveStatus(false,'Waiting for Cloudflare save confirmation…');queueCloudSync();return true}catch(e){setSaveStatus(false,'Temporary recovery copy failed');return false}}
function saveSet(){try{localStorage.setItem(SETKEY,JSON.stringify(settings));setSaveStatus(false,'Waiting for Cloudflare settings save…');queueCloudSync();return true}catch(e){setSaveStatus(false,'Settings not saved');return false}}
function humanTime(value){if(!value)return '—';const [h,m]=value.split(':').map(Number);return new Date(2000,0,1,h,m).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}
function renderWorkSettingsSummary(){$('summaryStart').textContent=humanTime(settings.startTime);$('summaryEnd').textContent=humanTime(settings.endTime);$('summaryLunch').textContent=humanTime(settings.lunchStart)+'–'+humanTime(settings.lunchEnd);$('summaryMorningBreak').textContent=humanTime(settings.morningBreakTime||'10:00');$('summaryAfternoonBreak').textContent=humanTime(settings.afternoonBreakTime||'15:00');$('summaryGoal').textContent=Number(settings.goalHours||8)+' hours'}
function openWorkSettings(open){$('workSettingsPanel').hidden=!open;$('workSettingsSummary').hidden=open;if(open)$('startTime').focus()}
$('openWorkSettings').onclick=()=>openWorkSettings(true);
$('cancelSettings').onclick=()=>{applySettings();openWorkSettings(false)};
function clockTextAt(ts){const d=new Date(ts);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}function day(){return data[todayKey()]||(data[todayKey()]={punches:[],audit:[]})}function parseTime(s){let [h,m]=s.split(':').map(Number);return h*60+m}function fmtMin(n){n=Math.max(0,Math.floor(n));return Math.floor(n/60)+'h '+String(n%60).padStart(2,'0')+'m'}function fmtDate(d){return new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(d)}function fmtClock(d){return new Intl.DateTimeFormat(settings.timezone==='UTC'?'en-US':undefined,{hour:'numeric',minute:'2-digit',second:'2-digit',...(settings.timezone==='UTC'?{timeZone:'UTC'}:{})}).format(d)}function fmtTime(ts){return new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(new Date(ts))}function paidMs(rec,now=Date.now()){let p=rec?.punches||[],ms=0,start=null;for(const x of p){if(x.type==='in')start=x.ts;if(x.type==='lunch-start'&&start){ms+=Math.max(0,x.ts-start);start=null}if(x.type==='lunch-end')start=x.ts;if(x.type==='out'&&start){ms+=Math.max(0,x.ts-start);start=null}}if(start)ms+=Math.max(0,now-start);return ms}function lunchMs(rec,now=Date.now()){let p=rec?.punches||[],s=null,ms=0;for(const x of p){if(x.type==='lunch-start')s=x.ts;if(x.type==='lunch-end'&&s){ms+=x.ts-s;s=null}}if(s)ms+=now-s;return ms}function currentState(){let p=day().punches.filter(x=>!['morning-break-start','morning-break-end','afternoon-break-start','afternoon-break-end'].includes(x.type));return p.length?p[p.length-1].type:'none'}function active15MinuteBreak(rec=day()){let p=rec.punches||[],active=null;for(const x of p){if(x.type==='morning-break-start')active={key:'morning',start:x.ts};if(x.type==='morning-break-end'&&active?.key==='morning')active=null;if(x.type==='afternoon-break-start')active={key:'afternoon',start:x.ts};if(x.type==='afternoon-break-end'&&active?.key==='afternoon')active=null}return active}function next15MinuteBreak(rec=day()){let p=rec.punches||[];for(const key of ['morning','afternoon'])if(!p.some(x=>x.type===key+'-break-start'))return key;return null}function projectedFinish(){let p=day().punches,first=p.find(x=>x.type==='in');if(!first)return null;let start=first.ts,goal=settings.goalHours*3600000,breakPlanned=Math.max(0,parseTime(settings.lunchEnd)-parseTime(settings.lunchStart))*60000;let lunchStarted=p.some(x=>x.type==='lunch-start'),lunchEnded=p.some(x=>x.type==='lunch-end'),lunchActual=lunchMs(day());let remainingLunch=lunchEnded?0:Math.max(0,breakPlanned-lunchActual);let elapsed=paidMs(day());let finish=Date.now()+Math.max(0,goal-elapsed)+remainingLunch;return new Date(finish)}function punch(type){let r=day(),last=currentState(),now=Date.now();if(type==='15-break-start'){if(!['in','lunch-end'].includes(last)){alert('Clock in and return from lunch before starting a 15-minute break.');return}if(active15MinuteBreak(r)){alert('End your current 15-minute break first.');return}const key=next15MinuteBreak(r);if(!key){alert('Both 15-minute breaks already have start punches today.');return}type=key+'-break-start';r.breakStatus=r.breakStatus||{};r.breakTimes=r.breakTimes||{};r.breakStatus[key]='taken';r.breakTimes[key]=r.breakTimes[key]||{};r.breakTimes[key].start=clockTextAt(now)}else if(type==='15-break-end'){const active=active15MinuteBreak(r);if(!active){alert('There is no active 15-minute break to end.');return}type=active.key+'-break-end';r.breakTimes=r.breakTimes||{};r.breakTimes[active.key]=r.breakTimes[active.key]||{};r.breakTimes[active.key].end=clockTextAt(now)}else{let allowed={none:['in'],'in':['lunch-start','out'],'lunch-start':['lunch-end'],'lunch-end':['lunch-start','out'],out:[]};if(!allowed[last]?.includes(type)){alert('That punch is not available in the current shift sequence.');return}}r.punches.push({type,ts:now});r.breakStatus=r.breakStatus||{};r.breakTimes=r.breakTimes||{};const clockText=clockTextAt(now);if(type==='lunch-start'){r.breakStatus.lunch='taken';r.breakTimes.lunch=r.breakTimes.lunch||{};r.breakTimes.lunch.start=clockText}if(type==='lunch-end'){r.breakStatus.lunch='taken';r.breakTimes.lunch=r.breakTimes.lunch||{};r.breakTimes.lunch.end=clockText}if(type==='morning-break-start'||type==='afternoon-break-start'){const key=type.startsWith('morning')?'morning':'afternoon';r.breakStatus[key]='taken';r.breakTimes[key]=r.breakTimes[key]||{};r.breakTimes[key].start=clockText}if(type==='morning-break-end'||type==='afternoon-break-end'){const key=type.startsWith('morning')?'morning':'afternoon';r.breakStatus[key]='taken';r.breakTimes[key]=r.breakTimes[key]||{};r.breakTimes[key].end=clockText}save();render();if(typeof renderMyTimeCalendar==='function'&&document.getElementById('myTimeCalendarRoot'))renderMyTimeCalendar();if(type==='out'&&new Date(now).getDay()===5&&typeof window.myTimeSendFridayReport==='function')window.myTimeFlushCloudSync().then(()=>window.myTimeSendFridayReport()).catch(e=>console.error('Friday report delivery failed',e))}function typeName(t){return ({in:'Clock in', 'lunch-start':'Lunch started','lunch-end':'Lunch ended',out:'Clock out','morning-break-start':'Morning 15-minute break started','morning-break-end':'Morning 15-minute break ended','afternoon-break-start':'Afternoon 15-minute break started','afternoon-break-end':'Afternoon 15-minute break ended'})[t]||t}function renderTimeline(){const p=day().punches||[],box=$('timeline');box.innerHTML='';if(!p.length){box.innerHTML='<div class="empty">No punches yet. Clock in to begin your day.</div>';return}const strip=document.createElement('div');strip.className='punch-strip';strip.setAttribute('aria-label',"Today's punches in chronological order");p.forEach(x=>{const chip=document.createElement('div');chip.className='punch-chip';const label=document.createElement('span'),time=document.createElement('strong');label.textContent=typeName(x.type);time.textContent=fmtTime(x.ts);chip.append(label,time);strip.appendChild(chip)});box.appendChild(strip)}function renderMonth(){
 const month=$('monthFilter').value||todayKey().slice(0,7),rows=Object.keys(data).filter(k=>k.startsWith(month)).sort().reverse(),body=$('monthRows');
 body.innerHTML='';let total=0;
 rows.forEach(k=>{
  const r=data[k],p=r.punches||[],first=p.find(x=>x.type==='in'),last=[...p].reverse().find(x=>x.type==='out'),ls=p.find(x=>x.type==='lunch-start'),le=p.find(x=>x.type==='lunch-end'),ms=paidMs(r,last?.ts||Date.now());
  if(last)total+=ms;
  const tr=document.createElement('tr');
  tr.innerHTML='<td>'+k+'</td><td>'+(first?fmtTime(first.ts):'—')+'</td><td>'+(ls&&le?fmtMin((le.ts-ls.ts)/60000):ls?'In progress':'—')+'</td><td>'+(last?fmtTime(last.ts):'—')+'</td><td>'+fmtMin(ms/60000)+'</td><td>'+(last?'Complete':first?'In progress':'—')+'</td><td>'+(lateStartMinutes(k)>0?'Late '+fmtMin(lateStartMinutes(k)):'On time')+(recoveryNote(k)?'<small style="display:block;max-width:240px;white-space:normal">Make-up: '+recoveryNote(k).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</small>':'')+'</td>';
  const documented=document.createElement('td');
  documented.className='record-break-summary';
  documented.textContent=typeof calendarBreakSummary==='function'?calendarBreakSummary(r,true):'Break record available in Calendar';
  tr.appendChild(documented);
  body.appendChild(tr);
 });
 if(!rows.length)body.innerHTML='<tr><td colspan="8">No records for this month.</td></tr>';
 $('monthSummary').textContent=rows.length+' day(s) · '+fmtMin(total/60000)+' completed paid time · loaded from Cloudflare';
}
function updateBreakCountdown(){
 const box=$('breakCountdown');if(!box)return;
 const r=day(),state=currentState(),active=active15MinuteBreak(r);
 let title='',start=0,duration=0;
 if(active){title=(active.key==='morning'?'Morning':'Afternoon')+' 15-minute break';start=active.start;duration=15*60*1000}
 else if(state==='lunch-start'){
  const p=r.punches||[],lastStart=[...p].reverse().find(x=>x.type==='lunch-start');
  if(lastStart){title='Lunch break';start=lastStart.ts;duration=Math.max(1,parseTime(settings.lunchEnd)-parseTime(settings.lunchStart))*60*1000}
 }
 if(!start||!duration){box.hidden=true;box.classList.remove('overdue');return}
 box.hidden=false;
 const elapsed=Math.max(0,Date.now()-start),remaining=duration-elapsed,over=elapsed-duration,percent=Math.min(100,elapsed/duration*100);
 const shown=Math.abs(remaining),mins=Math.floor(shown/60000),secs=Math.floor((shown%60000)/1000),clock=String(mins).padStart(2,'0')+':'+String(secs).padStart(2,'0');
 $('breakCountdownTitle').textContent=title+(remaining>0?' · countdown':' · overage');
 $('breakCountdownTime').textContent=remaining>0?clock:(!!active?'OVER +'+clock: 'OVER +'+clock);
 $('breakCountdownBar').style.width=percent+'%';
 $('breakCountdownProgress').setAttribute('aria-valuenow',String(Math.round(percent)));
 box.classList.toggle('overdue',remaining<=0);box.classList.toggle('over15',!!active&&remaining<=0);
 $('breakCountdownHelp').textContent=remaining>0?'Time remaining in your '+(active?'15-minute paid break':'scheduled lunch')+'. The bar fills as time passes.':(active?'Your break is '+clock+' over 15 minutes. The timer keeps counting until you end the break.':'Your lunch is '+clock+' over its scheduled duration. The timer keeps counting until you end lunch.');
}
setInterval(updateBreakCountdown,1000);
const REMINDER_PREF_KEY='foss-time-desktop-reminders-v1';
let desktopRemindersEnabled=localStorage.getItem(REMINDER_PREF_KEY)==='true';
function updateReminderPreferenceUI(){
 const btn=$('enableBreakNotifications'),status=$('breakNotificationStatus');if(!btn||!status)return;
 btn.textContent=desktopRemindersEnabled?'Desktop reminders enabled':'Enable desktop reminders';
 status.textContent=desktopRemindersEnabled?'Desktop alerts enabled · keep this page open for scheduled alerts.':'In-app reminders work while myTIME is open. Desktop alerts are optional.';
}
$('enableBreakNotifications').onclick=async()=>{
 if(!('Notification'in window)){alert('Desktop notifications are not supported in this browser. In-app reminders will still work while myTIME is open.');return}
 try{const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();if(permission!=='granted'){desktopRemindersEnabled=false;localStorage.setItem(REMINDER_PREF_KEY,'false');updateReminderPreferenceUI();alert('Notifications were not allowed. In-app reminders will still appear while myTIME is open.');return}
 desktopRemindersEnabled=true;localStorage.setItem(REMINDER_PREF_KEY,'true');updateReminderPreferenceUI();new Notification('myTIME reminders enabled',{body:'You’ll get a reminder 10 minutes before scheduled lunch and breaks while myTIME is open.'});
 }catch{alert('Could not enable desktop notifications. In-app reminders will still work while myTIME is open.')}
};
function renderScheduleReminders(){
 const now=new Date(),r=day(),p=r.punches||[],state=currentState(),nowMinutes=now.getHours()*60+now.getMinutes();
 updateReminderPreferenceUI();
 const events=[
  {key:'morning',time:settings.morningBreakTime||'10:00',label:'Morning paid break',duration:15,done:p.some(x=>x.type==='morning-break-start')},
  {key:'lunch',time:settings.lunchStart||'11:30',label:'Lunch',duration:Math.max(1,parseTime(settings.lunchEnd||'12:30')-parseTime(settings.lunchStart||'11:30')),done:p.some(x=>x.type==='lunch-start')},
  {key:'afternoon',time:settings.afternoonBreakTime||'15:00',label:'Afternoon paid break',duration:15,done:p.some(x=>x.type==='afternoon-break-start')}
 ];
 let upcoming=null;
 for(const ev of events){
  const el=$(ev.key+'ScheduleItem');if(!el)continue;
  const start=parseTime(ev.time),past=nowMinutes>start+ev.duration;
  el.classList.toggle('is-past',past||ev.done);el.classList.remove('is-next');
  const timeLabel=ev.key==='lunch'?humanTime(ev.time)+'–'+humanTime(settings.lunchEnd||'12:30'):humanTime(ev.time)+' · '+ev.duration+' minutes';
  $(ev.key+'ScheduleTime').textContent=timeLabel+(ev.done?' · recorded':past?' · time passed':'');
  if(!upcoming&&!ev.done&&start>=nowMinutes-ev.duration)upcoming=ev;
 }
 if(upcoming)$(upcoming.key+'ScheduleItem').classList.add('is-next');
 const popup=$('schedulePopup'),dismissed=localStorage.getItem('foss-time-dismissed-reminder-'+todayKey());
 const due=events.find(ev=>!ev.done&&nowMinutes>=parseTime(ev.time)-10&&nowMinutes<parseTime(ev.time)+ev.duration);
 if(due&&['in','lunch-end'].includes(state)&&!active15MinuteBreak(r)&&dismissed!==due.key){
  popup.hidden=false;$('schedulePopupTitle').textContent=due.label+' coming up';
  $('schedulePopupText').textContent=nowMinutes<parseTime(due.time)?'Your scheduled time is in '+(parseTime(due.time)-nowMinutes)+' minute(s).':'It is time for your scheduled '+due.label.toLowerCase()+'.';
  popup.dataset.reminder=due.key;
  const firedKey='foss-time-notified-'+todayKey()+'-'+due.key;
  if(desktopRemindersEnabled&&'Notification'in window&&Notification.permission==='granted'&&!localStorage.getItem(firedKey)){
   try{new Notification('myTIME · '+due.label+' coming up',{body:nowMinutes<parseTime(due.time)?'Scheduled in '+(parseTime(due.time)-nowMinutes)+' minute(s).':'It is time for your scheduled '+due.label.toLowerCase()+'.',icon:'/foss-icon.svg'});localStorage.setItem(firedKey,'true')}catch{}
  }
 }else if(!due||dismissed===due?.key){popup.hidden=true}
}
$('dismissSchedulePopup').onclick=()=>{const pop=$('schedulePopup');localStorage.setItem('foss-time-dismissed-reminder-'+todayKey(),pop.dataset.reminder||'');pop.hidden=true};
function render(){renderScheduleReminders();updateBreakOveragePanel();let now=new Date();$('liveClock').textContent=fmtClock(now);$('liveDate').textContent=fmtDate(now);$('timezoneLabel').textContent='Local time · '+(settings.timezone==='UTC'?'UTC':Intl.DateTimeFormat().resolvedOptions().timeZone);let state=currentState(),r=day(),p=r.punches,first=p.find(x=>x.type==='in'),out=p.some(x=>x.type==='out'),activeBreakState=active15MinuteBreak(r);$('statusText').textContent=activeBreakState?'On 15-minute break':state==='none'?'Not clocked in':state==='in'?'Working':state==='lunch-start'?'On lunch':state==='lunch-end'?'Working':'Shift complete';const statusDot=document.querySelector('.status .dot');if(statusDot){statusDot.classList.remove('state-working','state-break','state-locked');statusDot.classList.add(activeBreakState||state==='lunch-start'?'state-break':state==='in'||state==='lunch-end'?'state-working':'state-locked');statusDot.setAttribute('aria-hidden','true');}$('actionTitle').textContent=activeBreakState?'Enjoy your 15-minute break':state==='none'?'Ready when you are':state==='in'?'Your shift is underway':state==='lunch-start'?'Enjoy your lunch break':state==='lunch-end'?'Back to work':'You’re all done';$('actionHelp').textContent=activeBreakState?'You are on your '+(activeBreakState.key==='morning'?'morning':'afternoon')+' 15-minute break. End the break when you return to work.':state==='none'?'Clock in to start tracking today’s shift.':state==='in'?'Start lunch or your 15-minute break when scheduled, or clock out when your shift ends.':state==='lunch-start'?'End your lunch break when you return.':state==='lunch-end'?'Keep going until you have completed your paid hours.':'Your punches are saved to your signed-in Cloudflare account after sync is confirmed.';let btn=$('punchBtn'),second=$('secondaryBtn');btn.hidden=state==='lunch-start'||state==='out';btn.disabled=state==='out';btn.textContent=state==='none'?'Clock in':state==='in'?'Start lunch':state==='lunch-end'?'Clock out':'Clock in';btn.onclick=()=>punch(state==='none'?'in':state==='in'?'lunch-start':'out');second.hidden=state!=='lunch-start';second.textContent='End lunch';second.onclick=()=>punch('lunch-end');const activeBreak=active15MinuteBreak(r),nextBreak=next15MinuteBreak(r),startBreakBtn=$('startBreakBtn'),endBreakBtn=$('endBreakBtn');startBreakBtn.hidden=!(['in','lunch-end'].includes(state)&&!activeBreak&&!!nextBreak);startBreakBtn.textContent=nextBreak==='morning'?'Start morning 15-minute break':nextBreak==='afternoon'?'Start afternoon 15-minute break':'Both 15-minute breaks punched';startBreakBtn.disabled=!nextBreak;startBreakBtn.onclick=()=>punch('15-break-start');endBreakBtn.hidden=!activeBreak;endBreakBtn.textContent=activeBreak?'End '+(activeBreak.key==='morning'?'morning':'afternoon')+' 15-minute break':'End 15-minute break';endBreakBtn.onclick=()=>punch('15-break-end');$('breakPunchHint').textContent=activeBreak?'Break started at '+fmtTime(activeBreak.start)+'. End the break when you return.':nextBreak?('Next scheduled punch: '+(nextBreak==='morning'?'morning':'afternoon')+' 15-minute break. Break time is logged separately and never treated as make-up time.'):'Both 15-minute breaks have start punches logged for today.';updateWeeklyOvertimeAlert(now.getTime());let ms=paidMs(r),goal=settings.goalHours*3600000,remain=Math.max(0,goal-ms);$('paidMetric').textContent=fmtMin(ms/60000);$('paidSub').textContent='Goal: '+settings.goalHours+' paid hours';$('remainingMetric').textContent=fmtMin(remain/60000);let pct=Math.min(100,ms/goal*100);$('progressBar').style.width=pct+'%';$('progressLabel').textContent=Math.floor(pct)+'% of daily goal';let fin=projectedFinish();$('finishMetric').textContent=fin?new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(fin):new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format((()=>{const d=new Date();d.setHours(parseTime(settings.endTime)/60,parseTime(settings.endTime)%60,0,0);return d})());$('finishSub').textContent=(first?'Daily target based on actual clock-in and lunch punches. ':'Daily target finish. ')+'Scheduled end: '+humanTime(settings.endTime)+'.';updateBreakCountdown();$('dayTag').textContent=todayKey();renderTimeline();renderMonth()}function applySettings(){for(let k of ['startTime','endTime','lunchStart','lunchEnd','morningBreakTime','afternoonBreakTime','goalHours','timezone']){let el=$(k);if(el)el.value=settings[k]} }$('saveSettings').onclick=()=>{settings={...settings,startTime:$('startTime').value||'08:00',endTime:$('endTime').value||'17:00',lunchStart:$('lunchStart').value||'11:30',lunchEnd:$('lunchEnd').value||'12:30',morningBreakTime:$('morningBreakTime').value||'10:00',afternoonBreakTime:$('afternoonBreakTime').value||'15:00',goalHours:Math.min(16,Math.max(1,Number($('goalHours').value)||8)),timezone:$('timezone').value};saveSet();applySettings();render();renderWorkSettingsSummary();renderScheduleReminders();openWorkSettings(false)};function download(name,content,type){let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();URL.revokeObjectURL(a.href)}$('exportJson').onclick=()=>download('myTIME-backup-'+todayKey()+'.json',JSON.stringify({app:'FOSS myTIME',version:3,settings,data,bankEntries,profile:typeof profile!=='undefined'?profile:null,theme:localStorage.getItem('foss-time-theme-v1')||'light',exportedAt:new Date().toISOString()},null,2),'application/json');$('exportCsv').onclick=()=>{let lines=[['Date','First In','Lunch Start','Lunch End','Last Out','Paid Minutes','Punches'].join(',')];Object.keys(data).filter(k=>k.startsWith(($('monthFilter').value||todayKey().slice(0,7)))).sort().forEach(k=>{let p=data[k].punches||[],get=t=>p.find(x=>x.type===t),last=[...p].reverse().find(x=>x.type==='out');let cells=[k,get('in')?fmtTime(get('in').ts):'',get('lunch-start')?fmtTime(get('lunch-start').ts):'',get('lunch-end')?fmtTime(get('lunch-end').ts):'',last?fmtTime(last.ts):'',Math.round(paidMs(data[k],last?.ts||Date.now())/60000),p.map(x=>typeName(x.type)+' '+fmtTime(x.ts)).join('; ')];lines.push(cells.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(','))});download('myTIME-timesheet-'+($('monthFilter').value||todayKey().slice(0,7))+'.csv',lines.join('\r\n'),'text/csv')};$('restoreFile').onchange=async e=>{let f=e.target.files[0];if(!f)return;try{let j=JSON.parse(await f.text());if(!j.data||typeof j.data!=='object')throw Error();if(!confirm('Replace this browser’s time records and settings with the selected backup? Export a backup first if needed.'))return;data=j.data;if(j.settings)settings=j.settings;if(Array.isArray(j.bankEntries))bankEntries=j.bankEntries;save();saveSet();localStorage.setItem(BANKKEY,JSON.stringify(bankEntries));if(j.profile&&typeof j.profile==='object'){profile={name:String(j.profile.name||''),email:String(j.profile.email||''),photo:String(j.profile.photo||'')};localStorage.setItem('foss-time-profile-v1',JSON.stringify(profile));if(typeof renderProfile==='function')renderProfile()}if(j.theme==='dark'||j.theme==='light')localStorage.setItem('foss-time-theme-v1',j.theme);applySettings();render();alert('Backup restored on this device, including profile details when present.')}catch{alert('That backup file could not be read.')}};
const printTitles={dashboard:'Daily Time Report',calendar:'Monthly Time Calendar',timesheets:'Monthly Timesheet & Backup',weekly:'Weekly Schedule & Punches',records:'Time Records',import:'Time Data & Export Report',settings:'Workday Settings',integrations:'Integrations Overview'};
function preparePrintReport(){
 const active=document.querySelector('.tab-page:not([hidden])')||document.querySelector('#page-dashboard');
 if(!active)return;
 document.body.classList.toggle('print-wide',active.id==='page-timesheets'||active.id==='page-weekly');
 const toolsCard=document.getElementById('exportCsv')?.closest('article');
 if(toolsCard)toolsCard.classList.add('print-tools');
 document.querySelectorAll('.print-report-head,.print-report-foot').forEach(n=>n.remove());
 const now=new Date();
 const dateLabel=now.toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'});
 const head=document.createElement('div');head.className='print-report-head';
 const brand=document.createElement('div');brand.className='print-brand';
 const logo=document.createElement('img');logo.className='print-mark';logo.alt='FOSS';logo.src='https://www.fossanalytics.com/Design/static/foss-logo.png';logo.onerror=()=>logo.remove();
 const brandText=document.createElement('div');brandText.innerHTML='<div class="print-brand-name">myTIME</div><div class="print-brand-sub">FOSS North America · Workforce time report</div>';
 brand.append(logo,brandText);
 const meta=document.createElement('div');meta.className='print-report-meta';
 const title=document.createElement('strong');title.textContent=printTitles[active.id.replace('page-','')]||'myTIME Report';
 const date=document.createElement('span');date.textContent='Prepared '+dateLabel;
 meta.append(title,date);head.append(brand,meta);active.prepend(head);
 const foot=document.createElement('div');foot.className='print-report-foot';
 const left=document.createElement('span');left.textContent='myTIME · FOSS North America';
 const right=document.createElement('span');right.textContent='Generated '+now.toLocaleString();
 foot.append(left,right);active.append(foot);
 document.body.classList.add('printing-report');
}
function cleanPrintReport(){document.querySelectorAll('.print-report-head,.print-report-foot').forEach(n=>n.remove());document.querySelectorAll('.print-tools').forEach(n=>n.classList.remove('print-tools'));document.body.classList.remove('printing-report','print-wide')}
window.addEventListener('beforeprint',preparePrintReport);window.addEventListener('afterprint',cleanPrintReport);
$('printBtn').onclick=()=>{preparePrintReport();window.print();};
$('monthFilter').value=todayKey().slice(0,7);$('monthFilter').onchange=renderMonth;$('correctBtn').onclick=()=>{let r=day(),p=r.punches;if(!p.length){alert('There are no punches to correct today.');return}let choice=prompt('Enter the punch number to correct (1–'+p.length+'):\n'+p.map((x,i)=>(i+1)+'. '+typeName(x.type)+' — '+fmtTime(x.ts)).join('\n'));if(choice===null)return;let i=Number(choice)-1;if(!Number.isInteger(i)||i<0||i>=p.length){alert('Invalid punch number.');return}let reason=prompt('Required reason for correction:');if(!reason?.trim()){alert('A reason is required. No change made.');return}let old={...p[i]},newType=prompt('New punch type: in, lunch-start, lunch-end, or out',old.type);if(!['in','lunch-start','lunch-end','out'].includes(newType)){alert('Invalid type. No change made.');return}let tsInput=prompt('New date/time (YYYY-MM-DD HH:MM) or leave blank to keep time:',new Date(old.ts).getFullYear()+'-'+String(new Date(old.ts).getMonth()+1).padStart(2,'0')+'-'+String(new Date(old.ts).getDate()).padStart(2,'0')+' '+String(new Date(old.ts).getHours()).padStart(2,'0')+':'+String(new Date(old.ts).getMinutes()).padStart(2,'0'));let ts=old.ts;if(tsInput?.trim()){let parsed=new Date(tsInput.replace(' ','T'));if(Number.isNaN(parsed.getTime())){alert('Invalid date/time. No change made.');return}ts=parsed.getTime()}r.audit=r.audit||[];r.audit.push({at:Date.now(),before:old,after:{type:newType,ts},reason:reason.trim()});p[i]={type:newType,ts};p.sort((a,b)=>a.ts-b.ts);save();render();alert('Punch corrected and correction reason saved in the local audit history. Export a JSON backup to preserve the audit.');};applySettings();
function updateBreakOveragePanel(now=Date.now()){const root=$('breakOverageSummary');if(!root)return;const p=day().punches||[];function durationFor(st,et){let start=null,total=0;for(const x of p){if(x.type===st)start=x.ts;else if(x.type===et&&start!==null){total+=Math.max(0,x.ts-start);start=null}}if(start!==null)total+=Math.max(0,now-start);return total}function fmt(ms){const n=Math.floor(Math.max(0,ms)/60000);return Math.floor(n/60)?Math.floor(n/60)+' hr '+n%60+' min':n+' min'}const lm=durationFor('lunch-start','lunch-end'),ll=Math.max(0,(parseTime(settings.lunchEnd)-parseTime(settings.lunchStart))*60000),bm=durationFor('morning-break-start','morning-break-end'),ba=durationFor('afternoon-break-start','afternoon-break-end');root.innerHTML='';[['Lunch',lm,ll],['Morning 15-minute break',bm,900000],['Afternoon 15-minute break',ba,900000]].forEach(([label,actual,limit])=>{const line=document.createElement('div');line.className='overage-line';const name=document.createElement('span');name.textContent=label;const value=document.createElement('span');value.className='overage-value'+(actual>limit?' over':'');value.textContent=actual>limit?'Over by '+fmt(actual-limit)+' · Total '+fmt(actual):fmt(actual)+' / '+fmt(limit)+' planned';line.append(name,value);root.append(line)});const note=document.createElement('small');note.className='sub';note.textContent='Updates live while a break is active. Lunch allowance follows the scheduled lunch start/end in Settings; each rest break allowance is 15 minutes.';root.append(note)}
function updateWeeklyOvertimeAlert(now=Date.now()){
 const alert=$('weeklyOvertimeAlert'),title=$('weeklyOvertimeTitle'),message=$('weeklyOvertimeMessage'),plan=$('weeklyPlanPanel'),planTitle=$('weeklyPlanTitle'),planMessage=$('weeklyPlanMessage');
 if(!alert||!title||!message)return;
 const date=new Date(now),dayIndex=(date.getDay()+6)%7,monday=new Date(date.getFullYear(),date.getMonth(),date.getDate()-dayIndex);monday.setHours(0,0,0,0);
 const weekKeys=[];for(let i=0;i<5;i++){const d=new Date(monday);d.setDate(monday.getDate()+i);weekKeys.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'))}
 let total=0;for(const key of weekKeys){const rec=data[key];if(!rec)continue;const end=key===todayKey()?now:Math.min(now,new Date(key+'T23:59:59').getTime());if(end>new Date(key+'T00:00:00').getTime())total+=paidMs(rec,end)}
 const limit=40*3600000,over=Math.max(0,total-limit),exceeded=over>0;document.body.classList.toggle('weekly-overtime-exceeded',exceeded);alert.hidden=!exceeded;
 const fmt=ms=>{const n=Math.floor(Math.max(0,ms)/60000);return (Math.floor(n/60)?Math.floor(n/60)+' hr ':'')+(n%60)+' min'};
 const todayRecord=data[todayKey()],todayPaid=todayRecord?paidMs(todayRecord,now):0;
 if(exceeded){title.textContent='40-hour weekly limit exceeded';message.textContent='You are '+fmt(over)+' over 40 paid hours this week. Total paid time so far: '+fmt(total)+'.';}
 else{title.textContent='40-hour weekly limit';message.textContent='You have '+fmt(limit-total)+' of paid time remaining before 40 hours.'}
 if(plan&&planTitle&&planMessage){
  const goalHours=Math.max(0,Number(settings.goalHours||8)),scheduledPerDay=goalHours*3600000;
  let pastPaid=0;for(let i=0;i<Math.min(dayIndex,5);i++){const rec=data[weekKeys[i]];if(rec)pastPaid+=paidMs(rec,Math.min(now,new Date(weekKeys[i]+'T23:59:59').getTime()))}
  let futureDays=0;for(let i=Math.max(0,dayIndex+1);i<5;i++)futureDays++;
  const todayHasOut=!!(todayRecord&&getOut(todayRecord));
  const todayForecast=dayIndex>=5?todayPaid:(todayHasOut?todayPaid:Math.max(todayPaid,scheduledPerDay));
  const projected=pastPaid+todayForecast+futureDays*scheduledPerDay;
  const active=!!(todayRecord&&(todayRecord.punches||[]).some(x=>x.type==='in')&&!getOut(todayRecord));
  if(dayIndex<5&&projected>limit&&(!todayHasOut||exceeded)){
   const remainingToday=Math.max(0,limit-pastPaid-futureDays*scheduledPerDay-todayPaid);
   let unpaidLunchToCome=0;
   if(active){
    const punches=todayRecord.punches||[],lunchStarted=punches.some(x=>x.type==='lunch-start'),lunchEnded=punches.some(x=>x.type==='lunch-end');
    const plannedLunch=Math.max(0,parseTime(settings.lunchEnd)-parseTime(settings.lunchStart))*60000;
    if(lunchStarted&&!lunchEnded)unpaidLunchToCome=Math.max(0,plannedLunch-lunchMs(todayRecord,now));
    else if(!lunchStarted&&now<new Date(new Date(now).setHours(parseTime(settings.lunchStart)/60,parseTime(settings.lunchStart)%60,0,0)).getTime())unpaidLunchToCome=plannedLunch;
   }
   const suggested=new Date(now+remainingToday+unpaidLunchToCome);
   plan.hidden=false;
   if(exceeded){planTitle.textContent='Overtime already accrued · weekly limit exceeded';planMessage.textContent='You are '+fmt(over)+' over 40 hours already. Your scheduled daily finish is '+settings.endTime+'. '+(active?'If you keep working, additional paid time adds to this overage.':'Review the day you crossed 40 hours to see when the weekly limit was reached.')+' Forecast for the week: '+fmt(projected)+'.';}
   else{planTitle.textContent='Projected weekly overtime · suggested clock-out';planMessage.textContent='If you complete '+futureDays+' remaining weekday shift(s) at '+goalHours+' paid hours each, the week is projected to total '+fmt(projected)+' ('+fmt(Math.max(0,projected-limit))+' over 40). '+(active?'To stay at or under 40 hours, your estimated clock-out today is '+fmtTime(suggested.getTime())+'. ':'Your estimated paid-hour budget for today is '+fmt(Math.max(0,limit-pastPaid-futureDays*scheduledPerDay))+'. ')+ 'Your normal scheduled end is '+settings.endTime+'. This forecast uses actual completed punches and planned future shifts; adjust it if your schedule changes.';
   }
  }else if(exceeded){
   plan.hidden=false;planTitle.textContent='Weekly overtime already accumulated';planMessage.textContent='You are '+fmt(over)+' over 40 paid hours so far. Your normal scheduled end time is '+settings.endTime+'. The weekly limit was crossed during an earlier shift; review that day’s punches for the exact crossing time.';
  }else{
   plan.hidden=false;planTitle.textContent='Weekly hours forecast';planMessage.textContent='Projected total by Friday: '+fmt(projected)+'. '+(active?'Your daily paid-hours target is '+goalHours+' hours; estimated daily finish is shown below.':'Normal scheduled end time: '+settings.endTime+'.')+' The forecast updates as punches are recorded.';
  }
 }
}
function updateClockWorkGuidance(now=Date.now()){
 const box=$('clockWorkGuidance'),title=$('clockWorkGuidanceTitle'),text=$('clockWorkGuidanceText');if(!box||!title||!text)return;
 const fmt=ms=>{const m=Math.floor(Math.max(0,ms)/60000);return (Math.floor(m/60)?Math.floor(m/60)+' hr ':'')+(m%60)+' min'};
 const fmtTime=ts=>new Date(ts).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
 const d=new Date(now),idx=(d.getDay()+6)%7,monday=new Date(d.getFullYear(),d.getMonth(),d.getDate()-idx);monday.setHours(0,0,0,0);
 let total=0,past=0,futureDays=0;for(let i=0;i<5;i++){const dt=new Date(monday);dt.setDate(monday.getDate()+i);const key=dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');const rec=data[key];if(rec){const val=paidMs(rec,key===todayKey()?now:Math.min(now,new Date(key+'T23:59:59').getTime()));total+=val;if(i<idx)past+=val;}if(i>idx)futureDays++}
 const limit=40*3600000,over=Math.max(0,total-limit),punches=day().punches||[],active=punches.some(x=>x.type==='in')&&!punches.some(x=>x.type==='out');
 const todayPaid=paidMs(day(),now),goal=Math.max(0,Number(settings.goalHours||8)),todayFinish=projectedFinish();
 const expectedEnd=new Date(now);expectedEnd.setHours(parseTime(settings.endTime)/60,parseTime(settings.endTime)%60,0,0);
 const scheduledPerDay=goal*3600000,allowedToday=Math.max(0,limit-past-futureDays*scheduledPerDay-todayPaid);
 let html='Week paid time: '+fmt(total)+'. ';
 html+=over>0?'Overtime so far: '+fmt(over)+'. ':'Remaining before 40 hours: '+fmt(limit-total)+'. ';
 html+='Normal scheduled end: '+fmtTime(expectedEnd.getTime())+'. ';
 if(todayFinish)html+='Daily target finish (to reach '+goal+' paid hours): '+fmtTime(todayFinish.getTime())+'. ';
 if(active){
  let lunchExtra=0;const lunchStarted=punches.some(x=>x.type==='lunch-start'),lunchEnded=punches.some(x=>x.type==='lunch-end'),plannedLunch=Math.max(0,parseTime(settings.lunchEnd)-parseTime(settings.lunchStart))*60000;
  if(lunchStarted&&!lunchEnded)lunchExtra=Math.max(0,plannedLunch-lunchMs(day(),now));
  else if(!lunchStarted&&now<new Date(new Date(now).setHours(parseTime(settings.lunchStart)/60,parseTime(settings.lunchStart)%60,0,0)).getTime())lunchExtra=plannedLunch;
  const safeEnd=new Date(now+allowedToday+lunchExtra);
  if(over>0)html+='The 40-hour limit has already been exceeded; any additional paid time increases overtime.';
  else if(futureDays>0&&past+todayPaid+futureDays*scheduledPerDay>limit)html+='To keep the full-week forecast at or below 40 hours, estimated clock-out today is '+fmtTime(safeEnd.getTime())+'.';
  else html+='Projected weekly total with planned shifts: '+fmt(past+Math.max(todayPaid,scheduledPerDay)+futureDays*scheduledPerDay)+'.';
 }
 title.textContent=over>0?'Weekly overtime: '+fmt(over):'Daily finish & weekly forecast';
 text.textContent=html;box.style.background=over>0?'rgba(220,38,38,.2)':'rgba(255,255,255,.12)';box.style.color='inherit';
}
function updateLiveClock(){
 const clock=$('liveClock'),date=$('liveDate'),tz=$('timezoneLabel');
 if(!clock||!date)return;
 const now=new Date();
 clock.textContent=fmtClock(now);
 date.textContent=fmtDate(now);
 if(tz)tz.textContent='Local time · '+(settings.timezone==='UTC'?'UTC':Intl.DateTimeFormat().resolvedOptions().timeZone);
}
/* Start the clock and profile setup even if a dashboard renderer fails.
   A rendering exception must not abort the rest of this main script. */
try{render()}catch(error){console.error('myTIME initial dashboard render failed:',error)}
/* Continuous live clock: repaint every animation frame using wall-clock time. */
let liveClockFrame=0;
function runContinuousClock(){
 try{updateLiveClock();updateWeeklyOvertimeAlert();updateBreakOveragePanel();updateClockWorkGuidance()}catch(error){console.error('myTIME clock/overtime update failed:',error)}
 liveClockFrame=requestAnimationFrame(runContinuousClock);
}
runContinuousClock();
setInterval(()=>{try{render()}catch(error){console.error('myTIME live refresh failed:',error)}},15000);
function refreshMyTimeOnReturn(){
 try{updateLiveClock()}catch(error){console.error('myTIME clock refresh failed:',error)}
 try{render()}catch(error){console.error('myTIME refresh after returning to tab failed:',error)}
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshMyTimeOnReturn()});
window.addEventListener('focus',refreshMyTimeOnReturn);
window.addEventListener('pageshow',refreshMyTimeOnReturn);
// Load the signed-in user's cloud data after all app modules and profile state are initialized.
window.addEventListener('load',()=>initCloudSync(),{once:true});


/* Weekly planning and recovery tools */
const BANKKEY='foss-time-bank-v1';
let bankEntries=load(BANKKEY,[]);
const weekdays=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const defaultDaySchedule={startTime:'08:00',endTime:'17:00',lunchStart:'11:30',lunchEnd:'12:30',goalHours:8};
function ensureWeeklySchedule(){if(!settings.weeklySchedule){settings.weeklySchedule={};for(let d=0;d<7;d++)settings.weeklySchedule[d]=d===0||d===6?{...defaultDaySchedule,goalHours:0}:{...defaultDaySchedule};}else{settings.weeklySchedule[0]={...(settings.weeklySchedule[0]||defaultDaySchedule),goalHours:0};settings.weeklySchedule[6]={...(settings.weeklySchedule[6]||defaultDaySchedule),goalHours:0};}}
function scheduleForDate(dateKey){let d=new Date(dateKey+'T12:00:00');ensureWeeklySchedule();if(d.getDay()===0||d.getDay()===6)return {...defaultDaySchedule,goalHours:0,workday:false};return {...(settings.weeklySchedule[d.getDay()]||defaultDaySchedule),workday:true};}
function weekMonday(date){let d=new Date(date);d.setHours(12,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return d}
function keyDate(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function weekKeys(){let start=new Date(($('weekOf').value||keyDate(weekMonday(new Date())))+'T12:00:00');return Array.from({length:7},(_,i)=>{let d=new Date(start);d.setDate(d.getDate()+i);return keyDate(d)})}
function getPunch(rec,type){return (rec?.punches||[]).find(x=>x.type===type)}
function getOut(rec){return [...(rec?.punches||[])].reverse().find(x=>x.type==='out')}
function actualPaidMinutes(rec){let out=getOut(rec);return Math.round(paidMs(rec,out?.ts||Date.now())/60000)}
function plannedMinutes(s){return Math.max(0,Number(s.goalHours||0)*60)}
function lateStartMinutes(k){const rec=data[k],first=getPunch(rec,'in');if(!first)return 0;const s=scheduleForDate(k);return Math.max(0,(new Date(first.ts).getHours()*60+new Date(first.ts).getMinutes())-parseTime(s.startTime||settings.startTime))}
function recoveryNote(k){return String(data[k]?.makeUpNote||'').trim()}
function bankMinutesForWeek(keys){let set=new Set(keys);return bankEntries.filter(e=>set.has(e.date)).reduce((n,e)=>n+Number(e.minutes||0),0)}
function weekBalanceFor(keys){return keys.reduce((n,k)=>{let rec=data[k],s=scheduleForDate(k);if(!rec?.punches?.length)return n;return n+actualPaidMinutes(rec)-plannedMinutes(s)},0)+bankMinutesForWeek(keys)}
function renderRecovery(){
 const panel=$('recoveryPanel');if(!panel)return;
 const k=todayKey(),s=scheduleForDate(k),rec=data[k],first=rec?getPunch(rec,'in'):null,out=rec?getOut(rec):null;
 const goal=Number(s.goalHours||settings.goalHours||8),startM=parseTime(s.startTime||settings.startTime),actualStart=first?new Date(first.ts).getHours()*60+new Date(first.ts).getMinutes():null;
 const paidToday=rec?.punches?.length?actualPaidMinutes(rec):0,week=weekKeys();
 const deficit=Math.max(0,Math.round(goal*60)-paidToday);
 let projected=0,actualWeek=0,remaining=[];
 week.forEach(dk=>{
  const ds=scheduleForDate(dk),g=plannedMinutes(ds),rr=data[dk],has=!!rr?.punches?.length,done=!!(rr&&getOut(rr)),date=new Date(dk+'T12:00:00');
  if(date.getDay()===0||date.getDay()===6||g<=0)return;
  if(has)actualWeek+=actualPaidMinutes(rr);
  if(dk<k){if(has)projected+=actualPaidMinutes(rr);return}
  if(dk===k){projected+=done?actualPaidMinutes(rr):Math.max(g,has?actualPaidMinutes(rr):0);if(!done)remaining.push(dk);return}
  projected+=done?actualPaidMinutes(rr):(has?Math.max(g,actualPaidMinutes(rr)):g);
  if(!done)remaining.push(dk);
 });
 const gap=Math.max(0,2400-projected),perDay=remaining.length?Math.ceil(gap/remaining.length):gap,opts=[];
 if(gap&&remaining.length){
  opts.push({title:'Spread the gap across remaining workdays',detail:'To project 40 paid hours, plan about '+fmtMin(perDay)+' additional paid time on each of '+remaining.length+' remaining workday(s), on top of the planned shift.'});
  const half=Math.ceil(gap/remaining.length/15)*15;
  opts.push({title:'Choose an exact schedule adjustment',detail:'Add '+fmtMin(half)+' to each remaining shift (rounded up to 15-minute increments), or divide '+fmtMin(gap)+' across fewer days if approved. This is a plan, not recorded work time.'});
  opts.push({title:'Breaks are not automatic make-up credit',detail:'A skipped break only helps if policy allows it and you actually work during that time. Do not skip required breaks or count a skipped paid break as extra hours automatically.'});
  opts.push({title:'Start earlier or finish later—with approval',detail:'An earlier start or later finish can make up the gap without relying on missed meals or rest breaks. Check with your manager before changing your schedule.'});
 }else if(gap)opts.push({title:'Review the week with your manager',detail:'The forecast is '+fmtMin(gap)+' short of 40 paid hours and there are no remaining planned workdays. Ask about an approved schedule adjustment or overtime, if applicable.'});
 if(deficit&&first)opts.unshift({title:'Today’s paid-time estimate',detail:'Recorded punches show '+fmtMin(paidToday)+' paid minutes so far, '+fmtMin(deficit)+' below the '+goal+'-hour daily goal. This updates as actual punches are saved.'});
 const actualLabel=(actualWeek/60).toFixed(2);
 const forecastLabel=(Math.max(0,projected)/60).toFixed(2);
 const bank=bankMinutesForWeek(week);
 const status='<div class="recovery-progress"><div class="recovery-progress-head"><span>Weekly paid-hours target</span><strong>40.00 h</strong></div><div class="recovery-progress-track"><span style="width:'+Math.min(100,Math.max(0,projected/2400*100))+'%"></span></div><div class="recovery-stats"><div><small>Actual recorded</small><strong>'+actualLabel+' h</strong></div><div><small>Projected by week end</small><strong>'+forecastLabel+' h</strong></div><div><small>Projected gap</small><strong>'+(gap?(gap/60).toFixed(2)+' h':'On track')+'</strong></div></div><p class="sub">Actual paid hours stay based on recorded punches. Skipped breaks never automatically count as extra worked time. '+(bank?'Time-bank entries ('+fmtMin(bank)+') are shown separately and are not counted as paid hours here. ':'')+'Future shifts are estimates, not completed time.</p></div>';
 const list=opts.length?'<div class="suggestion-list">'+opts.map(o=>'<div class="suggestion"><strong>'+o.title+'</strong><span>'+o.detail+'</span></div>').join('')+'</div>':'<p>You are projected to reach the 40 paid-hour target if the remaining planned shifts are completed.</p>';
 const breakNotice='<p class="notice recovery-break-note"><strong>Breaks and make-up time.</strong> The 40-hour forecast counts actual punches and planned future shifts only. A skipped 15-minute break is not automatically 15 minutes of extra work. Only count time actually worked, and follow company policy and applicable break rules.</p>';
 if(!first){panel.innerHTML='<div class="recovery-number">Weekly goal: 40 paid hours</div>'+status+list+breakNotice;return}
 const late=Math.max(0,actualStart-startM);
 panel.innerHTML='<div class="recovery-number">'+(out?'Shift complete':deficit===0?'You’ve reached today’s paid-hours goal':late>0?'You started '+fmtMin(late)+' late':'Your recovery plan')+'</div>'+status+(late>0?'<p>You clocked in at '+fmtTime(first.ts)+'; your planned start is '+s.startTime+'.</p>':'')+list+breakNotice;
}
function renderWeek(){
 const keys=weekKeys(),body=$('weekRows');if(!body)return;body.innerHTML='';let paidTotal=0;
 keys.forEach(k=>{const d=new Date(k+'T12:00:00'),s=scheduleForDate(k),rec=data[k],p=rec?.punches||[],first=getPunch(rec,'in'),out=getOut(rec),ls=getPunch(rec,'lunch-start'),le=getPunch(rec,'lunch-end'),paid=rec?.punches?.length?actualPaidMinutes(rec):0,goal=plannedMinutes(s),balance=rec?.punches?.length?paid-goal:0;paidTotal+=paid;
 const tr=document.createElement('tr');if(k===todayKey())tr.className='today-row';
 const timeCell=(field,val,label)=>'<td>'+((goal===0)?'—':(val||'—'))+'</td>';
 tr.innerHTML='<td>'+weekdays[d.getDay()]+'<small style="display:block;color:var(--muted)">'+k+'</small></td>'+timeCell('startTime',s.startTime,'Planned in')+timeCell('lunchStart',s.lunchStart,'Lunch out')+timeCell('lunchEnd',s.lunchEnd,'Lunch in')+timeCell('endTime',s.endTime,'Planned out')+'<td>'+(first?fmtTime(first.ts):'—')+'</td><td>'+(out?fmtTime(out.ts):'—')+'</td><td>'+(ls&&le?fmtMin((le.ts-ls.ts)/60000):ls?'Open':'—')+'</td><td>'+(rec?.punches?.length?fmtMin(paid):'—')+'</td><td class="'+(balance<0?'negative':'positive')+'">'+(rec?.punches?.length?(balance<0?'−':'+')+fmtMin(Math.abs(balance)) :'—')+'</td><td>'+(lateStartMinutes(k)>0?'Late '+fmtMin(lateStartMinutes(k)):'On time')+(recoveryNote(k)?'<small style="display:block;max-width:220px;white-space:normal">Make-up: '+recoveryNote(k).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</small>':'')+'</td>';
 body.appendChild(tr);
 });
 $('weekPaid').textContent=fmtMin(paidTotal);
 const bal=weekBalanceFor(keys);$('weekBalance').textContent=(bal<0?'−':'+')+fmtMin(Math.abs(bal));$('weekBalance').className=bal<0?'negative':'positive';
}
function renderBank(){let list=$('bankList'),keys=new Set(weekKeys());let rows=bankEntries.filter(e=>keys.has(e.date)).sort((a,b)=>b.date.localeCompare(a.date));list.innerHTML=rows.length?'':'<div class="empty">No time-bank entries for this week yet.</div>';rows.forEach(e=>{let item=document.createElement('div');item.className='bank-item';let left=document.createElement('div');left.textContent=e.date+' · '+e.note;let small=document.createElement('small');small.textContent='Personal adjustment · '+(e.minutes>0?'Added':'Removed')+' time';left.appendChild(small);let right=document.createElement('div');right.className=e.minutes<0?'negative':'positive';right.textContent=(e.minutes<0?'−':'+')+fmtMin(Math.abs(e.minutes));let remove=document.createElement('button');remove.className='quiet';remove.textContent='Remove';remove.type='button';remove.setAttribute('aria-label','Remove time-bank entry');remove.onclick=()=>{if(confirm('Remove this time-bank entry?')){bankEntries=bankEntries.filter(x=>x.id!==e.id);localStorage.setItem(BANKKEY,JSON.stringify(bankEntries));if(window.myTimeQueueCloudSync)window.myTimeQueueCloudSync();renderWeek();renderBank();renderRecovery()}};item.append(left,right,remove);list.appendChild(item)})}
function renderPlanning(){renderWeek();renderBank();renderRecovery()}
$('weekOf').value=keyDate(weekMonday(new Date()));
$('prevWeek').onclick=()=>{let d=new Date($('weekOf').value+'T12:00:00');d.setDate(d.getDate()-7);$('weekOf').value=keyDate(d);renderPlanning()};
$('nextWeek').onclick=()=>{let d=new Date($('weekOf').value+'T12:00:00');d.setDate(d.getDate()+7);$('weekOf').value=keyDate(d);renderPlanning()};
$('weekOf').onchange=renderPlanning;
$('weeklyExportCsv').onclick=()=>{const keys=weekKeys();const rows=[['Date','Planned In','Planned Lunch Out','Planned Lunch In','Planned Out','Actual In','Actual Lunch Out','Actual Lunch In','Actual Out','Paid Minutes','Day Balance Minutes','Time Bank Minutes']];keys.forEach(k=>{const s=scheduleForDate(k),r=data[k],get=t=>getPunch(r,t),out=getOut(r),paid=r?.punches?.length?actualPaidMinutes(r):0,goal=plannedMinutes(s),bank=bankEntries.filter(e=>e.date===k).reduce((n,e)=>n+Number(e.minutes||0),0);rows.push([k,s.startTime,s.lunchStart,s.lunchEnd,s.endTime,get('in')?fmtTime(get('in').ts):'',get('lunch-start')?fmtTime(get('lunch-start').ts):'',get('lunch-end')?fmtTime(get('lunch-end').ts):'',out?fmtTime(out.ts):'',paid,r?.punches?.length?paid-goal:'',bank])});const csvText=rows.map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');download('myTIME-weekly-schedule-'+keys[0]+'.csv',csvText,'text/csv;charset=utf-8')};
$('weeklyPrintBtn').onclick=()=>{if(window.myTimeShowPage)window.myTimeShowPage('weekly');preparePrintReport();window.print()};

$('bankDate').value=todayKey();
$('bankForm').onsubmit=e=>{e.preventDefault();let hours=Number($('bankHours').value),note=$('bankNote').value.trim(),date=$('bankDate').value;if(!date||!note||!Number.isFinite(hours)||hours===0){alert('Enter a date, a non-zero number of hours, and a note.');return}bankEntries.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),date,minutes:Math.round(hours*60),note,createdAt:Date.now()});localStorage.setItem(BANKKEY,JSON.stringify(bankEntries));if(window.myTimeQueueCloudSync)window.myTimeQueueCloudSync();$('bankNote').value='';$('bankHours').value='1';renderPlanning()};
const oldRender=render;render=function(){oldRender();renderPlanning()};
const oldExportJson=$('exportJson').onclick;
$('exportJson').onclick=()=>download('foss-time-backup-'+todayKey()+'.json',JSON.stringify({version:2,settings,data,bankEntries},null,2),'application/json');
$('restoreFile').onchange=async e=>{let f=e.target.files[0];if(!f)return;try{let j=JSON.parse(await f.text());if(!j.data||typeof j.data!=='object')throw Error('Missing data');if(!confirm('Replace local records, settings and time-bank entries with this backup? Export a backup first if needed.'))return;data=j.data;if(j.settings)settings=j.settings;bankEntries=Array.isArray(j.bankEntries)?j.bankEntries:[];save();saveSet();localStorage.setItem(BANKKEY,JSON.stringify(bankEntries));applySettings();render();alert('Backup restored into the current session. Cloudflare save is pending; wait for the top status to confirm Cloud saved.')}catch{alert('That backup file could not be read.')}finally{e.target.value=''}};


/* Local profile autosave. This is not company authentication or cross-device storage. */
const PROFILEKEY='foss-time-profile-v1';
let profile=load(PROFILEKEY,{name:'',email:'',photo:''});
if(!profile||typeof profile!=='object'||Array.isArray(profile))profile={name:'',email:'',photo:''};
profile.name=typeof profile.name==='string'?profile.name:'';
profile.email=typeof profile.email==='string'?profile.email:'';
if(typeof profile.photo!=='string')profile.photo='';
let authenticatedUserEmail='';
async function loadAuthenticatedIdentity(){
 try{
  const response=await fetch('/api/whoami',{credentials:'same-origin',cache:'no-store'});
  if(!response.ok)throw new Error('Not authenticated');
  const identity=await response.json();
  authenticatedUserEmail=String(identity.email||'').trim().toLowerCase();
  if(!authenticatedUserEmail)throw new Error('No authenticated identity');
  if(profile.email.trim().toLowerCase()!==authenticatedUserEmail){
   profile={name:'',email:authenticatedUserEmail,photo:''};
   localStorage.setItem(PROFILEKEY,JSON.stringify(profile));
  }
  if(typeof renderProfile==='function')renderProfile();
  if(typeof updateProfileButton==='function')updateProfileButton();
 }catch(_){
  authenticatedUserEmail='';
  profile={name:'',email:'',photo:''};
  if(typeof renderProfile==='function')renderProfile();
  if(typeof updateProfileButton==='function')updateProfileButton();
 }
}
loadAuthenticatedIdentity();
function initialsFor(name,email){const source=(name||email||'YOU').trim();const bits=source.includes('@')?source.split('@')[0].split(/[._ -]+/):source.split(/\s+/);return bits.slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'YOU'}
function renderProfile(){
 $('profileName').value=profile.name||'';$('profileEmail').value=profile.email||'';
 $('profileInitials').textContent=initialsFor(profile.name,profile.email);
 const img=$('profileAvatar');if(profile.photo){img.src=profile.photo;img.hidden=false;$('profileInitials').hidden=true}else{img.removeAttribute('src');img.hidden=true;$('profileInitials').hidden=false}
}
function saveProfileChanges(showConfirmation=false){
 const email=$('profileEmail').value.trim();
 const name=$('profileName').value.trim();
 const status=$('profileSaveStatus');
 if(email&&!/^[^\s@]+@fossna\.com$/i.test(email)){
  if(status)status.textContent='Enter a valid @fossna.com work email, or leave it blank';
  $('profileEmail').setAttribute('aria-invalid','true');
  if(showConfirmation)alert('Enter a valid FOSS North America work email ending in @fossna.com, or leave the email blank.');
  return false
 }
 $('profileEmail').removeAttribute('aria-invalid');
 const previous={...profile};
 const next={...profile,name,email};
 try{
  const serialized=JSON.stringify(next);
  localStorage.setItem(PROFILEKEY,serialized);
  profile=next;
  if(status)status.textContent='Saved locally for recovery · waiting for Cloudflare confirmation';
  if(typeof updateProfileButton==='function')updateProfileButton();
  if(window.myTimeQueueCloudSync)window.myTimeQueueCloudSync();
  return true
 }catch(error){
  profile=previous;
  if(status)status.textContent='Could not save. Remove the photo or export a backup, then retry.';
  if(showConfirmation)alert('The profile could not be saved in this browser. Try removing the photo and saving again.');
  return false
 }
}
let profileSaveTimer;
function queueProfileSave(){clearTimeout(profileSaveTimer);const status=$('profileSaveStatus');if(status)status.textContent='Saving…';profileSaveTimer=setTimeout(()=>saveProfileChanges(),250)}
$('profileName').addEventListener('input',queueProfileSave);
$('profileEmail').addEventListener('input',queueProfileSave);
$('profileName').addEventListener('change',()=>saveProfileChanges());
$('profileEmail').addEventListener('change',()=>saveProfileChanges());
$('saveProfile').onclick=()=>{if(saveProfileChanges(true)){renderProfile();const status=$('profileSaveStatus');if(status)status.textContent='Profile saved · waiting for Cloudflare confirmation';}};
$('profilePhoto').onchange=async e=>{
 const file=e.target.files?.[0];if(!file)return;
 if(!file.type.startsWith('image/')){alert('Choose an image file.');e.target.value='';return}
 try{
  if(file.size>15*1024*1024)throw Error('Image is too large');
  const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});
  const img=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=dataUrl});
  const canvas=document.createElement('canvas'),max=192,scale=Math.min(1,max/Math.max(img.width,img.height));canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Image processing unavailable');ctx.drawImage(img,0,0,canvas.width,canvas.height);
  const compactPhoto=canvas.toDataURL('image/jpeg',.68);const oldPhoto=profile.photo;profile.photo=compactPhoto;
  if(saveProfileChanges(true)){renderProfile();const status=$('profileSaveStatus');if(status)status.textContent='Profile and photo saved · waiting for Cloudflare confirmation'}else{profile.photo=oldPhoto;renderProfile()}
 }catch{alert('Could not load that image. Try a different photo.')}finally{e.target.value=''}
};
$('clearProfilePhoto').onclick=()=>{profile.photo='';if(saveProfileChanges(true))renderProfile()};
renderProfile();
/* Keep the weekly schedule designer visibly connected to clock settings. */
const scheduleNote=document.querySelector('#weekHeading')?.parentElement;
if(scheduleNote){const note=document.createElement('p');note.className='sub';note.textContent='Design each day’s planned start, lunch, finish and paid-hours goal below. Save weekly schedule to update the clock’s late-start recovery and daily target calculations.';scheduleNote.insertAdjacentElement('afterend',note)}


/* Profile is an optional corner-button panel, not a permanent dashboard card. */
function updateProfileButton(){
 const isMyProfile=!!authenticatedUserEmail&&profile.email.trim().toLowerCase()===authenticatedUserEmail;
 const label=isMyProfile?(profile.name||authenticatedUserEmail):'Sign in required';
 $('profileButtonName').textContent=label;
 const mini=$('miniAvatar');
 /* Never reveal a locally cached name, initials, or photo before Cloudflare
    Access has supplied the authenticated identity for this browser session. */
 if(!isMyProfile){
  mini.replaceChildren();
  mini.textContent='?';
  mini.setAttribute('aria-label','Sign in required');
  return;
 }
 mini.removeAttribute('aria-label');
 if(profile.photo){
  mini.replaceChildren();
  const avatar=document.createElement('img');
  avatar.alt='';
  avatar.src=profile.photo;
  mini.appendChild(avatar);
 }else{
  mini.textContent=initialsFor(profile.name,profile.email);
 }
}
function setProfileOpen(open){
 const panel=$('profilePanel'),backdrop=$('profileBackdrop'),trigger=$('profileTrigger');
 if(!panel||!backdrop||!trigger)return;
 if(open){
  panel.hidden=false;backdrop.hidden=false;
  panel.setAttribute('aria-modal','true');
  trigger.setAttribute('aria-expanded','true');
  try{renderProfile()}catch(error){console.error('myTIME profile render failed:',error)}
  requestAnimationFrame(()=>{try{$('profileName')?.focus();panel.scrollIntoView({block:'nearest',behavior:'auto'})}catch(error){console.error('myTIME profile focus failed:',error)}});
 }else{
  panel.hidden=true;backdrop.hidden=true;
  panel.removeAttribute('aria-modal');
  trigger.setAttribute('aria-expanded','false');
  trigger.focus({preventScroll:true});
 }
}
$('profileTrigger').setAttribute('aria-controls','profilePanel');$('profileTrigger').setAttribute('aria-expanded','false');
$('profileTrigger').addEventListener('click',()=>{if(!authenticatedUserEmail){window.location.assign('/cdn-cgi/access/login/be13baf6dd40cfd1cbb67658f27069c13b65ada283abe5e93ed1c6bcbacb3ee5');return}setProfileOpen($('profilePanel').hidden)});
$('closeProfile').onclick=()=>setProfileOpen(false);
$('profileBackdrop').onclick=()=>setProfileOpen(false);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('profilePanel').hidden)setProfileOpen(false)});
const priorRenderProfile=renderProfile;
renderProfile=function(){priorRenderProfile();updateProfileButton()};
updateProfileButton();
renderWorkSettingsSummary();


/* Import/export centre and explicit, user-triggered webhook */
(()=> {
const el=id=>document.getElementById(id), pending=[], webhookKey='foss-time-webhook-v1';
const say=s=>{if(el('importStatus'))el('importStatus').textContent=s;if(el('webhookStatus'))el('webhookStatus').textContent=s};
const cell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
const csv=(name,rows)=>download(name,rows.map(r=>r.map(cell).join(',')).join('\r\n'),'text/csv;charset=utf-8');
const hh=ts=>ts?String(new Date(ts).getHours()).padStart(2,'0')+':'+String(new Date(ts).getMinutes()).padStart(2,'0'):'';
const parseCSV=s=>{let out=[],r=[],v='',q=false;for(let i=0;i<s.length;i++){let c=s[i];if(q){if(c==='"'&&s[i+1]==='"'){v+='"';i++}else if(c==='"')q=false;else v+=c}else if(c==='"')q=true;else if(c===','){r.push(v);v=''}else if(c==='\n'){r.push(v);out.push(r);r=[];v=''}else if(c!=='\r')v+=c}if(v||r.length){r.push(v);out.push(r)}return out.filter(x=>x.some(y=>String(y).trim()))};
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
function excelDate(v){if(v instanceof Date&&!Number.isNaN(v.getTime()))return v.getUTCFullYear()+'-'+String(v.getUTCMonth()+1).padStart(2,'0')+'-'+String(v.getUTCDate()).padStart(2,'0');if(typeof v==='number'&&v>20000&&v<80000){const d=new Date(Date.UTC(1899,11,30)+v*86400000);return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0')}const s=String(v??'').trim();if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);const m=s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);return m?m[3]+'-'+m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0'):s}
function excelTime(v){if(v==null||v==='')return '';if(v instanceof Date&&!Number.isNaN(v.getTime()))return String(v.getUTCHours()).padStart(2,'0')+':'+String(v.getUTCMinutes()).padStart(2,'0');if(typeof v==='number'&&v>=0&&v<1){const n=Math.round(v*1440);return String(Math.floor(n/60)%24).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}if(typeof v==='object'&&v.text)return excelTime(v.text);const s=String(v).trim(),m=s.match(/^(\d{1,2}):([0-5]\d)(?::[0-5]\d)?\s*(AM|PM)?$/i);if(m){let n=Number(m[1]);if(m[3])n=n%12+(m[3].toUpperCase()==='PM'?12:0);return String(n).padStart(2,'0')+':'+m[2]}return s}
function readRow(o){const get=names=>{for(const k of Object.keys(o))if(names.includes(norm(k)))return o[k]??'';return ''};
const date=excelDate(get(['date','workdate','punchdate'])),cin=excelTime(get(['clockin','firstin','starttime'])),lo=excelTime(get(['lunchout','lunchstart','breakout'])),li=excelTime(get(['lunchin','lunchend','breakin'])),cout=excelTime(get(['clockout','lastout','endtime']));
const times=[cin,lo,li,cout],labels=['Clock in','Lunch out','Lunch in','Clock out'],errors=[];
if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(new Date(date+'T12:00:00').getTime()))errors.push('Date must be a valid date (YYYY-MM-DD preferred)');
times.forEach((t,i)=>{if(t&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(t))errors.push(labels[i]+' must be a valid time like 08:00 or 5:00 PM')});
if(!times.some(Boolean))errors.push('No punch times found');if(lo&&!cin)errors.push('Lunch out needs clock-in');if(li&&!lo)errors.push('Lunch in needs lunch-out');if(cout&&!cin)errors.push('Clock out needs clock-in');
const seq=times.filter(Boolean);for(let i=1;i<seq.length;i++)if(seq[i]<seq[i-1]){errors.push('Times are not chronological');break}
const punches=[];[['in',cin],['lunch-start',lo],['lunch-end',li],['out',cout]].forEach(([type,t])=>{if(t)punches.push({type,ts:new Date(date+'T'+t+':00').getTime()})});
return {date,cin,lo,li,cout,punches,errors}}
function preview(){const body=el('importPreviewRows');body.innerHTML='';const displayTime=t=>{if(!t)return '';const parts=t.split(':').map(Number);const h=parts[0],m=parts[1];return (h%12||12)+':'+String(m).padStart(2,'0')+' '+(h>=12?'PM':'AM')};pending.forEach(r=>{const tr=document.createElement('tr');[r.date,displayTime(r.cin),displayTime(r.lo),displayTime(r.li),displayTime(r.cout)].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.appendChild(td)});const td=document.createElement('td');td.textContent=r.errors.join('; ')||(data[r.date]?.punches?.length?'Existing date — import replaces that date':'Ready');td.style.color=r.errors.length?'#a83d38':data[r.date]?.punches?.length?'#8a5a00':'#2458c6';tr.appendChild(td);body.appendChild(tr)});el('importPreviewWrap').hidden=!pending.length;el('commitPunchImport').disabled=!pending.some(r=>!r.errors.length)}
async function importFile(file){pending.length=0;try{let rows;if(file.name.toLowerCase().endsWith('.json')){const b=JSON.parse(await file.text());if(!b.data||typeof b.data!=='object')throw Error('Not a myTIME JSON backup.');if(!confirm('Merge backup records? Matching dates will be replaced; other dates stay.'))return;let n=0;Object.entries(b.data).forEach(([d,r])=>{if(/^\d{4}-\d{2}-\d{2}$/.test(d)&&Array.isArray(r?.punches)){data[d]={...r,punches:r.punches.filter(p=>['in','lunch-start','lunch-end','out','morning-break-start','morning-break-end','afternoon-break-start','afternoon-break-end'].includes(p.type)&&Number.isFinite(Number(p.ts))).map(p=>({type:p.type,ts:Number(p.ts)}))};n++}});if(b.settings&&confirm('Also replace schedule settings?')){settings={...settings,...b.settings};saveSet();applySettings()}if(Array.isArray(b.bankEntries)&&confirm('Replace time-bank entries too?')){bankEntries=b.bankEntries;localStorage.setItem(BANKKEY,JSON.stringify(bankEntries))}save();render();say('Merged '+n+' dated record(s).');return}
if(file.name.toLowerCase().endsWith('.xlsx')){if(!window.ExcelJS)throw Error('Excel reader did not load. Refresh the page or use CSV.');const wb=new ExcelJS.Workbook();await wb.xlsx.load(await file.arrayBuffer());const ws=wb.getWorksheet('Timecards')||wb.worksheets[0];if(!ws)throw Error('No worksheet found.');const headers=[];ws.getRow(1).eachCell((c,n)=>headers[n-1]=String(c.value?.text??c.value??''));rows=[];ws.eachRow((row,n)=>{if(n===1)return;const o={};row.eachCell({includeEmpty:true},(c,col)=>{let v=c.value;if(v&&typeof v==='object'&&'result'in v)v=v.result;if(v&&typeof v==='object'&&'text'in v)v=v.text;o[headers[col-1]||('Column '+col)]=v??''});if([o.Date??o.date,o['Clock In']??o.clockin,o['Lunch Out']??o.lunchout,o['Lunch In']??o.lunchin,o['Clock Out']??o.clockout].some(v=>v!==''&&v!=null))rows.push(o)});if(!rows.length)throw Error('The workbook has no data rows.')}
else{const parsed=parseCSV(await file.text());if(parsed.length<2)throw Error('CSV needs headers and at least one row.');const headers=parsed[0];rows=parsed.slice(1).map(row=>{const o={};headers.forEach((name,i)=>o[name]=row[i]||'');return o})}
rows.forEach(o=>pending.push(readRow(o)));preview();const ok=pending.filter(r=>!r.errors.length).length;say('Preview: '+ok+' valid date(s), '+(pending.length-ok)+' needing correction. Review the rows, then confirm import.')}catch(e){say('Import failed: '+(e.message||'unsupported file'))}finally{el('punchImportFile').value=''}}
el('punchImportFile').addEventListener('change',e=>{if(e.target.files?.[0])importFile(e.target.files[0])});
el('cancelPunchImport').onclick=()=>{pending.length=0;el('importPreviewWrap').hidden=true;say('Import cancelled; no changes made.')};
el('commitPunchImport').onclick=()=>{const good=pending.filter(r=>!r.errors.length),dates=[...new Set(good.map(r=>r.date))],dups=dates.filter(d=>data[d]?.punches?.length);if(dups.length&&!confirm(dups.length+' existing date(s) will be replaced. Continue?'))return;good.forEach(r=>{data[r.date]={punches:r.punches,audit:[...(data[r.date]?.audit||[]),{at:Date.now(),reason:'Imported through myTIME Import & Export Center'}]}});save();render();pending.length=0;el('importPreviewWrap').hidden=true;say('Imported '+good.length+' date(s) into this browser.');};
function rows(){const out=[['Date','Clock In','Lunch Out','Lunch In','Clock Out','Paid Minutes','Punch Sequence','Lunch Status','Morning Break Status','Morning Break Start','Morning Break End','Afternoon Break Status','Afternoon Break Start','Afternoon Break End']];Object.keys(data).sort().forEach(d=>{const p=data[d]?.punches||[],g=t=>p.find(x=>x.type===t),last=[...p].reverse().find(x=>x.type==='out'),r=data[d]||{},bs=r.breakStatus||{},bt=r.breakTimes||{};out.push([d,hh(g('in')?.ts),hh(g('lunch-start')?.ts),hh(g('lunch-end')?.ts),hh(last?.ts),Math.round(paidMs(r,last?.ts||Date.now())/60000),p.map(x=>typeName(x.type)+' '+hh(x.ts)).join('; '),bs.lunch||'not-recorded',bs.morning||'not-recorded',bt.morning?.start||'',bt.morning?.end||'',bs.afternoon||'not-recorded',bt.afternoon?.start||'',bt.afternoon?.end||''])});return out}
el('hubExportCsv').onclick=()=>csv('myTIME-punches-'+todayKey()+'.csv',rows());
el('hubExportJson').onclick=()=>download('myTIME-backup-'+todayKey()+'.json',JSON.stringify({version:2,settings,data,bankEntries,exportedAt:new Date().toISOString()},null,2),'application/json');
function workbookBase(){const w=new ExcelJS.Workbook();w.creator='FOSS North America · myTIME';w.title='myTIME Timecard Workbook';w.created=new Date();return w}
function head(row){row.height=28;row.eachCell(c=>{c.font={bold:true,color:{argb:'FFFFFFFF'},size:11};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF09266F'}};c.alignment={vertical:'middle',horizontal:'center',wrapText:true};c.border={bottom:{style:'medium',color:{argb:'FF2458C6'}}}})}
function formula(row){const n=row.number;row.getCell(6).value={formula:'IF(OR(B'+n+'="",E'+n+'=""),"",((E'+n+'-B'+n+')-IF(AND(C'+n+'<>"",D'+n+'<>""),D'+n+'-C'+n+',0))*24)'};row.getCell(7).value={formula:'IF(A'+n+'="","Enter a date",IF(COUNTA(B'+n+':E'+n+')=0,"Enter punch times",IF(AND(C'+n+'<>"",B'+n+'=""),"Lunch out needs clock-in",IF(AND(D'+n+'<>"",C'+n+'=""),"Lunch in needs lunch-out",IF(AND(E'+n+'<>"",B'+n+'=""),"Clock out needs clock-in","Recorded")))))'}}
async function exportXlsx(template){if(!window.ExcelJS){say('Excel workbook tools did not load. Check your connection or use CSV.');return}const w=workbookBase(),guide=w.addWorksheet('Start Here');guide.columns=[{width:28},{width:95}];guide.addRow(['myTIME · FOSS North America','WORKBOOK GUIDE']);head(guide.getRow(1));[['How to use','Enter one work date per row on Timecards. Upload this workbook here and preview it before confirming.'],['Date','Use an Excel date or YYYY-MM-DD.'],['Time','Use familiar 12-hour times such as 7:50 AM, 1:15 PM, 2:15 PM, 4:56 PM. Excel time cells and AM/PM text are accepted.'],['Multiple dates','Add a separate row for every date worked, including older dates.'],['Import safety','Existing dates are flagged. Import replaces punch records on matching dates. Export JSON first as a backup.'],['Note','FOSS North America · myTIME. Personal timekeeping helper, not a payroll system.']].forEach(r=>guide.addRow(r));guide.eachRow((r,n)=>{if(n>1){r.height=36;r.getCell(1).font={bold:true,color:{argb:'FF09266F'}};r.getCell(2).alignment={vertical:'top',wrapText:true};if(n%2===0)r.eachCell(c=>c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF1F5FF'}})}});const ws=w.addWorksheet('Timecards',{properties:{tabColor:'FF09266F'}});ws.columns=[{header:'Date',width:19},{header:'Clock In',width:14},{header:'Lunch Out',width:14},{header:'Lunch In',width:14},{header:'Clock Out',width:14},{header:'Paid Hours',width:15},{header:'Validation',width:28},{header:'Notes',width:34},{header:'Lunch Status',width:18},{header:'Morning Break Status',width:22},{header:'Morning Break Start',width:20},{header:'Morning Break End',width:20},{header:'Afternoon Break Status',width:24},{header:'Afternoon Break Start',width:22},{header:'Afternoon Break End',width:22}];head(ws.getRow(1));ws.views=[{state:'frozen',ySplit:1}];ws.autoFilter='A1:O'+(template?52:Math.max(2,Object.keys(data).length+1));ws.getColumn(1).numFmt='ddd, mmm d, yyyy';['B','C','D','E'].forEach(c=>ws.getColumn(c).numFmt='h:mm AM/PM');ws.getColumn(6).numFmt='0.00';const ds=template?[]:Object.keys(data).sort();if(template){const d=new Date();for(let i=0;i<50;i++){const r=ws.addRow([null,null,null,null,null,null,null,null,'not-recorded','not-recorded',null,null,'not-recorded',null,null]);formula(r);r.height=23}}else ds.forEach(d=>{const p=data[d]?.punches||[],get=t=>p.find(x=>x.type===t),last=[...p].reverse().find(x=>x.type==='out'),mins=t=>t?((new Date(t).getHours()*60+new Date(t).getMinutes())/1440):null;const r=ws.addRow([new Date(d+'T12:00:00'),mins(get('in')?.ts),mins(get('lunch-start')?.ts),mins(get('lunch-end')?.ts),mins(last?.ts),null,null,p.map(x=>typeName(x.type)+' '+hh(x.ts)).join('; '),data[d]?.breakStatus?.lunch||'not-recorded',data[d]?.breakStatus?.morning||'not-recorded',data[d]?.breakTimes?.morning?.start||'',data[d]?.breakTimes?.morning?.end||'',data[d]?.breakStatus?.afternoon||'not-recorded',data[d]?.breakTimes?.afternoon?.start||'',data[d]?.breakTimes?.afternoon?.end||'']);formula(r);r.height=23});ws.eachRow((r,n)=>{if(n>1){r.eachCell(c=>{c.alignment={vertical:'middle'};c.border={bottom:{style:'hair',color:{argb:'FFDCE5F5'}}};if(n%2===0)c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF5F7FC'}}})}});
const sm=w.addWorksheet('Weekly Summary',{properties:{tabColor:'FF2458C6'}});sm.columns=[{width:26},{width:20},{width:58}];sm.addRow(['WEEKLY OVERVIEW','VALUE','NOTES']);head(sm.getRow(1));sm.addRow(['Dates in workbook',template?0:ds.length,'One row per work date']);sm.addRow(['Total paid hours',template?'=0':'=SUM(Timecards!F2:F'+Math.max(2,ds.length+1)+')','Formula total; verify punch times']);sm.addRow(['Daily goal (hours)',Number(settings.goalHours||8),'From myTIME workday settings']);sm.addRow(['Expected hours',template?'=0':'=B4*COUNTIF(Timecards!G2:G'+Math.max(2,ds.length+1)+',"Recorded")','Only recorded rows count']);sm.addRow(['Difference','=B3-B5','Positive means above expected hours']);sm.getColumn(2).numFmt='0.00';sm.eachRow((r,n)=>{if(n>1){r.height=26;r.getCell(1).font={bold:true,color:{argb:'FF09266F'}};r.getCell(3).alignment={wrapText:true,vertical:'middle'}}});
const bk=w.addWorksheet('Time Bank',{properties:{tabColor:'FF2458C6'}});bk.columns=[{header:'Date Worked',width:20},{header:'Hours (+/-)',width:16},{header:'Note',width:48}];head(bk.getRow(1));(template?[{date:null,hours:null,note:'Example: Extra hour worked Tuesday'}]:bankEntries).forEach(e=>bk.addRow([e.date?new Date(e.date+'T12:00:00'):null,Number(e.hours??e.amount??0),e.note||e.reason||'']));bk.getColumn(1).numFmt='ddd, mmm d, yyyy';bk.getColumn(2).numFmt='0.00;[Red]-0.00';
const bytes=await w.xlsx.writeBuffer();download(template?'myTIME-Excel-import-template.xlsx':'myTIME-FOSS-branded-timecard-'+todayKey()+'.xlsx',bytes,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');say(template?'Excel template downloaded. Fill one row per work date, then upload it here.':'Branded Excel workbook downloaded with formulas, weekly summary and time-bank sheet.')}
el('hubExportXlsx').onclick=()=>exportXlsx(false);
el('downloadImportTemplate').onclick=()=>exportXlsx(true);
el('downloadCsvTemplate').onclick=()=>csv('myTIME-import-template.csv',[['Date','Clock In','Lunch Out','Lunch In','Clock Out','Notes'],[todayKey(),'8:00 AM','11:30 AM','12:30 PM','5:00 PM','Example row — replace with actual times']]);
try{el('webhookUrl').value=localStorage.getItem(webhookKey)||'';const cfg=JSON.parse(localStorage.getItem(webhookKey+'-options')||'{}');el('webhookMode').value=cfg.mode||'weekly-report';el('reportEmail').value=cfg.email||'wuflestad@att.net';el('reportName').value=cfg.name||'Weekly FOSS myTIME timecard';if(el('webhookUrl').value)el('webhookStatus').textContent='Custom webhook URL saved · syncing to your Cloudflare account.';else el('webhookStatus').textContent='Managed Make → Outlook connection is configured securely on the server. Select Make.com to use it without pasting a URL.'}catch{}
const powerSchemaEl=document.getElementById('copyPowerSchema');if(powerSchemaEl)powerSchemaEl.onclick=async()=>{const schema=document.querySelector('#webhookPanel details pre')?.textContent||'';try{await navigator.clipboard.writeText(schema);say('Power Automate JSON schema copied. Paste it into the HTTP trigger schema field.')}catch{say('Select and copy the JSON schema shown above.')}};
const providerEl=el('webhookProvider');if(providerEl){providerEl.addEventListener('change',()=>{const title=el('webhookPanelHeading');if(title)title.textContent=providerEl.value==='power-automate'?'Configure Power Automate':'Configure your webhook'});try{const savedProvider=localStorage.getItem(webhookKey+'-provider');const savedUrl=localStorage.getItem(webhookKey)||'';providerEl.value=(!savedUrl&&savedProvider==='power-automate')?'make':(savedProvider||'make');if(!savedProvider||(!savedUrl&&savedProvider==='power-automate'))localStorage.setItem(webhookKey+'-provider',providerEl.value)}catch{}providerEl.addEventListener('change',()=>{try{localStorage.setItem(webhookKey+'-provider',providerEl.value)}catch{}})}
el('saveWebhook').onclick=()=>{const u=el('webhookUrl').value.trim();if(u&&!/^https:\/\//i.test(u)){alert('Use an HTTPS webhook URL.');return}try{u?localStorage.setItem(webhookKey,u):localStorage.removeItem(webhookKey);localStorage.setItem(webhookKey+'-options',JSON.stringify({mode:el('webhookMode').value,email:el('reportEmail').value.trim(),name:el('reportName').value.trim()}));say(u?'Webhook and report options saved · syncing to your Cloudflare account. No data sent yet.':'Webhook URL cleared; report preferences syncing to Cloudflare.')}catch{say('Could not save webhook settings in this browser.')}};
el('clearWebhook').onclick=()=>{try{localStorage.removeItem(webhookKey);localStorage.removeItem(webhookKey+'-options')}catch{}el('webhookUrl').value='';el('reportEmail').value='';el('reportName').value='';el('webhookMode').value='weekly-report';say('Saved webhook URL and report preferences removed and syncing to Cloudflare.')};
el('sendWebhook').onclick=async()=>{if(el('webhookMode').value!=='weekly-report'){alert('Choose “Weekly timecard email report” to send a test email.');return}const u=el('webhookUrl').value.trim();const provider=el('webhookProvider')?.value||'make';if(provider!=='make'&&!/^https:\/\//i.test(u)){alert('Enter an HTTPS webhook URL for this provider. The managed Make connection does not need a URL.');return}if(u&&!/^https:\/\//i.test(u)){alert('Use an HTTPS webhook URL.');return}if(el('webhookMode').value==='weekly-report'&&provider!=='make'&&!el('reportEmail').value.trim()){alert('Enter the recipient email address your webhook flow should send to.');el('reportEmail').focus();return}if(!confirm(provider==='make'&&!u?'Send this timecard using the securely configured FOSS Make → Outlook connection?':'Send time records to this endpoint? Continue only if you trust the URL.'))return;const allRows=rows().slice(1);
const now=new Date();const monday=new Date(now.getFullYear(),now.getMonth(),now.getDate()-((now.getDay()+6)%7)-(now.getDay()===1?7:0));const friday=new Date(monday);friday.setDate(monday.getDate()+4);
const dateKey=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const weekDates=Array.from({length:5},(_,i)=>{const d=new Date(monday);d.setDate(monday.getDate()+i);return dateKey(d)});
const byDate=new Map(allRows.map(r=>[r[0],r]));
const reportRows=weekDates.map(k=>byDate.get(k)||[k,'—','—','—','—',0]);
const totalMinutes=reportRows.reduce((sum,r)=>sum+(Number(r[5])||0),0);
const safe=s=>String(s??'').replace(/[&<>\"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[ch]));
const recipient=(el('reportEmail')?.value||'').trim();const reportName=(el('reportName')?.value||'Weekly myTIME timecard').trim();
const employeeName=(typeof profile!=='undefined'&&profile&&profile.name)?profile.name:'';
const weekdayNames=['Monday','Tuesday','Wednesday','Thursday','Friday'];
const emailDays=reportRows.map((r,i)=>{
 const raw=(data[r[0]]?.punches||[]).slice().sort((a,b)=>Number(a.ts)-Number(b.ts));
 return {date:r[0],dayName:weekdayNames[i],clockIn:r[1]||'',lunchOut:r[2]||'',lunchIn:r[3]||'',clockOut:r[4]||'',paidMinutes:Number(r[5]||0),punches:raw.map(p=>({label:typeName(p.type),time:p.ts?new Date(p.ts).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}):''}))};
});
const emailContent=window.myTimeBuildProfessionalWeeklyReport({employeeName,reportTitle:reportName,startDate:weekDates[0],endDate:weekDates[4],targetMinutes:2400,days:emailDays,includePunches:true,generatedAt:now});
const htmlBody=emailContent.html;
const textBody=emailContent.text;
let payload;
if(el('webhookMode').value==='punches'){payload={source:'myTIME',event:'punch_records_export',sentAt:new Date().toISOString(),records:allRows.map(r=>({date:r[0],clockIn:r[1],lunchOut:r[2],lunchIn:r[3],clockOut:r[4],paidMinutes:r[5]}))};}
else if(el('webhookMode').value==='weekly-report'){payload={source:'myTIME',event:'weekly_timecard_report',sentAt:new Date().toISOString(),to:recipient,subject:'[TEST] FOSS myTIME | Weekly Timecard | '+weekDates[0]+' – '+weekDates[4],reportName:reportName,periodDays:5,periodStart:weekDates[0],periodEnd:weekDates[4],test:true,totalPaidMinutes:totalMinutes,totalPaidHours:Number((totalMinutes/60).toFixed(2)),records:reportRows.map(r=>({date:r[0],clockIn:r[1],lunchOut:r[2],lunchIn:r[3],clockOut:r[4],paidMinutes:r[5]})),htmlBody:htmlBody,textBody:textBody,branding:{brand:'FOSS North America',product:'myTIME',primaryColor:'#09266f',accentColor:'#2458c6',logoUrl:'https://www.fossanalytics.com/Design/static/foss-logo.png'}};}
else{payload={source:'myTIME',event:'full_backup',sentAt:new Date().toISOString(),backup:{version:2,settings,data,bankEntries}};}say('Sending…');try{let res;if((el('webhookProvider')?.value||'power-automate')==='power-automate'){res=await fetch('/api/power-automate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:u,payload})});}else if(provider==='make'){res=await fetch('/api/make-webhook',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:u||undefined,payload})});}else{res=await fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),mode:'cors'});}const result=await res.json().catch(()=>({}));if(!res.ok)throw Error(result.error||('HTTP '+res.status));say((provider==='make'?'Make.com accepted the request. Check scenario history and the recipient mailbox to confirm Outlook delivery.':'Power Automate accepted the request. Check your flow run history to confirm the next actions completed.'))}catch(e){say('Could not send webhook: '+(e.message||'network error')+'. Check the flow URL, trigger permissions, and run history. No automatic retry was made.')}};
})();

