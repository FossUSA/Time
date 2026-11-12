
/* Shared FOSS myTIME weekly email renderer: resilient table layout for Outlook plus phone cards where media queries are supported. */
(function(){
  'use strict';
  window.myTimeBuildProfessionalWeeklyReport=function(report){
    report=report||{};
    const esc=function(value){return String(value==null?'':value).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]})};
    const clean=function(value){const v=String(value==null?'':value).trim();return v&&v!=='—'&&v!=='-'?v:''};
    const duration=function(value){const n=Math.max(0,Math.round(Number(value)||0));const h=Math.floor(n/60),m=n%60;return h+'h '+String(m).padStart(2,'0')+'m'};
    const dateLabel=function(value,options){if(!value)return '';const d=new Date(String(value).slice(0,10)+'T12:00:00');return isNaN(d.getTime())?String(value):d.toLocaleDateString('en-US',options||{month:'short',day:'numeric'})};
    const days=Array.isArray(report.days)?report.days.slice(0,5):[];
    const total=days.reduce(function(sum,d){return sum+(Number(d.paidMinutes)||0)},0);
    const target=Math.max(0,Number(report.targetMinutes)||2400);
    const delta=total-target;
    const varianceText=delta===0?'On target':duration(Math.abs(delta))+(delta>0?' over target':' below target');
    const varianceColor=delta>0?'#a83d38':delta<0?'#936500':'#24734f';
    const progress=target?Math.max(0,Math.min(100,Math.round(total/target*100))):0;
    const reportRange=dateLabel(report.startDate,{month:'long',day:'numeric'})+' – '+dateLabel(report.endDate,{month:'long',day:'numeric',year:'numeric'});
    const generated=report.generatedAt?new Date(report.generatedAt):new Date();
    const generatedLabel=isNaN(generated.getTime())?'':generated.toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'});
    const punchText=function(d){
      const list=Array.isArray(d.punches)?d.punches:[];
      return list.map(function(p){let time=p.time||'';if(time&&String(time).includes('T')){const parsed=new Date(time);if(!isNaN(parsed.getTime()))time=parsed.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}return (p.label||p.type||'Punch')+(time?' '+time:'')});
    };
    const dayState=function(d){
      const hasIn=!!clean(d.clockIn),hasOut=!!clean(d.clockOut),hasPunches=(Array.isArray(d.punches)?d.punches.length:0)>0;
      if(hasIn&&hasOut)return {label:'Complete',color:'#24734f'};
      if(!hasIn&&!hasOut&&!hasPunches)return {label:'No punches',color:'#936500'};
      return {label:'Needs review',color:'#a83d38'};
    };
    const issueDays=days.filter(function(d){return dayState(d).label!=='Complete'});
    const rowHtml=days.map(function(d,i){
      const st=dayState(d),lunchStart=clean(d.lunchOut),lunchEnd=clean(d.lunchIn);
      const lunch=lunchStart||lunchEnd?(lunchStart||'Not recorded')+' – '+(lunchEnd||'Not recorded'):'—';
      const detail=punchText(d);
      const row='<tr>'+
        '<td style="padding:13px 12px;border-bottom:1px solid #e7ecf4;color:#09266f;font-weight:700">'+esc(d.dayName||['Monday','Tuesday','Wednesday','Thursday','Friday'][i])+'<div style="font-size:11px;font-weight:400;color:#71809a;margin-top:3px">'+esc(dateLabel(d.date))+'</div></td>'+
        '<td style="padding:13px 9px;border-bottom:1px solid #e7ecf4;color:#24385d;white-space:nowrap">'+esc(clean(d.clockIn)||'—')+'</td>'+
        '<td style="padding:13px 9px;border-bottom:1px solid #e7ecf4;color:#53627f">'+esc(lunch)+'</td>'+
        '<td style="padding:13px 9px;border-bottom:1px solid #e7ecf4;color:#24385d;white-space:nowrap">'+esc(clean(d.clockOut)||'—')+'</td>'+
        '<td style="padding:13px 12px;border-bottom:1px solid #e7ecf4;text-align:right;color:#09266f;font-weight:800;white-space:nowrap">'+duration(d.paidMinutes)+'</td></tr>';
      const punchRow=report.includePunches&&detail.length?'<tr><td colspan="5" style="padding:0 12px 12px;border-bottom:1px solid #e7ecf4;color:#687894;font-size:11px;line-height:1.7"><strong style="color:#53627f">Punch activity:</strong> '+detail.map(esc).join(' &nbsp;·&nbsp; ')+'</td></tr>':'';
      return row+punchRow;
    }).join('');
    const mobileHtml=days.map(function(d,i){
      const st=dayState(d),lunchStart=clean(d.lunchOut),lunchEnd=clean(d.lunchIn);
      const lunch=lunchStart||lunchEnd?(lunchStart||'Not recorded')+' – '+(lunchEnd||'Not recorded'):'—';
      const detail=punchText(d);
      return '<tr><td style="padding:0 0 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e3e9f2;border-collapse:separate;border-spacing:0;background:#ffffff">'+
       '<tr><td style="padding:14px 15px;background:#f5f8fd;border-bottom:1px solid #e7ecf4"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="font-size:14px;font-weight:700;color:#09266f">'+esc(d.dayName||['Monday','Tuesday','Wednesday','Thursday','Friday'][i])+' · '+esc(dateLabel(d.date))+'</td><td align="right" style="font-size:10px;font-weight:700;color:'+st.color+'">'+st.label+'</td></tr></table></td></tr>'+
       '<tr><td style="padding:12px 15px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'+
       '<tr><td width="50%" style="padding:5px 4px 9px 0;color:#71809a;font-size:11px">CLOCK IN</td><td width="50%" style="padding:5px 0 9px 4px;color:#24385d;font-size:13px;font-weight:700">'+esc(clean(d.clockIn)||'—')+'</td></tr>'+
       '<tr><td style="padding:5px 4px 9px 0;color:#71809a;font-size:11px">LUNCH</td><td style="padding:5px 0 9px 4px;color:#24385d;font-size:13px">'+esc(lunch)+'</td></tr>'+
       '<tr><td style="padding:5px 4px 9px 0;color:#71809a;font-size:11px">CLOCK OUT</td><td style="padding:5px 0 9px 4px;color:#24385d;font-size:13px;font-weight:700">'+esc(clean(d.clockOut)||'—')+'</td></tr>'+
       '<tr><td style="padding:10px 4px 2px 0;border-top:1px solid #e7ecf4;color:#09266f;font-size:12px;font-weight:700">TOTAL PAID</td><td align="right" style="padding:10px 0 2px 4px;border-top:1px solid #e7ecf4;color:#09266f;font-size:16px;font-weight:800">'+duration(d.paidMinutes)+'</td></tr>'+
       '</table></td></tr>'+
       (report.includePunches&&detail.length?'<tr><td style="padding:0 15px 14px;color:#687894;font-size:11px;line-height:1.7"><strong style="color:#53627f">Punch activity</strong><br>'+detail.map(esc).join('<br>')+'</td></tr>':'')+
       '</table></td></tr>';
    }).join('');
    const exceptions=issueDays.length?
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff8e9;border:1px solid #f0dfb9"><tr><td style="padding:14px 16px"><div style="font-size:12px;font-weight:800;color:#805b13;margin-bottom:6px">ITEMS TO REVIEW</div>'+issueDays.map(function(d){return '<div style="font-size:12px;line-height:1.7;color:#624c25">'+esc(d.dayName||'Workday')+' · '+esc(dateLabel(d.date))+': '+dayState(d).label+'</div>'}).join('')+'</td></tr></table>':
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef7f1;border:1px solid #d7e9dc"><tr><td style="padding:12px 15px;color:#24583b;font-size:12px;line-height:1.5"><strong>Record check:</strong> All five scheduled weekdays include clock-in and clock-out records.</td></tr></table>';
    const logo='<img src="https://raw.githubusercontent.com/FossUSA/Time/main/assets/foss-logo-white.png" width="118" height="22" alt="FOSS North America" class="myt-logo" style="display:block;width:118px;max-width:100%;height:auto;max-height:26px;border:0;outline:none;text-decoration:none">';
    const html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style type="text/css">'+
      'body{margin:0!important;padding:0!important;background:#f1f4f9!important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table{border-spacing:0;mso-table-lspace:0pt;mso-table-rspace:0pt}img{border:0;outline:none;text-decoration:none}'+
      '.myt-mobile{display:none;max-height:0;overflow:hidden;mso-hide:all}'+
      '@media only screen and (max-width:620px){.myt-wrap{padding:10px 0!important}.myt-container{width:100%!important;max-width:100%!important}.myt-pad{padding-left:16px!important;padding-right:16px!important}.myt-title{font-size:24px!important;line-height:1.25!important}.myt-desktop{display:none!important;max-height:0!important;overflow:hidden!important}.myt-mobile{display:table!important;width:100%!important;max-height:none!important;overflow:visible!important}.myt-kpi-cell{display:block!important;width:100%!important;padding:0 0 9px!important}.myt-logo{width:145px!important;height:auto!important}}'+
      '</style></head><body style="margin:0;padding:0;background:#f1f4f9;font-family:Arial,Helvetica,sans-serif;color:#1b2c4b">'+
      '<div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden">Your FOSS myTIME weekly timecard summary for '+esc(reportRange)+'.</div>'+
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f1f4f9" class="myt-wrap" style="width:100%;background:#f1f4f9;padding:26px 12px"><tr><td align="center">'+
      '<table role="presentation" width="760" cellpadding="0" cellspacing="0" border="0" class="myt-container" style="width:100%;max-width:760px;background:#ffffff;border:1px solid #dfe5ef;border-collapse:separate;border-spacing:0">'+
      '<tr><td bgcolor="#09266f" class="myt-pad" style="background:#09266f;padding:27px 32px 25px">'+logo+
      '<div style="font-size:9px;letter-spacing:2px;color:#dce7ff;margin-top:9px">ANALYTICS BEYOND MEASURE</div>'+
      '<div style="height:1px;line-height:1px;background:#45609a;margin:20px 0 17px">&nbsp;</div>'+
      '<div style="font-size:10px;letter-spacing:1.8px;color:#c9d7f4;font-weight:700">FOSS NORTH AMERICA · MYTIME</div>'+
      '<div class="myt-title" style="font-size:29px;line-height:1.2;font-weight:700;color:#ffffff;margin-top:7px">Weekly timecard</div>'+
      '<div style="font-size:14px;color:#dce7ff;margin-top:7px">'+esc(reportRange)+'</div>'+
      (report.employeeName?'<div style="font-size:12px;color:#ffffff;margin-top:13px">Prepared for <strong>'+esc(report.employeeName)+'</strong></div>':'')+
      '</td></tr>'+
      '<tr><td class="myt-pad" style="padding:24px 32px 8px">'+
      '<div style="font-size:11px;letter-spacing:1.3px;font-weight:800;color:#71809a;margin-bottom:11px">WEEK AT A GLANCE</div>'+
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'+
      '<td class="myt-kpi-cell" width="33.3%" valign="top" style="padding:0 7px 0 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f7fc;border:1px solid #e5eaf2"><tr><td style="padding:15px 14px"><div style="font-size:10px;letter-spacing:1px;color:#71809a;font-weight:700">TOTAL PAID</div><div style="font-size:25px;line-height:1.2;color:#09266f;font-weight:800;margin-top:6px">'+duration(total)+'</div><div style="font-size:10px;color:#71809a;margin-top:4px">'+(total/60).toFixed(2)+' decimal hours</div></td></tr></table></td>'+
      '<td class="myt-kpi-cell" width="33.3%" valign="top" style="padding:0 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f7fc;border:1px solid #e5eaf2"><tr><td style="padding:15px 14px"><div style="font-size:10px;letter-spacing:1px;color:#71809a;font-weight:700">WEEKLY TARGET</div><div style="font-size:25px;line-height:1.2;color:#09266f;font-weight:800;margin-top:6px">'+duration(target)+'</div><div style="font-size:10px;color:#71809a;margin-top:4px">Scheduled paid hours</div></td></tr></table></td>'+
      '<td class="myt-kpi-cell" width="33.3%" valign="top" style="padding:0 0 0 7px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f7fc;border:1px solid #e5eaf2"><tr><td style="padding:15px 14px"><div style="font-size:10px;letter-spacing:1px;color:#71809a;font-weight:700">DIFFERENCE</div><div style="font-size:22px;line-height:1.2;color:'+varianceColor+';font-weight:800;margin-top:8px">'+(delta>0?'+':'')+varianceText+'</div><div style="font-size:10px;color:#71809a;margin-top:5px">Compared with 40-hour target</div></td></tr></table></td>'+
      '</tr></table>'+
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px"><tr><td style="font-size:10px;color:#71809a;padding-bottom:6px">Weekly progress · '+progress+'%</td></tr><tr><td bgcolor="#e6edf6" style="background:#e6edf6;height:7px;font-size:1px;line-height:1px"><table role="presentation" width="'+progress+'%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#2458c6" style="height:7px;font-size:1px;line-height:1px">&nbsp;</td></tr></table></td></tr></table>'+
      '</td></tr>'+
      '<tr><td class="myt-pad" style="padding:22px 32px 10px"><div style="font-size:17px;font-weight:800;color:#09266f;margin-bottom:4px">Monday–Friday detail</div><div style="font-size:12px;color:#71809a;margin-bottom:12px">Daily punches and paid time for all five scheduled weekdays.</div>'+
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="myt-desktop" style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr bgcolor="#09266f" style="background:#09266f;text-align:left"><th style="padding:11px 12px;color:#ffffff">WORKDAY</th><th style="padding:11px 9px;color:#ffffff">CLOCK IN</th><th style="padding:11px 9px;color:#ffffff">LUNCH</th><th style="padding:11px 9px;color:#ffffff">CLOCK OUT</th><th style="padding:11px 12px;color:#ffffff;text-align:right">TOTAL PAID</th></tr></thead><tbody>'+rowHtml+
      '<tr bgcolor="#eef3fc"><td colspan="4" style="padding:14px 12px;color:#09266f;font-weight:800">WEEK TOTAL</td><td style="padding:14px 12px;text-align:right;color:#09266f;font-weight:900;font-size:14px">'+duration(total)+'</td></tr></tbody></table>'+
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="myt-mobile" style="display:none;max-height:0;overflow:hidden;mso-hide:all">'+mobileHtml+'</table>'+
      '</td></tr>'+
      '<tr><td class="myt-pad" style="padding:16px 32px 24px">'+exceptions+'</td></tr>'+
      '<tr><td bgcolor="#09266f" class="myt-pad" style="background:#09266f;padding:18px 32px;color:#dce7ff;font-size:11px;line-height:1.7">FOSS North America · myTIME<br>Generated '+esc(generatedLabel)+'<br><span style="color:#b9c9e7">Prepared automatically from recorded myTIME punches. Please review entries before payroll processing. This report is a timekeeping summary, not payroll approval.</span></td></tr>'+
      '</table></td></tr></table></body></html>';
    const textLines=['FOSS North America | myTIME','WEEKLY TIMECARD',reportRange,report.employeeName?'Prepared for '+report.employeeName:'','', 'TOTAL PAID: '+duration(total)+' ('+(total/60).toFixed(2)+' decimal hours)','WEEKLY TARGET: '+duration(target),'DIFFERENCE: '+varianceText,'','MONDAY–FRIDAY'];
    days.forEach(function(d,i){textLines.push('',(d.dayName||['Monday','Tuesday','Wednesday','Thursday','Friday'][i])+' '+dateLabel(d.date), 'Clock in: '+(clean(d.clockIn)||'Not recorded'), 'Lunch: '+(clean(d.lunchOut)||'—')+' – '+(clean(d.lunchIn)||'—'), 'Clock out: '+(clean(d.clockOut)||'Not recorded'), 'Total paid: '+duration(d.paidMinutes));if(report.includePunches){const details=punchText(d);if(details.length)textLines.push('Punch activity: '+details.join('; '))}});
    if(issueDays.length){textLines.push('','ITEMS TO REVIEW');issueDays.forEach(function(d){textLines.push((d.dayName||'Workday')+': '+dayState(d).label)})}else{textLines.push('','Record check: all five scheduled weekdays include clock-in and clock-out records.')}
    textLines.push('','Generated '+generatedLabel,'Please review entries before payroll processing. This report is a timekeeping summary, not payroll approval.');
    return {html:html,text:textLines.filter(function(line){return line!==undefined}).join('\n')};
  };
})();
