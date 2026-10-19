'use strict';

const isAdminPortal = /^\/admin\/?$/.test(window.location.pathname);
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
let currentUser = null;
let activeScreen = 'overview';
let activeApplicationJob = null;
let activeSupportTicketId = null;
let activeAdminSupportTicketId = null;
let selectedLanguage = (() => {
  try { return localStorage.getItem('earnroute_language') || sessionStorage.getItem('earnroute_language') || 'en'; }
  catch (_) { return sessionStorage.getItem('earnroute_language') || 'en'; }
})();
let currentJobs = [];
let authMode = 'login';

const TRANSLATIONS = {
  en: {
    workspace: 'WORKSPACE', overview: 'Overview', discover: 'Discover work', applications: 'Applications', schedule: 'My schedule', earnings: 'Earnings', profile: 'My profile',
    postJob: 'Post a shift', manageJobs: 'Manage jobs', applicants: 'Applicants', assignments: 'Assignments', verify: 'Business verification', disputes: 'Disputes', audit: 'Audit history',
    signOut: 'Sign out', overviewSub: 'Your work, organized around your life.', findShifts: 'Find shifts', profileSettings: 'Edit profile', recommended: 'Recommended for you', upcoming: 'Upcoming assignments',
    applied: 'Applications', confirmed: 'Confirmed shifts', completed: 'Completed work', pending: 'Pending settlement',
    noJobs: 'No published opportunities yet', noJobsCopy: 'New, verified opportunities will appear here when businesses publish genuine shifts. Try another category or check back later.',
    language: 'हि', myAccount: 'My account', workerRole: 'Worker', businessRole: 'Business', adminRole: 'Admin', support: 'Help & support', adminSupport: 'Support tickets',
    savedShifts: 'Saved shifts', savedShiftsSub: 'Keep promising shifts in one private list and compare them before you apply.', saveShift: 'Save shift', savedShift: 'Saved', removeSaved: 'Remove', noSavedShifts: 'No saved shifts yet', noSavedShiftsCopy: 'Save a published shift while browsing and it will appear here for later.', jobSafety: 'Work safely. Get paid fairly.', safetyIntro: 'A few checks can help you avoid common job scams and stay prepared while travelling to a shift.', safetyRule: 'Never pay a recruiter or employer to get a job, registration, or an interview.', emergency112: 'Emergency help · 112', cyberHelp: 'Cyber fraud helpline · 1930', officialSafety: 'Official safety guidance',
    reportConcern: 'Report a concern', reportMinChars: 'Please describe the concern in at least 20 characters. Do not include passwords, OTPs or identity numbers.', safetyReportSent: 'Your safety concern was sent to EarnRoute support. For immediate danger, call 112.',
    minimumPay: 'Minimum pay ₹', search: 'Search', clear: 'Clear',
    sortShiftsBy: 'Sort shifts by', sortClosest: 'Closest first', sortTakeHome: 'Highest estimated take-home',
    sortHourlyRate: 'Best estimated take-home / hour', sortAfterCommute: 'Best after commute estimate',
    sortSoonest: 'Soonest start', sortOpenSpots: 'Most open spots',
    commuteBudgetLabel: 'Commute budget per straight-line km (₹)', commuteBudgetPlaceholder: '₹/km (optional)',
    useMyLocation: 'Use my location', locationIntro: 'Choose 1, 3, 5, 8, 10 or 15 km to find genuine published shifts. The selected coordinates are sent to EarnRoute to return nearby results, kept in this device session for up to 30 minutes, and not added to your profile.', manualAreaHeading: 'Can’t use GPS? Choose your area manually',
    manualAreaIntro: 'Choose the nearest city to centre the map, then zoom in and tap the area where you want to find work. A nearby public landmark is better than your home entrance.',
    manualAreaCity: 'Your city / nearest city', manualAreaChooseCity: 'Choose a city', manualAreaChooseMap: 'Centre map and choose area',
    manualAreaMapNote: 'Map taps set a temporary search point for 30 minutes. Distances are straight-line, not road distance or travel time.',
    manualAreaNotSelected: 'No area selected yet. Centre the map, then tap your chosen locality.',
    manualAreaUseThis: 'Use this area', manualAreaPrivacy: 'The selected point is sent to EarnRoute to return nearby shifts, stays in this device session for up to 30 minutes, and is not added to your profile.',
    manualAreaUseCityCentre: 'Use city centre (rough)', manualAreaApproximateTag: 'approximate city centre',
    manualAreaApproximate: 'Using approximate city centre', manualAreaApproximateNotice: 'This uses a rough city-centre point; nearby distances may be misleading. Tap the map for a more accurate search area.',
    manualMapHeading: 'Choose your work-search area', manualAreaPickerKicker: 'MANUAL AREA SELECTION',
    manualAreaTapMap: 'Move or zoom the map to your locality, then tap it to set a temporary search centre.',
    manualAreaInvalid: 'Please tap a valid point on the map.', manualAreaCustomPoint: 'Selected map area',
    manualAreaCandidateReady: 'Area selected:', manualAreaActivated: 'Search area saved for 30 minutes. Showing shifts around your chosen point.',
    manualAreaSelected: 'Using selected area', mapRecenter: 'Recenter', mapDeviceLocation: 'Device location', mapTemporaryLocation: 'Using temporary location'
  },
  hi: {
    workspace: 'आपका वर्कस्पेस', overview: 'डैशबोर्ड', discover: 'काम खोजें', applications: 'आवेदन', schedule: 'मेरा शेड्यूल', earnings: 'कमाई', profile: 'मेरी प्रोफ़ाइल',
    postJob: 'शिफ्ट पोस्ट करें', manageJobs: 'जॉब मैनेज करें', applicants: 'आवेदक', assignments: 'असाइनमेंट', verify: 'बिज़नेस वेरिफ़िकेशन', disputes: 'विवाद', audit: 'ऑडिट हिस्ट्री',
    signOut: 'साइन आउट', overviewSub: 'आपका काम, आपकी ज़िंदगी के हिसाब से।', findShifts: 'शिफ्ट खोजें', profileSettings: 'प्रोफ़ाइल एडिट करें', recommended: 'आपके लिए सही काम', upcoming: 'आने वाले असाइनमेंट',
    applied: 'आवेदन', confirmed: 'कन्फ़र्म शिफ्ट', completed: 'पूरा किया काम', pending: 'पेमेंट लंबित',
    noJobs: 'अभी कोई प्रकाशित अवसर नहीं', noJobsCopy: 'बिज़नेस द्वारा वास्तविक शिफ्ट प्रकाशित होने पर अवसर यहाँ दिखेंगे। फ़िल्टर बदलकर देखें या बाद में वापस आएँ।',
    language: 'EN', myAccount: 'मेरा अकाउंट', workerRole: 'वर्कर', businessRole: 'बिज़नेस', adminRole: 'एडमिन', support: 'सहायता', adminSupport: 'सपोर्ट टिकट',
    savedShifts: 'सेव की गई शिफ्ट', savedShiftsSub: 'अच्छी शिफ्ट को एक निजी सूची में रखें और आवेदन से पहले तुलना करें।', saveShift: 'शिफ्ट सेव करें', savedShift: 'सेव है', removeSaved: 'हटाएँ', noSavedShifts: 'अभी कोई सेव की गई शिफ्ट नहीं', noSavedShiftsCopy: 'ब्राउज़ करते समय किसी प्रकाशित शिफ्ट को सेव करें, वह यहाँ दिखेगी।', jobSafety: 'सुरक्षित काम करें। सही भुगतान पाएँ।', safetyIntro: 'कुछ सावधानियाँ आम जॉब स्कैम से बचने और शिफ्ट पर जाते समय तैयारी में मदद कर सकती हैं।', safetyRule: 'नौकरी, रजिस्ट्रेशन या इंटरव्यू पाने के लिए किसी रिक्रूटर या नियोक्ता को पैसे न दें।', emergency112: 'आपातकालीन मदद · 112', cyberHelp: 'साइबर धोखाधड़ी हेल्पलाइन · 1930', officialSafety: 'आधिकारिक सुरक्षा जानकारी',
    reportConcern: 'शिकायत दर्ज करें', reportMinChars: 'कृपया कम-से-कम 20 अक्षरों में समस्या बताएँ। पासवर्ड, OTP या पहचान नंबर न लिखें।', safetyReportSent: 'आपकी सुरक्षा संबंधी शिकायत EarnRoute सपोर्ट को भेज दी गई है। तुरंत खतरा हो तो 112 पर कॉल करें।',
    minimumPay: 'न्यूनतम भुगतान ₹', search: 'खोजें', clear: 'हटाएँ',
    sortShiftsBy: 'शिफ्ट क्रम', sortClosest: 'सबसे पास पहले', sortTakeHome: 'अनुमानित सबसे ज़्यादा कमाई',
    sortHourlyRate: 'प्रति घंटे अनुमानित कमाई', sortAfterCommute: 'यात्रा खर्च के बाद सबसे ज़्यादा',
    sortSoonest: 'सबसे जल्द शुरू', sortOpenSpots: 'सबसे ज़्यादा खाली जगह',
    commuteBudgetLabel: 'सीधी दूरी के प्रति किमी यात्रा बजट (₹)', commuteBudgetPlaceholder: '₹/किमी (वैकल्पिक)',
    useMyLocation: 'मेरी लोकेशन उपयोग करें', locationIntro: 'वास्तविक प्रकाशित शिफ्ट खोजने के लिए 1, 3, 5, 8, 10 या 15 किमी चुनें। आसपास के परिणाम दिखाने के लिए चुने गए निर्देशांक EarnRoute को भेजे जाते हैं; वे इस डिवाइस के सेशन में अधिकतम 30 मिनट रहते हैं और प्रोफ़ाइल में नहीं जोड़े जाते।', manualAreaHeading: 'GPS नहीं चल रहा? अपना क्षेत्र खुद चुनें',
    manualAreaIntro: 'मैप को पास के शहर पर केंद्रित करें, फिर ज़ूम करके उस क्षेत्र पर टैप करें जहाँ काम खोजना है। घर के प्रवेश-द्वार के बजाय पास का सार्वजनिक स्थान चुनना बेहतर है।',
    manualAreaCity: 'आपका शहर / पास का शहर', manualAreaChooseCity: 'शहर चुनें', manualAreaChooseMap: 'मैप केंद्रित करें और क्षेत्र चुनें',
    manualAreaMapNote: 'मैप पर चुना गया खोज-बिंदु 30 मिनट तक रहेगा। दूरी सीधी GPS दूरी है, सड़क की दूरी या यात्रा समय नहीं।',
    manualAreaNotSelected: 'अभी क्षेत्र नहीं चुना गया। मैप केंद्रित करें, फिर अपने इलाके पर टैप करें।',
    manualAreaUseThis: 'यह क्षेत्र चुनें', manualAreaPrivacy: 'आसपास की शिफ्ट दिखाने के लिए चुना गया बिंदु EarnRoute को भेजा जाता है; वह इस डिवाइस के सेशन में अधिकतम 30 मिनट रहता है और प्रोफ़ाइल में नहीं जोड़ा जाता।',
    manualAreaUseCityCentre: 'शहर का केंद्र चुनें (अनुमानित)', manualAreaApproximateTag: 'शहर का अनुमानित केंद्र',
    manualAreaApproximate: 'शहर के अनुमानित केंद्र से खोज रहे हैं', manualAreaApproximateNotice: 'यह शहर के अनुमानित केंद्र का उपयोग करता है; नज़दीकी दूरी गलत हो सकती है। अधिक सही क्षेत्र के लिए मैप पर टैप करें।',
    manualMapHeading: 'काम खोजने का क्षेत्र चुनें', manualAreaPickerKicker: 'अपना क्षेत्र चुनें',
    manualAreaTapMap: 'मैप को अपने इलाके तक ले जाएँ या ज़ूम करें, फिर अस्थायी खोज-केंद्र चुनने के लिए टैप करें।',
    manualAreaInvalid: 'कृपया मैप पर सही स्थान चुनें।', manualAreaCustomPoint: 'मैप पर चुना गया क्षेत्र',
    manualAreaCandidateReady: 'क्षेत्र चुना गया:', manualAreaActivated: 'खोज क्षेत्र 30 मिनट के लिए सेव है। चुने गए स्थान के आसपास की शिफ्ट दिखाई जाएँगी।',
    manualAreaSelected: 'चुने गए क्षेत्र से खोज रहे हैं', mapRecenter: 'फिर केंद्रित करें', mapDeviceLocation: 'डिवाइस की लोकेशन', mapTemporaryLocation: 'अस्थायी लोकेशन उपयोग हो रही है'
  }
};
const t = key => (TRANSLATIONS[selectedLanguage] && TRANSLATIONS[selectedLanguage][key]) || TRANSLATIONS.en[key] || key;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function initials(name) {
  return String(name || 'ER').trim().split(/\s+/).slice(0, 2).map(s => s[0] || '').join('').toUpperCase() || 'ER';
}
function formatMoney(value) {
  return '₹' + Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}
function formatDate(value, withTime = true) {
  if (!value) return 'Not set';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Not set';
  return new Intl.DateTimeFormat(selectedLanguage === 'hi' ? 'hi-IN' : 'en-IN', withTime ? { weekday:'short', day:'numeric', month:'short', hour:'numeric', minute:'2-digit' } : { day:'numeric', month:'short', year:'numeric' }).format(d);
}
function dateInputValue(date) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
function statusPill(status) {
  const clean = String(status || 'unknown').toLowerCase();
  const labels = { applied:'Applied', shortlisted:'Shortlisted', offered:'Offer received', accepted:'Accepted', declined:'Declined', withdrawn:'Withdrawn', rejected:'Rejected',
    confirmed:'Confirmed', checked_in:'Checked in', checked_out:'Checked out', completed:'Completed', cancelled:'Cancelled', disputed:'Disputed', pending:'Pending', verified:'Verified', published:'Published', draft:'Draft', paused:'Paused', closed:'Closed', paid:'Paid', not_due:'Not due', open:'Open', in_progress:'In progress', waiting_user:'Waiting for user', resolved:'Resolved' };
  return `<span class="status-pill status-${escapeHtml(clean)}">${escapeHtml(labels[clean] || clean.replace(/_/g, ' '))}</span>`;
}
function showToast(message, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast${type === 'error' ? ' error' : ''}`;
  el.innerHTML = `<span class="toast-icon">${type === 'error' ? '!' : '✓'}</span><span class="toast-message">${escapeHtml(message)}</span>`;
  $('#toast-region').appendChild(el);
  window.setTimeout(() => el.remove(), 4800);
}
function friendlyError(error) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = sessionStorage.getItem('earnroute_token');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body !== undefined && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  let response;
  const nativeAndroid = Boolean(window.EarnRouteNative && typeof window.EarnRouteNative.isAndroidApp === 'function' && window.EarnRouteNative.isAndroidApp());
  const nativeConfiguredApiBase = nativeAndroid && typeof window.EarnRouteNative.getApiBaseUrl === 'function' ? window.EarnRouteNative.getApiBaseUrl() : '';
  const apiBase = nativeAndroid ? String(localStorage.getItem('earnroute_api_base') || nativeConfiguredApiBase || '').replace(/\/+$/, '') : '';
  if (nativeAndroid && !apiBase) {
    try { window.EarnRouteNative.openServerSettings(); } catch (_) { /* Server settings can still be opened from the header. */ }
    throw new Error('Connect the deployed EarnRoute server before creating an account or loading live work.');
  }
  const requestUrl = apiBase ? `${apiBase}${path.startsWith('/') ? path : `/${path}`}` : path;
  try {
    response = await fetch(requestUrl, { ...options, headers, body: options.body === undefined || options.body instanceof FormData ? options.body : JSON.stringify(options.body) });
  } catch (error) {
    throw new Error('Cannot reach EarnRoute right now. Check your connection and try again.');
  }
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { detail: raw || 'Unexpected server response.' }; }
  if (!response.ok) {
    if (response.status === 401 && currentUser) {
      sessionStorage.removeItem('earnroute_token');
      currentUser = null;
      if (isAdminPortal) showAdminSignIn('Your session expired. Sign in again to open the admin console.');
      else setLanding();
    }
    const detail = data.detail;
    if (Array.isArray(detail)) throw new Error(detail.map(x => x.msg).join(' · ') || `Request failed (${response.status})`);
    throw new Error(typeof detail === 'string' ? detail : `Request failed (${response.status})`);
  }
  return data;
}
function setLanding() {
  currentUser = null;
  $('#landing').hidden = false;
  $('#workspace').hidden = true;
  $('#auth-modal').hidden = true;
  document.body.classList.remove('app-open');
}
function setWorkspace(user) {
  if (isAdminPortal && user?.role === 'admin') document.body.classList.remove('admin-portal-mode');
  currentUser = user;
  $('#landing').hidden = true;
  $('#workspace').hidden = false;
  $('#user-initials').textContent = initials(user.full_name);
  $('#user-name').textContent = user.full_name;
  $('#user-role').textContent = user.role === 'admin' ? t('adminRole') : user.role === 'business' ? t('businessRole') : t('workerRole');
  $('#workspace-context').textContent = user.role === 'business' ? (user.profile?.legal_name || user.full_name) : user.role === 'admin' ? 'Founder console' : (user.profile?.city || 'Your work profile');
  buildNavigation();
  activeScreen = user.role === 'business' ? 'business-overview' : user.role === 'admin' ? 'admin-overview' : 'overview';
  setLanguageButton();
  renderPage();
}
function navItems() {
  if (currentUser?.role === 'business') return [
    { group:'WORKSPACE', items:[['business-overview','overview','◫'],['post-job','postJob','＋'],['business-jobs','manageJobs','▤'],['business-applicants','applicants','◎'],['business-assignments','assignments','✓']] },
    { group:'ACCOUNT', items:[['profile','profile','○'],['support','support','?']] }
  ];
  if (currentUser?.role === 'admin') return [
    { group:'FOUNDER CONTROL', items:[['admin-overview','overview','◫'],['admin-verifications','verify','✓'],['admin-jobs','manageJobs','▤'],['admin-disputes','disputes','⚑'],['admin-support','adminSupport','✉'],['admin-audit','audit','≋']] }
  ];
  return [
    { group:'WORKSPACE', items:[['overview','overview','◫'],['discover','discover','⌕'],['saved-shifts','savedShifts','♡'],['applications','applications','▤'],['schedule','schedule','▦'],['earnings','earnings','₹']] },
    { group:'ACCOUNT', items:[['profile','profile','○'],['support','support','?']] }
  ];
}
function buildNavigation() {
  const nav = $('#side-nav');
  nav.innerHTML = navItems().map((group, i) => `${i ? '<div class="nav-divider"></div>' : ''}<div class="nav-group-title">${group.group}</div>${group.items.map(([id, label, icon]) => `<button class="nav-link${id === activeScreen ? ' active' : ''}" data-screen="${id}"><span class="nav-icon">${icon}</span><span class="nav-label">${t(label)}</span></button>`).join('')}`).join('');
  $('#logout-btn').lastChild.textContent = ` ${t('signOut')}`;
}
function setLanguageButton() {
  $('#lang-btn').textContent = t('language');
  document.querySelectorAll('[data-er-language-toggle]').forEach(el => { el.textContent = t('language'); });
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.documentElement.lang = selectedLanguage === 'hi' ? 'hi-IN' : 'en-IN';
  applyEarnRouteLocale(document.body);
}
const TITLES = {
  overview:'Overview', discover:'Discover work', 'saved-shifts':'Saved shifts', applications:'Applications', schedule:'My schedule', earnings:'Earnings', profile:'My profile',
  'business-overview':'Business overview','post-job':'Post a shift','business-jobs':'Manage jobs','business-applicants':'Applicants','business-assignments':'Assignments',
  'admin-overview':'Founder overview','admin-verifications':'Business verification','admin-jobs':'Job moderation','admin-disputes':'Dispute review','admin-support':'Support tickets','support':'Help & support','admin-audit':'Audit history'
};
function setActiveScreen(screen) {
  activeScreen = screen;
  $$('.nav-link').forEach(el => el.classList.toggle('active', el.dataset.screen === screen));
  $('#page-title').textContent = TITLES[screen] || 'Overview';
  $('#sidebar').classList.remove('mobile-open');
  renderPage();
}
function pageHeading(eyebrow, title, copy, actions = '') {
  return `<div class="page-heading"><div><div class="eyebrow">${escapeHtml(eyebrow)}</div><h1>${title}</h1><p>${copy}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ''}</div>`;
}
function metricCard(label, value, note, icon, extra = '') {
  return `<article class="metric-card"><div class="metric-top"><span>${escapeHtml(label)}</span><span class="metric-icon">${icon}</span></div><div class="metric-value">${value}</div><div class="metric-note ${extra}">${note}</div></article>`;
}
function emptyState(title, copy, icon = '✳', action = '') {
  return `<div class="empty-state"><div class="empty-symbol">${icon}</div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(copy)}</p>${action}</div>`;
}
function jobCard(job, action = 'apply') {
  const match = job.match;
  const reasons = (match?.reasons || []).slice(0, 3).map(r => `<span class="reason-chip">${escapeHtml(r)}</span>`).join('');
  const filled = Number(job.positions_filled || 0);
  const remaining = Math.max(0, Number(job.slots || 0) - filled);
  let actionHtml = '';
  if (action === 'apply') {
    actionHtml = match && match.eligible === false
      ? `<button class="btn btn-outline btn-sm" disabled title="Update your profile to meet this shift's requirements">Profile mismatch</button>`
      : `<button class="btn btn-primary btn-sm" data-apply-job="${job.id}">Apply for shift <span>↗</span></button>`;
  }
  else if (action === 'view-apps') actionHtml = `<button class="btn btn-light btn-sm" data-view-applicants="${job.id}">Review applicants <span>→</span></button>`;
  const estimatedFee = Number(job.estimated_platform_fee ?? (Number(job.gross_shift_pay_estimate || job.pay_amount) * Number(job.platform_fee_percent || 0) / 100));
  const estimatedNet = Number(job.estimated_net_pay ?? (Number(job.gross_shift_pay_estimate || job.pay_amount) - estimatedFee));
  return `<article class="job-card"><div class="job-card-head"><div class="job-brand-icon">${escapeHtml((job.business_name || job.title || 'E').slice(0,1).toUpperCase())}</div><div class="job-head-main"><div class="job-title">${escapeHtml(job.title)}</div><div class="job-business">${escapeHtml(job.business_name || 'Business')}${job.business_verified ? '<span class="verified-chip">✓ VERIFIED</span>' : ''}${job.business_rating ? `<span class="job-rating">★ ${Number(job.business_rating).toFixed(1)} (${Number(job.business_review_count||0)})</span>` : ''}</div></div><div class="job-pay"><b>${formatMoney(job.pay_amount)}</b><small>per ${escapeHtml(job.pay_basis || 'shift')}</small><small class="net-estimate">~${formatMoney(estimatedNet)} net / shift</small></div></div><div class="job-meta"><span class="meta-chip">⌖ ${escapeHtml(job.city)}</span><span class="meta-chip">◷ ${escapeHtml(formatDate(job.start_at))}</span><span class="meta-chip">◴ ${escapeHtml(job.duration_hours)} hrs</span><span class="meta-chip">${remaining} position${remaining === 1 ? '' : 's'} open</span><span class="meta-chip">${escapeHtml(job.category)}</span></div><div class="compensation-disclosure"><b>Pay transparency:</b> Estimated gross for the full shift ${formatMoney(job.gross_shift_pay_estimate ?? job.pay_amount)} · worker platform fee (${Number(job.platform_fee_percent || 0)}%) ${formatMoney(estimatedFee)} · estimated worker net ${formatMoney(estimatedNet)}. Actual payment depends on accepted terms and approved completion.</div>${match ? `<div class="match-reasons" style="margin-top:10px">${reasons}${match.score ? `<span class="reason-chip">${match.score}% match</span>` : ''}</div>` : ''}<div class="job-card-bottom"><span class="job-business">Apply by ${escapeHtml(formatDate(job.application_deadline))} · ${escapeHtml(job.payment_terms || 'Terms listed in job details')}</span>${actionHtml}</div>${job.description ? `<details class="job-description-details"><summary>Role details and requirements</summary><p>${escapeHtml(job.description)}</p>${job.requirements?.length ? `<p><b>Skills:</b> ${escapeHtml(job.requirements.join(', '))}</p>` : ''}${job.address ? `<p><b>Location:</b> ${escapeHtml(job.address)}</p>` : ''}${job.breaks_info ? `<p><b>Breaks:</b> ${escapeHtml(job.breaks_info)}</p>` : ''}${job.equipment_info ? `<p><b>Equipment / dress:</b> ${escapeHtml(job.equipment_info)}</p>` : ''}${job.safety_info ? `<p><b>Safety:</b> ${escapeHtml(job.safety_info)}</p>` : ''}${job.cancellation_policy ? `<p><b>Cancellation:</b> ${escapeHtml(job.cancellation_policy)}</p>` : ''}</details>` : ''}</article>`;
}
async function shareEarnRouteText(title, text) {
  const rawBody = String(text || '').slice(0, 5000);
  const body = selectedLanguage === 'hi'
    ? rawBody.split(/\r?\n/).map(translateEarnRouteText).join('\n')
    : rawBody;
  const safeTitle = selectedLanguage === 'hi'
    ? translateEarnRouteText(String(title || 'Share shift details'))
    : String(title || 'Share shift details');
  try {
    if (window.EarnRouteNative && typeof window.EarnRouteNative.shareText === 'function') {
      window.EarnRouteNative.shareText(body, safeTitle);
      showToast('Choose an app to share these shift details.');
      return true;
    }
    if (navigator.share) {
      await navigator.share({title: safeTitle || 'EarnRoute shift', text: body});
      return true;
    }
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(body);
      showToast('Shift details copied. You can paste them into a message.');
      return true;
    }
    const field = document.createElement('textarea');
    field.value = body;
    field.setAttribute('readonly', 'readonly');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    if (!copied) throw new Error('Copy was not available on this device.');
    showToast('Shift details copied. You can paste them into a message.');
    return true;
  } catch (error) {
    if (error && error.name === 'AbortError') return false;
    showToast(friendlyError(error) || 'Could not share these shift details.', 'error');
    return false;
  }
}
function assignmentCard(assignment, isBusiness = false) {
  let actions = '';
  actions += `<button class="btn btn-outline btn-sm" data-share-assignment="${assignment.id}">Share shift ↗</button>`;
  const hasPinnedCoordinates = assignment.latitude !== null && assignment.latitude !== undefined &&
    assignment.longitude !== null && assignment.longitude !== undefined &&
    Number.isFinite(Number(assignment.latitude)) && Number.isFinite(Number(assignment.longitude));
  const mapQuery = hasPinnedCoordinates
    ? String(assignment.latitude) + ',' + String(assignment.longitude)
    : [assignment.address, assignment.city].filter(Boolean).join(', ');
  const mapLabel = hasPinnedCoordinates ? 'Navigate to workplace ↗' : 'Search workplace in Maps ↗';
  if (!isBusiness && assignment.status === 'confirmed') actions += `<button class="btn btn-primary btn-sm" data-check-in="${assignment.id}">Check in</button><button class="btn btn-outline btn-sm" data-cancel-assignment="${assignment.id}">Cancel</button>`;
  if (isBusiness && assignment.status === 'confirmed') actions += `<button class="btn btn-outline btn-sm" data-cancel-assignment="${assignment.id}">Cancel assignment</button>`;
  if (!isBusiness && assignment.status === 'checked_in') actions += `<button class="btn btn-primary btn-sm" data-check-out="${assignment.id}">Check out</button>`;
  if (!isBusiness && ['checked_in','checked_out','completed','disputed'].includes(assignment.status)) actions += `<button class="btn btn-light btn-sm" data-dispute="${assignment.id}">Report a problem</button>`;
  if (isBusiness && assignment.status === 'checked_out') actions += `<button class="btn btn-primary btn-sm" data-complete="${assignment.id}">Approve completion</button>`;
  if (isBusiness && assignment.status === 'checked_in') actions += `<span class="job-business">Waiting for worker check-out</span>`;
  if (!isBusiness && assignment.status === 'completed' && !assignment.worker_reviewed) actions += `<button class="btn btn-outline btn-sm" data-review-assignment="${assignment.id}">Rate business</button>`;
  if (isBusiness && assignment.status === 'completed' && !assignment.business_reviewed) actions += `<button class="btn btn-outline btn-sm" data-review-assignment="${assignment.id}">Rate worker</button>`;
  const payText = isBusiness ? `Gross pay ${formatMoney(assignment.gross_pay)}` : `Net payable ${formatMoney(assignment.net_pay)}`;
  return `<article class="job-card"><div class="job-card-head"><div class="job-brand-icon">✓</div><div class="job-head-main"><div class="job-title">${escapeHtml(assignment.job_title)}</div><div class="job-business">${escapeHtml(isBusiness ? assignment.worker_name || 'Worker assigned' : (assignment.business_name || 'Business'))} · ${escapeHtml(assignment.city)}</div></div>${statusPill(assignment.status)}</div><div class="job-meta"><span class="meta-chip">◷ ${escapeHtml(formatDate(assignment.start_at))}</span><span class="meta-chip">${escapeHtml(payText)}</span><span class="meta-chip">Payment: ${escapeHtml(assignment.payout_status || 'not due')}</span></div>${assignment.reviews?.length ? `<div class="review-list">${assignment.reviews.map(r=>`<div class="review-line"><b>★ ${r.rating}/5</b> ${escapeHtml(r.comment||'Review submitted without a comment')} <small>— ${escapeHtml(r.reviewer_name)}</small></div>`).join('')}</div>` : ''}<details class="job-description-details"><summary>Workplace, instructions and terms</summary>${assignment.address?`<p><b>Location:</b> ${escapeHtml(assignment.address)}</p>`:''}${mapQuery ? '<p><a class="er-map-link" href="https://www.google.com/maps/search/?api=1&amp;query=' + encodeURIComponent(mapQuery) + '" target="_blank" rel="noopener noreferrer">' + mapLabel + '</a></p>' : ''}<p>${escapeHtml(assignment.description||'Review the published role details before travelling.')}</p>${assignment.requirements?.length?`<p><b>Required skills:</b> ${escapeHtml(assignment.requirements.join(', '))}</p>`:''}${assignment.breaks_info?`<p><b>Breaks:</b> ${escapeHtml(assignment.breaks_info)}</p>`:''}${assignment.equipment_info?`<p><b>Equipment / dress:</b> ${escapeHtml(assignment.equipment_info)}</p>`:''}${assignment.safety_info?`<p><b>Safety instructions:</b> ${escapeHtml(assignment.safety_info)}</p>`:''}${assignment.payment_terms?`<p><b>Payment terms:</b> ${escapeHtml(assignment.payment_terms)}</p>`:''}${assignment.cancellation_policy?`<p><b>Cancellation:</b> ${escapeHtml(assignment.cancellation_policy)}</p>`:''}</details><div class="job-card-bottom"><span class="job-business">${assignment.checkin_at ? `Checked in ${escapeHtml(formatDate(assignment.checkin_at))}` : 'Review shift instructions before arrival'}</span><div class="job-management-actions">${actions}</div></div></article>`;
}
async function renderPage() {
  if (!currentUser) return;
  $('#page-title').textContent = TITLES[activeScreen] || 'Overview';
  $('#view-root').innerHTML = `<div class="loading-surface"><span class="loading-spinner"></span><span>Loading your workspace…</span></div>`;
  try {
    let html = '';
    switch (activeScreen) {
      case 'overview': html = await renderWorkerOverview(); break;
      case 'discover': html = await renderDiscover(); break;
      case 'saved-shifts': html = await renderSavedShifts(); break;
      case 'applications': html = await renderApplications(); break;
      case 'schedule': html = await renderSchedule(false); break;
      case 'earnings': html = await renderEarnings(); break;
      case 'profile': html = await renderProfile(); break;
      case 'business-overview': html = await renderBusinessOverview(); break;
      case 'post-job': html = renderPostJob(); break;
      case 'business-jobs': html = await renderBusinessJobs(); break;
      case 'business-applicants': html = await renderBusinessApplicants(); break;
      case 'business-assignments': html = await renderSchedule(true); break;
      case 'admin-overview': html = await renderAdminOverview(); break;
      case 'admin-verifications': html = await renderAdminVerifications(); break;
      case 'admin-jobs': html = await renderAdminJobs(); break;
      case 'admin-disputes': html = await renderAdminDisputes(); break;
      case 'admin-audit': html = await renderAdminAudit(); break;
      case 'support': html = await renderSupport(); break;
      case 'admin-support': html = await renderAdminSupport(); break;
      default: html = emptyState('Page not found', 'Use the navigation to open a workspace section.');
    }
    $('#view-root').innerHTML = html;
    setLanguageButton();
  } catch (error) {
    $('#view-root').innerHTML = `<div class="page-heading"><div><div class="eyebrow">WORKSPACE</div><h1>We couldn’t load this page</h1><p>${escapeHtml(friendlyError(error))}</p></div><button class="btn btn-primary" data-retry>Try again ↻</button></div>`;
  }
}
async function renderWorkerOverview() {
  const [jobsRes, appsRes, assRes, earnRes] = await Promise.allSettled([
    api('/api/jobs?page_size=4'), api('/api/applications/me'), api('/api/assignments/me'), api('/api/worker/earnings')
  ]);
  const jobs = jobsRes.status === 'fulfilled' ? jobsRes.value.items : [];
  const apps = appsRes.status === 'fulfilled' ? appsRes.value.items : [];
  const assignments = assRes.status === 'fulfilled' ? assRes.value.items : [];
  const earnings = earnRes.status === 'fulfilled' ? earnRes.value : { pending_settlement:0, verified_paid:0, completed_assignments:0 };
  const p = currentUser.profile || {};
  const progress = Math.round(([!!p.city, (p.skills||[]).length>0, (p.preferred_categories||[]).length>0, (p.availability||[]).length>0, Number(p.min_pay||0)>0].filter(Boolean).length / 5) * 100);
  const confirmed = assignments.filter(a => ['confirmed','checked_in','checked_out'].includes(a.status));
  const firstName = currentUser.full_name.split(' ')[0];
  const rightHint = progress < 80 ? `<div class="panel"><div class="panel-header"><div><h2 class="panel-title">A stronger profile, better matches</h2><div class="panel-subtitle">A few details help the matcher do better.</div></div></div><div class="profile-progress"><div class="progress-labels"><span>Profile completeness</span><b>${progress}%</b></div><div class="progress-bar"><span style="width:${progress}%"></span></div><p>Add your city, skills and real availability to make your recommendations more relevant.</p><button class="text-link" data-screen="profile">Complete your profile →</button></div></div>` : `<div class="panel"><div class="panel-header"><div><h2 class="panel-title">Your matching preferences</h2><div class="panel-subtitle">You control which opportunities suit you.</div></div></div><div class="panel-body"><div class="hint-card"><div class="hint-mark">✳</div><h4>Matching with clear reasons</h4><p>EarnRoute weighs skills, availability, city, pay preferences and your existing schedule. Matching scores are guidance, not a job guarantee.</p><button class="text-link" data-screen="profile">Review preferences →</button></div></div></div>`;
  return `${pageHeading('YOUR WORKSPACE', `Good to see you, ${escapeHtml(firstName)}.`, t('overviewSub'), `<button class="btn btn-outline" data-screen="profile">${t('profileSettings')} <span>→</span></button><button class="btn btn-primary" data-screen="discover">${t('findShifts')} <span>↗</span></button>`)}
  <div class="dashboard-grid">${metricCard(t('applied'), apps.length, 'Applications submitted', '▤')}${metricCard(t('confirmed'), confirmed.length, 'Current assignments', '✓','positive')}${metricCard(t('completed'), earnings.completed_assignments || 0, 'Work marked complete', '◷')}${metricCard(t('pending'), formatMoney(earnings.pending_settlement), 'Awaiting verified settlement', '₹')}</div>
  <div class="dashboard-columns"><div class="panel"><div class="panel-header"><div><h2 class="panel-title">${t('recommended')}</h2><div class="panel-subtitle">Published opportunities, ranked by preference fit.</div></div><button class="text-link" data-screen="discover">See all →</button></div><div class="panel-body">${jobs.length ? `<div class="job-list">${jobs.map(j=>jobCard(j)).join('')}</div>` : emptyState(t('noJobs'), t('noJobsCopy'), '⌕', '<button class="btn btn-light btn-sm" data-screen="discover">Adjust search ↗</button>')}</div></div>
  <div class="right-column">${rightHint}<div style="height:13px"></div><div class="panel"><div class="panel-header"><div><h2 class="panel-title">${t('upcoming')}</h2><div class="panel-subtitle">Your confirmed work schedule</div></div><button class="text-link" data-screen="schedule">View all →</button></div><div class="panel-body">${confirmed.length ? confirmed.slice(0,3).map(a=>`<div class="list-row"><span class="list-row-icon">◷</span><span class="list-row-main"><b>${escapeHtml(a.job_title)}</b><small>${escapeHtml(formatDate(a.start_at))} · ${escapeHtml(a.city)}</small></span>${statusPill(a.status)}</div>`).join('') : emptyState('Nothing confirmed yet','When you accept an offer, the shift and its confirmed terms will appear here.','▦','<button class="text-link" data-screen="discover">Explore shifts →</button>')}</div></div></div></div>`;
}
async function renderDiscover(filters = {}) {
  const params = new URLSearchParams({page_size:'30'});
  for (const [key,value] of Object.entries(filters)) if (value !== undefined && value !== null && String(value).trim()) params.set(key, String(value).trim());
  const result = await api(`/api/jobs?${params.toString()}`);
  currentJobs = result.items || [];
  return `${pageHeading('OPPORTUNITY FINDER','Find work that fits.','Filter real published shifts by location, category and compensation. Every listing shows the terms businesses have submitted.', '<button class="btn btn-outline" data-screen="profile">Update preferences ↗</button>')}
  <form id="discover-filter-form" class="filter-bar"><input name="search" placeholder="Search role, skill or business" value="${escapeHtml(filters.search || '')}" aria-label="Search roles"><input name="city" placeholder="City (e.g. Delhi)" value="${escapeHtml(filters.city || currentUser.profile?.city || '')}" aria-label="City"><select name="category" aria-label="Category"><option value="">All categories</option>${['Retail','Events','Warehouse','Hospitality','Delivery','Office support','Inventory','Customer support','Other'].map(c=>`<option ${filters.category===c?'selected':''}>${c}</option>`).join('')}</select><input type="number" name="min_pay" min="0" step="50" placeholder="Min pay ₹" value="${escapeHtml(filters.min_pay || '')}" aria-label="Minimum pay"><button class="btn btn-primary" type="submit">Search <span>⌕</span></button><button class="btn btn-outline" type="reset">Clear</button></form>
  <div class="results-heading"><span><b>${result.total}</b> published opportunity${result.total===1?'':'ies'}</span><span class="job-business">Match scores are explainable guidance, not guarantees.</span></div>
  ${result.items.length ? `<div class="job-list discover-list">${result.items.map(j=>jobCard(j)).join('')}</div>` : emptyState(t('noJobs'), t('noJobsCopy'), '⌕', '<button class="btn btn-light btn-sm" data-screen="profile">Add skills and availability →</button>')}`;
}
async function renderApplications() {
  const result = await api('/api/applications/me');
  const items = result.items || [];
  return `${pageHeading('YOUR APPLICATIONS','Every application, in one place.','Review updates from businesses. You stay in control of accepting or declining every offer.', '<button class="btn btn-primary" data-screen="discover">Find more work ↗</button>')}
  <div class="panel"><div class="panel-header"><div><h2 class="panel-title">Application history</h2><div class="panel-subtitle">Status changes are recorded as they happen.</div></div><span class="status-pill">${items.length} total</span></div><div class="panel-body">${items.length ? `<div class="job-list">${items.map(a=>`<article class="job-card"><div class="job-card-head"><div class="job-brand-icon">▤</div><div class="job-head-main"><div class="job-title">${escapeHtml(a.job_title)}</div><div class="job-business">Applied ${escapeHtml(formatDate(a.created_at))}</div></div>${statusPill(a.status)}</div>${a.note ? `<p class="application-note">${escapeHtml(a.note)}</p>`:''}<div class="job-card-bottom"><span class="job-business">${a.assignment_id ? `Assignment #${a.assignment_id} · check your schedule for instructions.` : a.status==='offered' ? 'Review the offer and respond.' : 'You will see a status update when the business responds.'}</span><div class="job-management-actions">${a.status==='offered'?`<button class="btn btn-primary btn-sm" data-respond-offer="${a.id}" data-decision="accepted">Accept offer</button><button class="btn btn-outline btn-sm" data-respond-offer="${a.id}" data-decision="declined">Decline</button>`:''}${['applied','shortlisted'].includes(a.status)?`<button class="btn btn-outline btn-sm" data-withdraw-app="${a.id}">Withdraw application</button>`:''}${a.assignment_id?`<button class="btn btn-light btn-sm" data-screen="schedule">View assignment</button>`:''}</div></div></article>`).join('')}</div>` : emptyState('No applications yet','When you apply for a published shift, you can track its status here without messaging different businesses separately.','▤','<button class="btn btn-primary btn-sm" data-screen="discover">Explore work ↗</button>')}</div></div>`;
}
async function renderSchedule(isBusiness) {
  const result = await api(isBusiness ? '/api/business/assignments' : '/api/assignments/me');
  const items = result.items || [];
  return `${pageHeading(isBusiness?'TEAM OPERATIONS':'YOUR WORK CALENDAR',isBusiness?'Confirmed assignments':'Your schedule, at a glance.',isBusiness?'Track worker attendance and approve completion only after the applicable checks.':'Check your confirmed assignments, review the start instructions and record attendance at the appropriate time.', isBusiness ? '<button class="btn btn-outline" data-screen="business-jobs">Manage shifts ↗</button>' : '<button class="btn btn-primary" data-screen="discover">Find more work ↗</button>')}
  ${!isBusiness && items.some(a=>a.status==='confirmed') ? '<div class="callout-warning">Check-in is enabled from two hours before the scheduled shift until its end. Follow any additional workplace verification instructions; an app timestamp alone may not be sufficient proof of attendance.</div>':''}
  <div class="panel"><div class="panel-header"><div><h2 class="panel-title">${isBusiness?'Worker assignments':'Upcoming and past assignments'}</h2><div class="panel-subtitle">${items.length} recorded assignment${items.length===1?'':'s'} · Terms are shown per assignment.</div></div></div><div class="panel-body">${items.length ? `<div class="job-list">${items.map(a=>assignmentCard(a,isBusiness)).join('')}</div>` : emptyState('No assignments to show','Accepted offers create confirmed assignments here. Cancelled offers and unpublished jobs are not counted as confirmed work.','▦',`<button class="btn btn-light btn-sm" data-screen="${isBusiness?'business-jobs':'discover'}">${isBusiness?'Manage jobs':'Discover shifts'} →</button>`)}</div></div>`;
}
async function renderEarnings() {
  const result = await api('/api/worker/earnings');
  const items = result.items || [];
  return `${pageHeading('EARNINGS & SETTLEMENT','Know what’s completed — and what is pending.','Only recorded completed work is included. A pending settlement is not money already paid.', '<button class="btn btn-outline" data-screen="schedule">Review assignments ↗</button>')}
  <div class="dashboard-grid">${metricCard('Completed assignments',result.completed_assignments||0,'Approved work records','✓')}${metricCard('Gross completed',formatMoney(result.gross_completed),'Before disclosed platform fees','₹')}${metricCard('Net completed',formatMoney(result.net_completed),'After configured platform fee','↘')}${metricCard('Verified payouts',formatMoney(result.verified_paid),'Provider-reconciled settlement only','✓','positive')}</div>
  <div class="callout-warning">${escapeHtml(result.notice || 'Payment status reflects the records available to EarnRoute. Confirmed pay is not considered paid until a verified settlement record exists.')}</div>
  <div class="panel"><div class="panel-header"><div><h2 class="panel-title">Work and payout history</h2><div class="panel-subtitle">Gross pay, platform fee, net payable and payout status stay separate.</div></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Assignment</th><th>Completed / shift</th><th>Gross pay</th><th>Platform fee</th><th>Net pay</th><th>Payout</th></tr></thead><tbody>${items.length ? items.map(a=>`<tr><td><b>${escapeHtml(a.job_title)}</b><small>#${a.id}</small></td><td>${escapeHtml(formatDate(a.completed_at || a.start_at))}</td><td>${formatMoney(a.gross_pay)}</td><td>${formatMoney(a.platform_fee)}</td><td><b>${formatMoney(a.net_pay)}</b></td><td>${statusPill(a.payout_status)}</td></tr>`).join('') : '<tr><td colspan="6">'+escapeHtml('No work records yet. Accepted offers and approved completions will appear here.')+'</td></tr>'}</tbody></table></div></div>`;
}
function renderPostJob() {
  const p = currentUser.profile || {};
  const now = new Date();
  now.setDate(now.getDate()+2); now.setHours(10,0,0,0);
  const end = new Date(now); end.setHours(end.getHours()+4);
  const deadline = new Date(now); deadline.setHours(deadline.getHours()-3);
  return `${pageHeading('CREATE A SHIFT','Post a clear, genuine opportunity.','Include every detail workers need to decide confidently. Publishing is enabled only after business verification.', '<button class="btn btn-outline" data-screen="business-jobs">Manage existing jobs →</button>')}
  ${p.verification_status!=='verified' ? `<div class="callout-warning">Your business verification is currently <b>${escapeHtml(p.verification_status || 'pending')}</b>. You can save a draft while review is pending, but a job cannot be published until an admin verifies your business. <button class="text-link" data-screen="profile">Update business details →</button></div>`:''}
  <form id="job-form" class="form-panel"><h2>Shift details</h2><p>Be specific about responsibilities, timing, compensation, travel requirements and any relevant safety or break information.</p><div class="form-grid">
  <div class="form-field span-2"><label for="job-title">Job title *</label><input id="job-title" name="title" required minlength="5" maxlength="140" placeholder="e.g. Event registration associate"></div>
  <div class="form-field span-2"><label for="job-description">Responsibilities and description *</label><textarea id="job-description" name="description" required minlength="20" maxlength="6000" placeholder="What will the worker do during the shift?"></textarea></div>
  <div class="form-field"><label for="job-category">Category *</label><select id="job-category" name="category" required>${['Retail','Events','Warehouse','Hospitality','Delivery','Office support','Inventory','Customer support','Other'].map(v=>`<option>${v}</option>`).join('')}</select></div>
  <div class="form-field"><label for="job-city">City *</label><input id="job-city" name="city" required maxlength="100" value="${escapeHtml(p.city||'')}" placeholder="e.g. New Delhi"></div>
  <div class="form-field span-2"><label for="job-address">Workplace address / meeting point</label><input id="job-address" name="address" maxlength="300" value="${escapeHtml(p.address||'')}" placeholder="Full address or clear meeting-point details"></div>
  <div class="form-field"><label for="job-slots">Number of positions *</label><input id="job-slots" name="slots" type="number" min="1" max="500" value="1" required></div>
  <div class="form-field"><label for="job-pay">Gross pay in INR *</label><input id="job-pay" name="pay_amount" type="number" min="1" max="1000000" step="1" required placeholder="e.g. 1200"></div>
  <div class="form-field"><label for="job-pay-basis">Pay basis *</label><select id="job-pay-basis" name="pay_basis"><option value="shift">Per shift (total)</option><option value="hour">Per hour</option><option value="project">Per project</option></select></div>
  <div class="form-field"><label for="job-experience">Minimum relevant experience (years)</label><input id="job-experience" name="min_experience" type="number" min="0" max="60" value="0"></div>
  <div class="form-field"><label for="job-start">Shift start *</label><input id="job-start" name="start_at" type="datetime-local" value="${dateInputValue(now)}" required></div>
  <div class="form-field"><label for="job-end">Shift end *</label><input id="job-end" name="end_at" type="datetime-local" value="${dateInputValue(end)}" required></div>
  <div class="form-field"><label for="job-deadline">Application deadline *</label><input id="job-deadline" name="application_deadline" type="datetime-local" value="${dateInputValue(deadline)}" required></div>
  <div class="form-field"><label for="job-requirements">Required skills (comma-separated)</label><input id="job-requirements" name="requirements" placeholder="e.g. customer service, inventory"></div>
  <div class="form-field"><label for="job-breaks">Breaks and meal arrangements</label><input id="job-breaks" name="breaks_info" maxlength="300" placeholder="Describe paid/unpaid breaks and facilities"></div>
  <div class="form-field"><label for="job-equipment">Equipment and dress code</label><input id="job-equipment" name="equipment_info" maxlength="300" placeholder="Any required uniform, equipment or PPE"></div>
  <div class="form-field span-2"><label for="job-safety">Safety and workplace instructions</label><textarea id="job-safety" name="safety_info" maxlength="500" placeholder="Supervisor / entry process, necessary safety information"></textarea></div>
  <div class="form-field span-2"><label for="job-payment-terms">Payment terms *</label><input id="job-payment-terms" name="payment_terms" maxlength="300" required value="Payment timing to be confirmed with the worker before the shift"></div>
  <div class="form-field span-2"><label for="job-cancellation">Cancellation policy *</label><textarea id="job-cancellation" name="cancellation_policy" required maxlength="500">Notify the business or worker as early as possible. Any applicable terms must be communicated before the assignment is accepted.</textarea></div>
  <div class="span-2 checkbox-row"><input id="job-publish" name="publish" type="checkbox"><label for="job-publish">Publish immediately after validation (requires verified business status). Leave unchecked to save a draft.</label></div>
  </div><div id="job-form-error" class="form-error" hidden></div><div class="form-actions"><button type="button" class="btn btn-outline" data-screen="business-jobs">Cancel</button><button type="submit" class="btn btn-primary btn-large" id="save-job-btn">Save job <span>↗</span></button></div></form>`;
}
async function renderBusinessOverview() {
  const [summaryRes, jobsRes, appsRes, assignRes] = await Promise.allSettled([api('/api/business/summary'),api('/api/business/jobs'),api('/api/business/applications'),api('/api/business/assignments')]);
  const s=summaryRes.status==='fulfilled'?summaryRes.value:{};const jobs=jobsRes.status==='fulfilled'?jobsRes.value.items:[];const apps=appsRes.status==='fulfilled'?appsRes.value.items:[];const assignments=assignRes.status==='fulfilled'?assignRes.value.items:[];
  return `${pageHeading('BUSINESS WORKSPACE','Good work starts with a clear shift.','Publish genuine requirements, review applications and keep every confirmed assignment organized.', '<button class="btn btn-outline" data-screen="business-jobs">Manage jobs →</button><button class="btn btn-primary" data-screen="post-job">Post a shift <span>↗</span></button>')}
  ${s.verification_status!=='verified'?`<div class="admin-banner"><span class="admin-banner-icon">✓</span><div><h3>Business verification: ${escapeHtml(s.verification_status||'pending')}</h3><p>Complete your business profile and wait for the verification review. Publishing is disabled until verification is confirmed.</p></div><button class="btn btn-light btn-sm" data-screen="profile">Review profile →</button></div>`:''}
  <div class="dashboard-grid">${metricCard('Active jobs',s.active_jobs||0,'Published shifts','▤')}${metricCard('Applications',s.applications||0,'Received for your jobs','◎')}${metricCard('Confirmed workers',s.confirmed_workers||0,'Current assigned capacity','✓')}${metricCard('Pending settlement',formatMoney(s.pending_settlement),'Tracked recorded obligations','₹')}</div>
  <div class="dashboard-columns"><div class="panel"><div class="panel-header"><div><h2 class="panel-title">Your recent jobs</h2><div class="panel-subtitle">Watch status and manage applicant flow.</div></div><button class="text-link" data-screen="business-jobs">All jobs →</button></div><div class="panel-body">${jobs.length?`<div class="job-list">${jobs.slice(0,4).map(j=>jobCard(j,'view-apps')).join('')}</div>`:emptyState('No jobs created yet','Create a shift with clear pay and hours. Drafts remain private until you publish them.','＋','<button class="btn btn-primary btn-sm" data-screen="post-job">Create first shift ↗</button>')}</div></div><div class="panel"><div class="panel-header"><div><h2 class="panel-title">Recent applications</h2><div class="panel-subtitle">Keep decisions and offers in one place.</div></div><button class="text-link" data-screen="business-applicants">View all →</button></div><div class="panel-body">${apps.length?apps.slice(0,5).map(a=>`<div class="list-row"><span class="list-row-icon">◎</span><span class="list-row-main"><b>${escapeHtml(a.worker_name)}</b><small>${escapeHtml(a.job_title)} · ${escapeHtml(a.worker_city||'City not set')}</small></span>${statusPill(a.status)}</div>`).join(''):emptyState('No applications yet','Applications appear here as workers respond to your published shifts.','◎')}</div></div></div>`;
}
async function renderBusinessJobs() {
  const result = await api('/api/business/jobs'); const items=result.items||[];
  return `${pageHeading('JOB MANAGEMENT','Manage the work you’ve published.','Pause, close or review applicants for your own jobs. Confirmed workers and their terms are protected from silent changes.', '<button class="btn btn-primary" data-screen="post-job">＋ Create a shift</button>')}
  <div class="panel"><div class="panel-header"><div><h2 class="panel-title">Jobs and drafts</h2><div class="panel-subtitle">${items.length} job record${items.length===1?'':'s'}</div></div></div><div class="panel-body">${items.length?`<div class="job-list">${items.map(j=>`<article class="job-card"><div class="job-card-head"><div class="job-brand-icon">${escapeHtml(j.title.slice(0,1).toUpperCase())}</div><div class="job-head-main"><div class="job-title">${escapeHtml(j.title)}</div><div class="job-business">${escapeHtml(j.city)} · ${escapeHtml(j.category)}</div></div>${statusPill(j.status)}</div><div class="job-meta"><span class="meta-chip">${formatMoney(j.pay_amount)} / ${escapeHtml(j.pay_basis)}</span><span class="meta-chip">◷ ${escapeHtml(formatDate(j.start_at))}</span><span class="meta-chip">${j.positions_filled||0}/${j.slots} positions</span><span class="meta-chip">Deadline ${escapeHtml(formatDate(j.application_deadline))}</span></div><div class="job-card-bottom"><span class="job-business">Created ${escapeHtml(formatDate(j.created_at))}</span><div class="job-management-actions"><button class="btn btn-light btn-sm" data-view-applicants="${j.id}">Applicants</button>${j.status==='draft'||j.status==='paused'?`<button class="btn btn-primary btn-sm" data-publish-job="${j.id}">Publish</button>`:''}${j.status==='published'?`<button class="btn btn-outline btn-sm" data-job-status="${j.id}" data-status="paused">Pause</button>`:''}${['published','paused','draft'].includes(j.status)?`<button class="btn btn-outline btn-sm" data-job-status="${j.id}" data-status="closed">Close</button>`:''}</div></div></article>`).join('')}</div>`:emptyState('Your job board starts here','Save a draft or publish a genuine paid shift once the business profile is verified.','▤','<button class="btn btn-primary btn-sm" data-screen="post-job">Post your first shift ↗</button>')}</div></div>`;
}
async function renderBusinessApplicants(jobId = null) {
  const params = jobId ? `?job_id=${encodeURIComponent(jobId)}` : '';
  const result = await api('/api/business/applications'+params); const items=result.items||[];
  return `${pageHeading('APPLICANT MANAGEMENT','Meet the people behind the applications.','Review the relevant skills and work preferences shared by applicants. Send offers only when shift terms and capacity are still correct.', '<button class="btn btn-outline" data-screen="business-jobs">Back to jobs →</button>')}
  <div class="panel"><div class="panel-header"><div><h2 class="panel-title">${jobId ? 'Applicants for selected job' : 'All applicants'}</h2><div class="panel-subtitle">${items.length} application${items.length===1?'':'s'} · Private worker details are limited to applications for your jobs.</div></div></div><div class="panel-body">${items.length?`<div class="job-list">${items.map(a=>`<article class="job-card"><div class="job-card-head"><div class="job-brand-icon">${escapeHtml(initials(a.worker_name).slice(0,1))}</div><div class="job-head-main"><div class="job-title">${escapeHtml(a.worker_name)}</div><div class="job-business">${escapeHtml(a.job_title)} · ${escapeHtml(a.worker_city||'City not set')} · ${a.worker_experience_years||0} year(s) experience${a.worker_rating ? ` · ★ ${Number(a.worker_rating).toFixed(1)} (${Number(a.worker_review_count||0)})` : ' · No reviews yet'}</div></div>${statusPill(a.status)}</div><div class="job-meta">${(a.worker_skills||[]).length?(a.worker_skills||[]).map(s=>`<span class="meta-chip">${escapeHtml(s)}</span>`).join(''):'<span class="meta-chip">Skills not added yet</span>'}</div>${a.note?`<p class="application-note">${escapeHtml(a.note)}</p>`:''}<div class="job-card-bottom"><span class="job-business">Received ${escapeHtml(formatDate(a.created_at))}</span><div class="job-management-actions">${['applied','shortlisted'].includes(a.status)?`<button class="btn btn-outline btn-sm" data-app-status="${a.id}" data-status="${a.status==='shortlisted'?'rejected':'shortlisted'}">${a.status==='shortlisted'?'Reject':'Shortlist'}</button><button class="btn btn-primary btn-sm" data-offer="${a.id}">Send offer</button>`:''}${a.assignment_id?`<button class="btn btn-light btn-sm" data-screen="business-assignments">Assignment #${a.assignment_id}</button>`:''}</div></div></article>`).join('')}</div>`:emptyState('No applications in this view','When workers apply to your published jobs, their applications and relevant profile details will appear here.','◎')}</div></div>`;
}
async function renderProfile() {
  const p=currentUser.profile||{};
  if(currentUser.role==='worker') {
    const availability=(p.availability||[]).map(w=>`${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][w.day]},${w.start},${w.end}`).join('\n');
    return `${pageHeading('YOUR WORK PROFILE','Help the matcher understand you.','Keep your preferences honest and up to date. You choose whether to apply for or accept any opportunity.', '<button class="btn btn-outline" data-screen="overview">Back to overview →</button>')}
    <form id="worker-profile-form" class="form-panel"><h2>Work preferences</h2><p>These details are used for explainable recommendations. Do not include Aadhaar, bank credentials or other unnecessary sensitive information.</p><div class="form-grid"><div class="form-field"><label for="profile-city">Your city *</label><input id="profile-city" name="city" required maxlength="100" value="${escapeHtml(p.city||'')}" placeholder="e.g. Delhi"></div><div class="form-field"><label for="profile-radius">Preferred travel radius</label><select id="profile-radius" name="travel_radius_km">${[1,3,5,8,10,15].map(v=>`<option value="${v}" ${Number(p.travel_radius_km||3)===v?'selected':''}>${v} km</option>`).join('')}</select><small class="form-help">Nearby searches support 1, 3 or 5 km, plus More: 8, 10 and 15 km. Distances are straight-line, not road ETA.</small></div><div class="form-field span-2"><label for="profile-skills">Your skills (comma-separated)</label><input id="profile-skills" name="skills" value="${escapeHtml((p.skills||[]).join(', '))}" placeholder="customer service, stock counting, event support"></div><div class="form-field span-2"><label for="profile-categories">Preferred work categories (comma-separated)</label><input id="profile-categories" name="preferred_categories" value="${escapeHtml((p.preferred_categories||[]).join(', '))}" placeholder="Retail, Events, Warehouse"></div><div class="form-field"><label for="profile-pay">Minimum preferred gross pay per shift (INR)</label><input id="profile-pay" name="min_pay" type="number" min="0" max="1000000" step="50" value="${escapeHtml(p.min_pay||0)}"></div><div class="form-field"><label for="profile-experience">Relevant experience (years)</label><input id="profile-experience" name="experience_years" type="number" min="0" max="60" value="${escapeHtml(p.experience_years||0)}"></div><div class="form-field span-2"><label for="profile-availability">Weekly availability windows *</label><textarea id="profile-availability" name="availability" placeholder="One per line: Mon,09:00,17:00\nTue,16:00,21:00">${escapeHtml(availability)}</textarea><small class="form-help">Use Mon, Tue, Wed, Thu, Fri, Sat or Sun followed by a start and end time in 24-hour format. Example: Wed,09:00,16:00. A window must cover the full shift.</small></div></div><div id="profile-form-error" class="form-error" hidden></div><div class="form-actions"><button class="btn btn-primary btn-large" type="submit">Save preferences <span>↗</span></button></div></form>`;
  }
  if(currentUser.role==='business') return `${pageHeading('BUSINESS PROFILE','Your business, clearly represented.','Keep business contact and location details accurate. Documents and private verification uploads are not enabled in this starter release.', '<button class="btn btn-outline" data-screen="business-overview">Back to overview →</button>')}
    <div class="callout-warning">Verification status: <b>${escapeHtml(p.verification_status||'pending')}</b>${p.verification_reason?` — ${escapeHtml(p.verification_reason)}`:''}. Publishing is locked until an admin verifies the business.</div><form id="business-profile-form" class="form-panel"><h2>Business details</h2><div class="form-grid"><div class="form-field"><label for="business-name">Business / legal name *</label><input id="business-name" name="legal_name" required maxlength="150" value="${escapeHtml(p.legal_name||currentUser.full_name)}"></div><div class="form-field"><label for="business-category">Business category</label><select id="business-category" name="category">${['Retail','Events','Warehouse','Hospitality','Delivery','Office support','Inventory','Customer support','Other'].map(v=>`<option ${p.category===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="form-field"><label for="business-city">City *</label><input id="business-city" name="city" required maxlength="100" value="${escapeHtml(p.city||'')}"></div><div class="form-field"><label for="business-phone">Business phone</label><input id="business-phone" name="phone" maxlength="20" value="${escapeHtml(p.phone||'')}"></div><div class="form-field span-2"><label for="business-address">Business address</label><input id="business-address" name="address" maxlength="300" value="${escapeHtml(p.address||'')}"></div><div class="form-field span-2"><label for="business-description">Description</label><textarea id="business-description" name="description" maxlength="3000">${escapeHtml(p.description||'')}</textarea></div></div><div id="profile-form-error" class="form-error" hidden></div><div class="form-actions"><button class="btn btn-primary btn-large" type="submit">Save business details ↗</button></div></form>`;
  return emptyState('Admin account','Admin accounts are provisioned by the founder command-line script. Profile editing is disabled for this role.');
}
async function renderAdminOverview() {
  const s=await api('/api/admin/overview');
  return `${pageHeading('FOUNDER CONTROL PANEL','Know what needs your attention.','Review platform operations, verification requests, reported issues and settlement exceptions without changing data from a client-side role toggle.', '<button class="btn btn-outline" data-screen="admin-audit">View audit history →</button>')}
  <div class="admin-banner"><span class="admin-banner-icon">✳</span><div><h3>Founder access is active</h3><p>Handle verification and disputes carefully. Payout state is never changed to Paid by a simple dashboard action; reconciliation must be backed by provider-verified settlement records.</p></div></div>
  <div class="dashboard-grid">${metricCard('Active workers',s.active_workers,'Registered worker accounts','◎')}${metricCard('Verified businesses',s.verified_businesses,`${s.pending_business_verifications} awaiting review`,'✓')}${metricCard('Published jobs',s.published_jobs,'Current published shifts','▤')}${metricCard('Assignments',s.assignments,`${s.completed_assignments} completed`,'◷')}${metricCard('Open disputes',s.open_disputes,'Require careful review','⚑')}${metricCard('Pending settlement',formatMoney(s.pending_settlements),'Outstanding recorded amount','₹')}${metricCard('Recognized platform revenue',formatMoney(s.recognized_platform_revenue),'Only reconciled completed assignments','↗')}${metricCard('Business accounts',s.business_accounts,'All registered business accounts','⌂')}</div>
  <div class="dashboard-columns"><div class="panel"><div class="panel-header"><div><h2 class="panel-title">What to review</h2><div class="panel-subtitle">Use the queues for human review of exceptional cases.</div></div></div><div class="panel-body"><div class="list-row"><span class="list-row-icon">✓</span><span class="list-row-main"><b>Business verification</b><small>${s.pending_business_verifications} profiles waiting for review</small></span><button class="btn btn-light btn-sm" data-screen="admin-verifications">Open queue →</button></div><div class="list-row"><span class="list-row-icon">⚑</span><span class="list-row-main"><b>Assignment disputes</b><small>${s.open_disputes} open disputes to investigate</small></span><button class="btn btn-light btn-sm" data-screen="admin-disputes">Review →</button></div><div class="list-row"><span class="list-row-icon">▤</span><span class="list-row-main"><b>Job moderation</b><small>Review listing details and safety information.</small></span><button class="btn btn-light btn-sm" data-screen="admin-jobs">Open jobs →</button></div></div></div><div class="panel"><div class="panel-header"><div><h2 class="panel-title">Metric definitions</h2><div class="panel-subtitle">Keep operational values distinct.</div></div></div><div class="panel-body"><div class="hint-card"><div class="hint-mark">₹</div><h4>Revenue is not transaction volume</h4><p>${escapeHtml(s.revenue_note||'Recognized revenue is based on recorded completed and reconciled assignments. This is not profit.')}</p></div></div></div></div>`;
}
async function renderAdminVerifications() {
  const result=await api('/api/admin/businesses?status_filter=pending'); const items=result.items||[];
  return `${pageHeading('TRUST & SAFETY','Review business verification.','Check the submitted business details before approving publication access. This view does not represent an automated legal identity or background check.', '<button class="btn btn-outline" data-screen="admin-overview">Back to overview →</button>')}
  <div class="callout-warning">Only mark a business verified after checks appropriate to your actual process. A profile being verified by this platform is not a government endorsement or a safety guarantee.</div>
  <div class="panel"><div class="panel-header"><div><h2 class="panel-title">Pending verification</h2><div class="panel-subtitle">${items.length} profile${items.length===1?'':'s'} waiting for founder review.</div></div></div><div class="panel-body">${items.length?`<div class="job-list">${items.map(b=>`<article class="job-card"><div class="job-card-head"><div class="job-brand-icon">⌂</div><div class="job-head-main"><div class="job-title">${escapeHtml(b.legal_name||b.owner_name)}</div><div class="job-business">${escapeHtml(b.owner_name)} · ${escapeHtml(b.email)}</div></div>${statusPill(b.verification_status)}</div><div class="job-meta"><span class="meta-chip">${escapeHtml(b.category)}</span><span class="meta-chip">⌖ ${escapeHtml(b.city||'City not added')}</span>${b.phone?`<span class="meta-chip">${escapeHtml(b.phone)}</span>`:''}</div><p class="application-note">${escapeHtml(b.description||'No business description supplied.')}</p><p class="application-note">${escapeHtml(b.address||'No business address supplied.')}</p><div class="job-card-bottom"><span class="job-business">Terms accepted: ${b.terms_accepted?'Yes':'No'}</span><div class="job-management-actions"><button class="btn btn-primary btn-sm" data-verify-business="${b.user_id}">Verify business ✓</button><button class="btn btn-danger btn-sm" data-reject-business="${b.user_id}">Reject</button></div></div></article>`).join('')}</div>`:emptyState('Verification queue is clear','New business accounts appear here until a founder reviews the profile. No fake verification records are seeded.','✓')}</div></div>`;
}
async function renderAdminJobs() {
  const result=await api('/api/admin/jobs?status_filter=all'); const items=result.items||[];
  return `${pageHeading('JOB QUALITY','Review live job listings.','Pause or close a problematic listing, and use the recorded business and shift details to investigate a report.', '<button class="btn btn-outline" data-screen="admin-audit">Audit history →</button>')}
  <div class="panel"><div class="panel-header"><div><h2 class="panel-title">Job inventory</h2><div class="panel-subtitle">${items.length} job records. Drafts are not public.</div></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Role / business</th><th>Location</th><th>Shift date</th><th>Gross pay</th><th>Status</th><th>Moderation</th></tr></thead><tbody>${items.length?items.map(j=>`<tr><td><b>${escapeHtml(j.title)}</b><small>${escapeHtml(j.business_name)} ${j.business_verified?'· verified':''}</small></td><td>${escapeHtml(j.city)}</td><td>${escapeHtml(formatDate(j.start_at))}</td><td>${formatMoney(j.pay_amount)}</td><td>${statusPill(j.status)}</td><td>${['published','paused','draft'].includes(j.status)?`<button class="btn btn-danger btn-sm" data-job-status="${j.id}" data-status="closed">Close listing</button>`:'—'}</td></tr>`).join(''):'<tr><td colspan="6">No job records yet.</td></tr>'}</tbody></table></div></div>`;
}
async function renderAdminDisputes() {
  const result=await api('/api/admin/disputes'); const items=result.items||[];
  return `${pageHeading('DISPUTE DESK','Review issues that need a human decision.','Read the reported reason, investigate the assignment history and document the resolution. Keep payout state separate from the dispute decision.', '<button class="btn btn-outline" data-screen="admin-audit">Audit history →</button>')}
  <div class="panel"><div class="panel-header"><div><h2 class="panel-title">Assignment disputes</h2><div class="panel-subtitle">${items.filter(d=>d.status==='open').length} open dispute${items.filter(d=>d.status==='open').length===1?'':'s'}.</div></div></div><div class="panel-body">${items.length?`<div class="job-list">${items.map(d=>`<article class="job-card"><div class="job-card-head"><div class="job-brand-icon">⚑</div><div class="job-head-main"><div class="job-title">${escapeHtml(d.job_title||'Assignment issue')}</div><div class="job-business">Reported by ${escapeHtml(d.reporter)} · ${escapeHtml(formatDate(d.created_at))}</div></div>${statusPill(d.status)}</div><p class="application-note">${escapeHtml(d.reason)}</p>${d.resolution_note?`<p class="application-note"><b>Resolution:</b> ${escapeHtml(d.resolution_note)}</p>`:''}${d.status==='open'?`<div class="job-card-bottom"><span class="job-business">Assignment #${d.assignment_id}</span><div class="job-management-actions"><button class="btn btn-primary btn-sm" data-resolve-dispute="${d.id}" data-status="resolved">Resolve</button><button class="btn btn-outline btn-sm" data-resolve-dispute="${d.id}" data-status="rejected">Close without change</button></div></div>`:''}</article>`).join('')}</div>`:emptyState('No disputes recorded','If a worker or business reports an assignment issue, it will be listed here for review.','⚑')}</div></div>`;
}
async function renderAdminAudit() {
  const result=await api('/api/admin/audit'); const items=result.items||[];
  return `${pageHeading('ACCOUNTABILITY','Audit history','Sensitive changes and lifecycle transitions are recorded with the actor and entity reference.', '<button class="btn btn-outline" data-screen="admin-overview">Back to overview →</button>')}
  <div class="panel"><div class="panel-header"><div><h2 class="panel-title">Recent audit events</h2><div class="panel-subtitle">Latest ${items.length} events.</div></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead><tbody>${items.length?items.map(e=>`<tr><td>${escapeHtml(formatDate(e.created_at))}</td><td>${escapeHtml(e.actor_user_id ?? 'Provider / system')}</td><td><b>${escapeHtml(e.action)}</b></td><td>${escapeHtml(e.entity_type)} #${escapeHtml(e.entity_id)}</td><td><small>${escapeHtml(JSON.stringify(e.detail||{}))}</small></td></tr>`).join(''):'<tr><td colspan="5">No events recorded yet.</td></tr>'}</tbody></table></div></div>`;
}
async function renderSupport() {
  const result = await api('/api/support/tickets/me');
  const items = result.items || [];
  let thread = '';
  if (activeSupportTicketId) {
    try {
      const response = await api('/api/support/tickets/' + activeSupportTicketId);
      const ticket = response.ticket;
      const messages = (ticket.messages || []).map(function(message) {
        return '<article class="er-support-message"><div class="er-support-message-head"><b>' +
          escapeHtml(message.sender_name) + '</b><small>' + escapeHtml(message.sender_role) + ' · ' +
          escapeHtml(formatDate(message.created_at)) + '</small></div><p>' +
          escapeHtml(message.message) + '</p></article>';
      }).join('');
      thread = '<section class="panel er-support-thread"><div class="panel-header"><div><h2 class="panel-title">Ticket #' +
        ticket.id + ' · ' + escapeHtml(ticket.subject) + '</h2><div class="panel-subtitle">' +
        statusPill(ticket.status) + '</div></div><button type="button" class="btn btn-outline btn-sm" data-support-open="' +
        ticket.id + '">Refresh thread ↻</button></div><div class="panel-body"><div class="er-support-messages">' +
        messages + '</div>' + (ticket.status !== 'closed'
          ? '<form id="support-reply-form" class="form-panel"><input type="hidden" name="ticket_id" value="' +
            ticket.id + '"><div class="form-field"><label for="support-reply-message">Add a reply</label><textarea id="support-reply-message" name="message" minlength="2" maxlength="4000" required placeholder="Write your reply or additional details"></textarea></div><div class="form-actions"><button class="btn btn-primary" type="submit">Send reply ↗</button></div></form>'
          : '<p class="form-help">This ticket is closed. Create a new ticket if you still need help.</p>') +
        '</div></section>';
    } catch (error) {
      thread = '<div class="callout-warning">' + escapeHtml(friendlyError(error)) + '</div>';
    }
  }
  const cards = items.length ? items.map(function(ticket) {
    return '<article class="job-card"><div class="job-card-head"><div class="job-brand-icon">?</div><div class="job-head-main"><div class="job-title">' +
      escapeHtml(ticket.subject) + '</div><div class="job-business">#' + ticket.id + ' · ' +
      escapeHtml(ticket.category) + ' · Updated ' + escapeHtml(formatDate(ticket.updated_at)) +
      '</div></div>' + statusPill(ticket.status) + '</div><p class="application-note">' +
      escapeHtml(ticket.latest_message || 'No messages yet.') + '</p><div class="job-card-bottom"><span class="job-business">' +
      ticket.message_count + ' message(s)</span><button type="button" class="btn btn-primary btn-sm" data-support-open="' +
      ticket.id + '">Open ticket →</button></div></article>';
  }).join('') : emptyState('No support tickets yet',
    'Create a ticket and the support team will respond in your account. Notifications will appear here when status changes.', '?');

  return pageHeading('HELP & SUPPORT', 'Tell us what you need help with.',
    'Create a private support ticket, follow replies and see its status in one place.',
    '<button class="btn btn-outline" data-screen="overview">Back to work →</button>') +
    '<form id="support-ticket-form" class="form-panel"><h2>New support ticket</h2><p>Do not include passwords, OTPs, full payment-card details or other highly sensitive information.</p><div class="form-grid">' +
    '<div class="form-field"><label for="support-subject">Subject *</label><input id="support-subject" name="subject" minlength="5" maxlength="140" required placeholder="Briefly describe the issue"></div>' +
    '<div class="form-field"><label for="support-category">Category</label><select id="support-category" name="category"><option value="account">Account</option><option value="payments">Payments</option><option value="shift">Shift or workplace</option><option value="safety">Safety concern</option><option value="technical">Technical problem</option><option value="other">Other</option></select></div>' +
    '<div class="form-field span-2"><label for="support-message">What happened? *</label><textarea id="support-message" name="message" minlength="20" maxlength="4000" required placeholder="Describe the issue and the steps already tried."></textarea><small class="form-help">A ticket is saved inside EarnRoute. Email delivery is not enabled until a real support email provider is configured.</small></div>' +
    '</div><div class="form-actions"><button class="btn btn-primary btn-large" type="submit">Create ticket ↗</button></div></form>' +
    thread + '<div class="panel"><div class="panel-header"><div><h2 class="panel-title">Your support tickets</h2><div class="panel-subtitle">' +
    items.length + ' ticket(s) · Latest activity first</div></div></div><div class="panel-body"><div class="job-list">' + cards + '</div></div></div>';
}

async function renderAdminSupport() {
  const result = await api('/api/admin/support/tickets');
  const items = result.items || [];
  let thread = '';
  if (activeAdminSupportTicketId) {
    try {
      const response = await api('/api/support/tickets/' + activeAdminSupportTicketId);
      const ticket = response.ticket;
      const messages = (ticket.messages || []).map(function(message) {
        return '<article class="er-support-message"><div class="er-support-message-head"><b>' +
          escapeHtml(message.sender_name) + '</b><small>' + escapeHtml(message.sender_role) + ' · ' +
          escapeHtml(formatDate(message.created_at)) + '</small></div><p>' +
          escapeHtml(message.message) + '</p></article>';
      }).join('');
      const statuses = ['open','in_progress','waiting_user','resolved','closed'].map(function(value) {
        return '<button type="button" class="btn btn-outline btn-sm" data-support-status="' + value +
          '" data-support-ticket-id="' + ticket.id + '">' + escapeHtml(value.replace(/_/g, ' ')) + '</button>';
      }).join('');
      thread = '<section class="panel er-support-thread"><div class="panel-header"><div><h2 class="panel-title">Ticket #' +
        ticket.id + ' · ' + escapeHtml(ticket.subject) + '</h2><div class="panel-subtitle">' +
        escapeHtml(ticket.requester_name) + ' · ' + escapeHtml(ticket.requester_email) + ' · ' +
        escapeHtml(ticket.requester_role) + ' · ' + statusPill(ticket.status) +
        '</div></div><button type="button" class="btn btn-outline btn-sm" data-admin-support-open="' +
        ticket.id + '">Refresh ↻</button></div><div class="panel-body"><div class="er-support-status-actions">' +
        statuses + '</div><div class="er-support-messages">' + messages + '</div>' +
        (ticket.status !== 'closed'
          ? '<form id="support-reply-form" class="form-panel"><input type="hidden" name="ticket_id" value="' +
            ticket.id + '"><div class="form-field"><label for="support-reply-message">Reply to user</label><textarea id="support-reply-message" name="message" minlength="2" maxlength="4000" required placeholder="Write the official support response"></textarea></div><div class="form-actions"><button class="btn btn-primary" type="submit">Send reply ↗</button></div></form>'
          : '<p class="form-help">This ticket is closed.</p>') + '</div></section>';
    } catch (error) {
      thread = '<div class="callout-warning">' + escapeHtml(friendlyError(error)) + '</div>';
    }
  }
  const openCount = items.filter(function(ticket) {
    return ['open','in_progress','waiting_user'].includes(ticket.status);
  }).length;
  const cards = items.length ? items.map(function(ticket) {
    return '<article class="job-card"><div class="job-card-head"><div class="job-brand-icon">?</div><div class="job-head-main"><div class="job-title">' +
      escapeHtml(ticket.subject) + '</div><div class="job-business">' + escapeHtml(ticket.requester_name) +
      ' · ' + escapeHtml(ticket.requester_email) + ' · #' + ticket.id + '</div></div>' +
      statusPill(ticket.status) + '</div><p class="application-note">' +
      escapeHtml(ticket.latest_message || 'No messages yet.') + '</p><div class="job-card-bottom"><span class="job-business">' +
      escapeHtml(ticket.category) + ' · ' + ticket.message_count + ' message(s)</span><button type="button" class="btn btn-primary btn-sm" data-admin-support-open="' +
      ticket.id + '">Open ticket →</button></div></article>';
  }).join('') : emptyState('No support tickets',
    'Tickets created by workers and businesses will appear here.', '?');

  return pageHeading('FOUNDER CONTROL', 'Support ticket queue',
    'Reply in-thread, change status and keep a record of every support interaction.',
    '<button class="btn btn-outline" data-screen="admin-overview">Back to admin →</button>') +
    '<div class="admin-banner"><span class="admin-banner-icon">?</span><div><h3>' + openCount +
    ' active ticket(s)</h3><p>These replies are in-app only. Configure an email provider before promising email delivery or response-time SLAs.</p></div></div>' +
    thread + '<div class="panel"><div class="panel-header"><div><h2 class="panel-title">All tickets</h2><div class="panel-subtitle">' +
    items.length + ' ticket(s) · Latest activity first</div></div></div><div class="panel-body"><div class="job-list">' +
    cards + '</div></div></div>';
}

function loadingButtons(button, isLoading) {
  if (!button) return;
  button.disabled = isLoading;
  if (isLoading) button.dataset.originalText = button.innerHTML;
  else if (button.dataset.originalText) { button.innerHTML = button.dataset.originalText; delete button.dataset.originalText; }
  if (isLoading) button.innerHTML = '<span class="loading-spinner tiny"></span> Please wait…';
}

// Authentication modal
function showAdminSignIn(message = '') {
  document.body.classList.add('admin-portal-mode');
  setLanding();
  openAuth('login', 'worker');
  if (message) {
    $('#auth-error').textContent = message;
    $('#auth-error').hidden = false;
  }
}
function openAuth(mode = 'login', role = 'worker') {
  if (isAdminPortal) mode = 'login';
  if (role) {
    const roleEl = $(`#auth-form input[name="role"][value="${role}"]`);
    if (roleEl) roleEl.checked = true;
  }
  setAuthMode(mode);
  $('#auth-modal').hidden = false;
  document.body.style.overflow = 'hidden';
  window.setTimeout(() => $('#auth-email').focus(), 50);
}
function closeAuth() {
  $('#auth-modal').hidden = true;
  document.body.style.overflow = '';
  $('#auth-error').hidden = true;
}
function setAuthMode(mode) {
  if (isAdminPortal) mode = 'login';
  authMode = mode;
  $('.auth-eyebrow').textContent = isAdminPortal ? 'EARNROUTE ADMIN CONSOLE' : 'A BETTER WAY TO WORK';
  $('#auth-heading').textContent = isAdminPortal ? 'Founder sign-in' : mode === 'login' ? 'Welcome back.' : 'Build your next step.';
  $('#auth-subheading').textContent = isAdminPortal ? 'Sign in with your authorised administrator account to manage the platform.' : mode === 'login' ? 'Sign in to continue to your workspace.' : 'Create a profile to discover or publish work.';
  $('#auth-mode-tabs').hidden = isAdminPortal;
  $('#close-auth').hidden = isAdminPortal;
  $('#name-field').hidden = mode === 'login';
  $('#role-field').hidden = mode === 'login';
  $('#terms-field').hidden = mode === 'login';
  const chosenRole = $('#auth-form input[name="role"]:checked')?.value || 'worker';
  $('#age-field').hidden = mode === 'login' || chosenRole !== 'worker';
  $('#auth-password').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  $('#auth-password').minLength = mode === 'login' ? 1 : 10;
  $('#password-hint').textContent = mode === 'login' ? 'Keep your password private.' : 'Use at least 10 characters.';
  $('#auth-submit').innerHTML = mode === 'login' ? 'Log in <span>↗</span>' : 'Create account <span>↗</span>';
  $$('[data-auth-mode]').forEach(el=>el.classList.toggle('active',el.dataset.authMode===mode));
  $('#auth-error').hidden = true;
}
async function submitAuth(form) {
  const data = new FormData(form);
  const button = $('#auth-submit');
  $('#auth-error').hidden = true;
  if (authMode === 'register' && String(data.get('password')||'').length < 10) {
    $('#auth-error').textContent = 'Use a password with at least 10 characters.'; $('#auth-error').hidden=false; return;
  }
  if (authMode === 'register' && !data.get('terms_accepted')) {
    $('#auth-error').textContent = 'Please accept the platform terms before creating an account.'; $('#auth-error').hidden=false; return;
  }
  if (authMode === 'register' && data.get('role') === 'worker' && !data.get('adult_confirmed')) {
    $('#auth-error').textContent = 'Workers must confirm that they are 18 or older.'; $('#auth-error').hidden=false; return;
  }
  loadingButtons(button, true);
  try {
    const payload = authMode === 'login'
      ? { email:data.get('email'), password:data.get('password') }
      : { email:data.get('email'), full_name:data.get('full_name'), password:data.get('password'), role:data.get('role'), terms_accepted:Boolean(data.get('terms_accepted')), adult_confirmed:Boolean(data.get('adult_confirmed')) };
    const result = await api(authMode === 'login' ? '/api/auth/login' : '/api/auth/register', {method:'POST',body:payload});
    if (isAdminPortal && result.user?.role !== 'admin') {
      throw new Error('This account does not have administrator access. Sign in with the authorised founder account.');
    }
    sessionStorage.setItem('earnroute_token', result.access_token);
    currentUser = result.user;
    closeAuth(); setWorkspace(currentUser);
    showToast(authMode === 'login' ? 'You’re signed in.' : 'Your account has been created. Complete your profile to get started.');
  } catch(error) {
    $('#auth-error').textContent = friendlyError(error); $('#auth-error').hidden = false;
  } finally { loadingButtons(button, false); }
}

function parseCommaList(value) { return String(value||'').split(',').map(x=>x.trim()).filter(Boolean).slice(0,30); }
function parseAvailability(value) {
  const days={mon:0,monday:0,tue:1,tuesday:1,wed:2,wednesday:2,thu:3,thursday:3,fri:4,friday:4,sat:5,saturday:5,sun:6,sunday:6};
  const rows=String(value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  return rows.map(row=>{
    const [day,start,end]=row.split(',').map(x=>x.trim());
    const d=days[String(day||'').toLowerCase()];
    if(d===undefined || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start||'') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end||'')) throw new Error(`Invalid availability: “${row}”. Use Mon,09:00,17:00.`);
    if(start>=end) throw new Error(`Availability start must be before end: “${row}”.`);
    return {day:d,start,end};
  });
}
function formObject(form) { return Object.fromEntries(new FormData(form).entries()); }
async function submitWorkerProfile(form) {
  const errorEl=$('#profile-form-error'); errorEl.hidden=true;
  try {
    const data=formObject(form);
    const availability=parseAvailability(data.availability);
    const result=await api('/api/worker/profile',{method:'PATCH',body:{city:data.city,skills:parseCommaList(data.skills),preferred_categories:parseCommaList(data.preferred_categories),availability,travel_radius_km:Number(data.travel_radius_km),min_pay:Number(data.min_pay||0),experience_years:Number(data.experience_years||0)}});
    currentUser=result.user; $('#workspace-context').textContent=currentUser.profile?.city||'Your work profile';
    showToast('Your work preferences have been saved.'); setActiveScreen('profile');
  } catch(error) { errorEl.textContent=friendlyError(error);errorEl.hidden=false; }
}
async function submitBusinessProfile(form) {
  const errorEl=$('#profile-form-error');errorEl.hidden=true;
  try {
    const data=formObject(form);
    const result=await api('/api/business/profile',{method:'PATCH',body:{legal_name:data.legal_name,category:data.category,city:data.city,address:data.address||'',phone:data.phone||'',description:data.description||''}});
    currentUser=result.user;$('#workspace-context').textContent=currentUser.profile?.legal_name||currentUser.full_name;
    showToast('Business details saved. Verification status is unchanged.');setActiveScreen('profile');
  } catch(error) {errorEl.textContent=friendlyError(error);errorEl.hidden=false;}
}
async function submitJob(form) {
  const errorEl=$('#job-form-error');errorEl.hidden=true;
  const btn=$('#save-job-btn');loadingButtons(btn,true);
  try {
    const d=formObject(form);
    const datetime = value => { const date=new Date(value); if(Number.isNaN(date.getTime())) throw new Error('Please enter valid dates and times.'); return date.toISOString(); };
    const payload={title:d.title,description:d.description,category:d.category,city:d.city,address:d.address||'',slots:Number(d.slots),start_at:datetime(d.start_at),end_at:datetime(d.end_at),pay_amount:Number(d.pay_amount),pay_basis:d.pay_basis,payment_terms:d.payment_terms,requirements:parseCommaList(d.requirements),min_experience:Number(d.min_experience||0),breaks_info:d.breaks_info||'',equipment_info:d.equipment_info||'',safety_info:d.safety_info||'',application_deadline:datetime(d.application_deadline),cancellation_policy:d.cancellation_policy,publish:$('#job-publish').checked};
    const result=await api('/api/jobs',{method:'POST',body:payload});
    showToast(payload.publish?'Job published.':'Draft saved.');
    setActiveScreen('business-jobs');
  } catch(error) {errorEl.textContent=friendlyError(error);errorEl.hidden=false;}
  finally {loadingButtons(btn,false);}
}
async function applyToJob(id, button) {
  loadingButtons(button,true);
  try { await api(`/api/jobs/${id}/apply`,{method:'POST',body:{note:''}});showToast('Application submitted. Track the status in Applications.'); if(activeScreen==='discover') setActiveScreen('applications'); else renderPage(); }
  catch(error){showToast(friendlyError(error),'error');loadingButtons(button,false);}
}
async function offerResponse(id, decision, button) {
  loadingButtons(button,true);
  try {await api(`/api/applications/${id}/respond`,{method:'POST',body:{decision}});showToast(decision==='accepted'?'Offer accepted. Your assignment is confirmed.':'Offer declined.');renderPage();}
  catch(error){showToast(friendlyError(error),'error');loadingButtons(button,false);}
}
async function actionApi(path, method='POST', body=undefined, success='Updated successfully.') {
  try {await api(path,{method,body});showToast(success);await renderPage();}
  catch(error){showToast(friendlyError(error),'error');}
}
async function showNotifications() {
  let panel=$('#notification-panel');
  if(panel){panel.remove();return;}
  try {
    const result=await api('/api/notifications'); const items=result.items||[];
    panel=document.createElement('div'); panel.id='notification-panel'; panel.className='notification-panel';
    panel.innerHTML=`<div class="panel-header"><div><h2 class="panel-title">Notifications</h2><div class="panel-subtitle">Recorded status updates for your account.</div></div><button class="icon-btn" data-close-notifications aria-label="Close notifications">×</button></div><div class="panel-body">${items.length?items.map(n=>`<button class="notification-item ${n.read?'read':''}" data-read-notification="${n.id}" style="display:flex;text-align:left;gap:10px;width:100%;padding:12px 0;border:0;border-bottom:1px solid #eef2ee;background:transparent;cursor:pointer"><span class="list-row-icon">${n.read?'✓':'•'}</span><span class="list-row-main"><b>${escapeHtml(n.title)}</b><small>${escapeHtml(n.body)}<br>${escapeHtml(formatDate(n.created_at))}</small></span></button>`).join(''):emptyState('No notifications','Application, offer, attendance and payment updates will be shown here.','♧')}</div>`;
    document.body.appendChild(panel); const unread=items.filter(i=>!i.read).length;$('#notification-count').hidden=!unread;
  } catch(error){showToast(friendlyError(error),'error');}
}

// Delegated UI actions keep controls functional after each screen renders.
document.addEventListener('click', async event => {
  const target=event.target.closest('button,a,[data-open-auth]');
  if(!target)return;
  if(target.dataset.openAuth){event.preventDefault();openAuth(target.dataset.openAuth,target.dataset.role||'worker');return;}
  if(target.dataset.authMode){setAuthMode(target.dataset.authMode);return;}
  if((target.id==='close-auth' || (target.classList.contains('modal-backdrop')&&target.id==='auth-modal')) && !isAdminPortal){closeAuth();return;}
  if(target.id==='logout-btn') {
    sessionStorage.removeItem('earnroute_token'); currentUser=null;
    if (isAdminPortal) showAdminSignIn('You have signed out. Sign in again to continue to the admin console.');
    else setLanding();
    showToast('You have signed out.'); return;
  }
  if(target.id==='mobile-menu'){ $('#sidebar').classList.toggle('mobile-open'); return; }
  if(target.id==='lang-btn' || target.hasAttribute('data-er-language-toggle')) {
    selectedLanguage=selectedLanguage==='en'?'hi':'en';
    try { localStorage.setItem('earnroute_language',selectedLanguage); } catch (_) {}
    sessionStorage.setItem('earnroute_language',selectedLanguage);
    document.documentElement.lang = selectedLanguage === 'hi' ? 'hi-IN' : 'en-IN';
    if(currentUser){buildNavigation();setWorkspace(currentUser);}
    else setLanguageButton();
    return;
  }
  if(target.id==='notifications-btn'){showNotifications();return;}
  if(target.dataset.closeNotifications!==undefined){$('#notification-panel')?.remove();return;}
  if(target.dataset.screen){event.preventDefault();setActiveScreen(target.dataset.screen);return;}
  if(target.dataset.supportOpen){activeSupportTicketId=Number(target.dataset.supportOpen);setActiveScreen('support');return;}
  if(target.dataset.adminSupportOpen){activeAdminSupportTicketId=Number(target.dataset.adminSupportOpen);setActiveScreen('admin-support');return;}
  if(target.dataset.supportStatus){
    const id=Number(target.dataset.supportTicketId);
    try {
      await api('/api/admin/support/tickets/'+id+'/status',{method:'PATCH',body:{status:target.dataset.supportStatus}});
      activeAdminSupportTicketId=id;
      showToast('Support ticket status updated.');
      await renderPage();
    } catch(error) { showToast(friendlyError(error),'error'); }
    return;
  }
  if(target.dataset.retry!==undefined){renderPage();return;}
  if(target.dataset.shareAssignment){
    try {
      const path = currentUser && currentUser.role === 'business' ? '/api/business/assignments' : '/api/assignments/me';
      const result = await api(path);
      const assignment = (result.items || []).find(item => String(item.id) === String(target.dataset.shareAssignment));
      if (!assignment) { showToast('This shift could not be found in your assignments.', 'error'); return; }
      const coordinates = assignment.latitude != null && assignment.longitude != null
        ? String(assignment.latitude) + ',' + String(assignment.longitude)
        : [assignment.address, assignment.city].filter(Boolean).join(', ');
      const directions = coordinates ? 'Directions: https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(coordinates) : '';
      const payment = currentUser && currentUser.role === 'business' ? assignment.gross_pay : assignment.net_pay;
      const payLabel = currentUser && currentUser.role === 'business' ? 'Gross shift pay' : 'Estimated worker pay';
      const message = [
        'EarnRoute shift details',
        'Shift: ' + (assignment.job_title || 'Local paid shift'),
        'Business: ' + (assignment.business_name || 'Local business'),
        'City: ' + (assignment.city || 'Not set'),
        'Workplace: ' + (assignment.address || 'Address to be confirmed'),
        'Start: ' + formatDate(assignment.start_at),
        payLabel + ': ' + formatMoney(payment),
        directions,
        'Shared from EarnRoute. Confirm the shift details with the other party before travelling.'
      ].filter(Boolean).join('\n');
      await shareEarnRouteText('EarnRoute shift details', message);
    } catch(error) { showToast(friendlyError(error), 'error'); }
    return;
  }
  if(target.dataset.applyJob){await applyToJob(Number(target.dataset.applyJob),target);return;}
  if(target.dataset.respondOffer){await offerResponse(Number(target.dataset.respondOffer),target.dataset.decision,target);return;}
  if(target.dataset.withdrawApp){if(!window.confirm('Withdraw this application? You cannot withdraw it after an offer is sent.'))return;await actionApi(`/api/applications/${target.dataset.withdrawApp}/withdraw`,'POST',undefined,'Application withdrawn.');return;}
  if(target.dataset.cancelAssignment){const reason=window.prompt('Cancellation note (optional):')||'';await actionApi(`/api/assignments/${target.dataset.cancelAssignment}/cancel`,'POST',{reason},'Assignment cancellation recorded and the other party notified.');return;}
  if(target.dataset.reviewAssignment){const ratingText=window.prompt('Rate the other participant from 1 to 5 stars:');if(ratingText===null)return;const rating=Number(ratingText);if(!Number.isInteger(rating)||rating<1||rating>5){showToast('Enter a whole-number rating from 1 to 5.','error');return;}const comment=window.prompt('Optional short review comment:')||'';await actionApi(`/api/reviews/assignments/${target.dataset.reviewAssignment}`,'POST',{rating,comment},'Review submitted.');return;}
  if(target.dataset.checkIn){await actionApi(`/api/assignments/${target.dataset.checkIn}/check-in`,'POST',undefined,'Check-in recorded. Follow any workplace instructions too.');return;}
  if(target.dataset.checkOut){await actionApi(`/api/assignments/${target.dataset.checkOut}/check-out`,'POST',undefined,'Check-out recorded. The business still needs to review completion.');return;}
  if(target.dataset.complete){await actionApi(`/api/assignments/${target.dataset.complete}/complete`,'POST',undefined,'Completion recorded. Payout remains pending until verified settlement.');return;}
  if(target.dataset.dispute){
    const reason=window.prompt('Briefly describe the assignment issue (at least 10 characters):');
    if(reason===null)return;
    await actionApi(`/api/assignments/${target.dataset.dispute}/dispute`,'POST',{reason},'Issue submitted for review.');return;
  }
  if(target.dataset.viewApplicants){activeApplicationJob=Number(target.dataset.viewApplicants);activeScreen='business-applicants';buildNavigation();await renderBusinessApplicants(activeApplicationJob).then(html=>{$('#view-root').innerHTML=html;$('#page-title').textContent=TITLES[activeScreen];});return;}
  if(target.dataset.publishJob){await actionApi(`/api/jobs/${target.dataset.publishJob}/publish`,'POST',undefined,'Job published and visible to eligible workers.');return;}
  if(target.dataset.jobStatus){await actionApi(`/api/jobs/${target.dataset.jobStatus}/status`,'PATCH',{status:target.dataset.status},`Job ${target.dataset.status}.`);return;}
  if(target.dataset.appStatus){await actionApi(`/api/applications/${target.dataset.appStatus}/status`,'PATCH',{status:target.dataset.status},`Application ${target.dataset.status}.`);return;}
  if(target.dataset.offer){await actionApi(`/api/applications/${target.dataset.offer}/offer`,'POST',undefined,'Offer sent to the worker.');return;}
  if(target.dataset.verifyBusiness){await actionApi(`/api/admin/businesses/${target.dataset.verifyBusiness}/verification`,'PATCH',{status:'verified',reason:'Verified by founder review.'},'Business marked verified.');return;}
  if(target.dataset.rejectBusiness){const reason=window.prompt('Enter the reason for rejection (at least 8 characters):');if(reason===null)return;if(reason.trim().length<8){showToast('Please provide a clear rejection reason.','error');return;}await actionApi(`/api/admin/businesses/${target.dataset.rejectBusiness}/verification`,'PATCH',{status:'rejected',reason},'Business verification rejected with a recorded reason.');return;}
  if(target.dataset.resolveDispute){const resolution_note=window.prompt(`Document why this dispute will be ${target.dataset.status} (at least 5 characters):`);if(resolution_note===null)return;if(resolution_note.trim().length<5){showToast('Please document your decision.','error');return;}await actionApi(`/api/admin/disputes/${target.dataset.resolveDispute}`,'PATCH',{status:target.dataset.status,resolution_note},'Dispute decision recorded in the audit history.');return;}
  if(target.dataset.readNotification){await actionApi(`/api/notifications/${target.dataset.readNotification}/read`,'POST',undefined,'Notification marked as read.');$('#notification-panel')?.remove();return;}
  if(target.id==='profile-btn'){setActiveScreen('profile');return;}
  if(target.getAttribute('href')==='#top' && currentUser){setActiveScreen('overview');return;}
});

document.addEventListener('submit', async event => {
  const form=event.target;
  if(form.id==='auth-form'){event.preventDefault();await submitAuth(form);return;}
  if(form.id==='discover-filter-form'){event.preventDefault();const d=formObject(form);const clean=Object.fromEntries(Object.entries(d).filter(([k,v])=>String(v).trim()));$('#view-root').innerHTML='<div class="loading-surface"><span class="loading-spinner"></span><span>Searching published opportunities…</span></div>';try{$('#view-root').innerHTML=await renderDiscover(clean);}catch(error){showToast(friendlyError(error),'error');}return;}
  if(form.id==='worker-profile-form'){event.preventDefault();await submitWorkerProfile(form);return;}
  if(form.id==='business-profile-form'){event.preventDefault();await submitBusinessProfile(form);return;}
  if(form.id==='support-ticket-form'){
    event.preventDefault();
    const data=formObject(form);
    try {
      const result=await api('/api/support/tickets',{method:'POST',body:data});
      activeSupportTicketId=result.ticket.id;
      showToast('Support ticket created.');
      await renderPage();
    } catch(error) { showToast(friendlyError(error),'error'); }
    return;
  }
  if(form.id==='support-reply-form'){
    event.preventDefault();
    const data=formObject(form);
    const ticketId=Number(data.ticket_id);
    try {
      await api('/api/support/tickets/'+ticketId+'/messages',{method:'POST',body:{message:data.message}});
      showToast('Support reply sent.');
      if(currentUser.role==='admin')activeAdminSupportTicketId=ticketId;else activeSupportTicketId=ticketId;
      await renderPage();
    } catch(error) { showToast(friendlyError(error),'error'); }
    return;
  }
  if(form.id==='job-form'){event.preventDefault();await submitJob(form);return;}
});
document.addEventListener('change',event=>{if(event.target.matches('#auth-form input[name="role"]'))setAuthMode(authMode);});
document.addEventListener('reset',event=>{if(event.target.id==='discover-filter-form')window.setTimeout(()=>setActiveScreen('discover'),10);});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){if(!isAdminPortal)closeAuth();$('#notification-panel')?.remove();$('#sidebar').classList.remove('mobile-open');}});

async function init() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('/static/sw.js').catch(()=>{});
  }
  setLanguageButton();
  const nativeAndroid = Boolean(window.EarnRouteNative && typeof window.EarnRouteNative.isAndroidApp === 'function' && window.EarnRouteNative.isAndroidApp());
  if (nativeAndroid) $$('[data-connect-server]').forEach(button => { button.hidden = false; });
  $$('[data-connect-server]').forEach(button => button.addEventListener('click', () => { try { window.EarnRouteNative?.openServerSettings?.(); } catch (_) { showToast('Open server settings from the app.', 'error'); } }));
  const token=sessionStorage.getItem('earnroute_token');
  if(!token){
    if(isAdminPortal) showAdminSignIn();
    else setLanding();
    return;
  }
  try {
    const data=await api('/api/auth/me');
    if(isAdminPortal && data.user?.role !== 'admin') {
      sessionStorage.removeItem('earnroute_token');
      showAdminSignIn('Your current account is not an administrator. Use the founder/admin account to continue.');
      return;
    }
    setWorkspace(data.user);
  } catch {
    sessionStorage.removeItem('earnroute_token');
    if(isAdminPortal) showAdminSignIn('Your session expired. Sign in again to open the admin console.');
    else setLanding();
  }
}
window.addEventListener('load', init, { once: true });


/* FULL-SCREEN HINDI LOCALIZATION
   Translate rendered interface text, form hints, accessible labels, dynamic empty states,
   notifications and prompts while leaving user-entered content and business/job names intact. */
const ER_HI_UI = Object.freeze({
  "WORKSPACE":"कार्य क्षेत्र","ACCOUNT":"अकाउंट","FOUNDER CONTROL":"संस्थापक कंट्रोल",
  "Overview":"डैशबोर्ड","Discover work":"काम खोजें","Applications":"आवेदन","My schedule":"मेरा शेड्यूल",
  "Earnings":"कमाई","My profile":"मेरी प्रोफ़ाइल","Post a shift":"शिफ्ट पोस्ट करें","Manage jobs":"काम मैनेज करें",
  "Applicants":"आवेदक","Assignments":"असाइनमेंट","Business verification":"बिज़नेस वेरिफ़िकेशन",
  "Disputes":"विवाद","Audit history":"ऑडिट हिस्ट्री","Sign out":"लॉग आउट",
  "Your work, organized around your life.":"आपका काम, आपकी ज़िंदगी के हिसाब से।",
  "Find shifts":"शिफ्ट खोजें","Edit profile":"प्रोफ़ाइल बदलें","Recommended for you":"आपके लिए सुझाया गया काम",
  "Upcoming assignments":"आने वाली शिफ्ट","Confirmed shifts":"पक्की हुई शिफ्ट","Completed work":"पूरा किया काम",
  "Pending settlement":"भुगतान लंबित","No published opportunities yet":"अभी कोई शिफ्ट प्रकाशित नहीं हुई",
  "New, verified opportunities will appear here when businesses publish genuine shifts. Try another category or check back later.":"बिज़नेस के असली काम प्रकाशित होने पर वे यहाँ दिखेंगे। दूसरी कैटेगरी चुनें या बाद में फिर देखें।",
  "My account":"मेरा अकाउंट","Worker":"वर्कर","Business":"बिज़नेस","Admin":"एडमिन",
  "Founder console":"संस्थापक कंसोल","Your work profile":"आपकी वर्क प्रोफ़ाइल","Your work profile, organized around your life.":"आपका काम, आपकी ज़िंदगी के हिसाब से।",
  "Home":"होम","Nearby":"आस-पास","Applied":"आवेदन","Schedule":"शेड्यूल","Post":"पोस्ट करें",
  "Shifts":"शिफ्ट","People":"लोग","Work":"काम","Verify":"वेरिफ़ाई","Issues":"समस्याएँ","Audit":"ऑडिट",
  "Your work":"आपका काम","Nearby work":"आस-पास का काम","Your workspace":"आपका कार्य क्षेत्र","Overview":"डैशबोर्ड",
  "Page not found":"यह पेज नहीं मिला","Use the navigation to open a workspace section.":"किसी दूसरे सेक्शन को खोलने के लिए नीचे दिए नेविगेशन का इस्तेमाल करें।",
  "We couldn’t load this page":"यह पेज लोड नहीं हो पाया","Try again ↻":"दोबारा कोशिश करें ↻",
  "Loading your workspace…":"आपका वर्कस्पेस लोड हो रहा है…","Searching published opportunities…":"प्रकाशित काम खोजे जा रहे हैं…",
  "Notifications":"सूचनाएँ","Recorded status updates for your account.":"आपके अकाउंट के काम और स्टेटस की सूचनाएँ।",
  "No notifications":"अभी कोई सूचना नहीं","Application, offer, attendance and payment updates will be shown here.":"आवेदन, ऑफ़र, उपस्थिति और भुगतान से जुड़ी सूचनाएँ यहाँ दिखेंगी।",
  "Close notifications":"सूचनाएँ बंद करें","Change language":"भाषा बदलें","Open navigation":"नेविगेशन खोलें",
  "Work close.":"पास में काम।","Earn with confidence.":"भरोसे के साथ कमाएँ।",
  "Find genuine paid shifts near you. Check the distance, hours and estimated take-home before you apply.":"अपने पास असली भुगतान वाली शिफ्ट खोजें। आवेदन से पहले दूरी, समय और अनुमानित कमाई देखें।",
  "MADE FOR YOUR NEIGHBOURHOOD":"आपके आस-पास के काम के लिए","NEARBY WORK":"आस-पास काम",
  "WORK, CLOSER TO HOME":"घर के पास काम","How far can you travel?":"आप कितनी दूर तक जा सकते हैं?",
  "Start small. Stay close to home.":"कम दूरी से शुरू करें, घर के पास रहें।",
  "Find nearby work":"पास का काम खोजें","I’m hiring for a shift":"मुझे शिफ्ट के लिए लोग चाहिए",
  "Already on EarnRoute?":"पहले से EarnRoute पर हैं?","Log in":"लॉग इन करें",
  "Opportunities depend on jobs actually published in your area. Earnings and work are not guaranteed.":"काम तभी दिखेगा जब आपके इलाके में शिफ्ट प्रकाशित होगी। काम या कमाई की गारंटी नहीं है।",
  "Illustration only · Real shifts load after sign-in":"सिर्फ़ उदाहरण · असली शिफ्ट लॉग इन के बाद दिखेंगी",
  "your chosen area":"आपका चुना हुआ इलाका","See pay upfront":"भुगतान पहले देखें","Clear terms. Your choice.":"शर्तें साफ़, फैसला आपका।",
  "options":"विकल्प","More":"और दूरी","km":"किमी","POPULAR":"लोकप्रिय",
  "LOCAL GIGS · CLEAR PAY":"पास का काम · साफ़ भुगतान","YOUR NEIGHBOURHOOD":"आपका आस-पास का इलाका",
  "Work around you":"आपके आस-पास काम","Closest first. Pay shown up front. One-tap apply.":"पहले सबसे नज़दीक की शिफ्ट। भुगतान साफ़। एक टैप में आवेदन।",
  "How far can you go?":"आप कितनी दूर जा सकते हैं?","Choose work type":"काम का प्रकार चुनें",
  "Choose category":"कैटेगरी चुनें","Browse nearby →":"पास का काम देखें →",
  "Find work close to you.":"अपने पास काम खोजें।","Find a gig close to you.":"अपने पास काम खोजें।",
  "Hi ":"नमस्ते ","Let’s earn nearby.":"चलिए, पास में कमाई करें।",
  "Short shifts, local gigs and paid help up to 15 km away. Less travel, more time back.":"15 किमी तक की छोटी शिफ्ट और स्थानीय काम। कम सफ़र, अपने लिए ज़्यादा समय।",
  "START WITH YOUR AREA":"अपने इलाके से शुरू करें","Earn closer to home.":"घर के पास कमाएँ।",
  "Turn on location to find real paid shifts within 1 km, 3 km, 5 km or more (up to 15 km). Your live position stays on this device and expires after 30 minutes.":"1, 3, 5 किमी या अधिक (15 किमी तक) की असली भुगतान वाली शिफ्ट खोजने के लिए लोकेशन चालू करें। आपकी लोकेशन इसी डिवाइस पर रहती है और 30 मिनट में हट जाती है।",
  "Use my location":"मेरी लोकेशन इस्तेमाल करें","Finding your location…":"आपकी लोकेशन ढूँढ रहे हैं…",
  "Location ready. Showing only nearby shifts.":"लोकेशन मिल गई। अब सिर्फ़ आस-पास की शिफ्ट दिखेंगी।",
  "Refresh location":"लोकेशन फिर से लें","Refresh my location":"लोकेशन अपडेट करें","Find jobs near me":"मेरे पास काम खोजें",
  "Your location is only used to find nearby work":"आपकी लोकेशन सिर्फ़ पास का काम ढूँढने के लिए इस्तेमाल होती है",
  "Location is only used to find nearby work":"लोकेशन सिर्फ़ पास का काम ढूँढने के लिए इस्तेमाल होती है",
  "Your live position stays on this device and expires after 30 minutes.":"आपकी लोकेशन इसी डिवाइस पर रहती है और 30 मिनट में हट जाती है।",
  "Location permission was denied. Enable location permission for EarnRoute, then try again.":"लोकेशन की अनुमति नहीं मिली। EarnRoute की सेटिंग में लोकेशन अनुमति चालू करके फिर कोशिश करें।",
  "Your location is unavailable. Turn on device location services and try again.":"लोकेशन उपलब्ध नहीं है। डिवाइस की लोकेशन चालू करके फिर कोशिश करें।",
  "Location took too long. Move near a window or try again.":"लोकेशन मिलने में देर हुई। खिड़की के पास जाकर या फिर से कोशिश करें।",
  "This device cannot share its location. Open EarnRoute in a location-enabled browser.":"यह डिवाइस लोकेशन साझा नहीं कर पा रहा। लोकेशन चालू ब्राउज़र में EarnRoute खोलें।",
  "Could not get your location. Please try again.":"आपकी लोकेशन नहीं मिल सकी। फिर कोशिश करें।",
  "No shifts inside 1 km yet":"1 किमी के अंदर अभी कोई शिफ्ट नहीं है",
  "No shifts in this radius yet":"इस दूरी के अंदर अभी कोई शिफ्ट नहीं है",
  "Try a wider radius using More (up to 15 km). Jobs without a workplace pin stay hidden rather than showing a made-up distance.":"More से दूरी बढ़ाकर 15 किमी तक देखें। सही वर्कप्लेस पिन न होने पर काम छिपा रहेगा, गलत दूरी नहीं दिखाई जाएगी।",
  "Only jobs with a real workplace pin are shown. Expand the distance or try another category.":"सिर्फ़ असली वर्कप्लेस पिन वाली शिफ्ट दिखती हैं। दूरी बढ़ाएँ या दूसरी कैटेगरी चुनें।",
  "Try a wider range or another category.":"दूरी बढ़ाकर या दूसरी कैटेगरी चुनकर देखें।",
  "You’re already at the widest radius. Try another work category or check back later.":"आप सबसे ज़्यादा दूरी पर हैं। दूसरी कैटेगरी चुनें या बाद में फिर देखें।",
  "Look within ":"इस दूरी में देखें: ","Expand to ":"दूरी बढ़ाएँ: ",
  "Browse nearby":"पास का काम देखें","No shifts yet":"अभी कोई शिफ्ट नहीं",
  "GROSS / SHIFT":"कुल भुगतान / शिफ्ट","EST. YOU RECEIVE":"आपको अनुमानित मिलेगा",
  "before platform fee":"प्लेटफ़ॉर्म शुल्क से पहले","after estimated fee":"अनुमानित शुल्क के बाद",
  "Apply now":"अभी आवेदन करें","Profile needed":"प्रोफ़ाइल पूरी करें","Details":"विवरण",
  "Workplace:":"काम की जगह:","Skills:":"ज़रूरी कौशल:","Apply by:":"आवेदन की आख़िरी तारीख:","Payment:":"भुगतान:","Confirm terms before accepting.":"स्वीकार करने से पहले शर्तें पक्की करें।",
  "Distance is straight-line GPS distance, not driving distance or ETA. Take-home pay is an estimate, not payment confirmation.":"दूरी सीधे GPS के हिसाब से है, सड़क की दूरी या पहुँचने का समय नहीं। कमाई अनुमान है, भुगतान की पुष्टि नहीं।",
  "Open workplace in Maps ↗":"मैप में काम की जगह खोलें ↗","Search workplace in Maps ↗":"मैप में काम की जगह खोजें ↗","Navigate to workplace ↗":"काम की जगह का रास्ता देखें ↗",
  "Delivery":"डिलीवरी","Retail":"रिटेल","Events":"इवेंट","Warehouse":"गोदाम","Hospitality":"हॉस्पिटैलिटी","Other":"अन्य",
  "All":"सभी","Search a local gig":"पास का काम खोजें","Min pay ₹":"न्यूनतम भुगतान ₹","Search":"खोजें","Clear":"हटाएँ",
  "Distance limit":"दूरी की सीमा","Work type":"काम का प्रकार","Using device location · ":"डिवाइस लोकेशन इस्तेमाल हो रही है · ",
  " shifts · closest first":" शिफ्ट · पहले नज़दीकी काम"," shift":" शिफ्ट"," shifts":" शिफ्ट",
  "Your city *":"आपका शहर *","Preferred travel radius":"पसंदीदा दूरी","Your skills (comma-separated)":"आपके कौशल (कॉमा से अलग करें)",
  "Preferred work categories (comma-separated)":"पसंदीदा काम की कैटेगरी (कॉमा से अलग करें)",
  "Minimum preferred gross pay per shift (INR)":"हर शिफ्ट का न्यूनतम कुल भुगतान (₹)",
  "Relevant experience (years)":"संबंधित अनुभव (वर्ष)","Weekly availability windows *":"हफ़्ते में उपलब्ध समय *",
  "Save preferences ↗":"पसंद सेव करें ↗","Save preferences":"पसंद सेव करें","Save business details ↗":"बिज़नेस की जानकारी सेव करें ↗",
  "Business / legal name *":"बिज़नेस / कानूनी नाम *","Business category":"बिज़नेस की कैटेगरी","Business phone":"बिज़नेस फ़ोन",
  "Business address":"बिज़नेस का पता","Description":"विवरण","City *":"शहर *","Business details":"बिज़नेस की जानकारी",
  "Work preferences":"काम की पसंद","Help the matcher understand you.":"अपने बारे में सही जानकारी दें।",
  "Keep your preferences honest and up to date. You choose whether to apply for or accept any opportunity.":"अपनी जानकारी सही और अपडेट रखें। किस काम के लिए आवेदन करना है, इसका फैसला आपका है।",
  "These details are used for explainable recommendations. Do not include Aadhaar, bank credentials or other unnecessary sensitive information.":"इन जानकारियों से काम सुझाए जाते हैं। आधार, बैंक पासवर्ड या दूसरी ज़रूरत से ज़्यादा निजी जानकारी न डालें।",
  "Use Mon, Tue, Wed, Thu, Fri, Sat or Sun followed by a start and end time in 24-hour format. Example: Wed,09:00,16:00. A window must cover the full shift.":"Mon, Tue, Wed, Thu, Fri, Sat या Sun के साथ 24-घंटे का शुरू और खत्म होने का समय लिखें। उदाहरण: Wed,09:00,16:00। समय पूरी शिफ्ट को कवर करना चाहिए।",
  "Save a draft or publish a genuine paid shift once the business profile is verified.":"बिज़नेस वेरिफ़ाई होने के बाद असली भुगतान वाली शिफ्ट का ड्राफ़्ट सेव या प्रकाशित करें।",
  "Exact workplace pin":"काम की जगह का सटीक पिन","Required to publish":"प्रकाशित करने के लिए ज़रूरी",
  "Workplace location not set":"काम की जगह की लोकेशन सेट नहीं है","Set pin from here":"यहाँ का पिन सेट करें",
  "Set workplace pin":"वर्कप्लेस पिन सेट करें","Publish":"प्रकाशित करें","Pause":"रोकें","Close":"बंद करें",
  "Post your first shift →":"अपनी पहली शिफ्ट पोस्ट करें →","Shift management":"शिफ्ट मैनेजमेंट",
  "Your local shifts.":"आपकी स्थानीय शिफ्ट।","Jobs and drafts":"शिफ्ट और ड्राफ़्ट",
  "No shifts yet":"अभी कोई शिफ्ट नहीं","Post a genuine paid shift and set its workplace pin so local workers can find it.":"असली भुगतान वाली शिफ्ट पोस्ट करें और उसका वर्कप्लेस पिन सेट करें ताकि पास के लोग उसे देख सकें।",
  "Applicants for selected job":"चुनी हुई शिफ्ट के आवेदक","All applicants":"सभी आवेदक","Shortlist":"शॉर्टलिस्ट करें","Reject":"रिजेक्ट करें","Send offer":"ऑफ़र भेजें",
  "No applications in this view":"यहाँ कोई आवेदन नहीं","Skills not added yet":"अभी कौशल नहीं जोड़े","No reviews yet":"अभी कोई रिव्यू नहीं",
  "Received ":"मिला: ","Created ":"बनाया गया: ","Deadline ":"आख़िरी तारीख: ","Created on ":"बनने की तारीख: ",
  "Apply":"आवेदन करें","Withdraw":"वापस लें","Withdraw application":"आवेदन वापस लें",
  "Withdraw this application? You cannot withdraw it after an offer is sent.":"क्या आवेदन वापस लेना है? ऑफ़र आने के बाद आवेदन वापस नहीं लिया जा सकता।",
  "Rate the other participant from 1 to 5 stars:":"दूसरे व्यक्ति को 1 से 5 स्टार दें:",
  "Enter a whole-number rating from 1 to 5.":"1 से 5 के बीच पूरा अंक चुनें।",
  "Cancellation note (optional):":"रद्द करने का कारण (ज़रूरी नहीं):",
  "Enter the reason for rejection (at least 8 characters):":"रिजेक्शन का कारण लिखें (कम-से-कम 8 अक्षर):",
  "Please provide a clear rejection reason.":"कृपया रिजेक्शन का साफ़ कारण दें।",
  "Please document your decision.":"कृपया अपना फैसला दर्ज करें।",
  "Document why this dispute will be ":"लिखें कि इस विवाद का फैसला क्यों किया जा रहा है: ",
  "Report a problem":"समस्या रिपोर्ट करें","Check in":"शिफ्ट शुरू करें","Check out":"शिफ्ट खत्म करें",
  "Cancel":"रद्द करें","Cancel assignment":"असाइनमेंट रद्द करें","Cancel shift":"शिफ्ट रद्द करें",
  "Approve completion":"काम पूरा होने की पुष्टि करें","Rate business":"बिज़नेस को रेट करें","Rate worker":"वर्कर को रेट करें",
  "Workplace, instructions and terms":"काम की जगह, निर्देश और शर्तें","Location:":"लोकेशन:",
  "Review shift instructions before arrival":"पहुँचने से पहले शिफ्ट के निर्देश पढ़ें",
  "Waiting for worker check-out":"वर्कर के शिफ्ट खत्म करने का इंतज़ार है",
  "Assigned":"असाइन हुआ","Applied":"आवेदन किया","Shortlisted":"शॉर्टलिस्ट हुआ","Offer received":"ऑफ़र मिला",
  "Accepted":"स्वीकार किया","Declined":"मना किया","Withdrawn":"वापस लिया","Rejected":"रिजेक्ट हुआ",
  "Confirmed":"पुष्टि हुई","Checked in":"शिफ्ट शुरू","Checked out":"शिफ्ट खत्म","Completed":"पूरा हुआ",
  "Cancelled":"रद्द","Disputed":"विवाद में","Pending":"लंबित","Verified":"वेरिफ़ाइड","Published":"प्रकाशित",
  "Draft":"ड्राफ़्ट","Paused":"रोका गया","Closed":"बंद","Paid":"भुगतान हो गया","Not due":"अभी देय नहीं",
  "Completed assignment":"पूरा हुआ असाइनमेंट","Pending settlement":"भुगतान लंबित","Verified paid":"भुगतान की पुष्टि",
  "Recognized platform revenue":"प्लेटफ़ॉर्म की दर्ज कमाई","Active workers":"सक्रिय वर्कर",
  "Verified businesses":"वेरिफ़ाइड बिज़नेस","Published jobs":"प्रकाशित शिफ्ट","Assignments":"असाइनमेंट",
  "Open disputes":"खुले विवाद","Business accounts":"बिज़नेस अकाउंट","What to review":"क्या जाँचना है",
  "Metric definitions":"मेट्रिक की जानकारी","Revenue is not transaction volume":"कमाई और कुल लेन-देन अलग हैं",
  "Pending verification":"वेरिफ़िकेशन बाकी","Verification queue is clear":"वेरिफ़िकेशन की कतार खाली है",
  "New business accounts appear here until a founder reviews the profile. No fake verification records are seeded.":"नए बिज़नेस अकाउंट यहाँ दिखेंगे जब तक संस्थापक उनकी जाँच नहीं करते। कोई नकली वेरिफ़िकेशन रिकॉर्ड नहीं है।",
  "Review job listings":"काम की लिस्टिंग जाँचें","Job inventory":"शिफ्ट की सूची","No job records yet.":"अभी कोई शिफ्ट रिकॉर्ड नहीं है।",
  "Dispute desk":"विवाद डेस्क","Assignment disputes":"असाइनमेंट से जुड़े विवाद","No disputes recorded":"अभी कोई विवाद दर्ज नहीं",
  "Recent audit events":"हाल की ऑडिट गतिविधियाँ","No events recorded yet.":"अभी कोई गतिविधि दर्ज नहीं",
  "Resolve":"हल करें","Close without change":"बिना बदलाव बंद करें","View audit history →":"ऑडिट हिस्ट्री देखें →",
  "Back to overview →":"डैशबोर्ड पर वापस जाएँ →","Back to jobs →":"शिफ्ट पर वापस जाएँ →",
  "Open queue →":"कतार खोलें →","Review →":"जाँचें →","Open jobs →":"शिफ्ट खोलें →",
  "Application sent.":"आवेदन भेज दिया गया।","Application withdrawn.":"आवेदन वापस ले लिया गया।",
  "Assignment cancellation recorded and the other party notified.":"असाइनमेंट रद्द हुआ और दूसरे व्यक्ति को सूचना भेज दी गई।",
  "Job published and visible to eligible workers.":"शिफ्ट प्रकाशित कर दी गई है और योग्य वर्कर इसे देख सकते हैं।",
  "Job paused.":"शिफ्ट रोक दी गई।","Job closed.":"शिफ्ट बंद कर दी गई।",
  "Offer sent to the worker.":"वर्कर को ऑफ़र भेज दिया गया।","Business marked verified.":"बिज़नेस वेरिफ़ाइड मार्क किया गया।",
  "Business verification rejected with a recorded reason.":"कारण दर्ज करके बिज़नेस वेरिफ़िकेशन अस्वीकार किया गया।",
  "Dispute decision recorded in the audit history.":"विवाद का फैसला ऑडिट हिस्ट्री में दर्ज हो गया।",
  "Notification marked as read.":"सूचना पढ़ी गई मार्क कर दी गई।",
  "Updated successfully.":"सफलतापूर्वक अपडेट हुआ।","Please wait…":"कृपया इंतज़ार करें…",
  "Something went wrong. Please try again.":"कुछ गड़बड़ हुई। कृपया फिर कोशिश करें।",
  "Cannot reach EarnRoute right now. Check your connection and try again.":"अभी EarnRoute से संपर्क नहीं हो पा रहा। इंटरनेट जाँचकर फिर कोशिश करें।",
  "Connect the deployed EarnRoute server before creating an account or loading live work.":"अकाउंट बनाने या असली काम देखने से पहले EarnRoute सर्वर कनेक्ट करें।",
  "Unexpected server response.":"सर्वर से अनपेक्षित जवाब मिला।",
  "Email or password is incorrect.":"ईमेल या पासवर्ड गलत है।",
  "This opportunity is not available.":"यह काम अब उपलब्ध नहीं है।",
  "Business verification is required before publishing jobs. Save it as a draft while verification is pending.":"शिफ्ट प्रकाशित करने से पहले बिज़नेस वेरिफ़िकेशन ज़रूरी है। जाँच पूरी होने तक ड्राफ़्ट सेव करें।",
  "Set the workplace pin first. Workers only see shifts inside their selected radius, up to 15 km of the real pin.":"पहले काम की जगह का पिन सेट करें। वर्कर असली पिन के आस-पास चुनी दूरी (15 किमी तक) में ही शिफ्ट देखेंगे।",
  "Set the workplace pin first. Workers only see shifts inside 1 km, 3 km or 5 km of the real pin.":"पहले काम की जगह का पिन सेट करें। वर्कर असली पिन के पास की शिफ्ट ही देखेंगे।",
  "Set the workplace pin first.":"पहले काम की जगह का पिन सेट करें।",
  "Please enter valid dates and times.":"कृपया सही तारीख और समय भरें।",
  "The workplace pin is required to publish this shift.":"यह शिफ्ट प्रकाशित करने के लिए वर्कप्लेस पिन ज़रूरी है।",
  "Server not connected":"सर्वर कनेक्ट नहीं है","Could not load nearby jobs":"आस-पास का काम लोड नहीं हो पाया",
  "Nearby work did not load":"आस-पास का काम लोड नहीं हुआ","Could not load this page":"यह पेज लोड नहीं हुआ",
  "Try another category or check back later.":"दूसरी कैटेगरी चुनें या बाद में फिर देखें।",
  "Please provide a valid reason.":"कृपया सही कारण लिखें।","Page not found":"पेज नहीं मिला",
  "A role cannot view this resource.":"इस भूमिका को यह जानकारी देखने की अनुमति नहीं है।",
  "Founder access is active":"संस्थापक का एक्सेस चालू है",
  "Founder access":"संस्थापक एक्सेस","FOUNDER CONTROL PANEL":"संस्थापक कंट्रोल पैनल",
  "Know what needs your attention.":"जानें कि किस पर ध्यान देना है।",
  "Review platform operations, verification requests, reported issues and settlement exceptions without changing data from a client-side role toggle.":"प्लेटफ़ॉर्म, वेरिफ़िकेशन, रिपोर्ट की गई समस्याएँ और भुगतान की जाँच करें। सिर्फ़ स्क्रीन से भूमिका बदलकर डेटा में बदलाव नहीं किया जा सकता।",
  "Only mark a business verified after checks appropriate to your actual process. A profile being verified by this platform is not a government endorsement or a safety guarantee.":"अपने जाँच-प्रक्रिया के अनुसार जाँच करने के बाद ही बिज़नेस वेरिफ़ाइड करें। प्लेटफ़ॉर्म वेरिफ़िकेशन सरकारी मंज़ूरी या सुरक्षा की गारंटी नहीं है।",
  "Review the relevant skills and work preferences shared by applicants. Send offers only when shift terms and capacity are still correct.":"आवेदक के कौशल और काम की पसंद देखें। शर्तें और सीटें पक्की होने पर ही ऑफ़र भेजें।",
  "Keep business contact and location details accurate. Documents and private verification uploads are not enabled in this starter release.":"बिज़नेस की संपर्क और लोकेशन जानकारी सही रखें। इस रिलीज़ में दस्तावेज़ अपलोड और निजी वेरिफ़िकेशन उपलब्ध नहीं हैं।",
  "Verification status:":"वेरिफ़िकेशन स्थिति:",
  "Help the matcher understand you.":"अपने बारे में सही जानकारी दें।",
  "Profile needed":"प्रोफ़ाइल पूरी करें","Skills not added yet":"कौशल अभी नहीं जोड़े गए","City not added":"शहर नहीं जोड़ा गया",
  "No applications in this view":"यहाँ कोई आवेदन नहीं","No shifts in this radius yet":"इस दूरी के भीतर कोई शिफ्ट नहीं",
  "Show more":"और दिखाएँ","Show less":"कम दिखाएँ","Open in Maps":"मैप में खोलें",
  "Application status":"आवेदन की स्थिति","Shift details":"शिफ्ट की जानकारी","Workplace pin":"वर्कप्लेस पिन",
  "Exact workplace pin":"काम की जगह का सही पिन","Workplace location not set":"काम की जगह सेट नहीं है",
  "Set pin from here":"यहाँ का पिन सेट करें","Publishing is locked until an admin verifies the business.":"एडमिन वेरिफ़ाई करने तक शिफ्ट प्रकाशित नहीं की जा सकती।",
  "No shifts yet":"अभी कोई शिफ्ट नहीं","Post a shift":"शिफ्ट पोस्ट करें","Use your device location":"डिवाइस की लोकेशन इस्तेमाल करें",
  "Gross pay":"कुल भुगतान","Net payable":"देय कमाई","Payment:":"भुगतान:",
  "Apply by:":"आवेदन की आख़िरी तारीख:","GROSS / SHIFT":"कुल भुगतान / शिफ्ट",
  "EST. YOU RECEIVE":"आपको अनुमानित मिलेगा","Open workplace in Maps ↗":"मैप में काम की जगह खोलें ↗",
  "Not set":"तय नहीं","All applicants":"सभी आवेदक","Account":"अकाउंट",
  "Are you sure?":"क्या आप पक्का करना चाहते हैं?","Withdraw this application?":"क्या आवेदन वापस लेना है?",
  "No jobs yet":"अभी कोई काम नहीं","Try again":"फिर कोशिश करें","Reset":"रीसेट करें","Save":"सेव करें","Update":"अपडेट करें",
  "Next":"आगे","Back":"वापस","Continue":"जारी रखें","Finish":"पूरा करें","Required":"ज़रूरी",
  "Optional":"वैकल्पिक","Loading…":"लोड हो रहा है…","Loading your workspace…":"आपका वर्कस्पेस लोड हो रहा है…",
  "Request failed":"अनुरोध पूरा नहीं हुआ","Account created.":"अकाउंट बन गया।","You have signed out.":"आप लॉग आउट हो गए हैं।",
  "Application status updated.":"आवेदन की स्थिति अपडेट हुई।","Shift posted.":"शिफ्ट पोस्ट हो गई।",
  "Share shift ↗":"शिफ्ट साझा करें ↗","Share shift details":"शिफ्ट की जानकारी साझा करें","Share shift":"शिफ्ट साझा करें",
  "Choose an app to share these shift details.":"शिफ्ट की जानकारी साझा करने के लिए ऐप चुनें।",
  "Shift details copied. You can paste them into a message.":"शिफ्ट की जानकारी कॉपी हो गई। इसे संदेश में पेस्ट कर सकते हैं।",
  "Could not share these shift details.":"शिफ्ट की जानकारी साझा नहीं हो सकी।",
  "EarnRoute shift details":"EarnRoute शिफ्ट की जानकारी","Preparing shift details…":"शिफ्ट की जानकारी तैयार हो रही है…",
  "This shift is no longer available.":"यह शिफ्ट अब उपलब्ध नहीं है।",
  "Confirm the shift details with the other party before travelling.":"सफ़र से पहले दूसरे पक्ष से शिफ्ट की जानकारी पक्की कर लें।",
  "Gross shift pay":"शिफ्ट का कुल भुगतान","Estimated worker pay":"वर्कर की अनुमानित कमाई",
  "Directions:":"रास्ता:","Category:":"कैटेगरी:","Business:":"बिज़नेस:","City:":"शहर:","Start:":"शुरू:","Distance:":"दूरी:",
  "straight-line":"सीधी दूरी","Expand to ":"दूरी बढ़ाएँ: ","km radius":"किमी की दूरी","km away":"किमी दूर",
  "Share shift details with a trusted contact.":"शिफ्ट की जानकारी किसी भरोसेमंद व्यक्ति के साथ साझा करें।",
  "Help & support":"सहायता और सपोर्ट",
  "Support tickets":"सपोर्ट टिकट",
  "New support ticket":"नया सपोर्ट टिकट",
  "Tell us what you need help with.":"बताएँ कि आपको किस चीज़ में मदद चाहिए।",
  "Create a private support ticket, follow replies and see its status in one place.":"निजी सपोर्ट टिकट बनाएँ, जवाब देखें और उसकी स्थिति एक ही जगह पर जानें।",
  "Your support tickets":"आपके सपोर्ट टिकट",
  "What happened?":"क्या हुआ?",
  "Add a reply":"जवाब जोड़ें",
  "Send reply":"जवाब भेजें",
  "Reply to user":"यूज़र को जवाब दें",
  "Support ticket queue":"सपोर्ट टिकट कतार",
  "Open ticket":"टिकट खोलें",
  "Active ticket(s)":"सक्रिय टिकट",
  "Open":"खुला",
  "In progress":"काम जारी",
  "Waiting for user":"यूज़र के जवाब का इंतज़ार",
  "Resolved":"हल हुआ",
  "Closed":"बंद",
  "Payments":"भुगतान",
  "Shift or workplace":"शिफ्ट या काम की जगह",
  "Safety concern":"सुरक्षा संबंधी समस्या",
  "Technical problem":"तकनीकी समस्या",
  "A ticket is saved inside EarnRoute. Email delivery is not enabled until a real support email provider is configured.":"टिकट EarnRoute में सेव होता है। असली ईमेल सेवा जोड़ने तक ईमेल नहीं भेजे जाएँगे।",
  "Support ticket created.":"सपोर्ट टिकट बन गया।",
  "Support reply sent.":"सपोर्ट जवाब भेज दिया गया।",
  "Support ticket status updated.":"सपोर्ट टिकट की स्थिति अपडेट हुई।"
});

const ER_HI_EXTRA_UI = Object.freeze({
  "A BETTER WAY TO WORK":"काम करने का बेहतर तरीका","Welcome back.":"वापस स्वागत है।",
  "Sign in to continue to your workspace.":"अपने कार्य क्षेत्र में जाने के लिए लॉग इन करें।",
  "Sign in":"लॉग इन करें","Log in":"लॉग इन करें","Create account":"अकाउंट बनाएँ",
  "Create your account":"अपना अकाउंट बनाएँ","Full name":"पूरा नाम","Email address":"ईमेल पता",
  "Password":"पासवर्ड","e.g. Aanya Sharma":"जैसे: आर्या शर्मा","you@example.com":"आपका ईमेल",
  "At least 10 characters":"कम-से-कम 10 अक्षर","Use at least 10 characters.":"कम-से-कम 10 अक्षर इस्तेमाल करें।",
  "I’m joining as":"मैं इस रूप में जुड़ रहा/रही हूँ","Find paid shifts":"भुगतान वाली शिफ्ट खोजें",
  "Hire for shifts":"शिफ्ट के लिए लोग रखें","Find work":"काम खोजें","Post a shift":"शिफ्ट पोस्ट करें",
  "I confirm that I am 18 or older. EarnRoute does not guarantee work or income.":"मैं पुष्टि करता/करती हूँ कि मेरी उम्र 18 वर्ष या उससे अधिक है। EarnRoute काम या कमाई की गारंटी नहीं देता।",
  "I agree to the":"मैं सहमत हूँ:",
  "Terms":"नियम","Privacy Policy":"प्राइवेसी पॉलिसी",
  "Your account details stay protected. Never share your password or OTP.":"आपके अकाउंट की जानकारी सुरक्षित रखें। अपना पासवर्ड या OTP किसी से साझा न करें।",
  "Close dialog":"डायलॉग बंद करें","Connect server":"सर्वर कनेक्ट करें",
  "Need a hand?":"मदद चाहिए?","Clear answers for your next step.":"अगले कदम के लिए साफ़ जानकारी।",
  "Contact support":"सपोर्ट से संपर्क करें","How it works":"यह कैसे काम करता है","For workers":"वर्कर के लिए",
  "For businesses":"बिज़नेस के लिए","Policies":"नीतियाँ",
  "BUILT AROUND CLARITY":"स्पष्टता के लिए बनाया गया","Work should come":"काम के साथ होना चाहिए",
  "with":"साथ","no surprises.":"कोई अनजान शर्त नहीं।",
  "Transparent terms before applying":"आवेदन से पहले साफ़ शर्तें","Confirmed shifts, not assumed schedules":"पक्की शिफ्ट, अंदाज़े वाला शेड्यूल नहीं",
  "Payment status that reflects recorded events":"भुगतान की वही स्थिति जो रिकॉर्ड में दर्ज है",
  "YOUR NEXT STEP STARTS HERE":"आपका अगला कदम यहाँ से","Find a better fit":"अपने लिए बेहतर काम खोजें",
  "for your":"अपने अगले","next few hours.":"कुछ घंटों के लिए।",
  "Make a profile, set your availability and explore the opportunities that are actually published in your area.":"अपनी प्रोफ़ाइल बनाएँ, उपलब्ध समय तय करें और अपने इलाके में प्रकाशित असली काम देखें।",
  "Real opportunities. Clear terms. Better use of your time.":"असली अवसर। साफ़ शर्तें। आपके समय का बेहतर इस्तेमाल।",
  "FIND YOUR NEXT SHIFT":"अपनी अगली शिफ्ट खोजें","Policies":"नीतियाँ","Terms and Privacy Policy":"नियम और प्राइवेसी पॉलिसी",
  "Shift published to nearby workers.":"शिफ्ट आसपास के वर्कर के लिए प्रकाशित कर दी गई।",
  "Draft saved. Add the workplace pin before publishing.":"ड्राफ़्ट सेव हो गया। प्रकाशित करने से पहले वर्कप्लेस पिन जोड़ें।",
  "Workplace pin saved. Nearby workers can now find this shift.":"वर्कप्लेस पिन सेव हो गया। अब पास के वर्कर यह शिफ्ट खोज सकते हैं।",
  "Workplace pin added to this shift.":"इस शिफ्ट में वर्कप्लेस पिन जोड़ दिया गया।",
  "Setting pin…":"पिन सेट हो रहा है…","Pin set ✓":"पिन सेट हो गया ✓",
  "Coordinates are set from this device. Publish only while you are at the actual workplace.":"लोकेशन इस डिवाइस से ली गई है। शिफ्ट तभी प्रकाशित करें जब आप असली वर्कप्लेस पर हों।",
  "Workplace pin ready":"वर्कप्लेस पिन तैयार है","Clear pay":"साफ़ भुगतान","Pay transparency:":"भुगतान की पारदर्शिता:",
  "Verified business":"वेरिफ़ाइड बिज़नेस","VERIFIED":"वेरिफ़ाइड","Checked":"जाँचा गया",
  "positions open":"जगह खाली","spot":"जगह","spots":"जगहें","hr":"घंटा","hrs":"घंटे",
  "Find jobs near me":"मेरे पास काम खोजें","Workplace not set":"काम की जगह सेट नहीं है",
  "No workplace pin":"वर्कप्लेस पिन नहीं है","Add workplace pin":"वर्कप्लेस पिन जोड़ें",
  "Verify business":"बिज़नेस वेरिफ़ाई करें","Save business details":"बिज़नेस की जानकारी सेव करें",
  "Share shift ↗":"शिफ्ट साझा करें ↗","Share shift details":"शिफ्ट की जानकारी साझा करें",
  "Share shift":"शिफ्ट साझा करें","Choose an app to share these shift details.":"शिफ्ट की जानकारी साझा करने के लिए ऐप चुनें।",
  "Shift details copied. You can paste them into a message.":"शिफ्ट की जानकारी कॉपी हो गई। इसे संदेश में पेस्ट कर सकते हैं।",
  "Could not share these shift details.":"शिफ्ट की जानकारी साझा नहीं हो सकी।",
  "EarnRoute shift details":"EarnRoute शिफ्ट की जानकारी","Preparing shift details…":"शिफ्ट की जानकारी तैयार हो रही है…",
  "This shift is no longer available.":"यह शिफ्ट अब उपलब्ध नहीं है।",
  "Gross shift pay":"शिफ्ट का कुल भुगतान","Estimated worker pay":"वर्कर की अनुमानित कमाई",
  "Directions:":"रास्ता:","Category:":"कैटेगरी:","Business:":"बिज़नेस:","City:":"शहर:","Start:":"शुरू:","Distance:":"दूरी:",
  "straight-line":"सीधी दूरी","Expand to ":"दूरी बढ़ाएँ: ","km radius":"किमी की दूरी","km away":"किमी दूर"
});
const ER_HI_PHRASES = Object.entries({...ER_HI_UI, ...ER_HI_EXTRA_UI})
  .filter(([english]) => english.length >= 8 && english.includes(' '))
  .sort((a, b) => b[0].length - a[0].length);

function translateEarnRouteText(input) {
  if (typeof input !== 'string' || selectedLanguage !== 'hi' || !input.trim()) return input;
  const source = input;
  const trimmed = source.trim();
  const exact = ER_HI_UI[trimmed] || ER_HI_EXTRA_UI[trimmed];
  if (exact) return source.replace(trimmed, exact);
  let output = source;
  for (const [english, hindi] of ER_HI_PHRASES) {
    if (output.includes(english)) output = output.split(english).join(hindi);
  }
  output = output
    .replace(/^No shifts inside\s+(\d+(?:\.\d+)?)\s*km yet$/i, 'अभी $1 किमी के अंदर कोई शिफ्ट नहीं है')
    .replace(/^(\d+)\s+applications?$/i, '$1 आवेदन')
    .replace(/^(\d+)\s+shifts?$/i, '$1 शिफ्ट')
    .replace(/^(\d+)\s+applicants?$/i, '$1 आवेदक')
    .replace(/^Hi\s+(.+?)[.!]?$/i, 'नमस्ते $1')
    .replace(/^Gross pay\s*/i, 'कुल भुगतान ')
    .replace(/^Net payable\s*/i, 'देय कमाई ')
    .replace(/^Payment:\s*/i, 'भुगतान: ')
    .replace(/^Location:\s*/i, 'लोकेशन: ')
    .replace(/^Shift:\s*/i, 'शिफ्ट: ')
    .replace(/^Business:\s*/i, 'बिज़नेस: ')
    .replace(/^City:\s*/i, 'शहर: ')
    .replace(/^Workplace:\s*/i, 'काम की जगह: ')
    .replace(/^Category:\s*/i, 'कैटेगरी: ')
    .replace(/^Start:\s*/i, 'शुरू: ')
    .replace(/^Distance:\s*/i, 'दूरी: ')
    .replace(/^Gross shift pay:\s*/i, 'शिफ्ट का कुल भुगतान: ')
    .replace(/^Estimated take-home:\s*/i, 'अनुमानित कमाई: ')
    .replace(/^Directions:\s*/i, 'रास्ता: ')
    .replace(/^Shared from EarnRoute\./i, 'EarnRoute से साझा किया गया।')
    .replace(/^Deadline\s*/i, 'आख़िरी तारीख ')
    .replace(/^Created\s*/i, 'बनाया गया ')
    .replace(/^Received\s*/i, 'मिला ')
    .replace(/^(\s*)km(\s*)$/i, '$1किमी$2')
    .replace(/^(\s*)More(\s*)$/i, '$1और$2')
    .replace(/^(\d+(?:\.\d+)?)\s*km\s+radius$/i, '$1 किमी की दूरी')
    .replace(/^(\d+(?:\.\d+)?)\s*km\s+away$/i, '$1 किमी दूर')
    .replace(/^(\d+(?:\.\d+)?)\s*hrs?$/i, '$1 घंटे')
    .replace(/^(\d+)\s+spots?$/i, '$1 जगह')
    .replace(/^(\d+)\s+positions?\s+open$/i, '$1 जगह खाली')
    .replace(/^Under 100 m$/i, '100 मीटर से कम')
    .replace(/^Location ready\s*·\s*approx\.\s*±(\d+) m$/i, 'लोकेशन तैयार · अनुमानित सटीकता ±$1 मीटर');
  return output;
}

const erOriginalConfirm = window.confirm.bind(window);
const erOriginalPrompt = window.prompt.bind(window);
window.confirm = function(message) {
  return erOriginalConfirm(translateEarnRouteText(String(message || '')));
};
window.prompt = function(message, defaultValue) {
  return erOriginalPrompt(translateEarnRouteText(String(message || '')), defaultValue);
};

const erLocaleTextRecords = new WeakMap();
const erLocaleAttributeRecords = new WeakMap();
const ER_LOCALE_ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'aria-description', 'alt'];

function translateEarnRouteTextNode(node) {
  if (!node || !node.parentElement) return;
  const parent = node.parentElement;
  if (parent.closest('script,style,noscript,textarea,[contenteditable="true"],[data-i18n],#lang-btn,[data-er-language-toggle]')) return;
  const current = node.nodeValue || '';
  const previous = erLocaleTextRecords.get(node);
  let english = previous && current === previous.applied ? previous.original : current;
  if (!previous || current !== previous.applied) {
    erLocaleTextRecords.set(node, {original: english, applied: current});
  }
  const localized = selectedLanguage === 'hi' ? translateEarnRouteText(english) : english;
  if (node.nodeValue !== localized) node.nodeValue = localized;
  erLocaleTextRecords.set(node, {original: english, applied: localized});
}

function translateEarnRouteAttributes(element) {
  if (!(element instanceof Element)) return;
  if (element.matches('#lang-btn,[data-er-language-toggle],[data-i18n]')) return;
  let records = erLocaleAttributeRecords.get(element);
  if (!records) { records = new Map(); erLocaleAttributeRecords.set(element, records); }
  for (const attr of ER_LOCALE_ATTRIBUTES) {
    if (!element.hasAttribute(attr)) continue;
    const current = element.getAttribute(attr) || '';
    const previous = records.get(attr);
    const english = previous && current === previous.applied ? previous.original : current;
    const localized = selectedLanguage === 'hi' ? translateEarnRouteText(english) : english;
    if (localized !== current) element.setAttribute(attr, localized);
    records.set(attr, {original: english, applied: localized});
  }
}

function applyEarnRouteLocale(root = document.body) {
  if (!root || typeof document.createTreeWalker !== 'function') return;
  document.documentElement.lang = selectedLanguage === 'hi' ? 'hi-IN' : 'en-IN';
  if (root instanceof Element) translateEarnRouteAttributes(root);
  const textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.parentElement || !node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      if (node.parentElement.closest('script,style,noscript,textarea,[contenteditable="true"],[data-i18n],#lang-btn,[data-er-language-toggle]')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  while (textWalker.nextNode()) nodes.push(textWalker.currentNode);
  for (const node of nodes) translateEarnRouteTextNode(node);
  if (root.querySelectorAll) root.querySelectorAll(ER_LOCALE_ATTRIBUTES.map(attr => '[' + attr + ']').join(',')).forEach(translateEarnRouteAttributes);
}

let erLocalePassQueued = false;
function queueEarnRouteLocalePass() {
  if (erLocalePassQueued) return;
  erLocalePassQueued = true;
  Promise.resolve().then(() => {
    erLocalePassQueued = false;
    applyEarnRouteLocale(document.body);
  });
}

if (typeof MutationObserver !== 'undefined' && document.body) {
  const erLocaleObserver = new MutationObserver(() => queueEarnRouteLocalePass());
  erLocaleObserver.observe(document.body, {
    childList: true, subtree: true, characterData: true, attributes: true,
    attributeFilter: ER_LOCALE_ATTRIBUTES
  });
}
window.addEventListener('beforeunload', () => {
  try { localStorage.setItem('earnroute_language', selectedLanguage); } catch (_) {}
});
