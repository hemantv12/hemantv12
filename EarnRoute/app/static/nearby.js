'use strict';

const ER_RADIUS_OPTIONS = [1, 3, 5, 8, 10, 15];
const ER_RADIUS_STANDARD = [1, 3, 5];
const ER_RADIUS_MORE = [8, 10, 15];
const ER_WORK_CATEGORIES = ['All', 'Delivery', 'Retail', 'Events', 'Warehouse', 'Hospitality', 'Other'];
const erBaseRenderPage = renderPage;
const erBasePostJob = renderPostJob;

function erRadius() {
  const value = Number(sessionStorage.getItem('earnroute_nearby_radius') || (currentUser && currentUser.profile && currentUser.profile.travel_radius_km) || 3);
  return ER_RADIUS_OPTIONS.includes(value) ? value : 3;
}
function erCategory() {
  const saved = sessionStorage.getItem('earnroute_nearby_category') || 'All';
  return ER_WORK_CATEGORIES.includes(saved) ? saved : 'All';
}
function erGetLocation() {
  try {
    const value = JSON.parse(sessionStorage.getItem('earnroute_device_location') || 'null');
    if (!value || !Number.isFinite(Number(value.latitude)) || !Number.isFinite(Number(value.longitude))) return null;
    if (!value.expiresAt || Date.now() > Number(value.expiresAt)) {
      sessionStorage.removeItem('earnroute_device_location');
      return null;
    }
    return value;
  } catch (_) { return null; }
}
function erUseLocation() {
  return new Promise(function(resolve, reject) {
    if (!navigator.geolocation) return reject(new Error('This device cannot share its location. Open EarnRoute in a location-enabled browser.'));
    navigator.geolocation.getCurrentPosition(function(position) {
      resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy_m: Math.round(position.coords.accuracy || 0),
        expiresAt: Date.now() + 30 * 60 * 1000
      });
    }, function(error) {
      const messages = {
        1: 'Location permission was denied. Enable location permission for EarnRoute, then try again.',
        2: 'Your location is unavailable. Turn on device location services and try again.',
        3: 'Location took too long. Move near a window or try again.'
      };
      reject(new Error(messages[error.code] || 'Could not get your location. Please try again.'));
    }, {enableHighAccuracy:true, timeout:15000, maximumAge:20000});
  });
}
function erRadiusButtons(selected) {
  const expanded = sessionStorage.getItem('earnroute_more_radius_open') === '1' || selected > 5;
  const standard = ER_RADIUS_STANDARD.map(function(km) {
    return '<button type="button" class="er-radius-btn ' + (selected === km ? 'is-active' : '') +
      '" data-er-radius="' + km + '" aria-pressed="' + (selected === km) + '"><b>' + km + '</b><small>km</small></button>';
  }).join('');
  const moreOptions = expanded ? '<div class="er-radius-more-options" role="group" aria-label="More work distances">' +
    ER_RADIUS_MORE.map(function(km) {
      return '<button type="button" class="er-radius-btn er-radius-extra ' + (selected === km ? 'is-active' : '') +
        '" data-er-radius="' + km + '" aria-pressed="' + (selected === km) + '"><b>' + km + '</b><small>km</small></button>';
    }).join('') + '</div>' : '';
  return '<div class="er-radius-control"><div class="er-radius-picker" role="group" aria-label="Nearby work distance">' +
    standard + '<button type="button" class="er-radius-btn er-radius-more ' + (selected > 5 ? 'is-active' : '') +
    '" data-er-more-radius aria-expanded="' + expanded + '"><b>More</b><small>km</small></button></div>' +
    moreOptions + '</div>';
}
function erCategoryIcon(category) {
  return ({Delivery:'📦',Retail:'🛍️',Events:'🎟️',Warehouse:'🏷️',Hospitality:'☕',Other:'🧰'})[category] || '✳';
}
function erCategoryButtons(selected) {
  return '<div class="er-category-row" role="group" aria-label="Work category">' +
    ER_WORK_CATEGORIES.map(function(cat) {
      const icon = cat === 'All' ? '✳' : erCategoryIcon(cat);
      return '<button type="button" class="er-category-chip ' + (cat === selected ? 'is-active' : '') +
        '" data-er-category="' + escapeHtml(cat) + '">' + icon + ' ' + escapeHtml(cat) + '</button>';
    }).join('') + '</div>';
}
function erLocationPrompt() {
  return '<section class="er-location-prompt">' +
    '<div class="er-location-art"><span class="er-location-ring er-ring-one"></span><span class="er-location-ring er-ring-two"></span><span class="er-location-marker">⌖</span></div>' +
    '<div class="er-location-copy"><span class="er-overline">START WITH YOUR AREA</span><h2>Earn closer to home.</h2>' +
    '<p>Turn on location to find real paid shifts within <b>1 km, 3 km, 5 km or more</b> (up to 15 km). Your live position stays on this device and expires after 30 minutes.</p>' +
    '<button class="btn btn-primary btn-large" type="button" data-er-enable-location>⌖ Use my location</button></div></section>';
}
function erNearbyCard(job) {
  const gross = Number(job.gross_shift_pay_estimate !== undefined ? job.gross_shift_pay_estimate : job.pay_amount || 0);
  const net = Number(job.estimated_net_pay !== undefined ? job.estimated_net_pay : gross - Number(job.estimated_platform_fee || 0));
  const dist = Number(job.distance_km);
  const distance = Number.isFinite(dist) ? (dist < 0.1 ? 'Under 100 m' : dist.toFixed(1) + ' km away') : 'Nearby';
  const slots = Math.max(0, Number(job.slots || 0) - Number(job.positions_filled || 0));
  const mismatch = job.match && job.match.eligible === false;
  const mapQuery = encodeURIComponent([job.address, job.city].filter(Boolean).join(', '));
  const mapsLink = mapQuery ? '<a class="er-map-link" href="https://www.google.com/maps/search/?api=1&amp;query=' + mapQuery +
    '" target="_blank" rel="noopener noreferrer">Open workplace in Maps ↗</a>' : '';
  return '<article class="er-job-card">' +
    '<div class="er-job-card-top"><span class="er-job-icon">' + erCategoryIcon(job.category) + '</span><span class="er-distance-pill">⌖ ' + escapeHtml(distance) + '</span></div>' +
    '<div class="er-job-title-wrap"><div><h3>' + escapeHtml(job.title) + '</h3><p>' + escapeHtml(job.business_name || 'Local business') +
    (job.business_verified ? ' <span class="er-verified-chip">✓ Checked</span>' : '') + '</p></div><span class="er-work-type">' + escapeHtml(job.category || 'Local work') + '</span></div>' +
    '<div class="er-pay-row"><div><small>GROSS / SHIFT</small><strong>' + formatMoney(gross) + '</strong><em>before platform fee</em></div>' +
    '<div class="er-net-pay"><small>EST. YOU RECEIVE</small><strong>' + formatMoney(net) + '</strong><em>after estimated fee</em></div></div>' +
    '<div class="er-job-facts"><span>◷ ' + escapeHtml(formatDate(job.start_at)) + '</span><span>◴ ' + escapeHtml(job.duration_hours) + ' hrs</span><span>◎ ' + slots + ' spot' + (slots === 1 ? '' : 's') + '</span></div>' +
    (mismatch ? '<p class="er-match-note">Review your skills and availability before applying.</p>' : '') +
    '<div class="er-job-action-row"><button type="button" class="btn btn-primary er-apply" data-apply-job="' + job.id + '" ' + (mismatch ? 'disabled' : '') + '>' + (mismatch ? 'Profile needed' : 'Apply now') + ' <span>→</span></button>' +
    '<details class="er-job-details"><summary>Details</summary><p>' + escapeHtml(job.description || '') + '</p>' +
    (job.address ? '<p><b>Workplace:</b> ' + escapeHtml(job.address) + '</p>' : '') + mapsLink +
    (job.requirements && job.requirements.length ? '<p><b>Skills:</b> ' + escapeHtml(job.requirements.join(', ')) + '</p>' : '') +
    '<p><b>Apply by:</b> ' + escapeHtml(formatDate(job.application_deadline)) + '</p><p><b>Payment:</b> ' + escapeHtml(job.payment_terms || 'Confirm terms before accepting.') + '</p>' +
    '<small>Distance is straight-line GPS distance, not driving distance or ETA. Take-home pay is an estimate, not payment confirmation.</small></details></div></article>';
}
async function erFetchNearby(options) {
  options = options || {};
  const location = erGetLocation();
  if (!location) return {location:null, items:[], total:0};
  const radius = options.radius || erRadius();
  const category = options.category || erCategory();
  const params = new URLSearchParams({
    latitude:String(location.latitude), longitude:String(location.longitude),
    radius_km:String(radius), page:'1', page_size:'50'
  });
  if (category && category !== 'All') params.set('category', category);
  if (options.search && options.search.trim()) params.set('search', options.search.trim());
  if (String(options.minPay || '').trim()) params.set('min_pay', String(options.minPay).trim());
  const result = await api('/api/jobs?' + params.toString());
  return Object.assign({}, result, {location:location});
}
renderWorkerOverview = async function() {
  const location = erGetLocation();
  const radius = erRadius();
  const category = erCategory();
  const firstName = ((currentUser && currentUser.full_name) || 'there').split(' ')[0];
  let result = null;
  let failure = '';
  if (location) {
    try { result = await erFetchNearby({radius:radius, category:category}); }
    catch (error) { failure = friendlyError(error); }
  }
  const settled = await Promise.allSettled([api('/api/applications/me'), api('/api/assignments/me'), api('/api/worker/earnings')]);
  const applications = settled[0].status === 'fulfilled' ? (settled[0].value.items || []) : [];
  const assignments = settled[1].status === 'fulfilled' ? (settled[1].value.items || []) : [];
  const earnings = settled[2].status === 'fulfilled' ? settled[2].value : {pending_settlement:0,verified_paid:0,completed_assignments:0};
  const confirmed = assignments.filter(function(a){return ['confirmed','checked_in','checked_out'].includes(a.status);});
  let list;
  if (!location) list = erLocationPrompt();
  else if (failure) list = '<div class="er-nearby-empty"><div class="er-empty-icon">↻</div><h3>Nearby work did not load</h3><p>' + escapeHtml(failure) + '</p><button type="button" class="btn btn-outline" data-er-enable-location>Refresh location</button></div>';
  else if (result.items && result.items.length) list = '<div class="er-job-grid">' + result.items.map(erNearbyCard).join('') + '</div>';
  else list = '<div class="er-nearby-empty"><div class="er-empty-icon">⌖</div><h3>No shifts inside ' + radius + ' km yet</h3><p>We only show shifts with an actual workplace pin inside your chosen radius. Try a wider local radius or check back later.</p><button type="button" class="btn btn-outline" data-er-radius="' + (radius === 1 ? 3 : 5) + '">Look within ' + (radius === 1 ? 3 : 5) + ' km</button></div>';
  return '<section class="er-nearby-hero"><div class="er-hero-main"><span class="er-overline"><i></i> LOCAL GIGS · CLEAR PAY</span>' +
    '<h1>Hi ' + escapeHtml(firstName) + '.<br><span>Let’s earn nearby.</span></h1><p>Short shifts, local gigs and paid help up to 15 km away. Less travel, more time back.</p>' +
    '<div class="er-hero-actions"><button type="button" class="btn btn-primary btn-large" data-er-enable-location>' + (location ? '↻ Refresh my location' : '⌖ Find jobs near me') + '</button>' +
    '<span>' + (location ? 'Location ready · approx. ±' + Math.max(1, Number(location.accuracy_m || 0)) + ' m' : 'Location is only used to find nearby work') + '</span></div></div>' +
    '<div class="er-hero-map" aria-hidden="true"><div class="er-map-roads"></div><span class="er-map-shop er-shop-a">🛍️</span><span class="er-map-shop er-shop-b">📦</span><span class="er-map-shop er-shop-c">☕</span><span class="er-map-pin">⌖</span><span class="er-map-label">' + radius + ' km radius</span></div></section>' +
    '<section class="er-nearby-section"><div class="er-section-head"><div><span class="er-overline">YOUR NEIGHBOURHOOD</span><h2>Work around you</h2><p>Closest first. Pay shown up front. One-tap apply.</p></div><button type="button" class="btn btn-outline" data-screen="discover">Browse nearby →</button></div>' +
    '<div class="er-filter-panel"><div><span class="er-control-label">How far can you go?</span>' + erRadiusButtons(radius) + '</div><div class="er-categories"><span class="er-control-label">Choose work type</span>' + erCategoryButtons(category) + '</div></div>' + list + '</section>' +
    '<section class="er-quick-links"><button type="button" data-screen="applications"><span class="er-quick-icon">▤</span><span><b>Applications</b><small>' + applications.length + ' sent</small></span><i>→</i></button>' +
    '<button type="button" data-screen="schedule"><span class="er-quick-icon">▦</span><span><b>My schedule</b><small>' + confirmed.length + ' confirmed</small></span><i>→</i></button>' +
    '<button type="button" data-screen="earnings"><span class="er-quick-icon">₹</span><span><b>My earnings</b><small>' + formatMoney(earnings.pending_settlement || 0) + ' pending</small></span><i>→</i></button></section>';
};
renderDiscover = async function(filters) {
  filters = filters || {};
  const location = erGetLocation();
  const requestedRadius = Number(filters.radius_km || erRadius());
  const radius = ER_RADIUS_OPTIONS.includes(requestedRadius) ? requestedRadius : erRadius();
  const category = filters.category || erCategory();
  if (!location) {
    return pageHeading('NEARBY WORK','Find a gig close to you.','Choose 1 km, 3 km, 5 km or open More for 8 km, 10 km and 15 km. EarnRoute shows only jobs with a real workplace pin inside that distance.','') +
      '<div class="er-discover-toolbar"><div><span class="er-control-label">Distance limit</span>' + erRadiusButtons(radius) + '</div></div>' + erLocationPrompt();
  }
  let result;
  try { result = await erFetchNearby({radius:radius, category:category, search:String(filters.search || ''), minPay:filters.min_pay || ''}); }
  catch (error) {
    return pageHeading('NEARBY WORK','Jobs around you.','Only real nearby shifts are listed here.','') + '<div class="er-nearby-empty"><h3>Could not load nearby jobs</h3><p>' + escapeHtml(friendlyError(error)) + '</p><button class="btn btn-outline" data-er-enable-location>Try again</button></div>';
  }
  return pageHeading('NEARBY WORK','Find work close to you.','No far-away listings. Compare distance, shift time and estimated take-home before applying.','<button type="button" class="btn btn-outline" data-er-enable-location>↻ Refresh location</button>') +
    '<div class="er-discover-toolbar"><div><span class="er-control-label">Distance limit</span>' + erRadiusButtons(radius) + '</div><div><span class="er-control-label">Work type</span>' + erCategoryButtons(category) + '</div><span class="er-location-note">⌖ Using device location · ' + radius + ' km maximum</span></div>' +
    '<form id="er-nearby-filter" class="er-search-row"><input name="search" placeholder="Search a local gig" aria-label="Search nearby jobs" value="' + escapeHtml(filters.search || '') + '">' +
    '<input name="min_pay" type="number" min="0" step="50" placeholder="Min pay ₹" value="' + escapeHtml(filters.min_pay || '') + '" aria-label="Minimum pay"><button class="btn btn-primary" type="submit">Search</button><button class="btn btn-outline" type="reset">Clear</button></form>' +
    '<div class="er-results-note"><b>' + (result.total || 0) + '</b> shift' + (result.total === 1 ? '' : 's') + ' within ' + radius + ' km · closest first</div>' +
    (result.items && result.items.length ? '<div class="er-job-grid">' + result.items.map(erNearbyCard).join('') + '</div>' :
    '<div class="er-nearby-empty"><div class="er-empty-icon">⌖</div><h3>No shifts in this radius yet</h3><p>Try a wider radius using More (up to 15 km). Jobs without a workplace pin stay hidden rather than showing a made-up distance.</p><button type="button" class="btn btn-outline" data-er-radius="' + (radius === 1 ? 3 : 5) + '">Expand to ' + (radius === 1 ? 3 : 5) + ' km</button></div>');
};
renderPostJob = function() {
  let html = erBasePostJob();
  const addressPattern = /(<div class="form-field span-2"><label for="job-address">[\s\S]*?<\/div>)(\s*<div class="form-field"><label for="job-slots">)/;
  const workplacePin = '\n  <div class="form-field span-2"><label>Exact workplace pin <span class="er-required-pin">Required to publish</span></label>' +
    '<div class="er-workplace-pin"><span class="er-pin-symbol">⌖</span><div><b id="er-new-pin-label">Workplace location not set</b><small id="er-new-pin-help">Stand at the actual shift location, then set the pin. Your personal location is not saved to your account.</small></div>' +
    '<button type="button" class="btn btn-outline btn-sm" data-er-capture-pin>Set pin from here</button></div><input type="hidden" id="job-latitude" name="latitude"><input type="hidden" id="job-longitude" name="longitude"></div>\n';
  if (!addressPattern.test(html)) throw new Error('Could not add workplace pin to the shift form.');
  return html.replace(addressPattern, '$1' + workplacePin + '$2');
};
renderBusinessJobs = async function() {
  const result = await api('/api/business/jobs');
  const items = result.items || [];
  const cards = items.map(function(job) {
    let actions = '';
    if (!job.has_workplace_pin) actions += '<button type="button" class="btn btn-outline btn-sm" data-er-pin-existing="' + job.id + '">Set workplace pin</button>';
    actions += '<button type="button" class="btn btn-outline btn-sm" data-view-applicants="' + job.id + '">Applicants</button>';
    if (['draft','paused'].includes(job.status)) actions += '<button type="button" class="btn btn-primary btn-sm" data-publish-job="' + job.id + '">Publish</button>';
    if (job.status === 'published') actions += '<button type="button" class="btn btn-outline btn-sm" data-job-status="' + job.id + '" data-status="paused">Pause</button>';
    if (['draft','paused','published'].includes(job.status)) actions += '<button type="button" class="btn btn-outline btn-sm" data-job-status="' + job.id + '" data-status="closed">Close</button>';
    return '<article class="er-business-job"><div><h3>' + escapeHtml(job.title) + '</h3><p>' + escapeHtml(job.city) + ' · ' + escapeHtml(job.category) + ' · ' + escapeHtml(formatDate(job.start_at)) + '</p><div class="er-job-facts"><span>' + formatMoney(job.pay_amount) + ' / ' + escapeHtml(job.pay_basis) + '</span><span>' + (job.has_workplace_pin ? '⌖ Workplace pin set' : '⚠ Pin needed for nearby discovery') + '</span><span>' + escapeHtml(job.status) + '</span></div></div><div class="er-business-job-actions">' + actions + '</div></article>';
  }).join('');
  return pageHeading('SHIFT MANAGEMENT','Your local shifts.','Set a real workplace pin for every shift so workers nearby can find it.','<button type="button" class="btn btn-primary" data-screen="post-job">Post a shift ↗</button>') +
    '<div class="panel"><div class="panel-header"><div><h2 class="panel-title">Jobs and drafts</h2><div class="panel-subtitle">' + items.length + ' shift record' + (items.length === 1 ? '' : 's') + '</div></div></div><div class="panel-body">' +
    (items.length ? '<div class="er-business-jobs">' + cards + '</div>' : emptyState('No shifts yet','Post a genuine paid shift and set its workplace pin so local workers can find it.','▤','<button class="btn btn-primary btn-sm" data-screen="post-job">Post your first shift →</button>')) + '</div></div>';
};
submitJob = async function(form) {
  const errorEl = $('#job-form-error');
  errorEl.hidden = true;
  const button = $('#save-job-btn');
  loadingButtons(button, true);
  try {
    const data = formObject(form);
    const publish = $('#job-publish').checked;
    if (publish && (!String(data.latitude == null ? '' : data.latitude).trim() || !String(data.longitude == null ? '' : data.longitude).trim())) {
      throw new Error('Set the workplace pin first. Workers only see shifts inside their selected radius, up to 15 km of the real pin.');
    }
    const dateTime = function(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) throw new Error('Please enter valid dates and times.');
      return date.toISOString();
    };
    const payload = {
      title:data.title, description:data.description, category:data.category, city:data.city, address:data.address || '',
      latitude:String(data.latitude == null ? '' : data.latitude).trim() === '' ? null : Number(data.latitude),
      longitude:String(data.longitude == null ? '' : data.longitude).trim() === '' ? null : Number(data.longitude),
      slots:Number(data.slots), start_at:dateTime(data.start_at), end_at:dateTime(data.end_at),
      pay_amount:Number(data.pay_amount), pay_basis:data.pay_basis, payment_terms:data.payment_terms,
      requirements:parseCommaList(data.requirements), min_experience:Number(data.min_experience || 0),
      breaks_info:data.breaks_info || '', equipment_info:data.equipment_info || '', safety_info:data.safety_info || '',
      application_deadline:dateTime(data.application_deadline), cancellation_policy:data.cancellation_policy, publish:publish
    };
    await api('/api/jobs', {method:'POST',body:payload});
    showToast(publish ? 'Shift published to nearby workers.' : 'Draft saved. Add the workplace pin before publishing.');
    setActiveScreen('business-jobs');
  } catch (error) {
    errorEl.textContent = friendlyError(error);
    errorEl.hidden = false;
  } finally { loadingButtons(button, false); }
};
function erEnsureMobileNav() {
  const role = currentUser && currentUser.role;
  const navigation = {
    worker: [
      ['overview','⌂','Home'], ['discover','⌕','Nearby'], ['applications','▤','Applied'],
      ['schedule','▦','Schedule'], ['earnings','₹','Earnings']
    ],
    business: [
      ['business-overview','⌂','Home'], ['post-job','＋','Post'], ['business-jobs','▤','Shifts'],
      ['business-applicants','◎','People'], ['business-assignments','✓','Work']
    ],
    admin: [
      ['admin-overview','⌂','Home'], ['admin-verifications','✓','Verify'], ['admin-jobs','▤','Jobs'],
      ['admin-disputes','⚑','Issues'], ['admin-audit','◷','Audit']
    ]
  };
  const items = navigation[role];
  document.body.classList.toggle('er-nearby-worker', role === 'worker');
  document.body.classList.toggle('er-nearby-business', role === 'business');
  let nav = $('#er-mobile-nav');
  if (!items) {
    if (nav) nav.remove();
    return;
  }
  if (!nav) {
    document.body.insertAdjacentHTML('beforeend', '<nav id="er-mobile-nav" class="er-mobile-nav" aria-label="App navigation"></nav>');
    nav = $('#er-mobile-nav');
  }
  if (nav.dataset.role !== role) {
    nav.innerHTML = items.map(function(item) {
      return '<button type="button" data-screen="' + item[0] + '" aria-label="' + item[2] + '">' +
        '<span aria-hidden="true">' + item[1] + '</span><small>' + item[2] + '</small></button>';
    }).join('');
    nav.dataset.role = role;
  }
  nav.querySelectorAll('[data-screen]').forEach(function(button) {
    const active = button.dataset.screen === activeScreen;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });
  $('#page-title').textContent = ['overview','discover'].includes(activeScreen) ? 'Nearby work' : (TITLES[activeScreen] || 'Your work');
}
renderPage = async function() {
  await erBaseRenderPage();
  erEnsureMobileNav();
};

function erIsNativeApp() {
  return document.documentElement.classList.contains('er-native-app');
}
function erDismissSplash() {
  const splash = $('#er-app-splash');
  if (!splash || !erIsNativeApp()) return;
  splash.classList.add('is-dismissed');
  window.setTimeout(function(){ splash.hidden = true; }, 260);
}
function erSyncWelcomeRadius() {
  const radius = erRadius();
  document.querySelectorAll('[data-er-welcome-radius]').forEach(function(button) {
    const active = Number(button.dataset.erWelcomeRadius) === radius;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  const moreButton = $('[data-er-welcome-more]');
  const moreOptions = $('#er-welcome-more-options');
  const expanded = sessionStorage.getItem('earnroute_more_radius_open') === '1' || radius > 5;
  if (moreButton) {
    moreButton.classList.toggle('is-active', radius > 5);
    moreButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }
  if (moreOptions) moreOptions.hidden = !expanded;
  const label = $('#er-welcome-radius-label');
  if (label) label.textContent = radius + ' km radius';
}
const erBaseSetLanding = setLanding;
setLanding = function() {
  erBaseSetLanding();
  document.body.classList.remove('er-nearby-worker','er-nearby-business');
  const nav = $('#er-mobile-nav');
  if (nav) nav.remove();
  if (!erIsNativeApp()) return;
  document.documentElement.classList.remove('er-authenticated');
  $('#landing').hidden = true;
  $('#workspace').hidden = true;
  $('#er-app-welcome').hidden = false;
  erSyncWelcomeRadius();
  erDismissSplash();
};
const erBaseSetWorkspace = setWorkspace;
setWorkspace = function(user) {
  erBaseSetWorkspace(user);
  if (!erIsNativeApp()) return;
  $('#er-app-welcome').hidden = true;
  document.documentElement.classList.add('er-authenticated');
  erDismissSplash();
};

document.addEventListener('click', function(event) {
  const moreButton = event.target.closest('[data-er-welcome-more]');
  if (moreButton) {
    const expanded = moreButton.getAttribute('aria-expanded') !== 'true';
    sessionStorage.setItem('earnroute_more_radius_open', expanded ? '1' : '0');
    erSyncWelcomeRadius();
    return;
  }
  const button = event.target.closest('[data-er-welcome-radius]');
  if (!button) return;
  const radius = Number(button.dataset.erWelcomeRadius);
  if (!ER_RADIUS_OPTIONS.includes(radius)) return;
  sessionStorage.setItem('earnroute_nearby_radius', String(radius));
  sessionStorage.setItem('earnroute_more_radius_open', radius > 5 ? '1' : '0');
  erSyncWelcomeRadius();
});

document.addEventListener('click', async function(event) {
  const target = event.target.closest('button');
  if (!target) return;
  if (target.hasAttribute('data-er-more-radius')) {
    const expanded = target.getAttribute('aria-expanded') !== 'true';
    sessionStorage.setItem('earnroute_more_radius_open', expanded ? '1' : '0');
    await renderPage();
    return;
  }
  if (target.hasAttribute('data-er-enable-location')) {
    const oldText = target.textContent;
    target.disabled = true;
    target.textContent = 'Finding your location…';
    try {
      sessionStorage.setItem('earnroute_device_location', JSON.stringify(await erUseLocation()));
      showToast('Location ready. Showing only nearby shifts.');
      await renderPage();
    } catch (error) {
      showToast(friendlyError(error), 'error');
      target.disabled = false;
      target.textContent = oldText;
    }
    return;
  }
  if (target.hasAttribute('data-er-radius')) {
    const value = Number(target.dataset.erRadius);
    if (!ER_RADIUS_OPTIONS.includes(value)) return;
    sessionStorage.setItem('earnroute_nearby_radius', String(value));
    sessionStorage.setItem('earnroute_more_radius_open', value > 5 ? '1' : '0');
    await renderPage();
    return;
  }
  if (target.hasAttribute('data-er-category')) {
    sessionStorage.setItem('earnroute_nearby_category', target.dataset.erCategory);
    await renderPage();
    return;
  }
  if (target.hasAttribute('data-er-capture-pin') || target.hasAttribute('data-er-pin-existing')) {
    target.disabled = true;
    const oldText = target.textContent;
    target.textContent = 'Setting pin…';
    try {
      const pin = await erUseLocation();
      if (target.hasAttribute('data-er-pin-existing')) {
        await api('/api/jobs/' + target.dataset.erPinExisting + '/location', {method:'PATCH',body:{latitude:pin.latitude,longitude:pin.longitude}});
        showToast('Workplace pin saved. Nearby workers can now find this shift.');
        await renderPage();
      } else {
        $('#job-latitude').value = String(pin.latitude);
        $('#job-longitude').value = String(pin.longitude);
        $('#er-new-pin-label').textContent = 'Workplace pin ready · ±' + Math.max(1,pin.accuracy_m) + ' m reported accuracy';
        $('#er-new-pin-help').textContent = 'Coordinates are set from this device. Publish only while you are at the actual workplace.';
        target.textContent = 'Pin set ✓';
        target.disabled = false;
        showToast('Workplace pin added to this shift.');
      }
    } catch (error) {
      showToast(friendlyError(error), 'error');
      target.disabled = false;
      target.textContent = oldText;
    }
  }
});
document.addEventListener('submit', async function(event) {
  const form = event.target;
  if (form && form.id === 'er-nearby-filter') {
    event.preventDefault();
    const data = formObject(form);
    $('#view-root').innerHTML = '<div class="loading-surface"><span class="loading-spinner"></span><span>Finding the closest shifts…</span></div>';
    try {
      $('#view-root').innerHTML = await renderDiscover(Object.assign({}, data, {radius_km:erRadius(), category:erCategory()}));
      erEnsureMobileNav();
    } catch (error) { showToast(friendlyError(error), 'error'); }
  }
});
document.addEventListener('reset', function(event) {
  if (event.target && event.target.id === 'er-nearby-filter') {
    event.preventDefault();
    sessionStorage.removeItem('earnroute_nearby_category');
    setTimeout(function(){renderPage();}, 0);
  }
});
