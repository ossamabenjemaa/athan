# 🕌 Athan — l'appel à la prière qui passe le mode silencieux

Horaires de prière calculés **hors ligne** sur le téléphone, et surtout : de quoi faire
sonner l'athan **sans jamais toucher au bouton silencieux physique de l'iPhone**.

```
index.html      — la page : chercher, vérifier, installer
prayer-times.js — le calcul astronomique (navigateur + Node, zéro dépendance)
cli.js          — les mêmes horaires en ligne de commande
calendriers/    — calendriers de mosquée, manifeste index.json, annuaire mosquees.json
raccourcis/     — les deux raccourcis iOS (.shortcut)
tuto/           — les illustrations du tuto, remplaçables par de vraies captures
scripts/        — import-mawaqit.js, crawl-mosquees.js, build-raccourci.py
```

## 🧭 Le parcours, en trois écrans

1. **Un seul champ** — « Indiquez votre adresse ou la mosquée de votre choix ». La saisie
   alimente les deux pistes : les mosquées de l'annuaire (avec la distance) et « utiliser cette
   adresse » (géocodage). La forme du texte décide seulement de l'ordre — un numéro ou un mot
   de voirie fait passer l'adresse en tête.
2. **Les horaires du jour**, avec la source en toutes lettres : *horaires officiels de la
   mosquée* ou *calcul pour tel lieu, telle méthode*. Puis la question :
   **« Ces horaires me conviennent — obtenir les alarmes »** ou
   **« Ils ne correspondent pas — changer de lieu »**.
3. **Le tuto**, adapté à ce qui a été choisi : installer le raccourci, coller **la seule valeur
   à changer**, les deux réglages iOS, l'automatisation de 00:05, la vérification.

Les réglages d'expert (méthode, madhhab, hautes latitudes, décalages, mode veilleur) sont
toujours là, repliés dans l'écran des horaires.

## 📲 Les deux raccourcis

Le raccourci isole ses réglages dans une **action Texte** en tête : c'est la seule chose qu'un
proche a à changer, et la page la lui donne en un tap.

| Fichier | Pour | Valeur à coller |
|---|---|---|
| `raccourcis/athan-aladhan.shortcut` | une adresse (calcul) | `latitude=…&longitude=…&method=…&school=…` |
| `raccourcis/athan-mosquee.shortcut` | un calendrier de mosquée | l'URL du fichier JSON |

Le second est **dérivé du premier** par `scripts/build-raccourci.py` : même enchaînement, mais
l'URL n'est plus celle d'AlAdhan et une action s'intercale pour extraire les horaires du jour
(clé = date au format `dd-MM`).

```bash
python3 scripts/build-raccourci.py             # régénère la variante mosquée
python3 scripts/build-raccourci.py --verifier  # relit les deux et décrit chaque action
```

**Un fichier `.shortcut` ne s'installe pas comme ça.** iOS n'importe un raccourci non signé
qu'après avoir activé *Autoriser les raccourcis non fiables*, réglage qui n'apparaît qu'une fois
un premier raccourci lancé — impasse pour la plupart des gens. Le fichier généré sert donc de
référence ; **le chemin praticable est de dupliquer le raccourci existant et d'y faire trois
retouches**, ce que le tuto détaille :

| Action | Avant (AlAdhan) | Après (calendrier) |
|---|---|---|
| Texte de tête | `latitude=…&longitude=…` | l'URL du fichier JSON |
| Obtenir le contenu de l'URL | `…/timings/[Date]?[Texte]` | la seule variable **Texte** |
| *(nouvelle action)* | — | **Valeur du dictionnaire**, clé = **Date actuelle** au format `dd-MM` |
| Valeur du dictionnaire (boucle) | clé `data.timings.[Élément]` | clé = **[Élément]**, dans la valeur du jour |

Une fois la copie fonctionnelle, **Partager → Copier le lien iCloud** : ce lien signé s'installe
en deux touches chez n'importe qui. Collé dans `SHORTCUT_URL_MOSQUEE` en tête du script de
`index.html`, il remplace tout ce pavé par un bouton.

## 🔗 Les liens du tuto

Chaque étape porte au moins un bouton qui agit, plutôt qu'une consigne à suivre de tête :

| Bouton | Lien | Fiable ? |
|---|---|---|
| Installer le raccourci | lien iCloud, ou téléchargement du `.shortcut` | ✅ |
| Ouvrir le raccourci | `shortcuts://open-shortcut?name=Athan` | ✅ |
| Ouvrir Raccourcis | `shortcuts://` | ✅ |
| Lancer le raccourci | `shortcuts://run-shortcut?name=Athan` | ✅ |
| Ouvrir GarageBand | `garageband://` | ✅ si l'app est installée |
| Ouvrir le réglage | un raccourci d'une action | ✅ une fois installé |

**Safari ne sait plus ouvrir un panneau de Réglages** — `App-Prefs:root=…` a été cassé par
iOS 18 et n'a jamais vraiment été autorisé depuis le web. En revanche, l'action *Ouvrir les URL*
d'un **raccourci** y arrive encore. D'où `raccourcis/reglages-raccourcis.shortcut` : deux actions,
une URL (`App-prefs:com.apple.shortcuts`) et son ouverture, généré par le même script.

L'étape 3 propose son téléchargement ; une fois importé puis repartagé depuis l'iPhone, coller
son lien iCloud dans `SHORTCUT_URL_REGLAGES` remplace le téléchargement par un bouton
**« Ouvrir le réglage »** qui lance le raccourci en un tap. L'itinéraire écrit reste affiché et
copiable, pour qui préfère y aller à la main.

Le nom du raccourci compte pour les liens `shortcuts://…?name=` : il est dans la constante
`SHORTCUT_NAME` en tête du script de `index.html`. S'il est renommé sur l'iPhone, les deux
boutons cessent de le trouver.

## 🖼 Les illustrations du tuto

`tuto/*.svg` sont des **schémas dessinés**, pas de vraies captures — ils portent la mention.
Pour les remplacer : déposer les images dans `tuto/` et changer le tableau `TUTO_IMAGES` en tête
du script de `index.html` (une ligne par étape).

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
| 2 | **Supprimer les alarmes** | entrée = les alarmes trouvées |
| 3 | **Obtenir le contenu de l'URL** | l'adresse donnée par la page (bloc *Valeurs à copier*), **date remplacée par une variable** (voir plus bas) |
| 4 | **Texte** | `Fajr,Dhuhr,Asr,Maghrib,Isha` — sans espace après les virgules |
| 5 | **Scinder le texte** | séparateur **Personnalisé** : une virgule |
| 6 | **Répéter avec chaque élément dans** | **Texte scindé** (le résultat de *Scinder*, pas *Contenu de l'URL*) ; dedans, deux actions ↓ |
| 6a | **Obtenir la valeur du dictionnaire** | clé `data.timings.` **suivie de la variable Élément de répétition** (la clé seule renvoie tout le dictionnaire), dans *Contenu de l'URL* |
| 6b | **Ajouter une alarme** | à cette valeur, étiquette `Athan ` + **Élément de répétition** |

La page réunit toutes ces valeurs dans un bloc **📋 Valeurs à copier** : une touche sur une ligne
la met dans le presse-papiers (adresse, `dd-MM-yyyy`, `Athan`, la liste des cinq prières, la virgule
séparatrice, `data.timings.`, `Athan ` espace final compris). Plus rien à retaper à la main.

La boucle remplace cinq copies des deux mêmes actions : six actions au total, et cinq occasions
de faute de frappe en moins. Attention à la clé — `timings` prend un **s**, et une clé fausse
ne lève aucune erreur : elle rend une valeur vide, et l'alarme n'est simplement pas créée.

> ⚠️ **Deux pièges, dans cet ordre précis.**
>
> **Les alarmes apparaissent puis disparaissent aussitôt** → la suppression est passée *après*
> les créations et efface ce qui vient d'être créé. Les actions 1 et 2 doivent être tout en haut.
> Vérifie aussi l'**entrée** de *Supprimer les alarmes* : une action sans entrée explicite reprend
> le résultat de celle qui la précède — donc, placée après *Ajouter une alarme*, elle supprime
> l'alarme fraîchement créée. Elle doit pointer sur le résultat de *Rechercher des alarmes*.
>
> **Une confirmation « Autoriser … à supprimer 1 alarme ? » s'affiche** → le réglage n'est pas dans
> l'action mais dans les préférences de l'app : **Réglages → Apps → Raccourcis → Avancé →
> Autoriser la suppression sans confirmation** (sur les iOS plus anciens :
> *Réglages → Raccourcis → Avancé*). Sans ça, l'automatisation de 00:05 reste plantée sur la
> question pendant que tu dors, et aucune alarme n'est créée. Vérifie aussi que l'automatisation
> elle-même est en **Exécuter immédiatement**, sans « Demander avant d'exécuter ».

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

Le bouton **📋 Copier la recette entière** de la page en donne la version texte, prête à suivre.

### c. Trouver sa mosquée depuis la page

Dépliant **🕌 Trouver la mosquée près de chez moi**, dans la carte du haut :

- **les dix plus proches** de l'adresse réglée, avec la distance — saisis ton adresse, touche
  *🔎 Chercher*, puis ouvre le dépliant ;
- ou une **barre de recherche** par nom de mosquée ou de ville, classée par distance.

Tout se fait sur l'appareil, à partir de `calendriers/mosquees.json` : un annuaire de
métadonnées publiques (nom, ville, position, slug), sans aucun horaire. Il est construit par
`scripts/crawl-mosquees.js`, qui balaie une grille de coordonnées sur la recherche Mawaqit
(dix résultats maximum par requête, d'où le découpage adaptatif : une case dont les dix
réponses sont toutes plus proches qu'elle-même est redécoupée en quatre). Le workflow
`annuaire.yml` le régénère chaque trimestre.

Une pastille indique l'état de chaque mosquée : **📅** son calendrier est déjà dans l'app,
**➕** pas encore — la page se cale alors sur ses coordonnées (calcul) et donne le lien pour
déclencher l'import en trois touches.

### d. Utiliser directement le calendrier de sa mosquée (le plus juste)

Le sélecteur **Source des horaires** propose, à côté du calcul, les calendriers de mosquée
présents dans le dépôt. Choisi comme source, un calendrier remplace entièrement le calcul :
plus de méthode, plus d'angle, plus d'ajustements — les horaires affichés *sont* ceux de la
mosquée. Le fichier est mis en cache sur l'appareil, donc la page marche ensuite hors ligne.

**Ajouter une mosquée : trois touches, sans terminal.** Onglet **Actions** du dépôt →
*Calendriers de mosquée* → **Run workflow** → coller le nom, le slug ou le lien
`mawaqit.net` → *Run*. Le job importe, commite, et la mosquée apparaît dans le sélecteur de
la page quelques minutes plus tard. Ça marche depuis un téléphone.

En ligne de commande, si tu as le dépôt sous la main :

```bash
node scripts/import-mawaqit.js "ayoub ansari"        # cherche, puis importe
node scripts/import-mawaqit.js "paris" --list        # juste voir les résultats
node scripts/import-mawaqit.js --slug <slug>         # une mosquée précise
node scripts/import-mawaqit.js --refresh             # met à jour tout le dépôt
```

L'import a été contrôlé contre le calendrier PDF d'une mosquée : **365 jours × 6 horaires,
zéro différence**. Le script refuse d'écrire un fichier incomplet (moins de 365 jours) ou
incohérent (horaires dans le désordre).

Ces horaires appartiennent aux mosquées : on les recopie, on ne les recalcule pas. Le workflow
`.github/workflows/calendriers.yml` relance `--refresh` une fois par mois — de quoi suivre les
corrections d'une mosquée et le passage à l'année suivante — et ne commite qu'en cas de
changement. La page, elle, ne peut pas interroger Mawaqit directement : ni la page mosquée ni
l'API de recherche n'envoient d'en-têtes CORS.

Le raccourci s'y branche avec **une action de plus** : après *Obtenir le contenu de l'URL*
(qui pointe maintenant sur le JSON), ajoute **Obtenir la valeur du dictionnaire** avec pour clé
la variable **Date actuelle** au format `dd-MM` — tu récupères les horaires du jour. Dans la
boucle, la clé n'est plus que la variable **Élément de répétition**, et le champ « dans » pointe
sur cette valeur du jour. Le bouton *Copier la recette entière* s'adapte tout seul à la source.

Une mosquée absente de Mawaqit ? Repli : **calcul + ajustements par prière** (section d),
précision mesurée à ±3 min sur une année face à un calendrier réel.

> Les clés sont `JJ-MM`, sans année : le fichier reste utilisable l'année suivante, à la réserve
> près des changements d'heure, qui ne tombent pas aux mêmes dates — d'où le rafraîchissement
> mensuel.

> 💡 **Variante avancée, sans rien importer.** La page d'une mosquée Mawaqit contient ses
> horaires du jour en clair : `"times":["05:18","13:55","17:52","21:07","22:28"]` (les cinq
> prières, le Chourouq étant à part dans `"shuruq"`). Un raccourci iOS n'étant pas soumis au
> CORS, il peut donc interroger `https://mawaqit.net/fr/<slug>` et extraire ces heures avec une
> action **Correspondance de texte** et l'expression `(?<="times":\[")[^\]]+(?="\])`, puis
> *Scinder le texte* sur `","`. Ça marche pour n'importe quelle mosquée, immédiatement.
> Contrepartie : on dépend de la structure de leur page HTML, alors qu'un calendrier importé
> dans le dépôt continue de fonctionner quoi qu'il arrive chez eux.

### e. Coller aux horaires de sa mosquée (sans calendrier complet)

Les horaires calculés ne sont pas ceux de ta mosquée, et c'est attendu : **Dhuhr et Asr** ne
dépendent que de la position du soleil et tombent au même moment partout, mais **Fajr et Ichaa**
dépendent de l'angle de crépuscule retenu, qui varie d'une mosquée à l'autre (12°, 15°, 18°, ou
un calendrier imprimé maison). Le Maghrib, lui, se voit souvent ajouter une ou deux minutes de
marge après le coucher.

Plutôt que de deviner l'angle, la page laisse **corriger prière par prière** :
dépliant **« Coller aux horaires de ma mosquée (± minutes) »** dans la carte du haut. Exemple
relevé sur une mosquée du 11ᵉ à Paris (méthode UOIF) : Fajr `-8`, Maghrib `+2`, Ichaa `+5`, et
les six horaires tombent alors pile.

Ces minutes ne restent pas dans la page : elles partent dans l'adresse du raccourci via le
paramètre `tune` d'AlAdhan (ordre imposé : `imsak,fajr,sunrise,dhuhr,asr,maghrib,sunset,isha,midnight`),
donc **les alarmes suivent le même calendrier que ce que tu lis**.

```
…&method=12&school=0&tune=0,-8,0,0,0,2,0,5,0
```

> Un résidu d'arrondi peut subsister : AlAdhan tronque parfois à la minute inférieure là où la page
> arrondit au-dessus. Si une alarme tombe une minute trop tôt, ajoute `1`.
>
> ⚠️ Ne confonds pas l'heure de l'athan avec les `+15`, `+10`, `+5` affichés par Mawaqit : ce sont
> les délais d'**iqama** (le début de la prière en groupe), pas l'appel.

### f. Trouver son lieu sans installer quoi que ce soit

Trois façons, de la plus simple à la plus précise :

- **Taper sa ville dans la page** — champ du haut, `Marseille, France`, bouton **🔎 Chercher**.
  La page interroge le géocodeur public d'AlAdhan (pas de clé, pas de compte) et remplit
  latitude et longitude toute seule. Elle accepte aussi un code postal (`75015 Paris`).
- **Se passer complètement de coordonnées** — AlAdhan sait travailler par ville. Le dépliant
  *Variante sans coordonnées* de la page donne l'adresse correspondante, plus courte à taper
  sur un téléphone :

  ```
  https://api.aladhan.com/v1/timingsByCity/16-08-2026?city=Marseille&country=France&method=3&school=0
  ```

  Les horaires visent alors le centre de la ville : quelques secondes d'écart avec ton adresse
  exacte, invisible à l'échelle d'une minute d'affichage.
- **📍 Ou me localiser** — le GPS du téléphone, le plus précis, mais il demande l'autorisation
  de localisation.

Une fois les coordonnées inscrites, la page n'a plus besoin de réseau : le calcul est local.

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

## 👨‍👩‍👧 Le donner à ses proches

Ce qui coûte cher à un débutant, ce n'est pas la page — c'est reconstruire le raccourci et ses
douze actions. À faire une fois, puis à distribuer :

1. **Partage le raccourci** : Raccourcis → ton raccourci → *Partager* → **Copier le lien iCloud**.
   Colle ce lien dans la constante `SHORTCUT_URL` en tête du script de `index.html` : la page
   affiche alors un bouton **« Installer le raccourci »** et relègue la recette au dépannage.
2. **Ajoute leur mosquée** sans terminal : onglet *Actions* → *Calendriers de mosquée* →
   *Run workflow* → le nom ou le lien Mawaqit. Elle apparaît dans le sélecteur de tout le monde,
   et le rafraîchissement mensuel s'en occupe ensuite tout seul.

Côté proche, il reste quatre gestes, tous dans la page :

| | |
|---|---|
| 1 | Ouvrir la page, choisir sa mosquée (ou sa ville) |
| 2 | Installer le raccourci (bouton) |
| 3 | Y coller l'**adresse** donnée par le bloc *Valeurs à copier* |
| 4 | Les deux réglages iOS : la sonnerie athan (GarageBand) et *Autoriser la suppression sans confirmation* |

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
