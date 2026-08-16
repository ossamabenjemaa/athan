#!/usr/bin/env node
/*
 * import-mawaqit.js — récupère le calendrier annuel d'une mosquée et l'écrit
 * dans calendriers/, au format lu par la page.
 *
 *   node scripts/import-mawaqit.js "ayoub ansari"          (recherche par nom)
 *   node scripts/import-mawaqit.js --slug association-faif-75011-paris
 *   node scripts/import-mawaqit.js --refresh               (met à jour l'existant)
 *   node scripts/import-mawaqit.js "grande mosquee" --list (affiche les résultats)
 *
 * Mawaqit publie sur la page de chaque mosquée un objet `confData` qui contient
 * les douze mois d'horaires — c'est la même donnée que le calendrier papier
 * affiché à l'entrée. On la range telle quelle, sans recalcul : ces horaires
 * appartiennent à la mosquée, on ne fait que les recopier.
 *
 * Aucune dépendance : fetch (Node ≥ 18) avec repli sur curl.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const DIR = path.join(__dirname, '..', 'calendriers');
const INDEX = path.join(DIR, 'index.json');
const PRAYERS = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

/* ------------------------------------------------------------------ */
/* Réseau                                                              */
/* ------------------------------------------------------------------ */

async function get(url) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(30000),
      headers: { 'user-agent': 'athan-poc/1.0 (calendrier de mosquee, usage personnel)' }
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.text();
  } catch (e) {
    return execFileSync('curl', ['-sS', '--max-time', '30', '-A', 'athan-poc/1.0', url],
      { encoding: 'utf8', maxBuffer: 5e7 });
  }
}

async function search(word) {
  const body = await get('https://mawaqit.net/api/2.0/mosque/search?word=' + encodeURIComponent(word));
  try { return JSON.parse(body); } catch (e) { throw new Error('réponse de recherche illisible'); }
}

/* ------------------------------------------------------------------ */
/* Extraction                                                          */
/* ------------------------------------------------------------------ */

async function fetchMosque(slug) {
  const html = await get('https://mawaqit.net/fr/' + slug);
  const m = html.match(/\bconfData\s*=\s*(\{.*?\});\s*\n/s);
  if (!m) throw new Error('calendrier introuvable sur la page de « ' + slug + ' »');
  return JSON.parse(m[1]);
}

/*
 * confData.calendar : douze mois, chacun un objet { "1": [six heures], … }.
 * On en fait { "JJ-MM": { Fajr, Sunrise, … } }, comme le reste du dépôt.
 */
function toCalendar(conf) {
  const cal = {};
  const months = conf.calendar || [];
  if (months.length !== 12) throw new Error('calendrier incomplet (' + months.length + ' mois)');
  months.forEach((days, i) => {
    for (const day of Object.keys(days)) {
      const times = days[day];
      if (!Array.isArray(times) || times.length < 6) continue;
      const key = pad(day) + '-' + pad(i + 1);
      cal[key] = {};
      PRAYERS.forEach((name, k) => { cal[key][name] = times[k]; });
    }
  });
  const count = Object.keys(cal).length;
  if (count < 365) throw new Error('seulement ' + count + ' jours extraits');
  return cal;
}

function pad(n) { return String(n).padStart(2, '0'); }

function sanity(cal) {
  const problems = [];
  for (const [key, row] of Object.entries(cal)) {
    const mins = PRAYERS.map(p => {
      const t = row[p];
      if (!/^\d{1,2}:\d{2}$/.test(t || '')) problems.push(`${key} ${p} = « ${t} »`);
      return t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : NaN;
    });
    const ordered = mins.every((v, i) => i === 0 || v >= mins[i - 1]);
    if (!ordered) problems.push(`${key} horaires dans le désordre : ${PRAYERS.map(p => row[p]).join(' ')}`);
  }
  return problems;
}

/* ------------------------------------------------------------------ */
/* Écriture                                                            */
/* ------------------------------------------------------------------ */

function write(entry, cal) {
  fs.mkdirSync(DIR, { recursive: true });
  const file = entry.id + '.json';
  const out = { _meta: entry.meta };
  for (const key of Object.keys(cal).sort(byDate)) out[key] = cal[key];
  fs.writeFileSync(path.join(DIR, file), JSON.stringify(out, null, 0));

  const index = fs.existsSync(INDEX) ? JSON.parse(fs.readFileSync(INDEX, 'utf8')) : [];
  const row = { id: entry.id, label: entry.label, file: 'calendriers/' + file, slug: entry.meta.slug };
  const at = index.findIndex(e => e.id === entry.id);
  if (at >= 0) index[at] = row; else index.push(row);
  index.sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  fs.writeFileSync(INDEX, JSON.stringify(index, null, 2) + '\n');
  return { file, days: Object.keys(cal).length, index: index.length };
}

function byDate(a, b) { return (a.slice(3) + a.slice(0, 2)).localeCompare(b.slice(3) + b.slice(0, 2)); }

/* Un identifiant de fichier lisible : « ayoub-el-ansari-paris ». */
function makeId(conf, slug) {
  const base = (conf.name || slug)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')            // on laisse tomber l'arabe pour le nom de fichier
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return (base || slug).slice(0, 60);
}

/* ------------------------------------------------------------------ */

async function importOne(slug, opts = {}) {
  const conf = await fetchMosque(slug);
  const cal = toCalendar(conf);
  const problems = sanity(cal);
  if (problems.length) {
    console.error('  ⚠️  ' + problems.length + ' anomalie(s) :');
    problems.slice(0, 5).forEach(p => console.error('     ' + p));
    if (problems.length > 20) throw new Error('trop d’anomalies, import abandonné');
  }
  const entry = {
    id: opts.id || makeId(conf, slug),
    label: (conf.name || slug) + (conf.localisation ? ' — ' + conf.localisation : ''),
    meta: {
      mosquee: conf.name || slug,
      ville: conf.localisation || conf.site || '',
      slug: slug,
      annee: new Date().getFullYear(),
      fuseau: conf.timezone || 'Europe/Paris',
      source: 'https://mawaqit.net/fr/' + slug,
      importe_le: new Date().toISOString().slice(0, 10),
      cles: 'jour-mois (JJ-MM), heures locales de la mosquée'
    }
  };
  const res = write(entry, cal);
  console.log(`  ✓ ${entry.label}\n    → calendriers/${res.file} (${res.days} jours)`);
  return entry;
}

async function main() {
  const args = process.argv.slice(2);
  const flag = name => args.includes(name);

  if (!args.length || flag('--help') || flag('-h')) {
    console.log(`Importer un calendrier de mosquée depuis Mawaqit :

  node scripts/import-mawaqit.js "ayoub ansari"       cherche puis importe le 1er résultat
  node scripts/import-mawaqit.js "paris" --list       affiche les résultats sans importer
  node scripts/import-mawaqit.js --slug <slug>        importe une mosquée précise
  node scripts/import-mawaqit.js --refresh            met à jour tous les calendriers du dépôt
`);
    return;
  }

  if (flag('--refresh')) {
    const index = fs.existsSync(INDEX) ? JSON.parse(fs.readFileSync(INDEX, 'utf8')) : [];
    if (!index.length) return console.log('Aucun calendrier à mettre à jour.');
    console.log(`Mise à jour de ${index.length} calendrier(s) :`);
    let failed = 0;
    for (const entry of index) {
      try { await importOne(entry.slug, { id: entry.id }); }
      catch (e) { failed++; console.error(`  ✗ ${entry.label} : ${e.message}`); }
    }
    if (failed) process.exitCode = 1;
    return;
  }

  const slugArg = args.indexOf('--slug');
  if (slugArg >= 0) return void await importOne(args[slugArg + 1]);

  const word = args.find(a => !a.startsWith('--'));
  const results = await search(word);
  if (!results.length) return console.log('Aucune mosquée trouvée pour « ' + word + ' ».');

  if (flag('--list') || results.length > 1) {
    console.log(`${results.length} résultat(s) pour « ${word} » :`);
    results.slice(0, 15).forEach(r => console.log(`  ${r.slug.padEnd(38)} ${r.name}${r.localisation ? ' — ' + r.localisation : ''}`));
    if (flag('--list')) return;
    console.log('\nImport du premier résultat (utilise --slug pour en choisir un autre) :');
  }
  await importOne(results[0].slug);
}

main().catch(e => { console.error('Échec : ' + e.message); process.exitCode = 1; });
