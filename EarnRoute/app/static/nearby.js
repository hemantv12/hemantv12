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
function erRadiusNextAction(radius, verb) {
  const next = ER_RADIUS_OPTIONS.find(function(km) { return km > radius; });
  return next
    ? '<button type="button" class="btn btn-outline" data-er-radius="' + next + '">' + verb + next + ' km</button>'
    : '<p>You’re already at the widest radius. Try another work category or check back later.</p>';
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
let erSavedShiftIds = new Set();
let erSavedShiftIdsAvailable = false;

async function erRefreshSavedShiftIds() {
  try {
    const response = await api('/api/worker/saved-shifts');
    erSavedShiftIds = new Set((response.items || []).map(function(job) { return Number(job.id); }).filter(Number.isFinite));
    erSavedShiftIdsAvailable = true;
    return true;
  } catch (_) {
    // Discovery should still work if the saved-shifts endpoint is briefly deploying or offline.
    erSavedShiftIdsAvailable = false;
    return false;
  }
}
function erDistanceKm(aLat, aLon, bLat, bLon) {
  const rad = function(deg) { return deg * Math.PI / 180; };
  const lat1 = rad(Number(aLat)), lat2 = rad(Number(bLat));
  const dLat = rad(Number(bLat) - Number(aLat)), dLon = rad(Number(bLon) - Number(aLon));
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}
function erTakeHomePerHour(job) {
  const net = Number(job.estimated_net_pay !== undefined ? job.estimated_net_pay : job.pay_amount || 0);
  const hours = Number(job.duration_hours || 0);
  return Number.isFinite(net) && Number.isFinite(hours) && hours > 0 ? net / hours : 0;
}
function erSortJobs(jobs, mode) {
  const items = (jobs || []).slice();
  if (mode === 'take-home') items.sort(function(a,b) {
    return Number(b.estimated_net_pay || b.pay_amount || 0) - Number(a.estimated_net_pay || a.pay_amount || 0) ||
      Number(a.distance_km ?? Infinity) - Number(b.distance_km ?? Infinity);
  });
  else if (mode === 'hourly-rate') items.sort(function(a,b) {
    return erTakeHomePerHour(b) - erTakeHomePerHour(a) ||
      Number(a.distance_km ?? Infinity) - Number(b.distance_km ?? Infinity);
  });
  else if (mode === 'soonest') items.sort(function(a,b) {
    return new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
  });
  else if (mode === 'open-spots') items.sort(function(a,b) {
    return (Number(b.slots || 0) - Number(b.positions_filled || 0)) -
      (Number(a.slots || 0) - Number(a.positions_filled || 0));
  });
  else items.sort(function(a,b) {
    return Number(a.distance_km ?? Infinity) - Number(b.distance_km ?? Infinity) ||
      new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
  });
  return items;
}

function erNearbyCard(job) {
  const gross = Number(job.gross_shift_pay_estimate !== undefined ? job.gross_shift_pay_estimate : job.pay_amount || 0);
  const net = Number(job.estimated_net_pay !== undefined ? job.estimated_net_pay : gross - Number(job.estimated_platform_fee || 0));
  const dist = Number(job.distance_km);
  const distance = Number.isFinite(dist) ? (dist < 0.1 ? 'Under 100 m' : dist.toFixed(1) + ' km away') : 'Nearby';
  const slots = Math.max(0, Number(job.slots || 0) - Number(job.positions_filled || 0));
  const mismatch = job.match && job.match.eligible === false;
  const hasCoordinates = job.latitude !== null && job.latitude !== undefined && job.longitude !== null && job.longitude !== undefined &&
    Number.isFinite(Number(job.latitude)) && Number.isFinite(Number(job.longitude));
  const mapQuery = job.address ? encodeURIComponent([job.address, job.city].filter(Boolean).join(', ')) : '';
  const mapUrl = hasCoordinates
    ? 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(Number(job.latitude) + ',' + Number(job.longitude))
    : (mapQuery ? 'https://www.google.com/maps/search/?api=1&query=' + mapQuery : '');
  const mapsLink = mapUrl ? '<a class="er-map-link" href="' + mapUrl + '" target="_blank" rel="noopener noreferrer">Directions to workplace ↗</a>' : '';
  const isSaved = erSavedShiftIds.has(Number(job.id));
  const saveButton = currentUser && currentUser.role === 'worker'
    ? '<button type="button" class="btn btn-outline er-save-shift ' + (isSaved ? 'is-saved' : '') +
      '" data-er-save-shift="' + Number(job.id) + '" aria-pressed="' + (isSaved ? 'true' : 'false') + '">' +
      '<span aria-hidden="true">' + (isSaved ? '♥' : '♡') + '</span> ' + escapeHtml(t(isSaved ? 'savedShift' : 'saveShift')) + '</button>'
    : '';
  const reportButton = currentUser && currentUser.role === 'worker'
    ? '<button type="button" class="btn btn-outline btn-sm er-report-shift" data-er-report-job="' + Number(job.id) +
      '" data-er-report-title="' + escapeHtml(String(job.title || 'Local shift').slice(0,140)) + '">' + escapeHtml(t('reportConcern')) + '</button>'
    : '';
  return '<article class="er-job-card" data-er-job-id="' + Number(job.id) + '">' +
    '<div class="er-job-card-top"><span class="er-job-icon">' + erCategoryIcon(job.category) + '</span><span class="er-distance-pill">⌖ ' + escapeHtml(distance) + '</span></div>' +
    '<div class="er-job-title-wrap"><div><h3>' + escapeHtml(job.title) + '</h3><p>' + escapeHtml(job.business_name || 'Local business') +
    (job.business_verified ? ' <span class="er-verified-chip">✓ Checked</span>' : '') + '</p></div><span class="er-work-type">' + escapeHtml(job.category || 'Local work') + '</span></div>' +
    '<div class="er-pay-row"><div><small>GROSS / SHIFT</small><strong>' + formatMoney(gross) + '</strong><em>before platform fee</em></div>' +
    '<div class="er-net-pay"><small>EST. YOU RECEIVE</small><strong>' + formatMoney(net) + '</strong><em>after estimated fee</em><small class="er-hourly-estimate">' + (Number(job.duration_hours) > 0 ? formatMoney(net / Number(job.duration_hours)) + '/hr estimated' : 'Hourly estimate unavailable') + '</small></div></div>' +
    '<div class="er-job-facts"><span>◷ ' + escapeHtml(formatDate(job.start_at)) + '</span><span>◴ ' + escapeHtml(job.duration_hours) + ' hrs</span><span>◎ ' + slots + ' spot' + (slots === 1 ? '' : 's') + '</span></div>' +
    (mismatch ? '<p class="er-match-note">Review your skills and availability before applying.</p>' : '') +
    '<div class="er-job-action-row">' + saveButton +
    '<button type="button" class="btn btn-primary er-apply" data-apply-job="' + job.id + '" ' + (mismatch ? 'disabled' : '') + '>' + (mismatch ? 'Profile needed' : 'Apply now') + ' <span>→</span></button>' +
    '<button type="button" class="btn btn-outline er-share-shift" data-share-nearby-job="' + job.id + '">Share shift ↗</button>' +
    '<details class="er-job-details"><summary>Details</summary><p>' + escapeHtml(job.description || '') + '</p>' +
    (job.address ? '<p><b>Workplace:</b> ' + escapeHtml(job.address) + '</p>' : '') + mapsLink +
    (job.requirements && job.requirements.length ? '<p><b>Skills:</b> ' + escapeHtml(job.requirements.join(', ')) + '</p>' : '') +
    (job.breaks_info ? '<p><b>Breaks:</b> ' + escapeHtml(job.breaks_info) + '</p>' : '') +
    (job.equipment_info ? '<p><b>Equipment / dress:</b> ' + escapeHtml(job.equipment_info) + '</p>' : '') +
    (job.safety_info ? '<p><b>Safety instructions:</b> ' + escapeHtml(job.safety_info) + '</p>' : '') +
    '<p><b>Apply by:</b> ' + escapeHtml(formatDate(job.application_deadline)) + '</p><p><b>Payment:</b> ' + escapeHtml(job.payment_terms || 'Confirm terms before accepting.') + '</p>' +
    '<p><b>Hourly comparison:</b> ' + (Number(job.duration_hours) > 0 ? formatMoney(net / Number(job.duration_hours)) + ' estimated take-home per paid hour' : 'not available') + '. This excludes travel time, fares and waiting time.</p>' +
    '<small>Distance is straight-line GPS distance, not driving distance or ETA. Take-home pay is an estimate, not payment confirmation.</small>' + reportButton + '</details></div></article>';
}
function erSortSelectMarkup(selected) {
  const options = [
    ['closest', 'Closest first'],
    ['take-home', 'Highest estimated take-home'],
    ['hourly-rate', 'Best estimated take-home / hour'],
    ['soonest', 'Soonest start'],
    ['open-spots', 'Most open spots']
  ];
  return '<label class="er-sort-field"><span class="er-control-label">Sort shifts by</span><select name="sort_by" aria-label="Sort nearby shifts">' +
    options.map(function(option) {
      return '<option value="' + option[0] + '"' + (selected === option[0] ? ' selected' : '') + '>' + option[1] + '</option>';
    }).join('') + '</select></label>';
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

function erLiveMapSectionMarkup(options) {
  options = options || {};
  const id = options.id || 'er-nearby-map';
  const kind = options.kind || 'nearby';
  const location = options.location && Number.isFinite(Number(options.location.latitude)) && Number.isFinite(Number(options.location.longitude))
    ? {latitude:Number(options.location.latitude), longitude:Number(options.location.longitude)} : null;
  const radius = ER_RADIUS_OPTIONS.includes(Number(options.radius)) ? Number(options.radius) : 3;
  const points = (options.jobs || []).filter(function(job) {
    return Number.isFinite(Number(job.latitude)) && Number.isFinite(Number(job.longitude));
  }).map(function(job) {
    return {
      id:Number(job.id),
      title:String(job.title || 'Local shift').slice(0,140),
      business_name:String(job.business_name || 'Local business').slice(0,140),
      category:String(job.category || 'Local work').slice(0,70),
      address:String(job.address || '').slice(0,300),
      city:String(job.city || '').slice(0,100),
      latitude:Number(job.latitude),
      longitude:Number(job.longitude),
      distance_km:Number.isFinite(Number(job.distance_km)) ? Number(job.distance_km) : null,
      pay_amount:Number(job.estimated_net_pay !== undefined ? job.estimated_net_pay : job.pay_amount || 0)
    };
  });
  const center = location || (kind === 'pin' ? erGetLocation() : null);
  const lat = center && Number.isFinite(Number(center.latitude)) ? Number(center.latitude) : '';
  const lon = center && Number.isFinite(Number(center.longitude)) ? Number(center.longitude) : '';
  const zoom = location ? (radius <= 1 ? 14 : radius <= 3 ? 13 : radius <= 5 ? 12 : radius <= 10 ? 11 : 10) : (kind === 'pin' && center ? 15 : 5);
  const openMapUrl = lat !== '' && lon !== ''
    ? 'https://www.openstreetmap.org/?mlat=' + lat + '&mlon=' + lon + '#map=' + zoom + '/' + lat + '/' + lon
    : 'https://www.openstreetmap.org/#map=5/22.5/79.0';
  const heading = kind === 'pin' ? 'Set the exact workplace pin' : 'Explore shifts around you';
  const copy = kind === 'pin'
    ? 'Tap the map to choose the real work location, or use GPS when you are at the workplace. The chosen pin is shown with the published shift.'
    : 'Real published workplace pins inside your selected radius. Tap a marker to see the shift and open directions.';
  const count = kind === 'pin' ? 'PIN SETUP' : points.length + ' PIN' + (points.length === 1 ? '' : 'S');
  return '<section class="er-live-map-card" aria-label="' + escapeHtml(heading) + '">' +
    '<div class="er-live-map-head"><div><span class="er-map-kicker">' + (kind === 'pin' ? 'WORKPLACE LOCATION' : 'LIVE LOCAL MAP') + '</span><h3>' + escapeHtml(heading) + '</h3><p>' + escapeHtml(copy) + '</p></div>' +
    '<div class="er-live-map-actions">' + (kind === 'pin'
      ? '<button type="button" class="btn btn-outline btn-sm" data-er-map-geolocate>Use my location</button>'
      : '<button type="button" class="btn btn-outline btn-sm" data-er-map-recenter="' + id + '">My location</button>') +
      '<a class="er-map-open-link" href="' + openMapUrl + '" target="_blank" rel="noopener noreferrer">Open map ↗</a></div></div>' +
    '<div id="' + id + '" class="er-live-map" data-er-map-kind="' + kind + '" data-er-map-lat="' + lat + '" data-er-map-lon="' + lon +
      '" data-er-map-radius="' + radius + '" data-er-map-points="' + encodeURIComponent(JSON.stringify(points)) +
      '" role="application" aria-label="' + escapeHtml(kind === 'pin' ? 'Interactive workplace pin map' : 'Interactive nearby shift map') + '" tabindex="0">' +
      '<div class="er-live-map-loading"><span class="loading-spinner"></span><span>Loading live map…</span></div></div>' +
    '<div class="er-live-map-bottom"><p id="' + id + '-status" role="status" aria-live="polite">' +
      (kind === 'pin' ? 'Map pins are a guide. Confirm the marker is on the actual workplace before publishing.' : 'Map uses your temporary device location and public workplace pins.') + '</p>' +
    '<div class="er-map-legend">' + (kind === 'pin'
      ? '<span><i class="er-map-legend-pin"></i> Selected workplace</span>'
      : '<span><i class="er-map-legend-you"></i> Your location</span><span><i class="er-map-legend-job"></i> Published shift</span>') +
    '<small>© OpenStreetMap contributors</small></div></div></section>';
}

let erLeafletLoadPromise = null;
function erLoadLeaflet() {
  if (window.L && typeof window.L.map === 'function') return Promise.resolve(true);
  if (erLeafletLoadPromise) return erLeafletLoadPromise;
  const cssId = 'er-leaflet-css';
  if (!document.getElementById(cssId)) {
    const link = document.createElement('link');
    link.id = cssId;
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.onerror = function() {
      if (!link.dataset.fallbackTried) {
        link.dataset.fallbackTried = '1';
        link.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
      }
    };
    document.head.appendChild(link);
  }
  erLeafletLoadPromise = new Promise(function(resolve) {
    const sources = [
      'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
      'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js'
    ];
    function attempt(index) {
      if (window.L && typeof window.L.map === 'function') return resolve(true);
      if (index >= sources.length) return resolve(false);
      const script = document.createElement('script');
      script.src = sources[index];
      script.async = true;
      let settled = false;
      const timeout = window.setTimeout(function() {
        if (settled) return;
        settled = true;
        attempt(index + 1);
      }, 8000);
      script.onload = function() {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        if (window.L && typeof window.L.map === 'function') resolve(true);
        else attempt(index + 1);
      };
      script.onerror = function() {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        attempt(index + 1);
      };
      document.head.appendChild(script);
    }
    attempt(0);
  });
  return erLeafletLoadPromise;
}
function erMapStatus(el, message) {
  const status = document.getElementById(el.id + '-status');
  if (status) status.textContent = message;
}
function erMapFallback(el) {
  const kind = el.dataset.erMapKind || 'nearby';
  const lat = Number(el.dataset.erMapLat);
  const lon = Number(el.dataset.erMapLon);
  const hasCenter = Number.isFinite(lat) && Number.isFinite(lon) && el.dataset.erMapLat !== '' && el.dataset.erMapLon !== '';
  const mapUrl = hasCenter
    ? 'https://www.openstreetmap.org/?mlat=' + lat + '&mlon=' + lon + '#map=13/' + lat + '/' + lon
    : 'https://www.openstreetmap.org/#map=5/22.5/79.0';
  el.innerHTML = '<div class="er-map-unavailable"><span class="er-empty-icon">⌖</span><b>Live map could not load</b><p>Check your internet connection and try again, or open the map separately.</p><div><button type="button" class="btn btn-outline btn-sm" data-er-map-retry>Try again</button> <a class="btn btn-primary btn-sm" href="' + mapUrl + '" target="_blank" rel="noopener noreferrer">Open OpenStreetMap ↗</a></div></div>';
  erMapStatus(el, kind === 'pin'
    ? 'Interactive map did not load. You can still set a workplace pin with “Set pin from here”.'
    : 'Interactive map did not load. Your job list and nearby filters are still available.');
}
function erCreateJobPopup(job) {
  const root = document.createElement('div');
  root.className = 'er-map-popup';
  const title = document.createElement('strong');
  title.textContent = job.title || 'Local shift';
  root.appendChild(title);
  const business = document.createElement('p');
  business.textContent = [job.business_name || 'Local business', job.category || 'Local work'].join(' · ');
  root.appendChild(business);
  if (job.distance_km !== null && Number.isFinite(Number(job.distance_km))) {
    const distance = document.createElement('small');
    distance.textContent = Number(job.distance_km).toFixed(1) + ' km away · estimated take-home ' + formatMoney(job.pay_amount || 0);
    root.appendChild(distance);
  }
  const actions = document.createElement('div');
  actions.className = 'er-map-popup-actions';
  const view = document.createElement('button');
  view.type = 'button';
  view.className = 'btn btn-primary btn-sm';
  view.textContent = 'View shift';
  view.dataset.erMapFocusJob = String(Number(job.id));
  view.addEventListener('click', function(event) {
    event.preventDefault();
    event.stopPropagation();
    erFocusJobCard(Number(job.id));
  });
  actions.appendChild(view);
  const directions = document.createElement('a');
  directions.className = 'btn btn-outline btn-sm';
  directions.href = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(Number(job.latitude) + ',' + Number(job.longitude));
  directions.target = '_blank';
  directions.rel = 'noopener noreferrer';
  directions.textContent = 'Directions ↗';
  actions.appendChild(directions);
  root.appendChild(actions);
  return root;
}
function erFocusJobCard(jobId) {
  if (!Number.isFinite(Number(jobId)) || Number(jobId) <= 0) return;
  const card = document.querySelector('[data-er-job-id="' + Number(jobId) + '"]');
  if (!card) return;
  card.scrollIntoView({behavior:'smooth',block:'center'});
  card.classList.add('er-map-job-highlight');
  window.setTimeout(function(){card.classList.remove('er-map-job-highlight');},1800);
}
function erSetWorkplacePin(latitude, longitude, accuracy, source) {
  const lat = Number(latitude), lon = Number(longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new Error('Choose a valid point on the map.');
  }
  const latInput = document.getElementById('job-latitude');
  const lonInput = document.getElementById('job-longitude');
  if (!latInput || !lonInput) return;
  latInput.value = lat.toFixed(7);
  lonInput.value = lon.toFixed(7);
  const label = document.getElementById('er-new-pin-label');
  const help = document.getElementById('er-new-pin-help');
  const sourceIsGps = source === 'gps';
  if (label) label.textContent = sourceIsGps
    ? 'Workplace pin ready · ±' + Math.max(1, Math.round(Number(accuracy || 0))) + ' m reported accuracy'
    : 'Map pin selected · ' + lat.toFixed(5) + ', ' + lon.toFixed(5);
  if (help) help.textContent = 'Confirm this pin is at the actual work location. This workplace pin is visible with the published shift; your personal location is not saved to your profile.';
  const mapEl = document.getElementById('er-workplace-map');
  if (mapEl && mapEl._erMapInstance) {
    const L = window.L, map = mapEl._erMapInstance;
    if (mapEl._erPinMarker) mapEl._erPinMarker.setLatLng([lat, lon]);
    else mapEl._erPinMarker = L.circleMarker([lat, lon], {radius:9,color:'#ffffff',weight:3,fillColor:'#244b32',fillOpacity:1}).addTo(map);
    map.setView([lat, lon], Math.max(16, map.getZoom()));
  }
  if (mapEl) erMapStatus(mapEl, 'Selected workplace pin: ' + lat.toFixed(5) + ', ' + lon.toFixed(5) + '. Check the map before publishing.');
}
function erInitializeLiveMap(el) {
  if (!el || el._erMapInstance || !window.L || !document.body.contains(el)) return;
  const L = window.L;
  const kind = el.dataset.erMapKind || 'nearby';
  const lat = Number(el.dataset.erMapLat), lon = Number(el.dataset.erMapLon);
  const hasLocation = el.dataset.erMapLat !== '' && el.dataset.erMapLon !== '' && Number.isFinite(lat) && Number.isFinite(lon);
  let points = [];
  try { points = JSON.parse(decodeURIComponent(el.dataset.erMapPoints || '%5B%5D')); } catch (_) { points = []; }
  points = Array.isArray(points) ? points.filter(function(job) {
    return Number.isFinite(Number(job.latitude)) && Number.isFinite(Number(job.longitude)) &&
      Math.abs(Number(job.latitude)) <= 90 && Math.abs(Number(job.longitude)) <= 180;
  }) : [];
  const latInput = document.getElementById('job-latitude');
  const lonInput = document.getElementById('job-longitude');
  const storedWorkplaceLat = Number(latInput && latInput.value);
  const storedWorkplaceLon = Number(lonInput && lonInput.value);
  const hasWorkplacePin = kind === 'pin' &&
    Number.isFinite(storedWorkplaceLat) && Math.abs(storedWorkplaceLat) <= 90 &&
    Number.isFinite(storedWorkplaceLon) && Math.abs(storedWorkplaceLon) <= 180 &&
    String(latInput && latInput.value || '').trim() !== '' &&
    String(lonInput && lonInput.value || '').trim() !== '';
  const startLat = hasWorkplacePin ? storedWorkplaceLat : (hasLocation ? lat : 22.9734);
  const startLon = hasWorkplacePin ? storedWorkplaceLon : (hasLocation ? lon : 78.6569);
  const startZoom = hasWorkplacePin ? 16 : (hasLocation ? (kind === 'pin' ? 15 : (Number(el.dataset.erMapRadius) <= 1 ? 14 : Number(el.dataset.erMapRadius) <= 3 ? 13 : Number(el.dataset.erMapRadius) <= 5 ? 12 : Number(el.dataset.erMapRadius) <= 10 ? 11 : 10)) : 5);
  el.innerHTML = '';
  const map = L.map(el, {zoomControl:true, preferCanvas:true, scrollWheelZoom:false}).setView([startLat,startLon], startZoom);
  el._erMapInstance = map;
  const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom:19,
    attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
    crossOrigin:true
  }).addTo(map);
  let tileErrors = 0;
  tileLayer.on('tileerror', function() {
    tileErrors += 1;
    if (tileErrors >= 3) erMapStatus(el, 'Map tiles are unavailable on this network. Try again later or use the OpenStreetMap link above.');
  });
  if (kind === 'pin') {
    if (hasWorkplacePin) {
      el._erPinMarker = L.circleMarker([storedWorkplaceLat,storedWorkplaceLon], {radius:9,color:'#ffffff',weight:3,fillColor:'#244b32',fillOpacity:1}).addTo(map);
      erMapStatus(el, 'Workplace pin loaded. Tap the map to adjust its exact position.');
    } else {
      erMapStatus(el, 'Move the map to the actual workplace, then tap to set the public shift pin. Or use your device location when onsite.');
    }
    map.on('click', function(event) {
      try { erSetWorkplacePin(event.latlng.lat, event.latlng.lng, 0, 'map'); }
      catch (error) { showToast(friendlyError(error), 'error'); }
    });
  } else {
    const radius = Number(el.dataset.erMapRadius) || 3;
    if (hasLocation) {
      L.circle([lat,lon], {radius:radius*1000,color:'#6d9133',weight:2,fillColor:'#c9f451',fillOpacity:.09,dashArray:'5 6'}).addTo(map);
      L.circleMarker([lat,lon], {radius:7,color:'#ffffff',weight:3,fillColor:'#2978bd',fillOpacity:1}).bindTooltip('Your device location').addTo(map);
    }
    points.forEach(function(job) {
      const point = [Number(job.latitude),Number(job.longitude)];
      const marker = L.circleMarker(point, {radius:8,color:'#183b2b',weight:2,fillColor:'#c9f451',fillOpacity:1});
      marker.bindPopup(erCreateJobPopup(job), {maxWidth:260,autoPan:true});
      marker.addTo(map);
    });
    if (hasLocation) erMapStatus(el, points.length
      ? points.length + ' published workplace pin' + (points.length===1?'':'s') + ' shown. The ring marks your selected ' + radius + ' km radius.'
      : 'Map ready. No published workplace pins were returned for this radius and category yet.');
    else erMapStatus(el, points.length ? points.length + ' workplace pin' + (points.length===1?'':'s') + ' shown.' : 'Map ready. No workplace pins are available in this response.');
  }
  window.requestAnimationFrame(function() { if (document.body.contains(el) && el._erMapInstance) map.invalidateSize(); });
}
function erDisposeLiveMaps(root) {
  root = root || document;
  const maps = [];
  if (root.matches && root.matches('.er-live-map[data-er-map-kind]')) maps.push(root);
  if (root.querySelectorAll) maps.push.apply(maps, Array.from(root.querySelectorAll('.er-live-map[data-er-map-kind]')));
  maps.forEach(function(el) {
    if (el._erMapInstance && typeof el._erMapInstance.remove === 'function') {
      try { el._erMapInstance.remove(); } catch (_) { /* The view may already be detached. */ }
    }
    el._erMapInstance = null;
    el._erPinMarker = null;
    el.dataset.erMapLoading = '';
  });
}
function erEnhanceLiveMaps() {
  const maps = Array.from(document.querySelectorAll('.er-live-map[data-er-map-kind]')).filter(function(el) {
    return !el._erMapInstance && el.dataset.erMapLoading !== '1';
  });
  if (!maps.length) return;
  maps.forEach(function(el) { el.dataset.erMapLoading = '1'; });
  erLoadLeaflet().then(function(loaded) {
    maps.forEach(function(el) {
      if (!document.body.contains(el)) return;
      el.dataset.erMapLoading = '';
      if (loaded) erInitializeLiveMap(el);
      else erMapFallback(el);
    });
  }).catch(function() {
    maps.forEach(function(el) {
      if (document.body.contains(el)) { el.dataset.erMapLoading = ''; erMapFallback(el); }
    });
  });
}

function erWorkerSafetyPanel() {
  return '<section class="er-safety-panel">' +
    '<div class="er-safety-mark" aria-hidden="true">✓</div><div class="er-safety-copy"><span class="er-overline">' + escapeHtml(t('jobSafety')) + '</span>' +
    '<h3>' + escapeHtml(t('safetyIntro')) + '</h3><p>' + escapeHtml(t('safetyRule')) + '</p>' +
    '<div class="er-safety-actions"><a class="er-safety-call" href="tel:112">☎ ' + escapeHtml(t('emergency112')) + '</a>' +
    '<a class="er-safety-link" href="tel:1930">' + escapeHtml(t('cyberHelp')) + '</a>' +
    '<a class="er-safety-link" href="https://112.gov.in/" target="_blank" rel="noopener noreferrer">' + escapeHtml(t('officialSafety')) + ' ↗</a>' +
    '<a class="er-safety-link" href="https://www.ncs.gov.in/" target="_blank" rel="noopener noreferrer">National Career Service ↗</a></div></div></section>';
}

async function renderSavedShifts() {
  let result;
  try {
    result = await api('/api/worker/saved-shifts');
  } catch (error) {
    return pageHeading('YOUR SHORTLIST', t('savedShifts'), t('savedShiftsSub'), '<button type="button" class="btn btn-outline" data-retry>Try again ↻</button>') +
      '<div class="er-nearby-empty"><div class="er-empty-icon">♡</div><h3>' + escapeHtml(friendlyError(error)) + '</h3><p>Your saved list could not load right now. Your saved shifts remain tied to your account.</p></div>';
  }
  const items = (result.items || []).map(function(job) {
    const location = erGetLocation();
    const copy = Object.assign({}, job);
    if (location && Number.isFinite(Number(job.latitude)) && Number.isFinite(Number(job.longitude))) {
      copy.distance_km = erDistanceKm(location.latitude, location.longitude, job.latitude, job.longitude);
    }
    return copy;
  });
  erSavedShiftIds = new Set(items.map(function(job) { return Number(job.id); }));
  erSavedShiftIdsAvailable = true;
  const cards = items.length
    ? '<div class="er-job-grid">' + items.map(erNearbyCard).join('') + '</div>'
    : '<div class="er-nearby-empty er-saved-empty"><div class="er-empty-icon">♡</div><h3>' + escapeHtml(t('noSavedShifts')) + '</h3><p>' +
      escapeHtml(t('noSavedShiftsCopy')) + '</p><button type="button" class="btn btn-primary" data-screen="discover">Find nearby work →</button></div>';
  return pageHeading('YOUR SHORTLIST', t('savedShifts'), t('savedShiftsSub'),
    '<button type="button" class="btn btn-primary" data-screen="discover">Find more shifts ↗</button>') +
    '<div class="er-saved-summary"><span class="er-saved-count">' + items.length + '</span><span>' + items.length + ' saved shift' + (items.length === 1 ? '' : 's') +
    '</span><small>Private to your account · Updated from the server</small></div>' + cards +
    '<p class="er-saved-note">A saved shift is a shortlist, not an application or a reservation. Check pay, time, workplace and availability again before you apply.</p>';
}

renderWorkerOverview = async function() {
  await erRefreshSavedShiftIds();
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
  else list = '<div class="er-nearby-empty"><div class="er-empty-icon">⌖</div><h3>No shifts inside ' + radius + ' km yet</h3><p>We only show shifts with a real workplace pin inside your selected radius. Try a wider range or another category.</p>' + erRadiusNextAction(radius, 'Look within ') + '</div>';
  return '<section class="er-nearby-hero"><div class="er-hero-main"><span class="er-overline"><i></i> LOCAL GIGS · CLEAR PAY</span>' +
    '<h1>Hi ' + escapeHtml(firstName) + '.<br><span>Let’s earn nearby.</span></h1><p>Short shifts, local gigs and paid help up to 15 km away. Less travel, more time back.</p>' +
    '<div class="er-hero-actions"><button type="button" class="btn btn-primary btn-large" data-er-enable-location>' + (location ? '↻ Refresh my location' : '⌖ Find jobs near me') + '</button>' +
    '<span>' + (location ? 'Location ready · approx. ±' + Math.max(1, Number(location.accuracy_m || 0)) + ' m' : 'Location is only used to find nearby work') + '</span></div></div>' +
    '<div class="er-hero-map" aria-hidden="true"><div class="er-map-roads"></div><span class="er-map-shop er-shop-a">🛍️</span><span class="er-map-shop er-shop-b">📦</span><span class="er-map-shop er-shop-c">☕</span><span class="er-map-pin">⌖</span><span class="er-map-label">' + radius + ' km radius</span></div></section>' +
    '<section class="er-nearby-section"><div class="er-section-head"><div><span class="er-overline">YOUR NEIGHBOURHOOD</span><h2>Work around you</h2><p>Closest first. Pay shown up front. One-tap apply.</p></div><button type="button" class="btn btn-outline" data-screen="discover">Browse nearby →</button></div>' +
    '<div class="er-filter-panel"><div><span class="er-control-label">How far can you go?</span>' + erRadiusButtons(radius) + '</div><div class="er-categories"><span class="er-control-label">Choose work type</span>' + erCategoryButtons(category) + '</div></div>' + (location ? erLiveMapSectionMarkup({id:'er-nearby-map',kind:'nearby',location:location,radius:radius,jobs:result && result.items ? result.items : []}) : '') + list + '</section>' +
    '<section class="er-quick-links"><button type="button" data-screen="applications"><span class="er-quick-icon">▤</span><span><b>Applications</b><small>' + applications.length + ' sent</small></span><i>→</i></button>' +
    '<button type="button" data-screen="saved-shifts"><span class="er-quick-icon">♡</span><span><b>' + escapeHtml(t('savedShifts')) + '</b><small>' + erSavedShiftIds.size + ' saved</small></span><i>→</i></button>' +
    '<button type="button" data-screen="schedule"><span class="er-quick-icon">▦</span><span><b>My schedule</b><small>' + confirmed.length + ' confirmed</small></span><i>→</i></button>' +
    '<button type="button" data-screen="earnings"><span class="er-quick-icon">₹</span><span><b>My earnings</b><small>' + formatMoney(earnings.pending_settlement || 0) + ' pending</small></span><i>→</i></button></section>' + erWorkerSafetyPanel();
};
renderDiscover = async function(filters) {
  filters = filters || {};
  await erRefreshSavedShiftIds();
  const location = erGetLocation();
  const requestedRadius = Number(filters.radius_km || erRadius());
  const radius = ER_RADIUS_OPTIONS.includes(requestedRadius) ? requestedRadius : erRadius();
  const category = filters.category || erCategory();
  const allowedSorts = ['closest','take-home','hourly-rate','soonest','open-spots'];
  const requestedSort = String(filters.sort_by || sessionStorage.getItem('earnroute_nearby_sort') || 'closest');
  const sortBy = allowedSorts.includes(requestedSort) ? requestedSort : 'closest';
  if (!location) {
    return pageHeading('NEARBY WORK','Find a gig close to you.','Choose 1 km, 3 km, 5 km or open More for 8 km, 10 km and 15 km. EarnRoute shows only jobs with a real workplace pin inside that distance.','') +
      '<div class="er-discover-toolbar"><div><span class="er-control-label">Distance limit</span>' + erRadiusButtons(radius) + '</div></div>' + erLocationPrompt();
  }
  let result;
  try { result = await erFetchNearby({radius:radius, category:category, search:String(filters.search || ''), minPay:filters.min_pay || ''}); }
  catch (error) {
    return pageHeading('NEARBY WORK','Jobs around you.','Only real nearby shifts are listed here.','') + '<div class="er-nearby-empty"><h3>Could not load nearby jobs</h3><p>' + escapeHtml(friendlyError(error)) + '</p><button class="btn btn-outline" data-er-enable-location>Try again</button></div>';
  }
  const visibleJobs = erSortJobs(result.items || [], sortBy);
  const sortDescription = {
    closest:'closest first', 'take-home':'highest estimated take-home first',
    'hourly-rate':'best estimated take-home per paid hour', soonest:'soonest start first', 'open-spots':'most open spots first'
  }[sortBy];
  return pageHeading('NEARBY WORK','Find work close to you.','No far-away listings. Compare distance, shift time and estimated take-home before applying.','<button type="button" class="btn btn-outline" data-er-enable-location>↻ Refresh location</button>') +
    '<div class="er-discover-toolbar"><div><span class="er-control-label">Distance limit</span>' + erRadiusButtons(radius) + '</div><div><span class="er-control-label">Work type</span>' + erCategoryButtons(category) + '</div><span class="er-location-note">⌖ Using device location · ' + radius + ' km maximum</span></div>' +
    '<form id="er-nearby-filter" class="er-search-row"><input name="search" placeholder="Search a local gig" aria-label="Search nearby jobs" value="' + escapeHtml(filters.search || '') + '">' +
    '<input name="min_pay" type="number" min="0" step="50" placeholder="Min pay ₹" value="' + escapeHtml(filters.min_pay || '') + '" aria-label="Minimum pay">' +
    erSortSelectMarkup(sortBy) + '<button class="btn btn-primary" type="submit">Search</button><button class="btn btn-outline" type="reset">Clear</button></form>' +
    '<div class="er-results-note"><b>' + (result.total || 0) + '</b> shift' + (result.total === 1 ? '' : 's') + ' within ' + radius + ' km · ' + sortDescription + '</div>' +
    erLiveMapSectionMarkup({id:'er-nearby-map',kind:'nearby',location:location,radius:radius,jobs:visibleJobs}) +
    (visibleJobs.length ? '<div class="er-job-grid">' + visibleJobs.map(erNearbyCard).join('') + '</div>' :
    '<div class="er-nearby-empty"><div class="er-empty-icon">⌖</div><h3>No shifts in this radius yet</h3><p>Only jobs with a real workplace pin are shown. Expand the distance or try another category.</p>' + erRadiusNextAction(radius, 'Expand to ') + '</div>');
};
renderPostJob = function() {
  let html = erBasePostJob();
  const addressPattern = /(<div class="form-field span-2"><label for="job-address">[\s\S]*?<\/div>)(\s*<div class="form-field"><label for="job-slots">)/;
  const workplacePin = '\n  <div class="form-field span-2"><label>Exact workplace pin <span class="er-required-pin">Required to publish</span></label>' +
    '<div class="er-workplace-pin"><span class="er-pin-symbol">⌖</span><div><b id="er-new-pin-label">Workplace location not set</b><small id="er-new-pin-help">Stand at the actual shift location, then set the pin. Your personal location is not saved to your account.</small></div>' +
    '<button type="button" class="btn btn-outline btn-sm" data-er-capture-pin>Set pin from here</button></div><input type="hidden" id="job-latitude" name="latitude"><input type="hidden" id="job-longitude" name="longitude"></div><div class="form-field span-2 er-pin-map-field">' + erLiveMapSectionMarkup({id:'er-workplace-map',kind:'pin',location:erGetLocation(),radius:3,jobs:[]}) + '</div>\n';
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
      ['overview','⌂','Home'], ['discover','⌕','Nearby'], ['saved-shifts','♡','Saved'],
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
  erDisposeLiveMaps($('#view-root'));
  await erBaseRenderPage();
  erEnsureMobileNav();
  erEnhanceLiveMaps();
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
  if (target.hasAttribute('data-er-report-job')) {
    const jobId = Number(target.dataset.erReportJob);
    const title = String(target.dataset.erReportTitle || 'Local shift').slice(0,140);
    const reason = window.prompt(t('reportMinChars'));
    if (reason === null) return;
    const cleanReason = reason.trim();
    if (cleanReason.length < 20) {
      showToast(t('reportMinChars'), 'error');
      return;
    }
    target.disabled = true;
    try {
      await api('/api/support/tickets', {
        method:'POST',
        body:{
          subject:('Safety concern: shift #' + jobId + ' — ' + title).slice(0,140),
          category:'safety',
          message:'Published shift ID: ' + jobId + '\nShift title: ' + title + '\nWorker report: ' + cleanReason
        }
      });
      showToast(t('safetyReportSent'));
      target.textContent = 'Reported ✓';
      target.disabled = true;
    } catch (error) {
      showToast(friendlyError(error), 'error');
      target.disabled = false;
    }
    return;
  }
  if (target.hasAttribute('data-er-save-shift')) {
    const jobId = Number(target.dataset.erSaveShift);
    const wasSaved = erSavedShiftIds.has(jobId);
    target.disabled = true;
    try {
      const response = await api('/api/jobs/' + encodeURIComponent(jobId) + '/save', {
        method:wasSaved ? 'DELETE' : 'POST'
      });
      if (response.saved) erSavedShiftIds.add(jobId);
      else erSavedShiftIds.delete(jobId);
      showToast(response.saved ? 'Shift saved to your private shortlist.' : 'Shift removed from your saved list.');
      await renderPage();
    } catch (error) {
      showToast(friendlyError(error), 'error');
      target.disabled = false;
    }
    return;
  }
  if (target.hasAttribute('data-er-map-retry')) {
    erLeafletLoadPromise = null;
    erEnhanceLiveMaps();
    return;
  }
  if (target.hasAttribute('data-er-map-recenter')) {
    const mapEl = document.getElementById(target.dataset.erMapRecenter);
    const location = erGetLocation();
    if (mapEl && mapEl._erMapInstance && location) {
      const radius = erRadius();
      const zoom = radius <= 1 ? 14 : radius <= 3 ? 13 : radius <= 5 ? 12 : radius <= 10 ? 11 : 10;
      mapEl._erMapInstance.setView([Number(location.latitude), Number(location.longitude)], zoom);
    } else if (!location) showToast('Use your location first to recenter the map.', 'error');
    return;
  }
  if (target.hasAttribute('data-er-map-geolocate')) {
    const oldText = target.textContent;
    target.disabled = true;
    target.textContent = 'Finding location…';
    try {
      const pin = await erUseLocation();
      erSetWorkplacePin(pin.latitude, pin.longitude, pin.accuracy_m, 'gps');
      const mapEl = document.getElementById('er-workplace-map');
      if (mapEl && mapEl._erMapInstance) mapEl._erMapInstance.setView([pin.latitude,pin.longitude],16);
      showToast('Workplace map centered on this device. Confirm you are at the real worksite.');
    } catch (error) {
      showToast(friendlyError(error), 'error');
    } finally {
      target.disabled = false;
      target.textContent = oldText;
    }
    return;
  }
  if (target.hasAttribute('data-er-map-focus-job')) {
    event.preventDefault();
    erFocusJobCard(Number(target.dataset.erMapFocusJob));
    return;
  }
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
  if (target.hasAttribute('data-share-nearby-job')) {
    const oldText = target.textContent;
    target.disabled = true;
    target.textContent = 'Preparing shift details…';
    try {
      const result = await api('/api/jobs/' + encodeURIComponent(target.dataset.shareNearbyJob));
      const job = result.job;
      if (!job) throw new Error('This shift is no longer available.');
      const locationText = [job.address, job.city].filter(Boolean).join(', ');
      const mapLink = job.address ? 'Directions: https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(locationText) : '';
      const message = [
        'EarnRoute shift details',
        'Shift: ' + (job.title || 'Local paid shift'),
        'Business: ' + (job.business_name || 'Local business'),
        'Category: ' + (job.category || 'Local work'),
        'Distance: ' + (typeof job.distance_km === 'number' ? job.distance_km.toFixed(1) + ' km (straight-line)' : 'Check in EarnRoute'),
        'Workplace: ' + (locationText || 'Confirm the workplace with the business'),
        'Start: ' + formatDate(job.start_at),
        'Gross shift pay: ' + formatMoney(job.gross_shift_pay_estimate !== undefined ? job.gross_shift_pay_estimate : job.pay_amount),
        'Estimated take-home: ' + formatMoney(job.estimated_net_pay),
        mapLink,
        'Shared from EarnRoute. Confirm the published details before travelling.'
      ].filter(Boolean).join('\n');
      await shareEarnRouteText('EarnRoute shift details', message);
    } catch (error) {
      showToast(friendlyError(error), 'error');
    } finally {
      target.disabled = false;
      target.textContent = oldText;
    }
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
        erSetWorkplacePin(pin.latitude, pin.longitude, pin.accuracy_m, 'gps');
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
    if (['closest','take-home','hourly-rate','soonest','open-spots'].includes(String(data.sort_by || ''))) {
      sessionStorage.setItem('earnroute_nearby_sort', String(data.sort_by));
    }
    erDisposeLiveMaps($('#view-root'));
    $('#view-root').innerHTML = '<div class="loading-surface"><span class="loading-spinner"></span><span>Finding the closest shifts…</span></div>';
    try {
      $('#view-root').innerHTML = await renderDiscover(Object.assign({}, data, {radius_km:erRadius(), category:erCategory()}));
      erEnsureMobileNav();
      erEnhanceLiveMaps();
    } catch (error) { showToast(friendlyError(error), 'error'); }
  }
});
document.addEventListener('reset', function(event) {
  if (event.target && event.target.id === 'er-nearby-filter') {
    event.preventDefault();
    sessionStorage.removeItem('earnroute_nearby_category');
    sessionStorage.removeItem('earnroute_nearby_sort');
    setTimeout(function(){renderPage();}, 0);
  }
});
