#!/usr/bin/env node
/*
 * cli.js — les horaires de prière en ligne de commande.
 *
 *   node cli.js --lat 48.8566 --lon 2.3522
 *   node cli.js --lat 43.2965 --lon 5.3698 --method 12 --hanafi --date 2026-09-01
 *   node cli.js --lat 48.8566 --lon 2.3522 --compare   (vérifie face à l'API AlAdhan)
 *
 * Aucune dépendance : le calcul est le même que celui de la page (prayer-times.js).
 */
'use strict';

const { execFileSync } = require('node:child_process');
const PT = require('./prayer-times.js');

function parseArgs(argv) {
  const opts = { latitude: 48.8566, longitude: 2.3522, methodId: 3, madhab: 'standard', highLats: 'angle' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--lat') opts.latitude = Number(next());
    else if (a === '--lon') opts.longitude = Number(next());
    else if (a === '--method') opts.methodId = Number(next());
    else if (a === '--hanafi') opts.madhab = 'hanafi';
    else if (a === '--highlats') opts.highLats = next();
    else if (a === '--tz') opts.timeZone = next();
    else if (a === '--date') opts.date = next();
    else if (a === '--compare') opts.compare = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else { console.error('Option inconnue : ' + a); opts.help = true; }
  }
  return opts;
}

function usage() {
  console.log(`Horaires de prière — usage :

  node cli.js [options]

  --lat <deg>        latitude (défaut 48.8566, Paris)
  --lon <deg>        longitude (défaut 2.3522)
  --method <id>      méthode de calcul (défaut 3) :
${PT.METHODS.map(m => `                       ${String(m.id).padStart(2)} — ${m.name}`).join('\n')}
  --hanafi           Asr à l'ombre ×2 (défaut : ×1)
  --highlats <r>     angle | seventh | night | none (défaut angle)
  --date <AAAA-MM-JJ>  jour à calculer (défaut aujourd'hui)
  --tz <zone>        fuseau d'affichage (défaut : celui du système)
  --compare          compare le calcul local avec l'API AlAdhan
`);
}

function fetchJson(url) {
  const out = execFileSync('curl', ['-sS', '--max-time', '30', url], { encoding: 'utf8', maxBuffer: 1e7 });
  return JSON.parse(out);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) return usage();

  const tz = opts.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const date = opts.date ? new Date(opts.date + 'T12:00:00Z') : new Date();
  const res = PT.computeTimes({ ...opts, timeZone: tz, date });
  const method = PT.methodById(opts.methodId);

  const day = new Intl.DateTimeFormat('fr-FR', { timeZone: tz, dateStyle: 'full' }).format(date);
  console.log(`\n🕌 ${day} — ${res.latitude}, ${res.longitude} (${tz})`);
  console.log(`   ${method.name} · Asr ${opts.madhab === 'hanafi' ? 'hanafi (×2)' : 'majorité (×1)'}\n`);

  // Le repère « → » et le compte à rebours n'ont de sens que pour aujourd'hui.
  const todayRes = PT.computeTimes({ ...opts, timeZone: tz, date: new Date() });
  const isToday = JSON.stringify(todayRes.date) === JSON.stringify(res.date);
  const next = isToday ? PT.nextPrayer({ ...opts, timeZone: tz }) : null;
  for (const p of res.list) {
    const mark = next && !next.tomorrow && next.key === p.key ? '→' : ' ';
    const name = p.silent ? `(${p.label})` : p.label;
    console.log(`  ${mark} ${name.padEnd(10)} ${PT.formatTime(p.date, tz).padStart(5)}   ${p.sub}`);
  }

  if (next) {
    const left = Math.max(0, Math.round((next.date - Date.now()) / 60000));
    console.log(`\n  Prochaine : ${next.label} à ${PT.formatTime(next.date, tz)}` +
      `${next.tomorrow ? ' (demain)' : ''} — dans ${Math.floor(left / 60)} h ${String(left % 60).padStart(2, '0')}`);
  }

  console.log(`\n  Raccourci iOS : ${PT.aladhanUrl({ ...opts, timeZone: tz }, res.date)}`);

  if (opts.compare) {
    const api = fetchJson(PT.aladhanUrl({ ...opts, timeZone: tz }, res.date)).data.timings;
    const keys = { Fajr: 'fajr', Sunrise: 'sunrise', Dhuhr: 'dhuhr', Asr: 'asr', Maghrib: 'maghrib', Isha: 'isha' };
    let worst = 0;
    console.log('\n  Comparaison AlAdhan :');
    for (const [apiKey, key] of Object.entries(keys)) {
      const mine = PT.formatTime(res.times[key], tz);
      const theirs = String(api[apiKey] || '').slice(0, 5);
      const delta = toMin(mine) - toMin(theirs);
      worst = Math.max(worst, Math.abs(delta));
      console.log(`    ${apiKey.padEnd(8)} local ${mine}  api ${theirs}  ${delta === 0 ? '=' : (delta > 0 ? '+' : '') + delta + ' min'}`);
    }
    console.log(`\n  Écart maximum : ${worst} min`);
  }
  console.log('');
}

function toMin(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

main();
