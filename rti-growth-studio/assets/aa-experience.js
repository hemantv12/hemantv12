/* AA Growth Studio — interactive illustration and motion layer.
   1. Dash fields: canvas illustrations that are always in motion and follow the cursor ([data-aa-field]).
   2. Heading reveals: words rise into place as headings enter the viewport.
   3. Scroll-scrubbed copy: words light up as the reader scrolls ([data-aa-scrub]).
   4. Smooth scrolling with Lenis on precise-pointer devices.
   Motion runs regardless of the OS reduce-motion setting (a deliberate choice by the studio).
   Without JS everything is static and fully readable. */
(function () {
  'use strict';
  var root = document.documentElement;
  var finePointer = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  root.classList.add('aa-exp');

  var TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  // Frame-rate independent easing: fraction of the remaining distance to cover this frame.
  function ease(rate, dt) { return 1 - Math.pow(1 - rate, dt * 60); }
  function hexToRgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }

  /* ---------- 1. Dash fields ---------- */

  // Brand hues deep enough to read on the paper background; fields cycle through them.
  var PALETTES = {
    studio: ['#5f7d1f', '#9db526', '#ff674d', '#d4486b', '#7a62e8', '#2f8f8a'],
    warm: ['#ff674d', '#e0892a', '#c9a227', '#9db526'],
    cool: ['#7a62e8', '#4a78d6', '#2f8f8a', '#5f7d1f'],
    lime: ['#9db526', '#5f7d1f', '#2f8f8a', '#171914']
  };
  var STEPS = 48, ALPHA_LEVELS = 4;

  function colourRamp(hexes) {
    var stops = hexes.concat([hexes[0]]).map(hexToRgb), out = [];
    for (var i = 0; i < STEPS; i++) {
      var f = i / STEPS * (stops.length - 1), k = Math.floor(f), t = f - k, a = stops[k], b = stops[k + 1];
      out.push('rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' + Math.round(a[1] + (b[1] - a[1]) * t) + ',' + Math.round(a[2] + (b[2] - a[2]) * t) + ')');
    }
    return out;
  }

  function Field(host) {
    this.host = host;
    this.mode = host.getAttribute('data-aa-field') || 'rings';
    this.dense = host.hasAttribute('data-aa-field-dense');
    this.ramp = colourRamp(PALETTES[host.getAttribute('data-aa-palette')] || PALETTES.studio);
    this.trackWindow = host.hasAttribute('data-aa-field-window');
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'aa-field-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    host.insertBefore(this.canvas, host.firstChild);
    this.ctx = this.canvas.getContext('2d');
    this.t = Math.random() * 60;
    this.age = 0;                 // seconds since first frame, drives the entrance wave
    this.energy = 0;              // 0..1, rises with fast cursor movement and settles back
    this.pulses = [];             // expanding rings: { x, y, born, strength }
    this.nextPulse = 2.2;
    this.pointer = false;
    this.visible = false;
    this.last = 0;
    this.buckets = [];
    for (var i = 0; i < STEPS * ALPHA_LEVELS; i++) this.buckets.push([]);
    this.resize();
    this.bind();
  }

  Field.prototype.resize = function () {
    var r = this.host.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, finePointer ? 2 : 1.5);
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.canvas.width = Math.round(this.w * dpr); this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.idle();
    this.cx = this.tx; this.cy = this.ty;
    var small = this.w < 640, pts = [], i, s;
    // Dashes keep fixed places on a loose grid; only the ripple travels and follows the cursor.
    var g = this.mode === 'grid' ? (small ? 20 : 22) : this.dense ? 17 : small ? 28 : 32;
    var jitter = this.mode === 'grid' ? 0 : 0.42;
    this.reach = Math.hypot(this.w, this.h) * (this.mode === 'grid' ? 0.7 : 0.62);
    for (var y = g / 2; y < this.h; y += g) {
      for (var x = g / 2; x < this.w; x += g) {
        s = Math.random();
        pts.push({ bx: x + (Math.random() - 0.5) * g * jitter * 2, by: y + (Math.random() - 0.5) * g * jitter * 2, s: s, dot: this.mode === 'rings' && s < 0.2, a: Math.random() * TAU });
      }
    }
    this.pts = pts;
  };

  // Where the centre wanders when nobody is pointing: a slow, never-repeating loop.
  Field.prototype.idle = function () {
    var t = this.t, ax = this.host.hasAttribute('data-aa-field-right') ? 0.7 : 0.5;
    this.tx = this.w * (ax + 0.16 * Math.sin(t * 0.23) + 0.06 * Math.sin(t * 0.61));
    this.ty = this.h * (0.5 + 0.17 * Math.sin(t * 0.31 + 1.3) + 0.05 * Math.cos(t * 0.53));
  };

  Field.prototype.pulse = function (x, y, strength) {
    this.pulses.push({ x: x, y: y, born: this.t, strength: strength });
    if (this.pulses.length > 5) this.pulses.shift();
  };

  Field.prototype.bind = function () {
    var self = this, target = this.trackWindow ? window : this.host, lastMove = 0;
    function local(e) { var r = self.host.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, r]; }
    target.addEventListener('pointermove', function (e) {
      var l = local(e), x = l[0], y = l[1], r = l[2];
      if (x < -60 || y < -60 || x > r.width + 60 || y > r.height + 60) { self.pointer = false; return; }
      // Cursor speed feeds "energy": quick flicks make the ripple surge, then it settles.
      if (self.pointer && lastMove) {
        var speed = Math.hypot(x - self.px, y - self.py) / Math.max((e.timeStamp - lastMove) / 1000, 0.008);
        self.energy = Math.max(self.energy, clamp(speed / 2200, 0, 1));
      }
      lastMove = e.timeStamp; self.pointer = true; self.px = x; self.py = y;
    }, { passive: true });
    target.addEventListener('pointerdown', function (e) {
      var l = local(e);
      if (l[0] >= 0 && l[1] >= 0 && l[0] <= l[2].width && l[1] <= l[2].height) self.pulse(l[0], l[1], 1);
    }, { passive: true });
    if (!this.trackWindow) this.host.addEventListener('pointerenter', function (e) { var l = local(e); self.pulse(l[0], l[1], 0.55); });
    (this.trackWindow ? document.documentElement : this.host).addEventListener('pointerleave', function () { self.pointer = false; lastMove = 0; });
  };

  Field.prototype.frame = function (now) {
    var dt = this.last ? Math.min((now - this.last) / 1000, 0.05) : 1 / 60;
    this.last = now; this.t += dt; this.age += dt;
    if (this.pointer) { this.tx = this.px; this.ty = this.py; } else this.idle();
    var k = 1 - Math.pow(this.pointer ? 0.0009 : 0.02, dt);
    this.cx += (this.tx - this.cx) * k; this.cy += (this.ty - this.cy) * k;
    this.energy *= Math.pow(0.18, dt);
    // A soft ring leaves the centre every few seconds so the field never sits still.
    this.nextPulse -= dt;
    if (this.nextPulse <= 0) { this.pulse(this.cx, this.cy, 0.6); this.nextPulse = 3.6 + Math.random() * 2.4; }
    while (this.pulses.length && this.t - this.pulses[0].born > 2.6) this.pulses.shift();
    this.draw(dt);
  };

  // Brightness of passing pulse rings at a point: a soft band moving outward at 460px/s.
  Field.prototype.ringAt = function (x, y) {
    var sum = 0;
    for (var i = 0; i < this.pulses.length; i++) {
      var q = this.pulses[i], age = this.t - q.born, edge = age * 460, d = Math.hypot(x - q.x, y - q.y) - edge;
      if (d > -90 && d < 90) sum += Math.exp(-(d * d) / 1800) * q.strength * (1 - age / 2.6);
    }
    return sum > 1 ? 1 : sum;
  };

  // Entrance: dashes grow outward from the starting centre during the first second and a half.
  Field.prototype.reveal = function (d) {
    return this.age > 3 ? 1 : clamp((this.age * 900 - d) / 260, 0, 1);
  };

  Field.prototype.push = function (hue, alpha, x, y, dir, len) {
    if (alpha < 0.04 || x < -20 || y < -20 || x > this.w + 20 || y > this.h + 20) return;
    var b = Math.floor(((hue % 1) + 1) % 1 * STEPS) % STEPS * ALPHA_LEVELS + Math.min(ALPHA_LEVELS - 1, Math.floor(alpha * ALPHA_LEVELS));
    var hx = Math.cos(dir) * len / 2, hy = Math.sin(dir) * len / 2;
    this.buckets[b].push(x - hx, y - hy, x + hx, y + hy);
  };

  Field.prototype.draw = function (dt) {
    var ctx = this.ctx, pts = this.pts, cx = this.cx, cy = this.cy, t = this.t, reach = this.reach, dots = [], i, p;
    for (i = 0; i < this.buckets.length; i++) this.buckets[i].length = 0;

    if (this.mode === 'rings') {
      // Ripples travel outwards from the centre; dashes point along the radius and ease aside near it.
      var clear = this.dense ? 34 : 88, en = this.energy;
      for (i = 0; i < pts.length; i++) {
        p = pts[i];
        var dx = p.bx - cx, dy = p.by - cy, d = Math.sqrt(dx * dx + dy * dy) || 1, show = this.reveal(d);
        if (p.dot) { if (show > 0.5) dots.push(p.bx, p.by); continue; }
        var inner = clamp((d - clear) / 140, 0, 1), outer = clamp(1 - d / reach, 0, 1);
        // Two interfering waves give the ripple an organic, uneven rhythm.
        var wave = 0.5 + 0.5 * (0.7 * Math.sin(d * 0.021 - t * 1.5 + p.s * 0.8) + 0.3 * Math.sin(d * 0.047 - t * 2.3));
        var ring = this.ringAt(p.bx, p.by);
        var push = (22 + 34 * en) * Math.exp(-d / (170 + 90 * en)) + 12 * ring;
        this.push((Math.atan2(dy, dx) + Math.PI) / TAU + t * 0.015,
          show * clamp(inner * (0.15 + 0.85 * outer) * (0.35 + 0.65 * wave) + 0.7 * ring, 0, 1),
          p.bx + dx / d * push, p.by + dy / d * push, Math.atan2(dy, dx),
          show * (1.5 + (8 + 6 * en) * wave * wave * inner + 9 * ring));
      }
    } else if (this.mode === 'flow') {
      // A slow current turns the dashes in place; the cursor bends nearby dashes towards it.
      for (i = 0; i < pts.length; i++) {
        p = pts[i];
        var flow = Math.sin(p.bx * 0.011 + t * 0.35) * Math.cos(p.by * 0.013 - t * 0.27) * Math.PI;
        var fx = p.bx - cx, fy = p.by - cy, fd = Math.sqrt(fx * fx + fy * fy) || 1, pull = clamp(1 - fd / 220, 0, 1);
        var dir = flow + (Math.atan2(fy, fx) - flow) * pull * 0.9, fring = this.ringAt(p.bx, p.by), fshow = this.reveal(fd);
        this.push(p.bx / this.w * 0.75 + t * 0.02, fshow * clamp(0.32 + 0.6 * pull + 0.6 * fring, 0, 1), p.bx, p.by, dir + fring * 1.2,
          fshow * (3 + 5 * (0.5 + 0.5 * Math.sin(p.s * 9 + t)) + 6 * pull + 7 * fring));
      }
    } else {
      for (i = 0; i < pts.length; i++) {
        p = pts[i];
        var gx = p.bx - cx, gy = p.by - cy, gd = Math.sqrt(gx * gx + gy * gy) || 1;
        var aim = Math.atan2(gy, gx), turn = Math.atan2(Math.sin(aim - p.a), Math.cos(aim - p.a));
        p.a += turn * ease(0.09 + 0.05 * p.s, dt);                  // each dash turns at its own pace
        var near = clamp(1 - gd / (reach * 0.75), 0, 1), pulse = 0.5 + 0.5 * Math.sin(gd * 0.03 - t * 2);
        var gring = this.ringAt(p.bx, p.by), gshow = this.reveal(gd);
        this.push(gd / reach * 1.3 + t * 0.03, gshow * clamp(0.15 + 0.85 * near + 0.6 * gring, 0, 1), p.bx, p.by, p.a,
          gshow * (2 + 8 * near * near * (0.6 + 0.4 * pulse) + 7 * gring));
      }
    }

    ctx.clearRect(0, 0, this.w, this.h);
    // Square caps match the site's sharp-edged style; brighter dashes are drawn heavier for depth.
    ctx.lineCap = 'butt';
    var base = this.dense ? 1.8 : 2.2;
    for (i = 0; i < this.buckets.length; i++) {
      var seg = this.buckets[i];
      if (!seg.length) continue;
      var level = i % ALPHA_LEVELS;
      ctx.lineWidth = base * (0.75 + 0.22 * level);
      ctx.globalAlpha = (level + 1) / ALPHA_LEVELS;
      ctx.strokeStyle = this.ramp[Math.floor(i / ALPHA_LEVELS)];
      ctx.beginPath();
      for (var j = 0; j < seg.length; j += 4) { ctx.moveTo(seg[j], seg[j + 1]); ctx.lineTo(seg[j + 2], seg[j + 3]); }
      ctx.stroke();
    }
    if (dots.length) {
      ctx.globalAlpha = 0.3; ctx.fillStyle = '#171914';
      ctx.beginPath();
      for (i = 0; i < dots.length; i += 2) ctx.rect(dots[i], dots[i + 1], 1.4, 1.4);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  var fields = [];
  document.querySelectorAll('[data-aa-field]').forEach(function (host) {
    try { fields.push(new Field(host)); } catch (e) { /* canvas unavailable: the static layout still works */ }
  });

  if (fields.length) {
    var byHost = function (el) { for (var i = 0; i < fields.length; i++) if (fields[i].host === el) return fields[i]; };
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(function (entries) {
        entries.forEach(function (en) {
          var f = byHost(en.target), r = en.contentRect;
          if (f && (Math.abs(r.width - f.w) > 2 || Math.abs(r.height - f.h) > 40)) f.resize();
        });
      });
      fields.forEach(function (f) { ro.observe(f.host); });
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { var f = byHost(en.target); if (f) { f.visible = en.isIntersecting; f.last = 0; } });
      }, { rootMargin: '80px' });
      fields.forEach(function (f) { io.observe(f.host); });
    } else { fields.forEach(function (f) { f.visible = true; }); }
    fields.forEach(function (f) { f.draw(1 / 60); f.host.classList.add('aa-field-ready'); });

    var loop = function (now) {
      if (!document.hidden) for (var i = 0; i < fields.length; i++) if (fields[i].visible) fields[i].frame(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /* ---------- 2. Heading reveals ---------- */

  var HEADINGS = '.home-hero h1 .line, main h2.section-title, .showcase-heading h2, .aa-page-hero h1, .service-hero h1, .services-intro h2, .contact-panel h2';

  // Wraps each word in a mask so it can slide up; inline elements such as <em> and <br> are kept.
  function splitWords(el) {
    var index = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var mask = document.createElement('span'), inner = document.createElement('span');
            mask.className = 'aa-word'; inner.className = 'aa-word-in';
            inner.style.setProperty('--i', index++); inner.textContent = part;
            mask.appendChild(inner); frag.appendChild(mask);
          });
          child.parentNode.replaceChild(frag, child);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') { walk(child); }
      });
    })(el);
  }

  if ('IntersectionObserver' in window) {
    var headIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('aa-words-in'); headIO.unobserve(en.target); } });
    }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll(HEADINGS).forEach(function (el) {
      if (el.closest('[data-aa-no-split]')) return;
      splitWords(el); el.classList.add('aa-reveal-words'); headIO.observe(el);
    });
  }

  /* ---------- 3. Scroll-scrubbed copy ---------- */

  var scrubs = [];
  document.querySelectorAll('[data-aa-scrub]').forEach(function (el) {
    var words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    var spans = words.map(function (w, i) {
      var s = document.createElement('span'); s.className = 'aa-scrub-word'; s.textContent = w;
      el.appendChild(s); if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
      return s;
    });
    el.classList.add('aa-scrub-ready');
    scrubs.push({ el: el, spans: spans });
  });

  function updateScrubs() {
    var vh = window.innerHeight;
    scrubs.forEach(function (sc) {
      var r = sc.el.getBoundingClientRect();
      var lit = clamp((vh * 0.82 - r.top) / (r.height + vh * 0.32), 0, 1) * (sc.spans.length + 2);
      sc.spans.forEach(function (s, i) { s.style.opacity = (0.16 + 0.84 * clamp(lit - i, 0, 1)).toFixed(3); });
    });
  }
  if (scrubs.length) {
    var scrubQueued = false;
    var queueScrub = function () { if (!scrubQueued) { scrubQueued = true; requestAnimationFrame(function () { scrubQueued = false; updateScrubs(); }); } };
    window.addEventListener('scroll', queueScrub, { passive: true });
    window.addEventListener('resize', queueScrub, { passive: true });
    updateScrubs();
  }

  /* ---------- Phone numbers: country picker beside every mobile field ---------- */

  // ISO code | name | dial code. Common client countries first, then everyone A–Z.
  var COUNTRIES = ('IN|India|91;AE|United Arab Emirates|971;US|United States|1;GB|United Kingdom|44;CA|Canada|1;AU|Australia|61;SG|Singapore|65;SA|Saudi Arabia|966;' +
    'AF|Afghanistan|93;AL|Albania|355;DZ|Algeria|213;AD|Andorra|376;AO|Angola|244;AR|Argentina|54;AM|Armenia|374;AT|Austria|43;AZ|Azerbaijan|994;BS|Bahamas|1;BH|Bahrain|973;' +
    'BD|Bangladesh|880;BB|Barbados|1;BY|Belarus|375;BE|Belgium|32;BZ|Belize|501;BJ|Benin|229;BT|Bhutan|975;BO|Bolivia|591;BA|Bosnia and Herzegovina|387;BW|Botswana|267;' +
    'BR|Brazil|55;BN|Brunei|673;BG|Bulgaria|359;BF|Burkina Faso|226;BI|Burundi|257;KH|Cambodia|855;CM|Cameroon|237;CV|Cape Verde|238;CF|Central African Republic|236;TD|Chad|235;' +
    'CL|Chile|56;CN|China|86;CO|Colombia|57;KM|Comoros|269;CG|Congo|242;CD|Congo (DRC)|243;CR|Costa Rica|506;CI|Côte d’Ivoire|225;HR|Croatia|385;CU|Cuba|53;CY|Cyprus|357;' +
    'CZ|Czechia|420;DK|Denmark|45;DJ|Djibouti|253;DM|Dominica|1;DO|Dominican Republic|1;EC|Ecuador|593;EG|Egypt|20;SV|El Salvador|503;GQ|Equatorial Guinea|240;ER|Eritrea|291;' +
    'EE|Estonia|372;SZ|Eswatini|268;ET|Ethiopia|251;FJ|Fiji|679;FI|Finland|358;FR|France|33;GA|Gabon|241;GM|Gambia|220;GE|Georgia|995;DE|Germany|49;GH|Ghana|233;GR|Greece|30;' +
    'GD|Grenada|1;GT|Guatemala|502;GN|Guinea|224;GW|Guinea-Bissau|245;GY|Guyana|592;HT|Haiti|509;HN|Honduras|504;HK|Hong Kong|852;HU|Hungary|36;IS|Iceland|354;ID|Indonesia|62;' +
    'IR|Iran|98;IQ|Iraq|964;IE|Ireland|353;IL|Israel|972;IT|Italy|39;JM|Jamaica|1;JP|Japan|81;JO|Jordan|962;KZ|Kazakhstan|7;KE|Kenya|254;KI|Kiribati|686;KW|Kuwait|965;' +
    'KG|Kyrgyzstan|996;LA|Laos|856;LV|Latvia|371;LB|Lebanon|961;LS|Lesotho|266;LR|Liberia|231;LY|Libya|218;LI|Liechtenstein|423;LT|Lithuania|370;LU|Luxembourg|352;MO|Macau|853;' +
    'MG|Madagascar|261;MW|Malawi|265;MY|Malaysia|60;MV|Maldives|960;ML|Mali|223;MT|Malta|356;MH|Marshall Islands|692;MR|Mauritania|222;MU|Mauritius|230;MX|Mexico|52;' +
    'FM|Micronesia|691;MD|Moldova|373;MC|Monaco|377;MN|Mongolia|976;ME|Montenegro|382;MA|Morocco|212;MZ|Mozambique|258;MM|Myanmar|95;NA|Namibia|264;NR|Nauru|674;NP|Nepal|977;' +
    'NL|Netherlands|31;NZ|New Zealand|64;NI|Nicaragua|505;NE|Niger|227;NG|Nigeria|234;KP|North Korea|850;MK|North Macedonia|389;NO|Norway|47;OM|Oman|968;PK|Pakistan|92;' +
    'PW|Palau|680;PS|Palestine|970;PA|Panama|507;PG|Papua New Guinea|675;PY|Paraguay|595;PE|Peru|51;PH|Philippines|63;PL|Poland|48;PT|Portugal|351;PR|Puerto Rico|1;QA|Qatar|974;' +
    'RO|Romania|40;RU|Russia|7;RW|Rwanda|250;KN|Saint Kitts and Nevis|1;LC|Saint Lucia|1;VC|Saint Vincent and the Grenadines|1;WS|Samoa|685;SM|San Marino|378;' +
    'ST|São Tomé and Príncipe|239;SN|Senegal|221;RS|Serbia|381;SC|Seychelles|248;SL|Sierra Leone|232;SK|Slovakia|421;SI|Slovenia|386;SB|Solomon Islands|677;' +
    'SO|Somalia|252;ZA|South Africa|27;KR|South Korea|82;SS|South Sudan|211;ES|Spain|34;LK|Sri Lanka|94;SD|Sudan|249;SR|Suriname|597;SE|Sweden|46;CH|Switzerland|41;SY|Syria|963;' +
    'TW|Taiwan|886;TJ|Tajikistan|992;TZ|Tanzania|255;TH|Thailand|66;TL|Timor-Leste|670;TG|Togo|228;TO|Tonga|676;TT|Trinidad and Tobago|1;TN|Tunisia|216;TR|Turkey|90;' +
    'TM|Turkmenistan|993;TV|Tuvalu|688;UG|Uganda|256;UA|Ukraine|380;UY|Uruguay|598;UZ|Uzbekistan|998;VU|Vanuatu|678;VA|Vatican City|39;VE|Venezuela|58;VN|Vietnam|84;' +
    'YE|Yemen|967;ZM|Zambia|260;ZW|Zimbabwe|263').split(';').map(function (row) { var c = row.split('|'); return { iso: c[0], name: c[1], dial: c[2] }; });
  var TOP = 8;

  // Default country: the device time zone is the best signal (many Indian visitors browse in US English),
  // then the browser language region, then India.
  var ZONES = { 'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Dubai': 'AE', 'Europe/London': 'GB', 'Asia/Singapore': 'SG', 'Asia/Riyadh': 'SA',
    'Asia/Kathmandu': 'NP', 'Asia/Dhaka': 'BD', 'Asia/Karachi': 'PK', 'Asia/Colombo': 'LK', 'Asia/Qatar': 'QA', 'Asia/Muscat': 'OM', 'Asia/Kuwait': 'KW',
    'Asia/Bahrain': 'BH', 'Europe/Dublin': 'IE', 'Europe/Berlin': 'DE', 'Europe/Paris': 'FR', 'Europe/Amsterdam': 'NL', 'Asia/Tokyo': 'JP', 'Asia/Hong_Kong': 'HK',
    'Asia/Kuala_Lumpur': 'MY', 'Pacific/Auckland': 'NZ', 'Africa/Johannesburg': 'ZA', 'Africa/Lagos': 'NG', 'Africa/Nairobi': 'KE' };
  function defaultCountry() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      if (ZONES[tz]) return ZONES[tz];
      if (/^Australia\//.test(tz)) return 'AU';
      if (/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|Regina|St_Johns)/.test(tz)) return 'CA';
      if (/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit)|^Pacific\/Honolulu/.test(tz)) return 'US';
    } catch (e) { /* no Intl time zone support */ }
    var langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']);
    for (var i = 0; i < langs.length; i++) {
      var region = (String(langs[i]).split('-')[1] || '').toUpperCase();
      for (var j = 0; j < COUNTRIES.length; j++) if (COUNTRIES[j].iso === region) return region;
    }
    return 'IN';
  }

  function enhancePhone(input) {
    if (input.dataset.aaPhone) return;
    input.dataset.aaPhone = '1';
    var select = document.createElement('select');
    select.className = 'aa-phone-code';
    select.setAttribute('aria-label', 'Country code');
    var html = '';
    COUNTRIES.forEach(function (c, i) {
      if (i === TOP) html += '<option disabled>──────────</option>';
      html += '<option value="' + c.iso + '">' + c.name + ' (+' + c.dial + ')</option>';
    });
    select.innerHTML = html;
    select.value = defaultCountry();
    var wrap = document.createElement('div');
    wrap.className = 'aa-phone';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(select); wrap.appendChild(input);
    input.placeholder = 'Phone number';
    input.removeAttribute('pattern');
  }

  // Before any submit handler reads the form, prefix the number with the chosen dial code.
  // A number the visitor already typed in +international format is sent as typed.
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form.querySelectorAll) return;
    form.querySelectorAll('.aa-phone').forEach(function (wrap) {
      var input = wrap.querySelector('input'), select = wrap.querySelector('select');
      var local = input.value.trim();
      if (!local || local.charAt(0) === '+') return;
      var country = COUNTRIES.filter(function (c) { return c.iso === select.value; })[0];
      if (country) input.value = '+' + country.dial + ' ' + local.replace(/^0+/, '');
    });
  }, true);

  var scanPhones = function (rootNode) {
    (rootNode.querySelectorAll ? rootNode : document).querySelectorAll('input[name="mobile_number"]').forEach(enhancePhone);
  };
  scanPhones(document);
  // The enquiry pop-up is added later by visitor-analytics.js.
  new MutationObserver(function (records) {
    records.forEach(function (r) { r.addedNodes.forEach(function (n) { if (n.nodeType === 1) scanPhones(n); }); });
  }).observe(document.body, { childList: true, subtree: true });

  /* ---------- Phone header: tucks away while reading down, returns on any scroll up ---------- */

  var siteHeader = document.querySelector('.site-header');
  if (siteHeader && window.matchMedia) {
    var phone = matchMedia('(max-width: 760px)'), lastY = window.scrollY, headerQueued = false;
    var updateHeader = function () {
      headerQueued = false;
      var y = window.scrollY, delta = y - lastY;
      if (!phone.matches || root.classList.contains('nav-open') || y < 140) siteHeader.classList.remove('is-tucked');
      else if (delta > 6) siteHeader.classList.add('is-tucked');
      else if (delta < -6) siteHeader.classList.remove('is-tucked');
      if (Math.abs(delta) > 6) lastY = y;
    };
    window.addEventListener('scroll', function () { if (!headerQueued) { headerQueued = true; requestAnimationFrame(updateHeader); } }, { passive: true });
    siteHeader.addEventListener('focusin', function () { siteHeader.classList.remove('is-tucked'); });
  }

  /* ---------- 4. Smooth scrolling ---------- */

  if (finePointer && typeof window.Lenis === 'function') {
    var lenis = new window.Lenis({
      lerp: 0.1,
      anchors: { offset: -96 },
      prevent: function (node) { return !!(node.closest && node.closest('.aa-conversion-modal, .nav-links.open, [data-lenis-prevent]')); }
    });
    window.aaLenis = lenis;
    var raf = function (time) { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    // The lead modal locks page scroll with a body class; pause Lenis while it is open.
    new MutationObserver(function () {
      if (document.body.classList.contains('aa-conversion-open')) lenis.stop(); else lenis.start();
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }
})();
