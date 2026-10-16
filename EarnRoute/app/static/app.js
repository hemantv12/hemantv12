'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
let currentUser = null;
let activeScreen = 'overview';
let activeApplicationJob = null;
let selectedLanguage = sessionStorage.getItem('earnroute_language') || 'en';
let currentJobs = [];
let authMode = 'login';

const TRANSLATIONS = {
  en: {
    workspace: 'WORKSPACE', overview: 'Overview', discover: 'Discover work', applications: 'Applications', schedule: 'My schedule', earnings: 'Earnings', profile: 'My profile',
    postJob: 'Post a shift', manageJobs: 'Manage jobs', applicants: 'Applicants', assignments: 'Assignments', verify: 'Business verification', disputes: 'Disputes', audit: 'Audit history',
    signOut: 'Sign out', overviewSub: 'Your work, organized around your life.', findShifts: 'Find shifts', profileSettings: 'Edit profile', recommended: 'Recommended for you', upcoming: 'Upcoming assignments',
    applied: 'Applications', confirmed: 'Confirmed shifts', completed: 'Completed work', pending: 'Pending settlement',
    noJobs: 'No published opportunities yet', noJobsCopy: 'New, verified opportunities will appear here when businesses publish genuine shifts. Try another category or check back later.',
    language: 'हि', myAccount: 'My account', workerRole: 'Worker', businessRole: 'Business', adminRole: 'Admin'
  },
  hi: {
    workspace: 'आपका वर्कस्पेस', overview: 'डैशबोर्ड', discover: 'काम खोजें', applications: 'आवेदन', schedule: 'मेरा शेड्यूल', earnings: 'कमाई', profile: 'मेरी प्रोफ़ाइल',
    postJob: 'शिफ्ट पोस्ट करें', manageJobs: 'जॉब मैनेज करें', applicants: 'आवेदक', assignments: 'असाइनमेंट', verify: 'बिज़नेस वेरिफ़िकेशन', disputes: 'विवाद', audit: 'ऑडिट हिस्ट्री',
    signOut: 'साइन आउट', overviewSub: 'आपका काम, आपकी ज़िंदगी के हिसाब से।', findShifts: 'शिफ्ट खोजें', profileSettings: 'प्रोफ़ाइल एडिट करें', recommended: 'आपके लिए सही काम', upcoming: 'आने वाले असाइनमेंट',
    applied: 'आवेदन', confirmed: 'कन्फ़र्म शिफ्ट', completed: 'पूरा किया काम', pending: 'पेमेंट लंबित',
    noJobs: 'अभी कोई प्रकाशित अवसर नहीं', noJobsCopy: 'बिज़नेस द्वारा वास्तविक शिफ्ट प्रकाशित होने पर अवसर यहाँ दिखेंगे। फ़िल्टर बदलकर देखें या बाद में वापस आएँ।',
    language: 'EN', myAccount: 'मेरा अकाउंट', workerRole: 'वर्कर', businessRole: 'बिज़नेस', adminRole: 'एडमिन'
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
  return new Intl.DateTimeFormat('en-IN', withTime ? { weekday:'short', day:'numeric', month:'short', hour:'numeric', minute:'2-digit' } : { day:'numeric', month:'short', year:'numeric' }).format(d);
}
function dateInputValue(date) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
function statusPill(status) {
  const clean = String(status || 'unknown').toLowerCase();
  const labels = { applied:'Applied', shortlisted:'Shortlisted', offered:'Offer received', accepted:'Accepted', declined:'Declined', withdrawn:'Withdrawn', rejected:'Rejected',
    confirmed:'Confirmed', checked_in:'Checked in', checked_out:'Checked out', completed:'Completed', cancelled:'Cancelled', disputed:'Disputed', pending:'Pending', verified:'Verified', published:'Published', draft:'Draft', paused:'Paused', closed:'Closed', paid:'Paid', not_due:'Not due' };
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
      setLanding();
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
    { group:'ACCOUNT', items:[['profile','profile','○']] }
  ];
  if (currentUser?.role === 'admin') return [
    { group:'FOUNDER CONTROL', items:[['admin-overview','overview','◫'],['admin-verifications','verify','✓'],['admin-jobs','manageJobs','▤'],['admin-disputes','disputes','⚑'],['admin-audit','audit','≋']] }
  ];
  return [
    { group:'WORKSPACE', items:[['overview','overview','◫'],['discover','discover','⌕'],['applications','applications','▤'],['schedule','schedule','▦'],['earnings','earnings','₹']] },
    { group:'ACCOUNT', items:[['profile','profile','○']] }
  ];
}
function buildNavigation() {
  const nav = $('#side-nav');
  nav.innerHTML = navItems().map((group, i) => `${i ? '<div class="nav-divider"></div>' : ''}<div class="nav-group-title">${group.group}</div>${group.items.map(([id, label, icon]) => `<button class="nav-link${id === activeScreen ? ' active' : ''}" data-screen="${id}"><span class="nav-icon">${icon}</span><span class="nav-label">${t(label)}</span></button>`).join('')}`).join('');
  $('#logout-btn').lastChild.textContent = ` ${t('signOut')}`;
}
function setLanguageButton() {
  $('#lang-btn').textContent = t('language');
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
}
const TITLES = {
  overview:'Overview', discover:'Discover work', applications:'Applications', schedule:'My schedule', earnings:'Earnings', profile:'My profile',
  'business-overview':'Business overview','post-job':'Post a shift','business-jobs':'Manage jobs','business-applicants':'Applicants','business-assignments':'Assignments',
  'admin-overview':'Founder overview','admin-verifications':'Business verification','admin-jobs':'Job moderation','admin-disputes':'Dispute review','admin-audit':'Audit history'
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
function assignmentCard(assignment, isBusiness = false) {
  let actions = '';
  if (!isBusiness && assignment.status === 'confirmed') actions += `<button class="btn btn-primary btn-sm" data-check-in="${assignment.id}">Check in</button><button class="btn btn-outline btn-sm" data-cancel-assignment="${assignment.id}">Cancel</button>`;
  if (isBusiness && assignment.status === 'confirmed') actions += `<button class="btn btn-outline btn-sm" data-cancel-assignment="${assignment.id}">Cancel assignment</button>`;
  if (!isBusiness && assignment.status === 'checked_in') actions += `<button class="btn btn-primary btn-sm" data-check-out="${assignment.id}">Check out</button>`;
  if (!isBusiness && ['checked_in','checked_out','completed','disputed'].includes(assignment.status)) actions += `<button class="btn btn-light btn-sm" data-dispute="${assignment.id}">Report a problem</button>`;
  if (isBusiness && assignment.status === 'checked_out') actions += `<button class="btn btn-primary btn-sm" data-complete="${assignment.id}">Approve completion</button>`;
  if (isBusiness && assignment.status === 'checked_in') actions += `<span class="job-business">Waiting for worker check-out</span>`;
  if (!isBusiness && assignment.status === 'completed' && !assignment.worker_reviewed) actions += `<button class="btn btn-outline btn-sm" data-review-assignment="${assignment.id}">Rate business</button>`;
  if (isBusiness && assignment.status === 'completed' && !assignment.business_reviewed) actions += `<button class="btn btn-outline btn-sm" data-review-assignment="${assignment.id}">Rate worker</button>`;
  const payText = isBusiness ? `Gross pay ${formatMoney(assignment.gross_pay)}` : `Net payable ${formatMoney(assignment.net_pay)}`;
  return `<article class="job-card"><div class="job-card-head"><div class="job-brand-icon">✓</div><div class="job-head-main"><div class="job-title">${escapeHtml(assignment.job_title)}</div><div class="job-business">${escapeHtml(isBusiness ? assignment.worker_name || 'Worker assigned' : (assignment.business_name || 'Business'))} · ${escapeHtml(assignment.city)}</div></div>${statusPill(assignment.status)}</div><div class="job-meta"><span class="meta-chip">◷ ${escapeHtml(formatDate(assignment.start_at))}</span><span class="meta-chip">${escapeHtml(payText)}</span><span class="meta-chip">Payment: ${escapeHtml(assignment.payout_status || 'not due')}</span></div>${assignment.reviews?.length ? `<div class="review-list">${assignment.reviews.map(r=>`<div class="review-line"><b>★ ${r.rating}/5</b> ${escapeHtml(r.comment||'Review submitted without a comment')} <small>— ${escapeHtml(r.reviewer_name)}</small></div>`).join('')}</div>` : ''}<details class="job-description-details"><summary>Workplace, instructions and terms</summary>${assignment.address?`<p><b>Location:</b> ${escapeHtml(assignment.address)}</p>`:''}${(assignment.address||assignment.city) ? '<p><a class="er-map-link" href="https://www.google.com/maps/search/?api=1&amp;query=' + encodeURIComponent([assignment.address,assignment.city].filter(Boolean).join(', ')) + '" target="_blank" rel="noopener noreferrer">Open workplace in Maps ↗</a></p>' : ''}<p>${escapeHtml(assignment.description||'Review the published role details before travelling.')}</p>${assignment.requirements?.length?`<p><b>Required skills:</b> ${escapeHtml(assignment.requirements.join(', '))}</p>`:''}${assignment.breaks_info?`<p><b>Breaks:</b> ${escapeHtml(assignment.breaks_info)}</p>`:''}${assignment.equipment_info?`<p><b>Equipment / dress:</b> ${escapeHtml(assignment.equipment_info)}</p>`:''}${assignment.safety_info?`<p><b>Safety instructions:</b> ${escapeHtml(assignment.safety_info)}</p>`:''}${assignment.payment_terms?`<p><b>Payment terms:</b> ${escapeHtml(assignment.payment_terms)}</p>`:''}${assignment.cancellation_policy?`<p><b>Cancellation:</b> ${escapeHtml(assignment.cancellation_policy)}</p>`:''}</details><div class="job-card-bottom"><span class="job-business">${assignment.checkin_at ? `Checked in ${escapeHtml(formatDate(assignment.checkin_at))}` : 'Review shift instructions before arrival'}</span><div class="job-management-actions">${actions}</div></div></article>`;
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
function loadingButtons(button, isLoading) {
  if (!button) return;
  button.disabled = isLoading;
  if (isLoading) button.dataset.originalText = button.innerHTML;
  else if (button.dataset.originalText) { button.innerHTML = button.dataset.originalText; delete button.dataset.originalText; }
  if (isLoading) button.innerHTML = '<span class="loading-spinner tiny"></span> Please wait…';
}

// Authentication modal
function openAuth(mode = 'login', role = 'worker') {
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
  authMode = mode;
  $('#auth-heading').textContent = mode === 'login' ? 'Welcome back.' : 'Build your next step.';
  $('#auth-subheading').textContent = mode === 'login' ? 'Sign in to continue to your workspace.' : 'Create a profile to discover or publish work.';
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
  if(target.id==='close-auth' || (target.classList.contains('modal-backdrop')&&target.id==='auth-modal')){closeAuth();return;}
  if(target.id==='logout-btn') {sessionStorage.removeItem('earnroute_token');currentUser=null;setLanding();showToast('You have signed out.');return;}
  if(target.id==='mobile-menu'){ $('#sidebar').classList.toggle('mobile-open'); return; }
  if(target.id==='lang-btn') {selectedLanguage=selectedLanguage==='en'?'hi':'en';sessionStorage.setItem('earnroute_language',selectedLanguage);if(currentUser){buildNavigation();setWorkspace(currentUser);}else setLanguageButton();return;}
  if(target.id==='notifications-btn'){showNotifications();return;}
  if(target.dataset.closeNotifications!==undefined){$('#notification-panel')?.remove();return;}
  if(target.dataset.screen){event.preventDefault();setActiveScreen(target.dataset.screen);return;}
  if(target.dataset.retry!==undefined){renderPage();return;}
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
  if(form.id==='job-form'){event.preventDefault();await submitJob(form);return;}
});
document.addEventListener('change',event=>{if(event.target.matches('#auth-form input[name="role"]'))setAuthMode(authMode);});
document.addEventListener('reset',event=>{if(event.target.id==='discover-filter-form')window.setTimeout(()=>setActiveScreen('discover'),10);});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeAuth();$('#notification-panel')?.remove();$('#sidebar').classList.remove('mobile-open');}});

async function init() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('/static/sw.js').catch(()=>{});
  }
  setLanguageButton();
  const nativeAndroid = Boolean(window.EarnRouteNative && typeof window.EarnRouteNative.isAndroidApp === 'function' && window.EarnRouteNative.isAndroidApp());
  if (nativeAndroid) $$('[data-connect-server]').forEach(button => { button.hidden = false; });
  $$('[data-connect-server]').forEach(button => button.addEventListener('click', () => { try { window.EarnRouteNative?.openServerSettings?.(); } catch (_) { showToast('Open server settings from the app.', 'error'); } }));
  const token=sessionStorage.getItem('earnroute_token');
  if(!token){setLanding();return;}
  try {const data=await api('/api/auth/me');setWorkspace(data.user);}
  catch {sessionStorage.removeItem('earnroute_token');setLanding();}
}
window.addEventListener('load', init, { once: true });
