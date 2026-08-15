/*
 * prayer-times.js — calcul des horaires de prière, sans réseau ni dépendance.
 *
 * Fonctionne tel quel dans le navigateur (expose window.PrayerTimes)
 * et sous Node (module.exports).
 *
 * Algorithme classique (PrayTimes / Ilyas) :
 *  - position du soleil (déclinaison + équation du temps) à partir du jour julien ;
 *  - midi solaire vrai (Dhuhr) ;
 *  - angle horaire pour Fajr / Ichaa (angle de crépuscule) et pour le
 *    lever / coucher (−0,833° = réfraction atmosphérique + rayon du disque) ;
 *  - Asr par la longueur d'ombre (1× pour Chafi'i/Maliki/Hanbali, 2× pour Hanafi) ;
 *  - correction hautes latitudes quand le soleil ne descend jamais assez bas.
 *
 * Les identifiants de méthode sont ceux de l'API AlAdhan (méthode 3 = LMM, etc.)
 * pour que la page et le raccourci iOS parlent exactement des mêmes horaires.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.PrayerTimes = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Méthodes de calcul (ids AlAdhan)                                    */
  /* ------------------------------------------------------------------ */

  var METHODS = [
    { id: 3,  name: 'Ligue islamique mondiale (LIM)', fajr: 18,   isha: 17 },
    { id: 12, name: 'UOIF — France (12°/12°)',        fajr: 12,   isha: 12 },
    { id: 2,  name: 'ISNA — Amérique du Nord',        fajr: 15,   isha: 15 },
    { id: 5,  name: 'Autorité générale d’Égypte', fajr: 19.5, isha: 17.5 },
    { id: 4,  name: 'Umm al-Qura — La Mecque',        fajr: 18.5, isha: 0, ishaMinutes: 90 },
    { id: 1,  name: 'Université de Karachi',          fajr: 18,   isha: 18 },
    { id: 13, name: 'Diyanet — Turquie',              fajr: 18,   isha: 17 },
    { id: 16, name: 'Dubaï / Émirats',                fajr: 18.2, isha: 18.2 }
  ];

  var PRAYERS = [
    { key: 'fajr',    label: 'Fajr',    ar: 'الفجر',   sub: 'Aube' },
    { key: 'sunrise', label: 'Chourouq', ar: 'الشروق', sub: 'Lever du soleil', silent: true },
    { key: 'dhuhr',   label: 'Dhuhr',   ar: 'الظهر',   sub: 'Midi' },
    { key: 'asr',     label: 'Asr',     ar: 'العصر',   sub: 'Après-midi' },
    { key: 'maghrib', label: 'Maghrib', ar: 'المغرب',  sub: 'Coucher du soleil' },
    { key: 'isha',    label: 'Ichaa',   ar: 'العشاء',  sub: 'Nuit' }
  ];

  function methodById(id) {
    for (var i = 0; i < METHODS.length; i++) if (METHODS[i].id === Number(id)) return METHODS[i];
    return METHODS[0];
  }

  /* ------------------------------------------------------------------ */
  /* Trigonométrie en degrés                                             */
  /* ------------------------------------------------------------------ */

  var DEG = Math.PI / 180;
  function sin(d) { return Math.sin(d * DEG); }
  function cos(d) { return Math.cos(d * DEG); }
  function tan(d) { return Math.tan(d * DEG); }
  function arcsin(x) { return Math.asin(x) / DEG; }
  function arccos(x) { return Math.acos(x) / DEG; }
  function arctan2(y, x) { return Math.atan2(y, x) / DEG; }
  function arccot(x) { return Math.atan(1 / x) / DEG; }

  function fix(a, b) { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; }
  function fixAngle(a) { return fix(a, 360); }
  function fixHour(a) { return fix(a, 24); }

  /* Jour julien à 0h UT. */
  function julian(year, month, day) {
    if (month <= 2) { year -= 1; month += 12; }
    var A = Math.floor(year / 100);
    var B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
  }

  /* Déclinaison du soleil et équation du temps (précision ~ quelques secondes). */
  function sunPosition(jd) {
    var D = jd - 2451545.0;
    var g = fixAngle(357.529 + 0.98560028 * D);            // anomalie moyenne
    var q = fixAngle(280.459 + 0.98564736 * D);            // longitude moyenne
    var L = fixAngle(q + 1.915 * sin(g) + 0.020 * sin(2 * g)); // longitude apparente
    var e = 23.439 - 0.00000036 * D;                       // obliquité
    var RA = fixHour(arctan2(cos(e) * sin(L), cos(L)) / 15); // ascension droite (h)
    return { declination: arcsin(sin(e) * sin(L)), equation: q / 15 - RA };
  }

  /* ------------------------------------------------------------------ */
  /* Calcul principal                                                    */
  /* ------------------------------------------------------------------ */

  /*
   * computeTimes({ latitude, longitude, date, methodId, madhab, highLats, adjustments })
   *
   *  - date       : objet Date (le jour civil est lu dans `timeZone`) ou {year, month, day}
   *  - madhab     : 'standard' (ombre ×1) ou 'hanafi' (ombre ×2)
   *  - highLats   : 'angle' (défaut) | 'night' | 'seventh' | 'none'
   *  - adjustments: { fajr: -2, isha: +3, … } en minutes
   *
   * Renvoie { times: { fajr: Date, … }, list: [{key,label,ar,sub,date}], … } où les
   * Date sont des instants absolus (donc affichables dans n'importe quel fuseau).
   */
  function computeTimes(opts) {
    var lat = Number(opts.latitude);
    var lng = Number(opts.longitude);
    var method = methodById(opts.methodId != null ? opts.methodId : 3);
    var madhab = opts.madhab === 'hanafi' ? 'hanafi' : 'standard';
    var rule = opts.highLats || 'angle';
    var adj = opts.adjustments || {};
    var ymd = toYMD(opts.date, opts.timeZone);

    var jd = julian(ymd.year, ymd.month, ymd.day) - lng / (15 * 24);

    // Estimations initiales (en heures, temps solaire local) puis une passe
    // d'affinage : la déclinaison du soleil bouge un peu au fil de la journée.
    var t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, isha: 18 };
    for (var pass = 0; pass < 2; pass++) {
      t = {
        fajr:    sunAngleTime(jd, lat, method.fajr, t.fajr, 'ccw'),
        sunrise: sunAngleTime(jd, lat, riseSetAngle(opts.elevation), t.sunrise, 'ccw'),
        dhuhr:   midDay(jd, t.dhuhr),
        asr:     asrTime(jd, lat, madhab === 'hanafi' ? 2 : 1, t.asr),
        sunset:  sunAngleTime(jd, lat, riseSetAngle(opts.elevation), t.sunset, 'cw'),
        isha:    method.ishaMinutes ? NaN : sunAngleTime(jd, lat, method.isha, t.isha, 'cw')
      };
    }

    // Hautes latitudes : sous nos climats (Paris, Londres, Montréal…) le soleil
    // ne descend pas toujours à 18° sous l'horizon en été — l'angle horaire
    // n'existe alors pas et il faut une convention de repli.
    var nightLen = 24 + t.sunrise - t.sunset;
    if (rule !== 'none') {
      t.fajr = adjustHighLat(t.fajr, t.sunrise, portion(rule, method.fajr, nightLen), nightLen, 'ccw');
      if (!method.ishaMinutes) {
        t.isha = adjustHighLat(t.isha, t.sunset, portion(rule, method.isha, nightLen), nightLen, 'cw');
      }
    }
    if (method.ishaMinutes) t.isha = t.sunset + method.ishaMinutes / 60;

    var hours = {
      fajr: t.fajr,
      sunrise: t.sunrise,
      dhuhr: t.dhuhr,
      asr: t.asr,
      maghrib: t.sunset + (method.maghribMinutes || 0) / 60,
      isha: t.isha
    };

    // Les heures ci-dessus sont en temps solaire local : on repasse en UTC
    // (le méridien de Greenwich est en avance de longitude/15 heures) avant
    // de fabriquer des instants absolus.
    var baseUTC = Date.UTC(ymd.year, ymd.month - 1, ymd.day);
    var times = {};
    var list = [];
    for (var i = 0; i < PRAYERS.length; i++) {
      var p = PRAYERS[i];
      var h = hours[p.key];
      var utc = h - lng / 15 + (Number(adj[p.key]) || 0) / 60;
      // Arrondi à la minute supérieure : c'est la convention des calendriers de
      // mosquée (et d'AlAdhan) — mieux vaut une minute de retard qu'une d'avance.
      var date = isFinite(h) ? new Date(Math.ceil(baseUTC / 60000 + utc * 60) * 60000) : null;
      times[p.key] = date;
      list.push({ key: p.key, label: p.label, ar: p.ar, sub: p.sub, silent: !!p.silent, date: date });
    }

    return {
      times: times,
      list: list,
      method: method,
      madhab: madhab,
      highLats: rule,
      date: ymd,
      latitude: lat,
      longitude: lng
    };
  }

  function riseSetAngle(elevation) {
    var elv = Number(elevation) || 0;
    return 0.833 + 0.0347 * Math.sqrt(Math.max(elv, 0));
  }

  function midDay(jd, t) {
    var eqt = sunPosition(jd + t / 24).equation;
    return fixHour(12 - eqt);
  }

  /* Heure à laquelle le soleil est à `angle` degrés sous l'horizon. */
  function sunAngleTime(jd, lat, angle, t, direction) {
    var decl = sunPosition(jd + t / 24).declination;
    var noon = midDay(jd, t);
    var x = (-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat));
    if (x > 1 || x < -1) return NaN; // le soleil ne descend jamais si bas ce jour-là
    var hourAngle = arccos(x) / 15;
    return noon + (direction === 'ccw' ? -hourAngle : hourAngle);
  }

  /* Asr : l'ombre d'un objet vaut sa longueur (×1) ou le double (×2), + l'ombre de midi. */
  function asrTime(jd, lat, factor, t) {
    var decl = sunPosition(jd + t / 24).declination;
    var angle = -arccot(factor + tan(Math.abs(lat - decl)));
    return sunAngleTime(jd, lat, angle, t, 'cw');
  }

  /* Part de nuit accordée à Fajr / Ichaa selon la règle de repli choisie. */
  function portion(rule, angle, nightLen) {
    if (rule === 'night') return nightLen / 2;
    if (rule === 'seventh') return nightLen / 7;
    return (angle / 60) * nightLen; // « angle based » (Ilyas) : 1/60ᵉ de nuit par degré
  }

  function adjustHighLat(time, base, portionHours, nightLen, direction) {
    var diff = direction === 'ccw' ? timeDiff(time, base) : timeDiff(base, time);
    if (!isFinite(time) || diff > portionHours) {
      return direction === 'ccw' ? base - portionHours : base + portionHours;
    }
    return time;
  }

  function timeDiff(a, b) { return fixHour(b - a); }

  /* ------------------------------------------------------------------ */
  /* Utilitaires date / affichage                                        */
  /* ------------------------------------------------------------------ */

  /* Jour civil (année, mois, jour) tel qu'il est vécu dans `timeZone`. */
  function toYMD(date, timeZone) {
    if (date && date.year && date.month && date.day) return date;
    var d = date instanceof Date ? date : (date ? new Date(date) : new Date());
    var parts = dateParts(d, timeZone);
    return { year: parts.year, month: parts.month, day: parts.day };
  }

  function dateParts(d, timeZone) {
    var fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || undefined,
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
    var s = fmt.format(d).split('-');
    return { year: Number(s[0]), month: Number(s[1]), day: Number(s[2]) };
  }

  /* "05:12" dans le fuseau demandé (celui du téléphone par défaut). */
  function formatTime(date, timeZone) {
    if (!date) return '—';
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: timeZone || undefined, hour: '2-digit', minute: '2-digit', hour12: false
    }).format(date);
  }

  /*
   * Prochaine prière à partir de `now` : on regarde aujourd'hui puis demain
   * (après Ichaa, la prochaine est le Fajr du lendemain).
   */
  function nextPrayer(opts, now) {
    now = now || new Date();
    for (var offset = 0; offset <= 1; offset++) {
      var day = new Date(now.getTime() + offset * 86400000);
      var res = computeTimes(assign({}, opts, { date: day }));
      for (var i = 0; i < res.list.length; i++) {
        var item = res.list[i];
        if (item.silent || !item.date) continue;      // le Chourouq n'est pas une prière
        if (item.date.getTime() > now.getTime()) {
          return { key: item.key, label: item.label, ar: item.ar, date: item.date, tomorrow: offset === 1 };
        }
      }
    }
    return null;
  }

  function assign(target) {
    for (var i = 1; i < arguments.length; i++) {
      var src = arguments[i] || {};
      for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k)) target[k] = src[k];
    }
    return target;
  }

  /* URL AlAdhan équivalente — c'est elle que le raccourci iOS interroge. */
  function aladhanUrl(opts, ymd) {
    var d = ymd || toYMD(opts.date, opts.timeZone);
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var method = methodById(opts.methodId != null ? opts.methodId : 3);
    return 'https://api.aladhan.com/v1/timings/' + pad(d.day) + '-' + pad(d.month) + '-' + d.year +
      '?latitude=' + round(opts.latitude, 5) +
      '&longitude=' + round(opts.longitude, 5) +
      '&method=' + method.id +
      '&school=' + (opts.madhab === 'hanafi' ? 1 : 0);
  }

  function round(n, digits) {
    var f = Math.pow(10, digits);
    return Math.round(Number(n) * f) / f;
  }

  return {
    METHODS: METHODS,
    PRAYERS: PRAYERS,
    methodById: methodById,
    computeTimes: computeTimes,
    nextPrayer: nextPrayer,
    formatTime: formatTime,
    aladhanUrl: aladhanUrl
  };
});
