
/* myTIME tab navigation — group content into real pages */
(function setupAppTabs(){
 const main=document.querySelector('main.shell'),nav=document.getElementById('appTabs');
 if(!main||!nav)return;
 const labels={dashboard:'Dashboard',calendar:'Calendar',timesheets:'Timesheet & backup',weekly:'Weekly schedule & punches',records:'Manage records',import:'Import & export',settings:'Settings',integrations:'Integrations'};
 const pages={};
 Object.keys(labels).forEach(key=>{
  let page=document.getElementById('page-'+key);
  if(!page){page=document.createElement('div');page.id='page-'+key;page.className='tab-page';page.dataset.tabPage=key;nav.insertAdjacentElement('afterend',page);}
  pages[key]=page;
 });
 const move=(el,key)=>{if(el)pages[key].appendChild(el)};
 // Add convenient cross-links so integrations are reachable from both Settings and Import & Export.
 function addPageShortcuts(key,title,description,links){
  const host=pages[key];if(!host||host.querySelector('[data-page-shortcuts="'+key+'"]'))return;
  const card=document.createElement('section');card.className='card';card.dataset.pageShortcuts=key;
  card.style.cssText='margin:0 0 16px;padding:16px 18px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap';
  const copy=document.createElement('div');copy.style.cssText='min-width:220px;flex:1';
  const heading=document.createElement('h2');heading.style.cssText='margin:0 0 4px;font-size:17px';heading.textContent=title;
  const note=document.createElement('p');note.className='sub';note.style.margin='0';note.textContent=description;
  copy.append(heading,note);card.appendChild(copy);
  const actions=document.createElement('div');actions.style.cssText='display:flex;gap:8px;flex-wrap:wrap';
  links.forEach(link=>{const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent=link.label;button.addEventListener('click',()=>{if(link.section)showSettingsSection(link.section);showPage(link.page)});actions.appendChild(button)});
  card.appendChild(actions);host.insertBefore(card,host.firstChild);
 }

 const oldLayout=document.querySelector('.layout');
 if(oldLayout){
  const timelineCard=oldLayout.querySelector('#timeline')?.closest('article');
  const settingsPanel=document.getElementById('workSettingsPanel');
  const settingsSummary=document.getElementById('workSettingsSummary');
  const quickTimesheet=document.getElementById('monthFilter')?.closest('article');
  move(timelineCard,'dashboard');
  move(settingsPanel,'settings');move(settingsSummary,'settings');
  move(quickTimesheet,'timesheets');
  oldLayout.remove();
 }
 move(document.querySelector('.hero'),'dashboard');
 move(document.querySelector('section.grid[aria-label="Today\'s totals"]'),'dashboard');
 move(document.querySelector('#recoveryPanel')?.closest('section'),'dashboard');
 // Keep the clock/punch hero first, summary metrics second, and today's punches below them.
 const dashboardHero=pages.dashboard.querySelector('.hero');
 const dashboardTotals=pages.dashboard.querySelector('section.grid[aria-label="Today\'s totals"]');
 const dashboardPunches=pages.dashboard.querySelector('#timeline')?.closest('article');
 const dashboardRecovery=pages.dashboard.querySelector('#recoveryPanel')?.closest('section');
 [dashboardHero,dashboardTotals,dashboardPunches,dashboardRecovery].forEach(el=>{if(el)pages.dashboard.appendChild(el)});

 move(document.querySelector('#monthRows')?.closest('section'),'timesheets');
 move(document.querySelector('#weekRows')?.closest('section'),'weekly');
 move(document.querySelector('#bankForm')?.closest('section'),'weekly');
 move(document.getElementById('recordManager'),'records');
 move(document.getElementById('dataHub'),'import');
 move(document.getElementById('integrationDirectory'),'integrations');
 move(document.querySelector('.schedule-reminders'),'dashboard');
 // Put the existing backup/timesheet and integration views inside Settings; keep their functionality intact.
 const settingsWorkday=document.createElement('div');settingsWorkday.id='settingsWorkdayGroup';settingsWorkday.className='settings-subpage';
 [...pages.settings.children].forEach(el=>settingsWorkday.appendChild(el));
 const settingsNav=document.createElement('div');settingsNav.className='settings-subnav';settingsNav.setAttribute('role','tablist');settingsNav.setAttribute('aria-label','Settings sections');
 settingsNav.innerHTML='<button type="button" class="settings-subtab active" data-settings-section="workday" role="tab" aria-selected="true">Workday settings</button><button type="button" class="settings-subtab" data-settings-section="backup" role="tab" aria-selected="false">Timesheet &amp; backup</button><button type="button" class="settings-subtab" data-settings-section="integrations" role="tab" aria-selected="false">Integration settings</button>';
 pages.settings.append(settingsNav,settingsWorkday);
 pages.settings.appendChild(pages.timesheets);pages.settings.appendChild(pages.integrations);
 pages.timesheets.classList.add('settings-subpage');pages.integrations.classList.add('settings-subpage');
 pages.timesheets.id='settingsBackupGroup';pages.integrations.id='settingsIntegrationsGroup';
 let settingsSection='workday';
 function showSettingsSection(section){settingsSection=section;settingsWorkday.hidden=section!=='workday';pages.timesheets.hidden=section!=='backup';pages.integrations.hidden=section!=='integrations';settingsNav.querySelectorAll('[data-settings-section]').forEach(btn=>{const active=btn.dataset.settingsSection===section;btn.classList.toggle('active',active);btn.setAttribute('aria-selected',active?'true':'false')});}
 settingsNav.querySelectorAll('[data-settings-section]').forEach(btn=>btn.addEventListener('click',()=>showSettingsSection(btn.dataset.settingsSection)));
 showSettingsSection('workday');
 // Webhook controls are already nested in #integrationDirectory in the source markup.
 [...main.children].filter(el=>el.tagName==='DIV'&&el.getAttribute('style')?.includes('height:1px')).forEach(el=>el.remove());
 document.querySelectorAll('[data-page]').forEach(el=>el.removeAttribute('data-page'));
 function showPage(key){
  if(!pages[key])key='dashboard';
  document.body.dataset.tab=key;
  Object.entries(pages).forEach(([name,el])=>{const nested=name==='timesheets'||name==='integrations';if(nested){el.hidden=key!=='settings'||(name==='timesheets'?settingsSection!=='backup':settingsSection!=='integrations');el.setAttribute('aria-hidden',el.hidden?'true':'false')}else if(name==='settings'){el.hidden=key!=='settings';el.setAttribute('aria-hidden',key==='settings'?'false':'true')}else{el.hidden=name!==key;el.setAttribute('aria-hidden',name===key?'false':'true')}});
  nav.querySelectorAll('.app-tab').forEach(btn=>{
   const active=btn.dataset.tab===key;btn.classList.toggle('active',active);btn.setAttribute('aria-current',active?'page':'false');
  });
  if(key==='calendar'&&typeof renderMyTimeCalendar==='function')renderMyTimeCalendar();
  if(key==='records'&&typeof renderRecordManager==='function')renderRecordManager();
  if(key==='weekly'&&typeof renderPlanning==='function')renderPlanning();
 }
 nav.querySelectorAll('.app-tab').forEach(btn=>btn.addEventListener('click',()=>showPage(btn.dataset.tab)));
 const updateNavBrand=()=>document.body.classList.toggle('nav-compact',window.scrollY>120);
 window.addEventListener('scroll',updateNavBrand,{passive:true});updateNavBrand();
 addPageShortcuts('settings','Settings overview','Choose a section above to manage your schedule, backups, or integrations.',[{label:'Import & export',page:'import'}]);
 addPageShortcuts('import','Data tools & integrations','Import or export your records, or manage your connected services.',[{label:'Open integration settings',page:'settings',section:'integrations'},{label:'Open settings',page:'settings'}]);
 showPage('dashboard');window.myTimeShowPage=showPage;
})();


/* Monthly timesheet: local punch records only. Weekly schedule lives on its own tab. */
let myTimeCalendarMonth = new Date(new Date().getFullYear(),new Date().getMonth(),1);
let myTimeSelectedDate = todayKey();
function normalizeCalendarBreakTime(value){
 const raw=String(value??'').trim().toUpperCase().replace(/\s+/g,' ');
 if(!raw)return '';
 const match=raw.match(/^(\d{1,2}):([0-5]\d)\s*(AM|PM)?$/);
 if(!match)return null;
 let hour=Number(match[1]),minute=Number(match[2]);
 if(match[3]){if(hour<1||hour>12)return null;hour=(hour%12)+(match[3]==='PM'?12:0)}
 else if(hour>23)return null;
 return String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0');
}
function displayCalendarBreakTime(value){
 return /^\d{2}:\d{2}$/.test(String(value||''))?humanTime(value):'';
}
function calendarBreakSnapshot(record){
 const status=record?.breakStatus||{},times=record?.breakTimes||{};
 return ['lunch','morning','afternoon'].map(key=>[
  ['taken','skipped','not-recorded'].includes(status[key])?status[key]:'not-recorded',
  String(times[key]?.start||'').trim(),
  String(times[key]?.end||'').trim()
 ]);
}
function calendarBreakStatusLabel(value){
 return value==='taken'?'Taken':value==='skipped'?'Skipped':'Not recorded';
}
function calendarBreakRange(value){
 const start=value?.start?humanTime(value.start):'';
 const end=value?.end?humanTime(value.end):'';
 if(start&&end)return start+'–'+end;
 if(start)return 'Start '+start;
 if(end)return 'End '+end;
 return 'Times not entered';
}
function calendarBreakSummary(record,includeEmpty=true){
 const status=record?.breakStatus||{},times=record?.breakTimes||{};
 const sections=[['lunch','Lunch'],['morning','Morning break'],['afternoon','Afternoon break']];
 const lines=sections.map(([key,label])=>{
  const state=['taken','skipped','not-recorded'].includes(status[key])?status[key]:'not-recorded';
  const value=times[key]||{};
  const hasTimes=!!(value.start||value.end);
  if(!includeEmpty&&state==='not-recorded'&&!hasTimes)return '';
  return label+': '+calendarBreakStatusLabel(state)+' · '+calendarBreakRange(value);
 }).filter(Boolean);
 return lines.length?lines.join('\n'):'No documented lunch or break entries';
}
function hasDocumentedBreakRecord(record){
 return calendarBreakSnapshot(record).some(([status,start,end])=>status!=='not-recorded'||!!start||!!end);
}

async function confirmCalendarBreakSave(dateKey){
 const badge=document.getElementById('calendarSavedBadge');
 if(badge&&myTimeSelectedDate===dateKey)badge.textContent='Saving to Cloudflare…';
 try{
  if(typeof window.myTimeFlushCloudSync!=='function')throw new Error('Cloudflare save confirmation is unavailable.');
  await window.myTimeFlushCloudSync();
  // Verify the exact edited date from D1; a generic successful save is not
  // enough to mark this day complete in the calendar.
  const response=await fetch('/api/records',{method:'GET',credentials:'same-origin',cache:'no-store'});
  const payload=await response.json().catch(()=>null);
  if(!response.ok||!payload?.ok||!payload.payload)throw new Error(payload?.error||('Cloudflare read-back failed (HTTP '+response.status+').'));
  const localSnapshot=calendarBreakSnapshot(data[dateKey]);
  const cloudSnapshot=calendarBreakSnapshot(payload.payload.records?.[dateKey]);
  if(JSON.stringify(localSnapshot)!==JSON.stringify(cloudSnapshot)){
   throw new Error('Cloudflare did not return the same lunch and break entries for '+dateKey+'. The editor values are being kept; the day is not marked saved.');
  }
  if(myTimeSelectedDate===dateKey&&badge&&badge.isConnected)badge.textContent='Cloudflare verified · revision '+Number(payload.revision||0);
  const status=document.getElementById('saveStatusText');
  if(status&&window.myTimeAutoCloudConnected)status.textContent='Cloud saved · '+dateKey+' verified';
  if(typeof renderRecordManager==='function')renderRecordManager();
  if(typeof renderMonth==='function')renderMonth();
  return true;
 }catch(error){
  console.warn('myTIME break/lunch read-back verification failed:',error);
  setSaveStatus(false,'Break/lunch save not verified · pending data kept');
  if(myTimeSelectedDate===dateKey&&badge&&badge.isConnected)badge.textContent='Save not verified · retry';
  return false;
 }
}
function ensureBreakFields(k){
 const r=data[k]||(data[k]={punches:[],audit:[]});
 r.breakStatus=r.breakStatus||{};
 ['lunch','morning','afternoon'].forEach(x=>{if(!['taken','skipped','not-recorded'].includes(r.breakStatus[x]))r.breakStatus[x]='not-recorded'});
 r.breakTimes=r.breakTimes||{};
 ['lunch','morning','afternoon'].forEach(x=>{r.breakTimes[x]=r.breakTimes[x]||{start:'',end:''}});
 return r;
}
function calendarKeyDate(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function calendarRecord(k){const r=data[k];return r&&Array.isArray(r.punches)?r:{punches:[]}}
function calendarPunchTime(rec,type){const p=rec?.punches||[],x=type==='out'?[...p].reverse().find(v=>v.type==='out'):p.find(v=>v.type===type);return x?.ts?fmtTime(x.ts):'—'}
function calendarPaid(k){const r=calendarRecord(k);if(!r.punches.length)return '—';const out=[...r.punches].reverse().find(x=>x.type==='out'),last=r.punches[r.punches.length-1];const end=out?.ts||(k===todayKey()?Date.now():last?.ts||Date.now());return fmtMin(paidMs(r,end)/60000)}
function renderMyTimeCalendar(){
 const page=document.getElementById('page-calendar');if(!page)return;
 if(!document.getElementById('myTimeCalendarRoot')){
  page.innerHTML=`<section class="card" id="myTimeCalendarRoot">
   <div class="section-head"><div><div class="metric-label">CLOUD RECORDS</div><h2 style="margin:4px 0">Monthly timesheet</h2><p class="sub">Your cloud-synced archive of saved clock punches. Use Weekly schedule & punches for planning your Mon–Sun week.</p></div></div>
   <div class="calendar-month-bar"><div class="settings-actions"><button type="button" class="quiet" id="calendarPrev">‹ Previous</button><button type="button" class="quiet" id="calendarToday">Current month</button><button type="button" class="quiet" id="calendarNext">Next ›</button></div><h3 id="calendarMonthTitle" style="margin:0"></h3><label class="sub">Jump to date <input id="calendarDatePicker" type="date" style="margin-left:6px"></label></div>
   <div class="grid calendar-hours-summary" style="grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:14px 0">
    <article class="card"><div class="metric-label">Scheduled hours</div><strong id="calendarScheduledTotal" style="font-size:25px">0h 00m</strong><small class="sub">From your saved weekly work schedule</small></article>
    <article class="card"><div class="metric-label">Actual paid hours</div><strong id="calendarPaidTotal" style="font-size:25px">0h 00m</strong><small class="sub">Calculated from clock punches</small></article>
    <article class="card"><div class="metric-label">Hours balance</div><strong id="calendarHoursBalance" style="font-size:25px">0h 00m</strong><small class="sub">Actual paid minus scheduled</small></article>
    <article class="card"><div class="metric-label">Days / punch events</div><strong id="calendarDaysCount" style="font-size:25px">0</strong><small class="sub"><span id="calendarPunchTotal">0</span> punch events</small></article>
   </div>
   <div class="section-head calendar-records-head"><div><h3 style="margin:0">Monthly calendar</h3><p class="sub">Select any date to see its saved punches, lunch, and rest breaks. Days with records are marked on the calendar.</p></div><div class="settings-actions no-print"><button type="button" class="quiet" id="calendarPrintWeek">Print weekly</button><button type="button" class="primary" id="calendarPrintMonth">Print monthly</button><button type="button" class="quiet" id="calendarExportMonth">Export month CSV</button></div></div>
   <div class="mytime-calendar-wrap" aria-label="Monthly timecard calendar"><div class="mytime-calendar-grid" id="myTimeCalendarGrid" role="grid" aria-label="Monthly saved time records"></div></div>
   <div class="calendar-legend"><span><i class="legend-dot has-record"></i> Saved punches</span><span><i class="legend-dot today-dot"></i> Today</span><span><i class="legend-dot selected-dot"></i> Selected date</span></div>
   <section class="card" id="calendarDayDetail" style="margin-top:18px;background:var(--bg)">
    <div class="section-head"><div><div class="metric-label">SELECTED DAY</div><h3 id="calendarSelectedTitle" style="margin:4px 0"></h3></div><span class="tag" id="calendarSavedBadge">No saved record</span></div>
    <div class="mytime-detail-grid" id="calendarPunchDetails"></div><p class="sub" id="calendarDaySummary" style="margin-top:12px"></p>
    <section class="calendar-analysis" aria-live="polite"><h3 style="margin:0">Hours, lunch &amp; break analysis</h3><p class="sub" style="margin:5px 0 0">Select a day to compare recorded time with your schedule. Green means within allowance, amber means short or missing, and red means over the allowance.</p><div class="calendar-analysis-grid" id="calendarIntervalAnalysis"></div></section>
    <h3 style="margin-top:18px">Late start &amp; make-up record</h3><p class="sub">Late start is calculated from your planned start and actual clock-in. Add a note about approved adjustments and how you made up time; notes do not change paid hours.</p><div id="calendarRecoverySummary" class="notice" style="margin:10px 0"></div><div class="field"><label for="calendarMakeUpNote">How time was made up (or plan agreed)</label><textarea id="calendarMakeUpNote" rows="3" maxlength="600" placeholder="e.g. Started 20 minutes late; stayed until 5:20 PM with approval."></textarea></div><button type="button" class="quiet" id="saveCalendarMakeUpNote">Save make-up note</button><h3 style="margin-top:18px">Lunch and rest-break record</h3><p class="sub">Choose Taken, Skipped, or Not recorded. These labels document what happened; they do not alter payroll or automatically grant make-up credit.</p>
    <div class="mytime-break-grid" id="calendarBreakControls"></div>
   </section>
   <section id="calendarPrintReport" aria-hidden="true"></section>
  </section>`;
  document.getElementById('calendarPrev').onclick=()=>{myTimeCalendarMonth=new Date(myTimeCalendarMonth.getFullYear(),myTimeCalendarMonth.getMonth()-1,1);renderMyTimeCalendar()};
  document.getElementById('calendarNext').onclick=()=>{myTimeCalendarMonth=new Date(myTimeCalendarMonth.getFullYear(),myTimeCalendarMonth.getMonth()+1,1);renderMyTimeCalendar()};
  document.getElementById('calendarToday').onclick=()=>{myTimeSelectedDate=todayKey();myTimeCalendarMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);renderMyTimeCalendar()};
  document.getElementById('calendarDatePicker').onchange=e=>{if(!e.target.value)return;myTimeSelectedDate=e.target.value;const d=new Date(myTimeSelectedDate+'T12:00:00');myTimeCalendarMonth=new Date(d.getFullYear(),d.getMonth(),1);renderMyTimeCalendar()};
  document.getElementById('calendarExportMonth').onclick=()=>exportCalendarCsv(calendarDateKeys('month'));
  document.getElementById('saveCalendarMakeUpNote').onclick=()=>{const k=myTimeSelectedDate,rec=data[k]||(data[k]={punches:[],audit:[]});rec.makeUpNote=document.getElementById('calendarMakeUpNote').value.trim();save();renderMyTimeCalendar();renderPlanning()};
  document.getElementById('calendarPrintMonth').onclick=()=>printCalendarReport('month');
  document.getElementById('calendarPrintWeek').onclick=()=>printCalendarReport('week');
 }
 const first=new Date(myTimeCalendarMonth.getFullYear(),myTimeCalendarMonth.getMonth(),1,12),count=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
 const keys=Array.from({length:count},(_,i)=>calendarKeyDate(new Date(first.getFullYear(),first.getMonth(),i+1,12)));
 if(!/^\d{4}-\d{2}-\d{2}$/.test(myTimeSelectedDate||''))myTimeSelectedDate=todayKey();
 document.getElementById('calendarMonthTitle').textContent=first.toLocaleDateString(undefined,{month:'long',year:'numeric'});
 document.getElementById('calendarDatePicker').value=myTimeSelectedDate;
 const calGrid=document.getElementById('myTimeCalendarGrid');calGrid.innerHTML='';
 ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach((label,i)=>{const h=document.createElement('div');h.className='mytime-calendar-weekday';h.setAttribute('role','columnheader');h.textContent=label;calGrid.appendChild(h)});
 for(let i=0;i<first.getDay();i++){const empty=document.createElement('div');empty.className='mytime-calendar-empty';empty.setAttribute('aria-hidden','true');calGrid.appendChild(empty)}
 let days=0,totalMs=0,scheduledMinutesTotal=0,punchTotal=0;
 keys.forEach(k=>{
  const rec=calendarRecord(k),p=rec.punches||[],hasPunches=p.length>0,hasBreakRecord=hasDocumentedBreakRecord(rec),has=hasPunches||hasBreakRecord,schedule=scheduleForDate(k),planned=plannedMinutes(schedule);
  scheduledMinutesTotal+=planned;
  if(has)days++;
  if(hasPunches){punchTotal+=p.length;const out=[...p].reverse().find(x=>x.type==='out'),last=p[p.length-1];const end=out?.ts||(k===todayKey()?Date.now():last?.ts||Date.now());totalMs+=paidMs(rec,end)}

  const late=lateStartMinutes(k),note=recoveryNote(k),documentedBreaks=calendarBreakSummary(rec,false);
  const d=new Date(k+'T12:00:00'),cell=document.createElement('button');cell.type='button';cell.className='mytime-calendar-day'+(has?' has-record':'')+(k===myTimeSelectedDate?' selected':'')+(k===todayKey()?' today':'');cell.setAttribute('role','gridcell');cell.setAttribute('aria-label',d.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'})+(hasPunches?', '+p.length+' saved punch events':hasBreakRecord?', documented lunch and break entries':' , no saved records'));cell.setAttribute('aria-pressed',k===myTimeSelectedDate?'true':'false');
  const dateNum=document.createElement('strong');dateNum.textContent=String(d.getDate());cell.appendChild(dateNum);
  if(has){const badge=document.createElement('span');badge.className='calendar-record-badge';badge.textContent=hasPunches?p.length+' punch'+(p.length===1?'':'es'):'Breaks documented';cell.appendChild(badge);
   const inTime=calendarPunchTime(rec,'in'),outTime=calendarPunchTime(rec,'out'),lunchOut=calendarPunchTime(rec,'lunch-start'),lunchIn=calendarPunchTime(rec,'lunch-end');
   if(inTime!=='—'){const line=document.createElement('small');line.className='calendar-day-punches';line.textContent='In '+inTime;cell.appendChild(line)}
   if(late>0){const line=document.createElement('small');line.className='calendar-day-late';line.textContent='Late start +'+fmtMin(late);cell.appendChild(line)}
   if(note){const line=document.createElement('small');line.className='calendar-day-recovery';line.textContent='Make-up logged';cell.appendChild(line)}
   if(outTime!=='—'){const line=document.createElement('small');line.className='calendar-day-punches';line.textContent='Out '+outTime;cell.appendChild(line)}
   if(lunchOut!=='—'||lunchIn!=='—'){const line=document.createElement('small');line.className='calendar-day-lunch';line.textContent='Lunch '+(lunchOut==='—'?'—':lunchOut)+' / '+(lunchIn==='—'?'—':lunchIn);cell.appendChild(line)}
   const paid=document.createElement('small');const paidMinutes=actualPaidMinutes(rec);paid.className='calendar-day-paid'+(paidMinutes>480?' is-over-eight':'');paid.textContent='Total paid: '+calendarPaid(k);cell.appendChild(paid);if(paidMinutes>480){const over=document.createElement('small');over.className='calendar-day-overtime';over.textContent='Over daily target: +'+fmtMin(paidMinutes-480);cell.appendChild(over)}
   if(hasBreakRecord){const breaks=document.createElement('small');breaks.className='calendar-day-breaks';breaks.textContent=documentedBreaks.replaceAll('\n',' · ');cell.appendChild(breaks)}
  } else {const noData=document.createElement('small');noData.className='calendar-no-record';noData.textContent='No records';cell.appendChild(noData)}
  if(planned>0){const plan=document.createElement('small');plan.className='calendar-day-planned';plan.textContent='Planned '+fmtMin(planned);cell.appendChild(plan)}

  cell.onclick=()=>{myTimeSelectedDate=k;renderMyTimeCalendar()};calGrid.appendChild(cell);
 });
 document.getElementById('calendarDaysCount').textContent=String(days);
 document.getElementById('calendarPaidTotal').textContent=fmtMin(totalMs/60000);
 document.getElementById('calendarScheduledTotal').textContent=fmtMin(scheduledMinutesTotal);
 document.getElementById('calendarHoursBalance').textContent=(totalMs/60000-scheduledMinutesTotal>=0?'+':'')+fmtMin(totalMs/60000-scheduledMinutesTotal);
 document.getElementById('calendarPunchTotal').textContent=String(punchTotal);
 const selected=calendarRecord(myTimeSelectedDate),p=selected.punches||[],has=!!(p.length||hasDocumentedBreakRecord(data[myTimeSelectedDate]));
 document.getElementById('calendarSelectedTitle').textContent=new Date(myTimeSelectedDate+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'});
 document.getElementById('calendarSavedBadge').textContent=has?(window.myTimeAutoCloudConnected?'Cloud record loaded · edits verify on save':'Awaiting Cloudflare confirmation'):'No saved record';
 const details=document.getElementById('calendarPunchDetails');details.innerHTML='';
 [['Clock in','in'],['Lunch out','lunch-start'],['Lunch in','lunch-end'],['Clock out','out']].forEach(([label,type])=>{const box=document.createElement('div');box.className='mytime-detail-item';const l=document.createElement('span'),v=document.createElement('strong');l.textContent=label;v.textContent=calendarPunchTime(selected,type);box.append(l,v);details.appendChild(box)});
 const breakSummary=calendarBreakSummary(data[myTimeSelectedDate],false);
 document.getElementById('calendarDaySummary').textContent=[p.length?p.length+' clock punch event(s) · paid time '+calendarPaid(myTimeSelectedDate):'No clock punches saved',breakSummary!=='No documented lunch or break entries'?'Documented: '+breakSummary:''].filter(Boolean).join(' · ');
 renderCalendarIntervalAnalysis(myTimeSelectedDate,selected);
 const selectedSchedule=scheduleForDate(myTimeSelectedDate),selectedLate=lateStartMinutes(myTimeSelectedDate),recoverySummary=document.getElementById('calendarRecoverySummary');if(recoverySummary)recoverySummary.textContent=selectedLate>0?'Late start: '+fmtMin(selectedLate)+' (planned '+selectedSchedule.startTime+', actual '+calendarPunchTime(selected,'in')+'). Record the actual approved make-up action below.':(calendarPunchTime(selected,'in')!=='—'?'No late start detected against the planned '+selectedSchedule.startTime+'.':'No clock-in recorded; late start will be calculated once you clock in.');const noteInput=document.getElementById('calendarMakeUpNote');if(noteInput)noteInput.value=recoveryNote(myTimeSelectedDate);
 const breakRoot=data[myTimeSelectedDate]||{breakStatus:{lunch:'not-recorded',morning:'not-recorded',afternoon:'not-recorded'},breakTimes:{}};
 const controls=document.getElementById('calendarBreakControls');controls.innerHTML='';
 [['lunch','Lunch status'],['morning','Morning 15-minute break'],['afternoon','Afternoon 15-minute break']].forEach(([name,label])=>{
  const box=document.createElement('div');box.className='mytime-break-item';const h=document.createElement('strong');h.textContent=label;box.appendChild(h);
  const sel=document.createElement('select');sel.setAttribute('aria-label',label+' status');
  [['not-recorded','Not recorded'],['taken','Taken'],['skipped','Skipped']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;sel.appendChild(o)});
  sel.value=['taken','skipped','not-recorded'].includes(breakRoot.breakStatus?.[name])?breakRoot.breakStatus[name]:'not-recorded';
  box.appendChild(sel);
  const times=document.createElement('div');times.className='mytime-break-times';
  ['start','end'].forEach(part=>{
   const lab=document.createElement('label');lab.textContent=part==='start'?'Start time':'End time';
   const inp=document.createElement('input');inp.type='text';inp.inputMode='text';inp.autocomplete='off';inp.spellcheck=false;inp.maxLength=8;
   inp.placeholder='9:45 AM';inp.value=displayCalendarBreakTime(breakRoot.breakTimes?.[name]?.[part]||'');
   inp.setAttribute('aria-label',label+' '+(part==='start'?'start time':'end time'));
   inp.title='Enter a time such as 9:45 AM or 14:30';
   lab.appendChild(inp);times.appendChild(lab);
  });
  box.appendChild(times);controls.appendChild(box);
 });
 const saveBreaks=document.createElement('button');saveBreaks.type='button';saveBreaks.className='primary';saveBreaks.id='saveCalendarBreakRecords';saveBreaks.textContent='Save lunch & break corrections';saveBreaks.style.marginTop='12px';
 saveBreaks.onclick=async()=>{
  const cards=[...controls.querySelectorAll('.mytime-break-item')],draft={breakStatus:{},breakTimes:{}};
  for(let i=0;i<cards.length;i++){
   const [name]=[['lunch'],['morning'],['afternoon']][i],sel=cards[i].querySelector('select'),inputs=[...cards[i].querySelectorAll('input')];
   const a=normalizeCalendarBreakTime(inputs[0]?.value),b=normalizeCalendarBreakTime(inputs[1]?.value);
   if(a===null||b===null){alert('Enter a valid time such as 11:30 AM or 14:30.');inputs[a===null?0:1]?.focus();return}
   if((a&&!b)||(!a&&b)){alert('Enter both start and end times for '+name+' or leave both blank.');return}
   if(a&&b&&b<a){alert('The end time must be after the start time for '+name+'.');return}
   draft.breakStatus[name]=sel.value;draft.breakTimes[name]={start:a,end:b};
  }
  const dateKey=myTimeSelectedDate,previous=data[dateKey]||{punches:[],audit:[]},updated={...previous,breakStatus:draft.breakStatus,breakTimes:{...(previous.breakTimes||{}),...draft.breakTimes}};
  const changed=JSON.stringify(calendarBreakSnapshot(previous))!==JSON.stringify(calendarBreakSnapshot(updated));
  if(!changed){saveBreaks.textContent='No changes to save';return}
  data[dateKey]=updated;save();render();renderRecordManager();
  saveBreaks.disabled=true;saveBreaks.textContent='Saving and verifying…';
  const ok=await confirmCalendarBreakSave(dateKey);
  saveBreaks.disabled=false;saveBreaks.textContent=ok?'Saved to Cloudflare ✓':'Save not verified · retry';
  if(typeof renderMyTimeCalendar==='function')renderMyTimeCalendar();
 };
 controls.appendChild(saveBreaks);
}
function calendarIntervalMinutes(rec,startType,endType,fallback){
 const p=rec?.punches||[],start=[...p].reverse().find(x=>x.type===startType),end=[...p].reverse().find(x=>x.type===endType);
 const parseClock=v=>{if(!v||!/^\d{2}:\d{2}$/.test(v))return null;const [h,m]=v.split(':').map(Number);return h*60+m};
 const a=parseClock(fallback?.start),b=parseClock(fallback?.end);
 if(a!==null&&b!==null)return (b-a+1440)%1440;
 if(start?.ts&&end?.ts&&end.ts>=start.ts)return (end.ts-start.ts)/60000;
 if(start?.ts&&!end?.ts)return (Date.now()-start.ts)/60000;
 return null;
}
function renderCalendarIntervalAnalysis(k,rec){
 const root=document.getElementById('calendarIntervalAnalysis');if(!root)return;root.innerHTML='';
 const schedule=scheduleForDate(k),p=rec?.punches||[],status=rec?.breakStatus||{},times=rec?.breakTimes||{};
 const lunchActual=calendarIntervalMinutes(rec,'lunch-start','lunch-end',times.lunch);
 const lunchAllowed=Math.max(0,parseTime(settings.lunchEnd)-parseTime(settings.lunchStart));
 const lunchStarted=p.some(x=>x.type==='lunch-start'),lunchEnded=p.some(x=>x.type==='lunch-end');
 const minsText=v=>v===null?'Not recorded':fmtMin(v);
 function add(label,actual,allowed,detail,missing=false){
  const box=document.createElement('article');box.className='calendar-analysis-item';
  const h=document.createElement('small');h.textContent=label;
  const value=document.createElement('strong');value.textContent=minsText(actual);
  const delta=actual===null?null:Math.round(actual-allowed);
  const badge=document.createElement('span');badge.className='calendar-analysis-status';
  if(missing||actual===null){badge.classList.add('neutral');badge.textContent='Missing / incomplete'}
  else if(delta>0){badge.classList.add('bad');badge.textContent=fmtMin(delta)+' over'}
  else if(delta<0){badge.classList.add('warn');badge.textContent=fmtMin(-delta)+' short'}
  else badge.textContent='On target';
  const note=document.createElement('small');note.textContent='Allowance: '+fmtMin(allowed)+(detail?' · '+detail:'');
  box.append(h,value,badge,note);root.appendChild(box);
 }
 const lunchFallbackRecorded=!!(times.lunch?.start&&times.lunch?.end);
 const lunchDetail=calendarBreakStatusLabel(status.lunch)+' · '+calendarBreakRange(times.lunch)+(lunchStarted&&!lunchEnded?' · punch lunch is still open':'');
 add('Lunch duration',lunchActual,lunchAllowed,lunchDetail,lunchActual===null||(!lunchEnded&&!lunchFallbackRecorded));
 [['Morning break','morning','morning-break-start','morning-break-end'],['Afternoon break','afternoon','afternoon-break-start','afternoon-break-end']].forEach(([label,key,st,et])=>{
  const actual=calendarIntervalMinutes(rec,st,et,times[key]);
  const ended=p.some(x=>x.type===et),fallbackRecorded=!!(times[key]?.start&&times[key]?.end);
  const missing=actual===null||(!ended&&!fallbackRecorded);
  const detail=calendarBreakStatusLabel(status[key])+' · '+calendarBreakRange(times[key]);
  add(label,actual,15,detail,missing);
 });
 const planned=Math.max(0,plannedMinutes(schedule)),out=[...p].reverse().find(x=>x.type==='out'),last=p[p.length-1];
 const paid=p.length?paidMs(rec,out?.ts||(k===todayKey()?Date.now():last?.ts||Date.now()))/60000:null;
 add('Total paid time',paid,planned,'Daily target: '+fmtMin(planned)+' · This is total paid time, not the amount over target',paid===null);
 const summary=document.getElementById('calendarDaySummary');
 if(summary&&myTimeSelectedDate===k){
  const documented=calendarBreakSummary(rec,false);
  summary.textContent=[p.length?p.length+' clock punch event(s) · paid time '+calendarPaid(k):'No clock punches saved',documented!=='No documented lunch or break entries'?'Documented: '+documented:''].filter(Boolean).join(' · ');
 }
}
function calendarDateKeys(scope){
 const first=new Date(myTimeCalendarMonth.getFullYear(),myTimeCalendarMonth.getMonth(),1,12),count=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
 return Array.from({length:count},(_,i)=>calendarKeyDate(new Date(first.getFullYear(),first.getMonth(),i+1,12)));
}
function printCalendarReport(scope){
 const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 const selected=new Date((myTimeSelectedDate||todayKey())+'T12:00:00');let keys,first,last,monthMode=scope!=='week';
 if(scope==='week'){const off=(selected.getDay()+6)%7;first=new Date(selected);first.setDate(selected.getDate()-off);last=new Date(first);last.setDate(first.getDate()+6);keys=Array.from({length:7},(_,i)=>{const d=new Date(first);d.setDate(first.getDate()+i);return calendarKeyDate(d)})}
 else{first=new Date(myTimeCalendarMonth.getFullYear(),myTimeCalendarMonth.getMonth(),1,12);last=new Date(first.getFullYear(),first.getMonth()+1,0,12);const a=new Date(first);a.setDate(first.getDate()-first.getDay());const b=new Date(last);b.setDate(last.getDate()+6-last.getDay());keys=[];for(let d=new Date(a);d<=b;d.setDate(d.getDate()+1))keys.push(calendarKeyDate(d))}
 const report=document.getElementById('calendarPrintReport');if(!report)return;let totalMs=0,days=0,punchCount=0;
 const cells=keys.map(k=>{const date=new Date(k+'T12:00:00'),r=calendarRecord(k),p=r.punches||[],inside=!monthMode||date.getMonth()===first.getMonth(),out=[...p].reverse().find(x=>x.type==='out'),lastP=p[p.length-1],end=out?.ts||(k===todayKey()?Date.now():lastP?.ts||Date.now()),ms=p.length?paidMs(r,end):0;if(inside&&p.length){totalMs+=ms;days++;punchCount+=p.length}
 const time=(type,rev=false)=>{const x=rev?[...p].reverse().find(v=>v.type===type):p.find(v=>v.type===type);return x?.ts?fmtTime(x.ts):''},punches=[['IN',time('in')],['LUNCH OUT',time('lunch-start')],['LUNCH IN',time('lunch-end')],['OUT',time('out',true)]].filter(x=>x[1]);
 const documented=calendarBreakSummary(r,false);
 return '<div class="calendar-print-day '+(!inside?'outside-month ':'')+(k===todayKey()?'is-today':'')+'"><div class="calendar-print-day-number">'+date.getDate()+'</div>'+(punches.length?punches.map(x=>'<div class="calendar-print-punch"><span class="calendar-print-dot">●</span> '+esc(x[0])+' '+esc(x[1])+'</div>').join(''):'<div class="calendar-print-punch">'+(inside?'No punches':'')+'</div>')+(documented!=='No documented lunch or break entries'?'<div class="calendar-print-breaks"><strong>Documented breaks</strong><br>'+esc(documented).replaceAll('\n','<br>')+'</div>':'')+'<div class="calendar-print-hours">'+esc(p.length?fmtMin(ms/60000):'0m')+'</div></div>'}).join('');
 const weekdays=(monthMode?['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']:['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']).map(d=>'<div class="calendar-print-weekday">'+d+'</div>').join(''),title=monthMode?first.toLocaleDateString(undefined,{month:'long',year:'numeric'}):'Weekly Timecard',range=first.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})+' – '+last.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}),name=(typeof profile!=='undefined'&&profile.name)||'Employee',generated=new Date().toLocaleString(),relevant=monthMode?keys.filter(k=>k.slice(0,7)===calendarKeyDate(first).slice(0,7)):keys;
 const recent=relevant.filter(k=>(data[k]?.punches||[]).length).slice(-5).map(k=>'<div class="calendar-print-stat"><span>'+esc(new Date(k+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}))+'</span><strong>'+esc(calendarPaid(k))+'</strong></div>').join('');
 report.innerHTML='<header class="calendar-print-head"><div class="calendar-print-brand"><img class="calendar-print-logo" src="https://www.fossanalytics.com/Design/static/foss-logo.png" alt="FOSS" onerror="this.style.display=\'none\'"><div><div class="calendar-print-brand-name">myTIME</div><div class="calendar-print-tagline">FOSS North America · Time & Attendance</div></div></div><div class="calendar-print-meta"><strong>'+esc(name)+'</strong>'+esc(Intl.DateTimeFormat().resolvedOptions().timeZone||'Local time')+'<br>Report period: '+esc(range)+'<br>Generated: '+esc(generated)+'</div></header><div class="calendar-print-title"><div><h1>'+esc(title)+'</h1><p>Time & attendance calendar · Cloud-saved punches and documented breaks</p></div><strong>'+esc(range)+'</strong></div><div class="calendar-print-grid">'+weekdays+cells+'</div><section class="calendar-print-summary"><div class="calendar-print-card"><h2>Time Summary</h2><div class="calendar-print-stat"><span>Days with punches</span><strong>'+days+'</strong></div><div class="calendar-print-stat"><span>Punch events</span><strong>'+punchCount+'</strong></div><div class="calendar-print-stat total"><span>Total recorded paid time</span><strong>'+esc(fmtMin(totalMs/60000))+'</strong></div></div><div class="calendar-print-card"><h2>Recent Daily Totals</h2>'+(recent||'<div class="calendar-print-stat">No punch records saved</div>')+'<div class="calendar-print-stat total"><span>Period total</span><strong>'+esc(fmtMin(totalMs/60000))+'</strong></div></div><div class="calendar-print-card"><h2>Legend</h2><div class="calendar-print-legend"><span>● Punch event</span><span>Blue band: recorded time</span><span>Outlined day: today</span></div><p style="font-size:6.5pt;margin-top:7pt;color:#64718b">Blank days mean no punches are saved.</p></div></section><footer class="calendar-print-foot"><div><strong>TIME CLOCK RECORDS</strong><br>Verify times against your records. Not an official payroll document.</div><div style="text-align:right">FOSS North America · myTIME<br>Track Today. Build Tomorrow.</div></footer>';
 document.body.classList.add('printing-calendar');const cleanup=()=>{document.body.classList.remove('printing-calendar');window.removeEventListener('afterprint',cleanup)};window.addEventListener('afterprint',cleanup);window.print();setTimeout(cleanup,2000)
}
function exportCalendarCsv(keys){
 const q=v=>{const s=String(v??'');return '"'+s.replace(/"/g,'""')+'"';};
 const rows=[['Date','Clock in punch','Lunch out punch','Lunch in punch','Clock out punch','Paid time','Punch count','Late start minutes','Make-up note','Lunch status','Lunch record start','Lunch record end','Morning break status','Morning break record start','Morning break record end','Afternoon break status','Afternoon break record start','Afternoon break record end']];
 keys.forEach(k=>{const r=data[k]||{punches:[]},p=r.punches||[],get=t=>p.find(x=>x.type===t),out=[...p].reverse().find(x=>x.type==='out'),clock=t=>{const item=t==='out'?out:get(t);return item?.ts?fmtTime(item.ts):''},status=r.breakStatus||{},times=r.breakTimes||{};rows.push([k,clock('in'),clock('lunch-start'),clock('lunch-end'),clock('out'),p.length?fmtMin(paidMs(r,out?.ts||Date.now())/60000):'',p.length,lateStartMinutes(k),recoveryNote(k),status.lunch||'not-recorded',times.lunch?.start||'',times.lunch?.end||'',status.morning||'not-recorded',times.morning?.start||'',times.morning?.end||'',status.afternoon||'not-recorded',times.afternoon?.start||'',times.afternoon?.end||''])});
 const csv=rows.map(row=>row.map(q).join(',')).join('\r\n'),blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='myTIME-monthly-timesheet-'+keys[0]+'-to-'+keys[keys.length-1]+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
/* Direct editing and deletion for any saved date */
function recordHH(ts){if(!ts)return '';const d=new Date(ts);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}
function managerRecordTimes(k){const p=data[k]?.punches||[],first=t=>p.find(x=>x.type===t);return {cin:first('in')?.ts,lo:first('lunch-start')?.ts,li:first('lunch-end')?.ts,cout:[...p].reverse().find(x=>x.type==='out')?.ts}}
function stableRecordJson(value){if(Array.isArray(value))return value.map(stableRecordJson);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stableRecordJson(value[key])]));return value}
async function verifyDateRecordSaved(dateKey){
 if(typeof window.myTimeFlushCloudSync!=='function')throw new Error('Cloud save confirmation is unavailable.');
 await window.myTimeFlushCloudSync();
 const response=await fetch('/api/records',{method:'GET',credentials:'same-origin',cache:'no-store'});
 const payload=await response.json().catch(()=>null);
 if(!response.ok||!payload?.ok||!payload.payload)throw new Error(payload?.error||('Cloudflare read-back failed (HTTP '+response.status+').'));
 if(JSON.stringify(stableRecordJson(payload.payload.records?.[dateKey]||null))!==JSON.stringify(stableRecordJson(data[dateKey]||null)))throw new Error('Cloudflare did not return the exact corrected record for '+dateKey+'. Your edit is retained but not marked saved.');
 return Number(payload.revision||0);
}
function renderRecordManager(){
 const body=document.getElementById('recordManagerRows');if(!body)return;
 const filter=(document.getElementById('recordSearch')?.value||'').trim(),keys=Object.keys(data).filter(k=>!filter||k.includes(filter)).sort().reverse();body.innerHTML='';
 if(!keys.length){body.innerHTML='<tr><td colspan="8">No matching saved records.</td></tr>';return}
 keys.forEach(k=>{
  const p=managerRecordTimes(k),rec=data[k],paid=paidMs(rec,[...(rec.punches||[])].reverse().find(x=>x.type==='out')?.ts||Date.now()),tr=document.createElement('tr');
  [k,p.cin?fmtTime(p.cin):'—',p.lo?fmtTime(p.lo):'—',p.li?fmtTime(p.li):'—',p.cout?fmtTime(p.cout):'—',fmtMin(paid/60000)].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.appendChild(td)});
  const documented=document.createElement('td');documented.className='record-break-summary';documented.textContent=calendarBreakSummary(rec,true);tr.appendChild(documented);
  const td=document.createElement('td'),actions=document.createElement('div');actions.className='record-row-actions';const edit=document.createElement('button');edit.type='button';edit.className='quiet';edit.textContent='Edit';edit.onclick=()=>openRecordEditor(k);const del=document.createElement('button');del.type='button';del.className='danger';del.textContent='Delete';del.onclick=()=>deleteRecordDate(k);actions.append(edit,del);td.appendChild(actions);tr.appendChild(td);body.appendChild(tr);
 });
}
function openRecordEditor(k){
 const input=document.getElementById('recordDate');input.value=k;const exists=!!data[k];const p=managerRecordTimes(k);
 document.getElementById('editClockIn').value=recordHH(p.cin);document.getElementById('editLunchOut').value=recordHH(p.lo);document.getElementById('editLunchIn').value=recordHH(p.li);document.getElementById('editClockOut').value=recordHH(p.cout);
 document.getElementById('editReason').value='';const br=data[k]||{},bs=br.breakStatus||{},bt=br.breakTimes||{};['lunch','morning','afternoon'].forEach(name=>{const status=document.getElementById('edit'+name+'Status'),start=document.getElementById('edit'+name+'Start'),end=document.getElementById('edit'+name+'End');if(status)status.value=['taken','skipped','not-recorded'].includes(bs[name])?bs[name]:'not-recorded';if(start)start.value=bt[name]?.start||'';if(end)end.value=bt[name]?.end||''});document.getElementById('recordEditorTitle').textContent=(exists?'Edit punches for ':'Add punches for ')+k;document.getElementById('deleteRecordDay').hidden=!exists;document.getElementById('recordEditor').hidden=false;
}
function deleteRecordDate(k){
 if(!data[k])return;if(!confirm('Permanently delete all punch records for '+k+' from your Cloudflare timecard? This removes them from your account across devices.'))return;
 delete data[k];save();render();renderRecordManager();document.getElementById('recordEditor').hidden=true;
}
document.getElementById('recordSearch')?.addEventListener('input',renderRecordManager);
document.getElementById('recordDate')?.addEventListener('change',e=>{if(e.target.value)openRecordEditor(e.target.value)});
document.getElementById('newRecordBtn')?.addEventListener('click',()=>{const d=document.getElementById('recordDate');if(!d.value)d.value=todayKey();openRecordEditor(d.value)});
document.getElementById('cancelRecordEdit')?.addEventListener('click',()=>document.getElementById('recordEditor').hidden=true);
document.getElementById('deleteRecordDay')?.addEventListener('click',()=>deleteRecordDate(document.getElementById('recordDate').value));
document.getElementById('saveRecordEdit')?.addEventListener('click',async()=>{
 const k=document.getElementById('recordDate').value;if(!/^\d{4}-\d{2}-\d{2}$/.test(k)){alert('Choose a valid work date first.');return}
 const values=[['in',document.getElementById('editClockIn').value],['lunch-start',document.getElementById('editLunchOut').value],['lunch-end',document.getElementById('editLunchIn').value],['out',document.getElementById('editClockOut').value]],seq=values.filter(x=>x[1]).map(x=>x[1]);
 const hasBreakEdits=['lunch','morning','afternoon'].some(name=>{const status=document.getElementById('edit'+name+'Status')?.value||'not-recorded',start=document.getElementById('edit'+name+'Start')?.value||'',end=document.getElementById('edit'+name+'End')?.value||'';return status!=='not-recorded'||!!start||!!end});
 if(!seq.length&&!hasBreakEdits){alert('Enter at least one punch or documented break entry, or use Delete to remove the date.');return}
 if(values[1][1]&&!values[2][1]||!values[1][1]&&values[2][1]){alert('Lunch out and lunch in must both be entered, or both left blank.');return}
 for(let i=1;i<seq.length;i++)if(seq[i]<seq[i-1]){alert('Punch times must be chronological: clock in, lunch out, lunch in, clock out.');return}
 if(values[1][1]&&!values[0][1]||values[2][1]&&!values[1][1]||values[3][1]&&!values[0][1]){alert('Add the preceding punch first (clock in before lunch, lunch out before lunch in, and clock in before clock out).');return}
 const punches=values.filter(x=>x[1]).map(([type,t])=>({type,ts:new Date(k+'T'+t+':00').getTime()}));
 const reason=document.getElementById('editReason').value.trim()||'Manually edited in Manage records';
 const audit=[...(data[k]?.audit||[]),{at:Date.now(),reason}],record={...(data[k]||{}),punches,audit};record.breakStatus={...(record.breakStatus||{})};record.breakTimes={...(record.breakTimes||{})};for(const name of ['lunch','morning','afternoon']){const status=document.getElementById('edit'+name+'Status'),start=document.getElementById('edit'+name+'Start'),end=document.getElementById('edit'+name+'End');if(status)record.breakStatus[name]=status.value;if(start||end){const a=start?.value||'',b=end?.value||'';if((a&&!b)||(!a&&b)){alert('Enter both start and end times for '+name+' or leave both blank.');return}if(a&&b&&b<a){alert('The end time must be after the start time for '+name+'.');return}record.breakTimes[name]={start:a,end:b}}}data[k]=record;save();render();renderRecordManager();
 const saveButton=document.getElementById('saveRecordEdit');if(saveButton){saveButton.disabled=true;saveButton.textContent='Saving and verifying…'}const status=document.getElementById('importStatus');if(status)status.textContent='Saving corrections for '+k+' to Cloudflare…';try{const revision=await verifyDateRecordSaved(k);if(status)status.textContent='Cloudflare verified · '+k+' · revision '+revision;document.getElementById('recordEditor').hidden=true;if(typeof renderMyTimeCalendar==='function')renderMyTimeCalendar()}catch(error){if(status)status.textContent='Save not verified for '+k+' · your edit is retained: '+error.message;setSaveStatus(false,'Record correction not verified · pending data kept')}finally{if(saveButton){saveButton.disabled=false;saveButton.textContent='Save changes'}}
});
document.getElementById('downloadRecordsCsv')?.addEventListener('click',()=>{
 const escapeCsv=v=>'"'+String(v??'').replace(/"/g,'""')+'"',lines=[['Date','Clock In','Lunch Out','Lunch In','Clock Out','Paid Minutes','Notes']];
 Object.keys(data).sort().forEach(k=>{const p=managerRecordTimes(k),rec=data[k],out=[...(rec.punches||[])].reverse().find(x=>x.type==='out'),mins=Math.round(paidMs(rec,out?.ts||Date.now())/60000);lines.push([k,recordHH(p.cin),recordHH(p.lo),recordHH(p.li),recordHH(p.cout),mins,(rec.audit||[]).map(a=>a.reason).filter(Boolean).join(' | ')])});
 const blob=new Blob([lines.map(r=>r.map(escapeCsv).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='myTIME-editable-records-'+todayKey()+'.csv';a.click();URL.revokeObjectURL(url);
});
const beforeManagerRender=render;render=function(){beforeManagerRender();renderRecordManager()};
renderRecordManager();

