#!/usr/bin/env node
/*
 * crawl-mosquees.js — construit l'annuaire des mosquées (nom, ville, position,
 * slug) que la page utilise pour « les mosquées près de chez moi » et pour sa
 * barre de recherche.
 *
 *   node scripts/crawl-mosquees.js                          (France, communes > 2000 hab.)
 *   node scripts/crawl-mosquees.js --bbox 48.6,1.9,49.1,2.8 (une région)
 *   node scripts/crawl-mosquees.js --pop 5000 --max 800     (plus rapide, moins complet)
 *
 * La recherche par coordonnées de Mawaqit ne renvoie pas « les dix plus
 * proches » : elle renvoie ce qui se trouve dans un rayon d'environ 5 km,
 * plafonné à dix résultats. Balayer une grille régulière serait donc à la fois
 * ruineux (des milliers de cases vides) et incomplet en ville.
 *
 * On interroge donc là où vivent les gens : les centres des communes françaises
 * (API publique geo.api.gouv.fr). Et quand une réponse est pleine — dix
 * résultats, donc probablement tronquée — on repique autour du point avec un
 * pas plus fin, récursivement.
 *
 * Uniquement des métadonnées publiques, jamais les horaires : ceux-là ne sont
 * récupérés que pour les mosquées réellement utilisées (import-mawaqit.js).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const OUT = path.join(__dirname, '..', 'calendriers', 'mosquees.json');
const COMMUNES = 'https://geo.api.gouv.fr/communes?fields=nom,centre,population&format=json';
const PAUSE_MS = 120;
const RING = 0.028;      // ~3 km : le pas de reprise autour d'un point saturé
const MAX_DEPTH = 3;

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const bbox = arg('--bbox') ? String(arg('--bbox')).split(',').map(Number) : null;
const minPop = Number(arg('--pop', 2000));
const maxCalls = Number(arg('--max', 12000));

function curl(url, maxBuffer) {
  return execFileSync('curl', ['-sS', '--max-time', '40', '-A', 'athan-poc/1.0 (annuaire de mosquees)', url],
    { encoding: 'utf8', maxBuffer: maxBuffer || 5e7 });
}

function km(lat1, lon1, lat2, lon2) {
  const p = Math.PI / 180;
  const x = (lat2 - lat1) * p;
  const y = (lon2 - lon1) * p * Math.cos(((lat1 + lat2) / 2) * p);
  return 6371 * Math.hypot(x, y);
}

function search(lat, lon) {
  const url = `https://mawaqit.net/api/2.0/mosque/search?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
  try {
    const json = JSON.parse(curl(url));
    return Array.isArray(json) ? json : [];
  } catch (e) {
    return null; // incident réseau : on continue, le point sera revu au prochain passage
  }
}

function sleep(ms) { execFileSync('sleep', [String(ms / 1000)]); }

function loadCommunes() {
  const cache = path.join(require('node:os').tmpdir(), 'communes-fr.json');
  let raw;
  if (fs.existsSync(cache) && Date.now() - fs.statSync(cache).mtimeMs < 30 * 86400000) {
    raw = fs.readFileSync(cache, 'utf8');
  } else {
    raw = curl(COMMUNES, 5e8);
    try { fs.writeFileSync(cache, raw); } catch (e) {}
  }
  return JSON.parse(raw)
    .filter(c => c.centre && (c.population || 0) >= minPop)
    .filter(c => !bbox || (c.centre.coordinates[1] >= bbox[0] && c.centre.coordinates[1] <= bbox[2] &&
                           c.centre.coordinates[0] >= bbox[1] && c.centre.coordinates[0] <= bbox[3]))
    .map(c => ({ nom: c.nom, pop: c.population, lat: c.centre.coordinates[1], lon: c.centre.coordinates[0] }))
    .sort((a, b) => b.pop - a.pop); // les grandes villes d'abord : le plus utile si on plafonne
}

function main() {
  const found = new Map();
  if (fs.existsSync(OUT)) {
    try {
      (JSON.parse(fs.readFileSync(OUT, 'utf8')).mosquees || []).forEach(m => found.set(m.slug, m));
      console.log(`Reprise : ${found.size} mosquées déjà connues.`);
    } catch (e) { /* fichier illisible : on repart de zéro */ }
  }

  const communes = loadCommunes();
  const queue = communes.map(c => ({ lat: c.lat, lon: c.lon, depth: 0, nom: c.nom }));
  console.log(`${communes.length} communes à sonder (population ≥ ${minPop}), plafond ${maxCalls} requêtes.`);

  const probed = new Set();
  let calls = 0, refined = 0, failures = 0;
  const t0 = Date.now();

  while (queue.length && calls < maxCalls) {
    const point = queue.shift();
    const cellKey = point.lat.toFixed(2) + ',' + point.lon.toFixed(2) + ',' + point.depth;
    if (probed.has(cellKey)) continue;
    probed.add(cellKey);

    const results = search(point.lat, point.lon);
    calls++;
    if (!results) { failures++; continue; }

    for (const m of results) {
      if (!m.slug || typeof m.latitude !== 'number' || found.has(m.slug)) continue;
      found.set(m.slug, {
        slug: m.slug,
        nom: (m.name || '').trim(),
        ville: (m.localisation || '').trim(),
        lat: Math.round(m.latitude * 10000) / 10000,
        lon: Math.round(m.longitude * 10000) / 10000
      });
    }

    // Réponse pleine = probablement tronquée : on repique autour, plus finement.
    if (results.length >= 10 && point.depth < MAX_DEPTH) {
      const step = RING / (point.depth + 1);
      for (const dLat of [-step, 0, step]) for (const dLon of [-step, 0, step]) {
        if (!dLat && !dLon) continue;
        queue.push({ lat: point.lat + dLat, lon: point.lon + dLon, depth: point.depth + 1, nom: point.nom });
      }
      refined++;
    }

    if (calls % 200 === 0) {
      const s = ((Date.now() - t0) / 1000).toFixed(0);
      console.log(`  ${calls} requêtes · ${found.size} mosquées · ${queue.length} points en attente · ${s}s`);
      write(found, { partiel: true });
    }
    sleep(PAUSE_MS);
  }

  write(found, { partiel: queue.length > 0 });
  console.log(`\nTerminé : ${found.size} mosquées, ${calls} requêtes` +
    `${refined ? `, ${refined} points densifiés` : ''}${failures ? `, ${failures} échecs` : ''}` +
    `${queue.length ? `, ${queue.length} points non explorés (plafond atteint)` : ''}.`);
  console.log(`→ ${path.relative(process.cwd(), OUT)}`);
}

function write(found, state) {
  const mosquees = [...found.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    _meta: {
      source: 'mawaqit.net (recherche par coordonnées) — points de sondage : geo.api.gouv.fr',
      contenu: 'métadonnées publiques uniquement : nom, ville, position, slug',
      population_min: minPop,
      zone: bbox ? bbox.join(',') : 'France',
      mosquees: mosquees.length,
      partiel: !!state.partiel,
      mis_a_jour_le: new Date().toISOString().slice(0, 10)
    },
    mosquees
  }));
}

main();
