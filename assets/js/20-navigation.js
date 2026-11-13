
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

function calendarBreakStatusLabel(value){return value==='taken'?'Taken':value==='skipped'?'Skipped':'Not recorded'}
function calendarBreakRange(value){const start=value?.start?humanTime(value.start):'',end=value?.end?humanTime(value.end):'';if(start&&end)return start+'–'+end;if(start)return 'Start '+start;if(end)return 'End '+end;return 'Times not entered'}
function calendarBreakSummary(record,includeEmpty=true){
 const status=record?.breakStatus||{},times=record?.breakTimes||{},sections=[['lunch','Lunch'],['morning','Morning break'],['afternoon','Afternoon break']];
 const lines=sections.map(([key,label])=>{const state=['taken','skipped','not-recorded'].includes(status[key])?status[key]:'not-recorded',value=times[key]||{},hasTimes=!!(value.start||value.end);if(!includeEmpty&&state==='not-recorded'&&!hasTimes)return '';return label+': '+calendarBreakStatusLabel(state)+' · '+calendarBreakRange(value)}).filter(Boolean);
 return lines.length?lines.join('\n'):'No documented lunch or break entries';
}
function hasDocumentedBreakRecord(record){const status=record?.breakStatus||{},times=record?.breakTimes||{};return ['lunch','morning','afternoon'].some(key=>['taken','skipped'].includes(status[key])||!!(times[key]?.start||times[key]?.end))}
function calendarPunchOnlyIntervalMinutes(record,startType,endType){const p=record?.punches||[],start=p.find(x=>x.type===startType),end=p.find(x=>x.type===endType);return start?.ts&&end?.ts&&end.ts>=start.ts?(end.ts-start.ts)/60000:null}
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
    <div class="mytime-detail-grid" id="calendarPunchDetails"></div>
    <p class="sub" id="calendarDaySummary" style="margin-top:12px;line-height:1.5"></p>
    <section class="calendar-analysis" aria-live="polite"><h3 style="margin:0">Hours, lunch &amp; break analysis</h3><p class="sub" style="margin:5px 0 0">Analysis compares saved clock punches with the separately documented lunch and rest breaks.</p><div class="calendar-analysis-grid" id="calendarIntervalAnalysis"></div></section>
    <h3 style="margin-top:18px">Late start &amp; make-up record</h3>
    <div id="calendarRecoverySummary" class="notice" style="margin:10px 0"></div>
    <p class="sub" id="calendarMakeUpNoteSummary"></p>
    <h3 style="margin-top:18px">Documented lunch &amp; rest breaks</h3>
    <p class="sub" id="calendarDocumentedSummary"></p>
    <button type="button" class="primary" id="editSelectedDayInRecords">Edit this day in Manage Records</button>
   </section>
   <section id="calendarPrintReport" aria-hidden="true"></section>
  </section>`;
  document.getElementById('calendarPrev').onclick=()=>{myTimeCalendarMonth=new Date(myTimeCalendarMonth.getFullYear(),myTimeCalendarMonth.getMonth()-1,1);renderMyTimeCalendar()};
  document.getElementById('calendarNext').onclick=()=>{myTimeCalendarMonth=new Date(myTimeCalendarMonth.getFullYear(),myTimeCalendarMonth.getMonth()+1,1);renderMyTimeCalendar()};
  document.getElementById('calendarToday').onclick=()=>{myTimeSelectedDate=todayKey();myTimeCalendarMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);renderMyTimeCalendar()};
  document.getElementById('calendarDatePicker').onchange=e=>{if(!e.target.value)return;myTimeSelectedDate=e.target.value;const d=new Date(myTimeSelectedDate+'T12:00:00');myTimeCalendarMonth=new Date(d.getFullYear(),d.getMonth(),1);renderMyTimeCalendar()};
  document.getElementById('editSelectedDayInRecords').onclick=()=>{
   const key=myTimeSelectedDate;
   if(typeof window.myTimeShowPage==='function')window.myTimeShowPage('records');
   openRecordEditor(key);
   document.getElementById('recordEditor')?.scrollIntoView({behavior:'smooth',block:'start'});
  };
  document.getElementById('calendarExportMonth').onclick=()=>exportCalendarCsv(calendarDateKeys('month'));
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
 const selected=calendarRecord(myTimeSelectedDate),p=selected.punches||[];
 document.getElementById('calendarSelectedTitle').textContent=new Date(myTimeSelectedDate+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'});
 const detail=document.getElementById('calendarPunchDetails');detail.innerHTML='';
 [['Clock in','in'],['Lunch out','lunch-start'],['Lunch in','lunch-end'],['Clock out','out']].forEach(([label,type])=>{const box=document.createElement('div');box.className='mytime-detail-item';const l=document.createElement('span'),v=document.createElement('strong');l.textContent=label;v.textContent=calendarPunchTime(selected,type);box.append(l,v);detail.appendChild(box)});
 const punchLunch=calendarPunchOnlyIntervalMinutes(selected,'lunch-start','lunch-end'),lunchTimes=selected.breakTimes?.lunch||{};
 const docStart=/^\d{2}:\d{2}$/.test(lunchTimes.start||'')?parseTime(lunchTimes.start):null,docEnd=/^\d{2}:\d{2}$/.test(lunchTimes.end||'')?parseTime(lunchTimes.end):null;
 const documentedLunch=docStart!==null&&docEnd!==null?(docEnd-docStart+1440)%1440:null;
 const parts=[p.length+' clock punch event(s)','Paid time '+calendarPaid(myTimeSelectedDate)];
 if(punchLunch!==null)parts.push('Lunch deducted from paid time '+fmtMin(punchLunch));
 if(documentedLunch!==null)parts.push('Documented lunch '+fmtMin(documentedLunch));
 if(punchLunch!==null&&documentedLunch!==null&&Math.round(punchLunch)!==Math.round(documentedLunch))parts.push('WARNING: saved lunch punches and documented lunch do not match');
 document.getElementById('calendarDaySummary').textContent=parts.join(' · ');
 document.getElementById('calendarSavedBadge').textContent=p.length||hasDocumentedBreakRecord(selected)?(window.myTimeAutoCloudConnected?'Cloud record loaded':'Cloud connection needs attention'):'No saved record';
 renderCalendarIntervalAnalysis(myTimeSelectedDate,selected);
 const late=lateStartMinutes(myTimeSelectedDate),note=String(selected.makeUpNote||'').trim();
 document.getElementById('calendarRecoverySummary').textContent=late>0?'Late start: '+fmtMin(late)+' after the planned start.':'No late start detected against the planned schedule.';
 document.getElementById('calendarMakeUpNoteSummary').textContent=note?'Make-up note: '+note:'No make-up note recorded.';
 document.getElementById('calendarDocumentedSummary').textContent=calendarBreakSummary(selected,true);

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
 const lunchActual=calendarIntervalMinutes(rec,'lunch-start','lunch-end',times.lunch),paidLunchPunch=calendarPunchOnlyIntervalMinutes(rec,'lunch-start','lunch-end');
 const lunchAllowed=Math.max(0,parseTime(settings.lunchEnd)-parseTime(settings.lunchStart)),lunchStarted=p.some(x=>x.type==='lunch-start'),lunchEnded=p.some(x=>x.type==='lunch-end');
 const documentedLunchText=calendarBreakRange(times.lunch),minsText=v=>v===null?'Not recorded':fmtMin(v);
 function add(label,actual,allowed,detail,missing=false){
  const box=document.createElement('article');box.className='calendar-analysis-item';const h=document.createElement('small');h.textContent=label;const value=document.createElement('strong');value.textContent=minsText(actual);const delta=actual===null?null:Math.round(actual-allowed);const badge=document.createElement('span');badge.className='calendar-analysis-status';
  if(missing||actual===null){badge.classList.add('neutral');badge.textContent='Missing / incomplete'}else if(delta>0){badge.classList.add('bad');badge.textContent=fmtMin(delta)+' over'}else if(delta<0){badge.classList.add('warn');badge.textContent=fmtMin(-delta)+' short'}else badge.textContent='On target';
  const note=document.createElement('small');note.textContent='Allowance: '+fmtMin(allowed)+(detail?' · '+detail:'');box.append(h,value,badge,note);root.appendChild(box);
 }
 const lunchFallbackRecorded=!!(times.lunch?.start&&times.lunch?.end);
 add('Documented lunch duration',lunchActual,lunchAllowed,calendarBreakStatusLabel(status.lunch)+' · '+documentedLunchText,!lunchFallbackRecorded);
 add('Lunch deducted from paid time',paidLunchPunch,lunchAllowed,'Calculated from the Lunch out and Lunch in punch fields'+(lunchStarted&&!lunchEnded?' · punch lunch is still open':''),paidLunchPunch===null);
 [['Morning break','morning','morning-break-start','morning-break-end'],['Afternoon break','afternoon','afternoon-break-start','afternoon-break-end']].forEach(([label,key,st,et])=>{
  const actual=calendarIntervalMinutes(rec,st,et,times[key]),ended=p.some(x=>x.type===et),fallbackRecorded=!!(times[key]?.start&&times[key]?.end),missing=actual===null||(!ended&&!fallbackRecorded);
  add(label,actual,15,calendarBreakStatusLabel(status[key])+' · '+calendarBreakRange(times[key]),missing);
 });
 const planned=Math.max(0,plannedMinutes(schedule)),out=[...p].reverse().find(x=>x.type==='out'),last=p[p.length-1],paid=p.length?paidMs(rec,out?.ts||(k===todayKey()?Date.now():last?.ts||Date.now()))/60000:null;
 add('Total paid time',paid,planned,'Calculated from the paid-time clock punches, not from the separate documented lunch fields',paid===null);
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
 if(typeof window.myTimeSaveAndVerifyRecord==='function'){
  const result=await window.myTimeSaveAndVerifyRecord(dateKey,JSON.parse(JSON.stringify(data[dateKey]||null)));
  return Number(result?.revision||0);
 }
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
 if(!keys.length){body.innerHTML='<tr><td colspan="7">No matching saved records.</td></tr>';return}
 keys.forEach(k=>{
  const p=managerRecordTimes(k),rec=data[k],paid=paidMs(rec,[...(rec.punches||[])].reverse().find(x=>x.type==='out')?.ts||Date.now()),tr=document.createElement('tr');
  const dateCell=document.createElement('td'),select=document.createElement('button');select.type='button';select.className='record-date-select';select.textContent=k;select.title='Load this date into the correction form above';select.setAttribute('aria-label','Select '+k+' in the correction form');
  select.onclick=()=>{openRecordEditor(k);document.getElementById('recordEditor')?.scrollIntoView({behavior:'smooth',block:'start'})};dateCell.appendChild(select);tr.appendChild(dateCell);
  [p.cin?fmtTime(p.cin):'—',p.lo?fmtTime(p.lo):'—',p.li?fmtTime(p.li):'—',p.cout?fmtTime(p.cout):'—',fmtMin(paid/60000)].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.appendChild(td)});
  const documented=document.createElement('td');documented.className='record-break-summary';documented.textContent=calendarBreakSummary(rec,true);tr.appendChild(documented);
  body.appendChild(tr);
 });
}
function calculateRecordPaidMinutes(input){
 const minute=value=>{if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value||'')))return null;const [h,m]=value.split(':').map(Number);return h*60+m};
 const start=minute(input.clockIn),out=minute(input.clockOut),lunchOut=minute(input.lunchOut),lunchIn=minute(input.lunchIn);
 if(start===null||out===null)return {valid:false,message:'Enter both clock-in and clock-out times to preview paid hours.'};
 if((input.lunchOut&&!input.lunchIn)||(!input.lunchOut&&input.lunchIn))return {valid:false,message:'Enter both lunch punches or leave both blank.'};
 if(out<start)return {valid:false,message:'Clock-out must be later than clock-in for this work date.'};
 if(lunchOut!==null&&lunchIn!==null&&(lunchOut<start||lunchIn<lunchOut||lunchIn>out))return {valid:false,message:'Lunch punches must fall between clock-in and clock-out in chronological order.'};
 const elapsed=out-start,lunch=lunchOut===null?0:lunchIn-lunchOut,paid=elapsed-lunch;
 if(paid<0)return {valid:false,message:'Lunch duration cannot exceed the total shift.'};
 return {valid:true,totalMinutes:paid,elapsedMinutes:elapsed,lunchMinutes:lunch};
}
function updateRecordPaidTimePreview(){
 const preview=document.getElementById('recordPaidTimePreview');if(!preview)return;
 const key=document.getElementById('recordDate')?.value||'';
 const input={clockIn:document.getElementById('editClockIn')?.value||'',lunchOut:document.getElementById('editLunchOut')?.value||'',lunchIn:document.getElementById('editLunchIn')?.value||'',clockOut:document.getElementById('editClockOut')?.value||''};
 const result=calculateRecordPaidMinutes(input);
 if(!result.valid){preview.textContent=result.message;preview.dataset.kind='warning';return}
 const existing=data[key],out=[...(existing?.punches||[])].reverse().find(x=>x.type==='out');
 const current=existing?Math.round(paidMs(existing,out?.ts||Date.now())/60000):null;
 const fmt=n=>Math.floor(n/60)+'h '+String(n%60).padStart(2,'0')+'m';
 preview.textContent=current===null?'Paid time after saving: '+fmt(result.totalMinutes)+'. Preview only — no changes have been saved.':'Current saved paid time: '+fmt(current)+' → With punch values above: '+fmt(result.totalMinutes)+'. Preview only — no changes have been saved.';
 preview.dataset.kind='info';
}
function copyDocumentedLunchToPunches(){
 const start=document.getElementById('editlunchStart')?.value||'',end=document.getElementById('editlunchEnd')?.value||'';
 if(!start||!end){alert('Enter both documented lunch start and end times before copying them to the paid-time lunch punches.');return}
 document.getElementById('editLunchOut').value=start;
 document.getElementById('editLunchIn').value=end;
 updateRecordPaidTimePreview();
 const note=document.getElementById('recordLunchCopyNotice');
 if(note)note.textContent='Copied to the paid-time Lunch out and Lunch in fields above. This is not saved yet — review the preview and press Save changes.';
}
function openRecordEditor(k){
 const input=document.getElementById('recordDate');input.value=k;const exists=!!data[k];const p=managerRecordTimes(k);
 document.getElementById('editClockIn').value=recordHH(p.cin);document.getElementById('editLunchOut').value=recordHH(p.lo);document.getElementById('editLunchIn').value=recordHH(p.li);document.getElementById('editClockOut').value=recordHH(p.cout);
 document.getElementById('editReason').value='';const br=data[k]||{},bs=br.breakStatus||{},bt=br.breakTimes||{};document.getElementById('editMakeUpNote').value=String(br.makeUpNote||'');const saveStatus=document.getElementById('recordEditSaveStatus');if(saveStatus){saveStatus.textContent='';saveStatus.dataset.state=''}const saveButton=document.getElementById('saveRecordEdit');if(saveButton){saveButton.disabled=false;saveButton.textContent='Save changes'}['lunch','morning','afternoon'].forEach(name=>{const status=document.getElementById('edit'+name+'Status'),start=document.getElementById('edit'+name+'Start'),end=document.getElementById('edit'+name+'End');if(status)status.value=['taken','skipped','not-recorded'].includes(bs[name])?bs[name]:'not-recorded';if(start)start.value=bt[name]?.start||'';if(end)end.value=bt[name]?.end||''});document.getElementById('recordEditorTitle').textContent=(exists?'Edit punches for ':'Add punches for ')+k;document.getElementById('deleteRecordDay').hidden=!exists;document.getElementById('recordEditor').hidden=false;updateRecordPaidTimePreview();
}
function deleteRecordDate(k){
 if(!data[k])return;if(!confirm('Permanently delete all punch records for '+k+' from your Cloudflare timecard? This removes them from your account across devices.'))return;
 delete data[k];save();render();renderRecordManager();document.getElementById('recordEditor').hidden=true;
}
['editClockIn','editLunchOut','editLunchIn','editClockOut'].forEach(id=>{const el=document.getElementById(id);el?.addEventListener('input',updateRecordPaidTimePreview);el?.addEventListener('change',updateRecordPaidTimePreview)});
['editlunchStart','editlunchEnd'].forEach(id=>{const el=document.getElementById(id);el?.addEventListener('input',updateRecordPaidTimePreview);el?.addEventListener('change',updateRecordPaidTimePreview)});
document.getElementById('copyDocumentedLunchToPunches')?.addEventListener('click',copyDocumentedLunchToPunches);
document.getElementById('recordSearch')?.addEventListener('input',renderRecordManager);
document.getElementById('recordDate')?.addEventListener('change',e=>{if(e.target.value)openRecordEditor(e.target.value)});
document.getElementById('newRecordBtn')?.addEventListener('click',()=>{const d=document.getElementById('recordDate');if(!d.value)d.value=todayKey();openRecordEditor(d.value)});
document.getElementById('cancelRecordEdit')?.addEventListener('click',()=>document.getElementById('recordEditor').hidden=true);
document.getElementById('deleteRecordDay')?.addEventListener('click',()=>deleteRecordDate(document.getElementById('recordDate').value));
document.getElementById('saveRecordEdit')?.addEventListener('click',async()=>{
 const k=document.getElementById('recordDate').value,saveButton=document.getElementById('saveRecordEdit'),status=document.getElementById('recordEditSaveStatus');
 const showStatus=(message,state='info')=>{if(status){status.textContent=message;status.dataset.state=state}const globalStatus=document.getElementById('saveStatusText');if(globalStatus)globalStatus.textContent=message};
 if(!/^\d{4}-\d{2}-\d{2}$/.test(k)){showStatus('Choose a valid work date before saving.','error');return}
 const values=[['in',document.getElementById('editClockIn').value],['lunch-start',document.getElementById('editLunchOut').value],['lunch-end',document.getElementById('editLunchIn').value],['out',document.getElementById('editClockOut').value]];
 const seq=values.filter(x=>x[1]).map(x=>x[1]),existingBefore=data[k]||{punches:[],audit:[]};
 const makeUpNoteInput=String(document.getElementById('editMakeUpNote')?.value||'').trim();
 const hasMakeUpNoteEdit=makeUpNoteInput!==String(existingBefore.makeUpNote||'').trim();
 const hasBreakEdits=['lunch','morning','afternoon'].some(name=>{
  const state=document.getElementById('edit'+name+'Status')?.value||'not-recorded',start=document.getElementById('edit'+name+'Start')?.value||'',end=document.getElementById('edit'+name+'End')?.value||'';
  return state!=='not-recorded'||!!start||!!end;
 });
 if(!seq.length&&!hasBreakEdits&&!hasMakeUpNoteEdit){showStatus('Nothing to save yet. Enter a punch, a documented lunch/break entry, or a make-up note.','error');return}
 if((values[1][1]&&!values[2][1])||(!values[1][1]&&values[2][1])){showStatus('Lunch out and lunch in must both be entered, or both left blank.','error');return}
 for(let i=1;i<seq.length;i++)if(seq[i]<seq[i-1]){showStatus('Punch times must be chronological: clock in, lunch out, lunch in, clock out.','error');return}
 if((values[1][1]&&!values[0][1])||(values[2][1]&&!values[1][1])||(values[3][1]&&!values[0][1])){showStatus('Add the preceding punch first: clock in before lunch and clock out.','error');return}
 const original=data[k]||{punches:[],audit:[]},originalPunches=Array.isArray(original.punches)?original.punches:[],selectedOriginal=new Set();
 const replacements=values.map(([type,time])=>{
  const prior=originalPunches.find(item=>item.type===type&&!selectedOriginal.has(item));
  if(prior)selectedOriginal.add(prior);
  if(!time)return null;
  const ts=new Date(k+'T'+time+':00').getTime();
  if(!Number.isFinite(ts))return null;
  return {...(prior||{}),eventId:prior?.eventId||(prior?String(prior.type)+'|'+String(prior.ts):String(type)+'|'+String(ts)),type,ts};
 }).filter(Boolean);
 const punches=[...originalPunches.filter(item=>!selectedOriginal.has(item)),...replacements].sort((a,b)=>Number(a.ts)-Number(b.ts));
 const reason=document.getElementById('editReason').value.trim()||'Manually edited in Manage records';
 const breakStatus={...(original.breakStatus||{})},breakTimes={...(original.breakTimes||{})};
 for(const name of ['lunch','morning','afternoon']){
  const state=document.getElementById('edit'+name+'Status'),start=document.getElementById('edit'+name+'Start'),end=document.getElementById('edit'+name+'End');
  if(state)breakStatus[name]=state.value;
  if(start||end){
   const a=start?.value||'',b=end?.value||'';
   if((a&&!b)||(!a&&b)){showStatus('Enter both start and end times for '+name+', or leave both blank.','error');return}
   if(a&&b&&b<a){showStatus('The end time must be after the start time for '+name+'.','error');return}
   breakTimes[name]={start:a,end:b};
  }
 }
 const makeUpNote=makeUpNoteInput;
 const before={punches:originalPunches.map(item=>({...item})),breakStatus:{...(original.breakStatus||{})},breakTimes:{...(original.breakTimes||{})},makeUpNote:original.makeUpNote||''};
 const after={punches:punches.map(item=>({...item})),breakStatus:{...breakStatus},breakTimes:{...breakTimes},makeUpNote};
 const audit=[...(original.audit||[]),{at:Date.now(),reason,before,after}];
 const record={...original,punches,audit,breakStatus,breakTimes,makeUpNote};
 if(saveButton){saveButton.disabled=true;saveButton.textContent='Saving to Cloudflare…'}
 showStatus('Sending '+k+' to Cloudflare D1…','pending');
 data[k]=record;
 try{
  save();
  const revision=await verifyDateRecordSaved(k);
  showStatus('Saved and verified in Cloudflare · '+k+' · revision '+revision,'success');
  try{render();renderRecordManager();if(typeof renderMyTimeCalendar==='function')renderMyTimeCalendar();if(typeof renderPlanning==='function')renderPlanning()}catch(renderError){console.warn('myTIME refreshed the saved record but a view did not redraw:',renderError)}
  updateRecordPaidTimePreview();
 }catch(error){
  const message=String(error?.message||error);
  showStatus('NOT SAVED · '+message+' Your entries are still shown here; correct the issue and click Save changes again.','error');
  setSaveStatus(false,'Record save not verified · pending edits kept');
  console.error('myTIME record correction could not be verified in D1:',error);
 }finally{
  if(saveButton){saveButton.disabled=false;saveButton.textContent='Save changes'}
 }
});
document.getElementById('downloadRecordsCsv')?.addEventListener('click',()=>{
 const escapeCsv=v=>'"'+String(v??'').replace(/"/g,'""')+'"',lines=[['Date','Clock In','Lunch Out','Lunch In','Clock Out','Paid Minutes','Notes']];
 Object.keys(data).sort().forEach(k=>{const p=managerRecordTimes(k),rec=data[k],out=[...(rec.punches||[])].reverse().find(x=>x.type==='out'),mins=Math.round(paidMs(rec,out?.ts||Date.now())/60000);lines.push([k,recordHH(p.cin),recordHH(p.lo),recordHH(p.li),recordHH(p.cout),mins,(rec.audit||[]).map(a=>a.reason).filter(Boolean).join(' | ')])});
 const blob=new Blob([lines.map(r=>r.map(escapeCsv).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='myTIME-editable-records-'+todayKey()+'.csv';a.click();URL.revokeObjectURL(url);
});
const beforeManagerRender=render;render=function(){beforeManagerRender();renderRecordManager()};
renderRecordManager();

