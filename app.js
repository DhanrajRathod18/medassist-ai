/**
 * AI Health Assistant — Main Application Logic
 * 3-screen app: Upload → Dashboard → Tracker
 */

let currentParsedData = null;
let currentSchedule = null;
let trackerData = {}; // { 'YYYY-MM-DD': { morning: [{...status}], afternoon: [...], night: [...] } }
let currentTrackerDate = new Date();

// ——— Initialization ———
document.addEventListener('DOMContentLoaded', () => {
  initSamplePrescriptions();
  initEventListeners();
  initChatSuggestions();
  updateClock();
  setInterval(updateClock, 60000);
  loadTrackerData();
  loadUserProfile();
  renderTrackerDate();
});

function updateClock() {
  const el = document.getElementById('topbarTime');
  if (el) el.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ——— Screen Navigation ———
function navigateTo(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item[data-screen]').forEach(n => n.classList.remove('active'));

  const screen = document.getElementById('screen-' + screenId);
  const nav = document.querySelector(`.nav-item[data-screen="${screenId}"]`);
  if (screen) screen.classList.add('active');
  if (nav) nav.classList.add('active');

  const titles = { upload: 'Upload Prescription', dashboard: 'Result Dashboard', tracker: 'Medication Tracker', reminders: 'Reminders & Notifications' };
  document.getElementById('topbarTitle').textContent = titles[screenId] || '';

  if (screenId === 'tracker') renderTracker();
  if (screenId === 'reminders') renderReminders();
}

// ——— Event Listeners ———
function initEventListeners() {
  // Nav buttons
  document.querySelectorAll('.nav-item[data-screen]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.screen));
  });

  // Analyze & Clear
  document.getElementById('analyzeBtn').addEventListener('click', analyzePrescription);
  document.getElementById('clearBtn').addEventListener('click', clearAll);

  // Chat
  document.getElementById('chatSendBtn').addEventListener('click', sendChatMessage);
  document.getElementById('chatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
  });

  // Tabs
  document.querySelectorAll('[data-tab]').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Textarea auto-resize
  const textarea = document.getElementById('prescriptionInput');
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 300) + 'px';
  });

  // Image upload
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('imageUpload');
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); handleImageFile(e.dataTransfer.files[0]); });
  fileInput.addEventListener('change', (e) => { if (e.target.files[0]) handleImageFile(e.target.files[0]); });

  // Tracker date nav
  document.getElementById('prevDayBtn').addEventListener('click', () => { currentTrackerDate.setDate(currentTrackerDate.getDate() - 1); renderTrackerDate(); renderTracker(); });
  document.getElementById('nextDayBtn').addEventListener('click', () => { currentTrackerDate.setDate(currentTrackerDate.getDate() + 1); renderTrackerDate(); renderTracker(); });

  // Reminders
  document.getElementById('saveProfileBtn').addEventListener('click', saveUserProfile);
  document.getElementById('sendAllRemindersBtn').addEventListener('click', sendAllReminders);

  // Mobile menu
  document.getElementById('mobileMenuBtn')?.addEventListener('click', toggleSidebar);
}

// ——— Image Upload ———
function handleImageFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('dropzone').style.display = 'none';
    const preview = document.getElementById('imagePreview');
    preview.style.display = 'block';
    document.getElementById('previewImg').src = e.target.result;
    showToast('Image loaded. For best results, also paste the prescription text.', 'info');
  };
  reader.readAsDataURL(file);
}

function removeImage() {
  document.getElementById('dropzone').style.display = 'flex';
  document.getElementById('imagePreview').style.display = 'none';
  document.getElementById('imageUpload').value = '';
}

// ——— Sample Prescriptions ———
function initSamplePrescriptions() {
  const container = document.getElementById('samplePrescriptions');
  SAMPLE_PRESCRIPTIONS.forEach((sample) => {
    const chip = document.createElement('button');
    chip.className = 'sample-chip';
    chip.textContent = sample.title;
    chip.addEventListener('click', () => {
      document.getElementById('prescriptionInput').value = sample.text;
      document.getElementById('prescriptionInput').dispatchEvent(new Event('input'));
      chip.classList.add('chip-active');
      setTimeout(() => chip.classList.remove('chip-active'), 600);
    });
    container.appendChild(chip);
  });
}

// ——— Analyze Prescription ———
function analyzePrescription() {
  const input = document.getElementById('prescriptionInput').value.trim();
  if (!input) { showToast('Please enter a prescription to analyze.', 'warning'); return; }

  const btn = document.getElementById('analyzeBtn');
  btn.classList.add('loading');
  btn.disabled = true;

  setTimeout(() => {
    currentParsedData = parsePrescription(input);
    currentSchedule = generateSchedule(currentParsedData.medicines);
    const instructions = generateInstructions(currentParsedData);

    renderResults(currentParsedData, currentSchedule, instructions);
    updateStats(currentParsedData, currentSchedule);
    initTrackerFromSchedule();

    btn.classList.remove('loading');
    btn.disabled = false;

    showToast('Prescription analyzed! Redirecting to dashboard...', 'success');
    setTimeout(() => navigateTo('dashboard'), 600);
  }, 800);
}

// ——— Render Results ———
function renderResults(data, schedule, instructions) {
  switchTab('extracted');
  renderExtractedData(data);
  renderSchedule(schedule);
  renderInstructions(instructions);
}

function renderExtractedData(data) {
  const container = document.getElementById('extractedContent');
  const jsonStr = JSON.stringify(data, null, 2);
  container.innerHTML = `
    <div class="json-display">
      <div class="json-header">
        <span class="json-badge">JSON</span>
        <button class="copy-btn" onclick="copyJSON()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copy
        </button>
      </div>
      <pre><code>${syntaxHighlight(jsonStr)}</code></pre>
    </div>
    <div class="medicine-cards">
      ${data.medicines.map((med, i) => `
        <div class="medicine-card animate-in" style="animation-delay:${i * 0.1}s">
          <div class="med-card-header">
            <div class="med-icon">${getMedIcon(med.name)}</div>
            <div><h4 class="med-name">${med.name}</h4><span class="med-dosage-badge">${med.dosage}</span></div>
          </div>
          <div class="med-card-body">
            <div class="med-detail"><span class="detail-label">Frequency</span><span class="detail-value">${med.frequency}</span></div>
            <div class="med-detail"><span class="detail-label">Duration</span><span class="detail-value">${med.duration}</span></div>
            <div class="med-detail"><span class="detail-label">Instructions</span><span class="detail-value">${med.instructions}</span></div>
          </div>
        </div>`).join('')}
    </div>`;
}

function renderSchedule(schedule) {
  const container = document.getElementById('scheduleContent');
  const slot = (icon, label, meds, cls) => {
    if (!meds.length) return '';
    return `<div class="schedule-slot ${cls} animate-in">
      <div class="slot-header"><span class="slot-icon">${icon}</span><h4 class="slot-label">${label}</h4><span class="slot-count">${meds.length}</span></div>
      <div class="slot-medicines">${meds.map(m => `
        <div class="slot-med">
          <div class="slot-med-info"><span class="slot-med-name">${m.name}</span><span class="slot-med-dosage">${m.dosage}</span></div>
          <div class="slot-med-count">${typeof m.count==='number'?(m.count===0.5?'½ tab':m.count+' tab'):m.count}</div>
          <div class="slot-med-instr">${m.instructions}</div>
        </div>`).join('')}
      </div></div>`;
  };
  container.innerHTML = `<div class="schedule-grid">
    ${slot('🌅','Morning',schedule.morning,'slot-morning')}
    ${slot('☀️','Afternoon',schedule.afternoon,'slot-afternoon')}
    ${slot('🌙','Night',schedule.night,'slot-night')}
  </div>`;
}

function renderInstructions(text) {
  const container = document.getElementById('instructionsContent');
  const html = text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>').replace(/• /g,'<span class="bullet">•</span> ').replace(/---/g,'<hr>');
  container.innerHTML = `
    <div class="instructions-card animate-in"><div class="instructions-text">${html}</div></div>
    <div class="disclaimer-box animate-in" style="animation-delay:0.2s">
      <div class="disclaimer-icon">⚠️</div>
      <div class="disclaimer-text"><strong>Safety Disclaimer</strong><br>This is an AI assistant and not a replacement for a doctor.</div>
    </div>`;
}

// ——— Tabs ———
function switchTab(tabId) {
  document.querySelectorAll('[data-tab]').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector(`[data-tab="${tabId}"]`)?.classList.add('active');
  document.getElementById(`tab-${tabId}`)?.classList.add('active');
}

// ——— Stats ———
function updateStats(data, schedule) {
  animateCounter('statMedicines', data.medicines.length);
  animateCounter('statMorning', schedule.morning.length);
  animateCounter('statNight', schedule.night.length);
  document.getElementById('statCondition').textContent = data.disease !== 'Not specified' ? data.disease : '—';
}

function animateCounter(id, target) {
  const el = document.getElementById(id);
  let current = 0;
  const step = Math.max(1, Math.ceil(target / 15));
  const interval = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current;
    if (current >= target) clearInterval(interval);
  }, 40);
}

// ——— TRACKER ———
function getDateKey(date) {
  return date.toISOString().split('T')[0];
}

function renderTrackerDate() {
  const el = document.getElementById('trackerDate');
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(currentTrackerDate); d.setHours(0,0,0,0);
  const isToday = d.getTime() === today.getTime();
  el.textContent = (isToday ? 'Today — ' : '') + currentTrackerDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function initTrackerFromSchedule() {
  if (!currentSchedule) return;
  const key = getDateKey(new Date());
  if (trackerData[key]) return; // Don't overwrite existing data

  const buildSlot = (meds) => meds.map(m => ({ name: m.name, dosage: m.dosage, count: m.count, instructions: m.instructions, status: 'pending' }));
  trackerData[key] = {
    morning: buildSlot(currentSchedule.morning),
    afternoon: buildSlot(currentSchedule.afternoon),
    night: buildSlot(currentSchedule.night),
  };
  saveTrackerData();
}

function ensureTrackerDay(key) {
  if (trackerData[key] || !currentSchedule) return;
  const buildSlot = (meds) => meds.map(m => ({ name: m.name, dosage: m.dosage, count: m.count, instructions: m.instructions, status: 'pending' }));
  trackerData[key] = {
    morning: buildSlot(currentSchedule.morning),
    afternoon: buildSlot(currentSchedule.afternoon),
    night: buildSlot(currentSchedule.night),
  };
  saveTrackerData();
}

function renderTracker() {
  const container = document.getElementById('trackerSlots');
  const key = getDateKey(currentTrackerDate);

  if (!currentSchedule || !currentSchedule.morning.length && !currentSchedule.afternoon.length && !currentSchedule.night.length) {
    container.innerHTML = '<div class="empty-state"><p>No prescription data yet.</p><p style="margin-top:8px">Go to <strong>Upload Prescription</strong> and analyze first.</p></div>';
    updateAdherence(key);
    return;
  }

  ensureTrackerDay(key);
  const day = trackerData[key];
  if (!day) { container.innerHTML = '<div class="empty-state">No data for this day.</div>'; return; }

  const renderSlot = (icon, label, meds, slotKey, colorClass) => {
    if (!meds || !meds.length) return '';
    return `<div class="tracker-slot ${colorClass} animate-in">
      <div class="slot-header"><span class="slot-icon">${icon}</span><h4 class="slot-label">${label}</h4></div>
      <div class="tracker-items">${meds.map((m, i) => `
        <div class="tracker-item ${m.status}" id="titem-${slotKey}-${i}">
          <div class="tracker-med-info">
            <span class="tracker-med-name">${m.name}</span>
            <span class="tracker-med-dose">${m.dosage} · ${typeof m.count==='number'?(m.count===0.5?'½ tab':m.count+' tab'):m.count}</span>
          </div>
          <div class="tracker-actions">
            <button class="tracker-btn taken-btn ${m.status==='taken'?'active':''}" onclick="markDose('${key}','${slotKey}',${i},'taken')" title="Taken">✔</button>
            <button class="tracker-btn missed-btn ${m.status==='missed'?'active':''}" onclick="markDose('${key}','${slotKey}',${i},'missed')" title="Missed">✕</button>
          </div>
        </div>`).join('')}
      </div></div>`;
  };

  container.innerHTML =
    renderSlot('🌅','Morning', day.morning, 'morning', 'slot-morning') +
    renderSlot('☀️','Afternoon', day.afternoon, 'afternoon', 'slot-afternoon') +
    renderSlot('🌙','Night', day.night, 'night', 'slot-night');

  updateAdherence(key);
}

function markDose(dateKey, slotKey, index, status) {
  if (!trackerData[dateKey] || !trackerData[dateKey][slotKey]) return;
  const item = trackerData[dateKey][slotKey][index];
  const prevStatus = item.status;
  item.status = item.status === status ? 'pending' : status;
  saveTrackerData();
  renderTracker();
  // Send missed dose alert
  if (item.status === 'missed' && prevStatus !== 'missed') {
    const profile = getUserProfile();
    if (profile.name) {
      addNotificationLog('alert', `Missed dose alert for ${item.name} (${item.dosage}) sent to ${profile.name}.`, '⚠️');
      showToast(`Missed dose alert sent for ${item.name}`, 'warning');
    }
  }
}

function updateAdherence(dateKey) {
  const day = trackerData[dateKey];
  let total = 0, taken = 0, missed = 0, pending = 0;
  if (day) {
    ['morning','afternoon','night'].forEach(slot => {
      if (day[slot]) day[slot].forEach(m => {
        total++;
        if (m.status === 'taken') taken++;
        else if (m.status === 'missed') missed++;
        else pending++;
      });
    });
  }
  const pct = total ? Math.round((taken / total) * 100) : 0;
  document.getElementById('adherencePercent').textContent = pct + '%';
  document.getElementById('adherenceBar').style.width = pct + '%';
  document.getElementById('takenCount').textContent = taken;
  document.getElementById('missedCount').textContent = missed;
  document.getElementById('pendingCount').textContent = pending;
}

function saveTrackerData() { try { localStorage.setItem('medassist_tracker', JSON.stringify(trackerData)); } catch(e) {} }
function loadTrackerData() { try { const d = localStorage.getItem('medassist_tracker'); if (d) trackerData = JSON.parse(d); } catch(e) {} }

// ——— Chat ———
function initChatSuggestions() {
  const suggestions = ['When should I take my medicines?','Can I take this after food?','How long is the course?','What if I miss a dose?'];
  const container = document.getElementById('chatSuggestions');
  suggestions.forEach(text => {
    const btn = document.createElement('button');
    btn.className = 'suggestion-chip';
    btn.textContent = text;
    btn.addEventListener('click', () => { document.getElementById('chatInput').value = text; sendChatMessage(); });
    container.appendChild(btn);
  });
}

function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  addChatMessage(text, 'user');
  input.value = '';
  const typingId = showTypingIndicator();
  setTimeout(() => {
    removeTypingIndicator(typingId);
    addChatMessage(answerQuestion(text, currentParsedData), 'bot');
  }, 600 + Math.random() * 400);
}

function addChatMessage(text, sender) {
  const container = document.getElementById('chatMessages');
  const msg = document.createElement('div');
  msg.className = `chat-message ${sender}-message animate-in`;
  const html = text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>').replace(/• /g,'<span class="bullet">•</span> ');
  msg.innerHTML = `<div class="msg-avatar">${sender==='user'?'👤':'🤖'}</div>
    <div class="msg-content"><div class="msg-bubble">${html}</div>
    <span class="msg-time">${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span></div>`;
  const sug = document.getElementById('chatSuggestions');
  if (sug) sug.style.display = 'none';
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
}

function showTypingIndicator() {
  const container = document.getElementById('chatMessages');
  const id = 'typing-' + Date.now();
  const div = document.createElement('div');
  div.id = id; div.className = 'chat-message bot-message typing-indicator';
  div.innerHTML = `<div class="msg-avatar">🤖</div><div class="msg-content"><div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div></div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return id;
}
function removeTypingIndicator(id) { document.getElementById(id)?.remove(); }

// ——— Utilities ———
function clearAll() {
  document.getElementById('prescriptionInput').value = '';
  currentParsedData = null; currentSchedule = null;
  ['statMedicines','statMorning','statNight'].forEach(id => document.getElementById(id).textContent = '0');
  document.getElementById('statCondition').textContent = '—';
  document.getElementById('chatMessages').innerHTML = '';
  const sug = document.getElementById('chatSuggestions');
  if (sug) sug.style.display = 'flex';
  removeImage();
  showToast('Cleared all data.', 'info');
}

function copyJSON() {
  if (!currentParsedData) return;
  navigator.clipboard.writeText(JSON.stringify(currentParsedData, null, 2)).then(() => showToast('JSON copied!', 'success'));
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

function toggleChat() {
  navigateTo('dashboard');
  setTimeout(() => document.getElementById('chatInput')?.focus(), 300);
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: '✅', warning: '⚠️', info: 'ℹ️', error: '❌' };
  toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

function syntaxHighlight(json) {
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
    let cls = 'json-number';
    if (/^"/.test(match)) cls = /:$/.test(match) ? 'json-key' : 'json-string';
    else if (/true|false/.test(match)) cls = 'json-boolean';
    else if (/null/.test(match)) cls = 'json-null';
    return `<span class="${cls}">${match}</span>`;
  });
}

function getMedIcon(name) {
  const l = name.toLowerCase();
  if (l.includes('tab')) return '💊';
  if (l.includes('cap')) return '💊';
  if (l.includes('syp') || l.includes('syrup')) return '🧴';
  if (l.includes('inj')) return '💉';
  if (l.includes('drop')) return '💧';
  return '💊';
}

// ——— NOTIFICATION / REMINDER SYSTEM ———
let userProfile = { name: '', email: '', phone: '' };
let notificationLog = [];

function getUserProfile() { return userProfile; }

function saveUserProfile() {
  const name = document.getElementById('userName').value.trim();
  const email = document.getElementById('userEmail').value.trim();
  const phone = document.getElementById('userPhone').value.trim();
  if (!name) { showToast('Please enter your name.', 'warning'); return; }
  if (!email && !phone) { showToast('Please enter email or phone number.', 'warning'); return; }
  userProfile = { name, email, phone };
  try { localStorage.setItem('medassist_profile', JSON.stringify(userProfile)); } catch(e) {}
  showToast('Profile saved! Reminders enabled.', 'success');
  renderReminders();
}

function loadUserProfile() {
  try {
    const d = localStorage.getItem('medassist_profile');
    if (d) {
      userProfile = JSON.parse(d);
      document.getElementById('userName').value = userProfile.name || '';
      document.getElementById('userEmail').value = userProfile.email || '';
      document.getElementById('userPhone').value = userProfile.phone || '';
    }
  } catch(e) {}
  try {
    const l = localStorage.getItem('medassist_notif_log');
    if (l) notificationLog = JSON.parse(l);
  } catch(e) {}
}

function renderReminders() {
  const container = document.getElementById('remindersList');
  if (!currentSchedule || (!currentSchedule.morning.length && !currentSchedule.afternoon.length && !currentSchedule.night.length)) {
    container.innerHTML = '<div class="empty-state">Analyze a prescription first to see scheduled reminders.</div>';
    renderNotificationLog();
    return;
  }

  const timeMap = { morning: '8:00 AM', afternoon: '2:00 PM', night: '8:00 PM' };
  const iconMap = { morning: '🌅', afternoon: '☀️', night: '🌙' };
  let html = '';

  ['morning', 'afternoon', 'night'].forEach(slot => {
    const meds = currentSchedule[slot];
    if (!meds.length) return;
    meds.forEach((m, i) => {
      const id = `reminder-${slot}-${i}`;
      html += `<div class="reminder-item animate-in" id="${id}">
        <div class="reminder-time"><span class="reminder-icon">${iconMap[slot]}</span><span>${timeMap[slot]}</span></div>
        <div class="reminder-med-info"><span class="reminder-med-name">${m.name}</span><span class="reminder-med-dose">${m.dosage}</span></div>
        <div class="reminder-actions">
          <button class="uiverse-btn btn-ghost btn-sm" onclick="sendSingleReminder('${slot}',${i},'sms','${id}')">📱 SMS</button>
          <button class="uiverse-btn btn-ghost btn-sm" onclick="sendSingleReminder('${slot}',${i},'email','${id}')">📧 Email</button>
        </div>
        <div class="reminder-status" id="${id}-status"></div>
      </div>`;
    });
  });

  container.innerHTML = html || '<div class="empty-state">No medicines scheduled.</div>';
  renderNotificationLog();
}

function sendSingleReminder(slot, index, type, elementId) {
  if (!userProfile.name) { showToast('Save your profile first!', 'warning'); return; }
  const meds = currentSchedule[slot];
  if (!meds || !meds[index]) return;
  const med = meds[index];
  const timeMap = { morning: '8:00 AM', afternoon: '2:00 PM', night: '8:00 PM' };

  const statusEl = document.getElementById(elementId + '-status');
  statusEl.innerHTML = `<span class="status-sending">⏳ Sending ${type.toUpperCase()}...</span>`;

  setTimeout(() => {
    if (type === 'sms') {
      const msg = `Reminder: Take your medicine ${med.name} - ${med.dosage} now.`;
      addNotificationLog('sms', `SMS to ${userProfile.phone || 'N/A'}: "${msg}"`, '📱');
      statusEl.innerHTML = '<span class="status-sent">✅ SMS Sent</span>';
    } else {
      const subject = 'Medicine Reminder';
      const body = `Hello ${userProfile.name},\n\nThis is a reminder to take your medicine:\n- Medicine: ${med.name}\n- Dosage: ${med.dosage}\n- Time: ${timeMap[slot]}\n\nPlease follow your prescription properly.\n\n⚠️ This is an AI assistant and not a replacement for a doctor.`;
      addNotificationLog('email', `Email to ${userProfile.email || 'N/A'}: Subject: "${subject}"`, '📧');
      statusEl.innerHTML = '<span class="status-sent">✅ Email Sent</span>';
    }
    showToast(`${type.toUpperCase()} reminder sent (simulated)!`, 'success');
  }, 800 + Math.random() * 500);
}

function sendAllReminders() {
  if (!userProfile.name) { showToast('Save your profile first!', 'warning'); return; }
  if (!currentSchedule) { showToast('No prescription analyzed yet.', 'warning'); return; }

  const timeMap = { morning: '8:00 AM', afternoon: '2:00 PM', night: '8:00 PM' };
  let count = 0;

  ['morning', 'afternoon', 'night'].forEach(slot => {
    const meds = currentSchedule[slot];
    if (!meds) return;
    meds.forEach((med, i) => {
      count++;
      const delay = count * 400;
      setTimeout(() => {
        const smsMsg = `Reminder: Take your medicine ${med.name} - ${med.dosage} now.`;
        addNotificationLog('sms', `SMS to ${userProfile.phone || 'N/A'}: "${smsMsg}"`, '📱');

        const emailBody = `Email to ${userProfile.email || 'N/A'}: Medicine Reminder - ${med.name} (${med.dosage}) at ${timeMap[slot]}`;
        addNotificationLog('email', emailBody, '📧');

        const statusEl = document.getElementById(`reminder-${slot}-${i}-status`);
        if (statusEl) statusEl.innerHTML = '<span class="status-sent">✅ SMS & Email Sent</span>';
      }, delay);
    });
  });

  setTimeout(() => {
    showToast(`All ${count} reminders sent (simulated)!`, 'success');
    renderNotificationLog();
  }, count * 400 + 200);
}

function addNotificationLog(type, message, icon) {
  const entry = {
    type, message, icon,
    timestamp: new Date().toLocaleString(),
  };
  notificationLog.unshift(entry);
  if (notificationLog.length > 50) notificationLog.pop();
  try { localStorage.setItem('medassist_notif_log', JSON.stringify(notificationLog)); } catch(e) {}
  renderNotificationLog();
}

function renderNotificationLog() {
  const container = document.getElementById('notificationLog');
  if (!container) return;
  if (!notificationLog.length) {
    container.innerHTML = '<div class="empty-state">No notifications sent yet.</div>';
    return;
  }
  container.innerHTML = notificationLog.map((entry, i) => `
    <div class="log-entry animate-in" style="animation-delay:${Math.min(i * 0.05, 0.5)}s">
      <span class="log-icon">${entry.icon}</span>
      <div class="log-content">
        <span class="log-message">${entry.message}</span>
        <span class="log-time">${entry.timestamp}</span>
      </div>
      <span class="log-type-badge log-${entry.type}">${entry.type.toUpperCase()}</span>
    </div>
  `).join('');
}

function clearNotificationLog() {
  notificationLog = [];
  try { localStorage.removeItem('medassist_notif_log'); } catch(e) {}
  renderNotificationLog();
  showToast('Notification log cleared.', 'info');
}
