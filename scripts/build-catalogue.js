#!/usr/bin/env node
/*
 * build-catalogue.js — fusionne l'annuaire et le manifeste en un seul fichier
 * compact, celui que la page télécharge au premier chargement.
 *
 *   node scripts/build-catalogue.js
 *
 * Avant : deux fichiers arrivaient à chaque visite — mosquees.json (65 Ko
 * compressés : nom, adresse complète, position) et index.json (44 Ko : quels
 * calendriers existent). Soit 109 Ko pour une personne qui ne veut qu'une seule
 * mosquée.
 *
 * Ici on n'écrit qu'un tableau de tableaux, sans noms de champs répétés, avec
 * l'adresse réduite au code postal et à la commune, et l'identifiant du
 * calendrier seulement quand il existe :
 *
 *   ["slug", "Nom", "45000 Orléans", 47.9025, 1.8985, "mosquee-des-carmes-orleans"]
 *
 * Les deux fichiers d'origine restent : ce sont eux que les scripts d'import
 * mettent à jour, et ils servent de source à celui-ci.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'calendriers');
const ANNUAIRE = path.join(DIR, 'mosquees.json');
const INDEX = path.join(DIR, 'index.json');
const SORTIE = path.join(DIR, 'catalogue.json');

/* « 4 rue de limare 45000 orléans France » → « 45000 Orléans ». */
function lieuCourt(adresse) {
  const texte = String(adresse || '').trim();
  const m = texte.match(/\b(\d{5})\b\s*(.*)$/);
  if (!m) return texte.slice(0, 40);
  const ville = m[2].replace(/\b(france|belgique|suisse)\b/i, '').replace(/[,\s]+$/, '').trim();
  return (m[1] + ' ' + capitaliser(ville)).trim();
}

function capitaliser(s) {
  return s.replace(/\S+/g, function (mot) {
    return mot.length > 2 && mot === mot.toLowerCase()
      ? mot.charAt(0).toUpperCase() + mot.slice(1)
      : mot;
  });
}

function main() {
  if (!fs.existsSync(ANNUAIRE)) throw new Error('annuaire absent : lance crawl-mosquees.js');
  const annuaire = JSON.parse(fs.readFileSync(ANNUAIRE, 'utf8'));
  const index = fs.existsSync(INDEX) ? JSON.parse(fs.readFileSync(INDEX, 'utf8')) : [];

  const parSlug = {};
  index.forEach(e => { if (e.slug) parSlug[e.slug] = e.id; });

  const vus = new Set();
  const lignes = [];
  for (const m of annuaire.mosquees || []) {
    if (!m.slug || vus.has(m.slug)) continue;
    vus.add(m.slug);
    lignes.push([m.slug, (m.nom || '').trim(), lieuCourt(m.ville),
                 m.lat, m.lon, parSlug[m.slug] || '']);
  }
  // Les mosquées dont on a le calendrier d'abord : c'est ce que la page montre.
  lignes.sort((a, b) => (b[5] ? 1 : 0) - (a[5] ? 1 : 0));

  const avecCalendrier = lignes.filter(l => l[5]).length;
  fs.writeFileSync(SORTIE, JSON.stringify({
    _meta: {
      mosquees: lignes.length,
      avec_calendrier: avecCalendrier,
      champs: 'slug, nom, lieu, latitude, longitude, identifiant du calendrier (vide si absent)',
      calendrier: 'calendriers/<identifiant>.json',
      mis_a_jour_le: new Date().toISOString().slice(0, 10)
    },
    m: lignes
  }));

  const ko = n => (n / 1024).toFixed(1) + ' Ko';
  const avant = fs.statSync(ANNUAIRE).size + (fs.existsSync(INDEX) ? fs.statSync(INDEX).size : 0);
  console.log(`${lignes.length} mosquées, dont ${avecCalendrier} avec calendrier`);
  console.log(`  ${ko(avant)} (annuaire + manifeste) → ${ko(fs.statSync(SORTIE).size)} (catalogue)`);
}

main();
