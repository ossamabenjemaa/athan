# 🕌 Athan — l'appel à la prière qui passe le mode silencieux

Horaires de prière calculés **hors ligne** sur le téléphone, et surtout : de quoi faire
sonner l'athan **sans jamais toucher au bouton silencieux physique de l'iPhone**.

```
index.html      — la page (horaires, compte à rebours, mode veilleur)
prayer-times.js — le calcul astronomique (navigateur + Node, zéro dépendance)
cli.js          — les mêmes horaires en ligne de commande
```

## 🚀 Essayer

**Sur l'iPhone** — le dépôt publie tout seul sur GitHub Pages au premier push sur `main`
(workflow `.github/workflows/pages.yml`, rien à régler dans Settings) :

👉 **https://ossamabenjemaa.github.io/athan/** — puis *Partager → Sur l'écran d'accueil*.

**En local** — il suffit d'un petit serveur statique :

```bash
python3 -m http.server 8000
# puis ouvre http://localhost:8000
```

## 🔇 Le problème, en une ligne

Sur iPhone, le bouton silencieux coupe **les sonneries et les notifications** — donc
aussi celles de n'importe quelle app d'athan. Trois catégories de sons y échappent :

| Son | Silencieux | Concentration | Remarque |
|---|:---:|:---:|---|
| Notification (web ou app) | ❌ | ❌ | le cas de 99 % des apps |
| Alerte critique (app native) | ✅ | ✅ | autorisation Apple spéciale, sur dossier |
| Lecture média (`<audio>`, Musique, YouTube…) | ✅ | ✅ | seulement si une page/app joue déjà |
| **Alarme de l'app Horloge** | ✅ | ✅ | par conception, toujours |

D'où les deux moyens proposés ici, l'un pour le téléphone posé à côté de soi,
l'autre pour le téléphone au fond de la poche.

## ① Mode veilleur — la page fait le muezzin

Ouvre la page, choisis ton fichier d'athan, active **Mode veilleur**.

- Le son passe par une balise `<audio>` : sur iOS, la **lecture média ignore le bouton
  silencieux** (c'est pour ça qu'une vidéo Safari ou Instagram s'entend en mode silencieux,
  alors qu'un son d'interface non). Seul le volume multimédia compte, monte-le.
- L'écran est maintenu allumé via l'API **Wake Lock** (Safari 16.4+), et la page rattrape
  une prière tombée pendant les 2 dernières minutes si iOS a mis le minuteur en pause.
- Le fichier d'athan reste sur l'appareil (IndexedDB) : rien n'est téléversé, il est
  retrouvé au rechargement. Sans fichier, un petit carillon fabriqué en JS sert de secours.
- ⚠️ Il faut **toucher une fois la page** (le bouton « Tester » ou l'interrupteur) : Safari
  n'autorise le son qu'après un geste. Et la page doit rester **ouverte au premier plan**.

Parfait au bureau ou à la maison, avec le téléphone posé. Inutile s'il est verrouillé.

## ② Réveils de l'app Horloge — ça sonne même rangé (recommandé)

Les alarmes de l'app **Horloge** sont les seuls sons qu'iOS laisse passer *quoi qu'il arrive* :
bouton silencieux, Ne pas déranger, Concentration. On s'en sert comme athan, et un raccourci
les reprogramme chaque nuit avec les horaires du jour.

### a. L'athan comme sonnerie (une fois)

1. Envoie ton mp3 d'athan dans **Fichiers** (AirDrop, iCloud, téléchargement…).
2. **GarageBand** → nouveau projet **Enregistreur audio** → vue pistes → boucle 🔄 →
   **Fichiers** → importe l'athan → ajuste à **30 secondes** environ.
3. **Mes morceaux** → appui long sur le projet → **Partager → Sonnerie → Exporter**.
4. Ouvre **Horloge**, crée une alarme, choisis cette sonnerie : les alarmes créées ensuite
   par le raccourci reprennent ce son (l'action *Ajouter une alarme* ne choisit pas la
   sonnerie elle-même).

### b. Le raccourci quotidien

**Raccourcis → Automatisation → + → Heure de la journée → 00:05, tous les jours →
Exécuter immédiatement** (décoche « Demander avant d'exécuter »), puis :

| # | Action | Réglage |
|---|---|---|
| 1 | **Rechercher des alarmes** | Étiquette *contient* `Athan` |
| 2 | **Supprimer les alarmes** | les alarmes trouvées (nettoie la veille) |
| 3 | **Obtenir le contenu de l'URL** | l'adresse donnée par la page (bouton *Copier l'adresse*), **date remplacée par une variable** (voir plus bas) |
| 4 | **Obtenir la valeur du dictionnaire** | clé `data.timings.Fajr` |
| 5 | **Ajouter une alarme** | à cette heure, étiquette `Athan Fajr` |
| 6 | Répéter 4–5 | `Dhuhr`, `Asr`, `Maghrib`, `Isha` |

L'adresse pointe sur l'API publique **AlAdhan** avec *tes* coordonnées, *ta* méthode et
*ton* madhhab — donc exactement les horaires affichés par la page :

```
https://api.aladhan.com/v1/timings/15-08-2026?latitude=48.8566&longitude=2.3522&method=3&school=0
```

⚠️ **La date compte.** Elle est au format `JJ-MM-AAAA` et la page y met celle du jour :
telle quelle, le raccourci reprogrammerait chaque nuit les horaires d'aujourd'hui. Dans
l'action *Obtenir le contenu de l'URL*, efface `15-08-2026` et insère à la place la variable
**Date actuelle** → touche-la → **Format de date : personnalisé** → `dd-MM-yyyy`.

(Le raccourci s'exécutant à 00:05, « Date actuelle » est bien le jour qui commence.
À éviter : l'adresse `/v1/timings/today`, dont le « aujourd'hui » est calculé en UTC —
à 00:05 à Paris, il renvoie encore la veille.)

Le bouton **📋 Copier la recette** de la page en donne la version texte, prête à suivre.

> 💡 Volume : les alarmes suivent le curseur **Réglages → Sons et vibrations → Sonnerie et
> alertes**, pas le volume multimédia. Monte-le une bonne fois.

### ③ Et une vraie app native ?

Une app iOS peut jouer l'athan par-dessus le silencieux en configurant sa session audio en
`AVAudioSession.Category.playback` avec le mode d'arrière-plan *audio* — c'est ce que font
les apps d'athan du store. Ça demande Xcode, un compte développeur et un rechargement tous
les 7 jours en compte gratuit : hors sujet pour un POC statique, mais c'est la voie propre
si tu veux aller plus loin.

## 🧮 Le calcul

`prayer-times.js` implémente l'algorithme classique (PrayTimes / Ilyas) : position du soleil
depuis le jour julien, midi solaire vrai pour Dhuhr, angle horaire pour Fajr/Ichaa, longueur
d'ombre pour Asr (×1 ou ×2), réfraction de −0,833° pour le lever/coucher, et une règle de
repli aux hautes latitudes quand le soleil ne descend jamais assez bas (Paris en juin).

Méthodes disponibles (ids **AlAdhan**, pour que page, CLI et raccourci concordent) :
LIM `3`, UOIF France `12`, ISNA `2`, Égypte `5`, Umm al-Qura `4`, Karachi `1`,
Diyanet `13`, Dubaï `16`.

**Vérification** : 240 comparaisons (8 villes × 5 dates × 5 méthodes, Paris → Jakarta → Oslo)
face à l'API AlAdhan → écart **≤ 1 min** partout, sauf l'Asr d'Oslo en hiver (jusqu'à 4 min,
traitement des hautes latitudes différent). À reproduire :

```bash
node cli.js --lat 48.8566 --lon 2.3522 --compare
```

```bash
node cli.js --lat 43.2965 --lon 5.3698 --method 12 --hanafi --date 2026-09-01
node cli.js --help
```

## ⚠️ Limites connues

- La page ne peut **rien déclencher fermée** — c'est une limite d'iOS, pas du code ; d'où le ②.
- Les notifications web sur iPhone (page ajoutée à l'écran d'accueil) restent **muettes en
  mode silencieux** : elles ne remplacent pas les alarmes.
- L'action *Ajouter une alarme* ne permet pas de choisir la sonnerie : elle reprend celle
  par défaut de l'app Horloge.
- Le raccourci a besoin du réseau (API AlAdhan) une fois par nuit. Sans réseau, les alarmes
  de la veille ont déjà été supprimées : garde une alarme fixe de secours si c'est critique.
- Les horaires calculés peuvent différer de quelques minutes du calendrier de ta mosquée
  (méthode, arrondis, angle retenu). Ajuste la méthode, et vérifie. 🤲
