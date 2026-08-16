#!/usr/bin/env python3
"""
build-raccourci.py — fabrique la variante « calendrier de mosquée » du raccourci.

    python3 scripts/build-raccourci.py
    python3 scripts/build-raccourci.py --verifier   (relit et décrit le résultat)

Le raccourci d'origine (raccourcis/athan-aladhan.shortcut) interroge l'API
AlAdhan : son URL contient la date, et la clé du dictionnaire est
« data.timings.<prière> ». Nos calendriers de mosquée, eux, sont des fichiers
JSON rangés par date : « JJ-MM » puis « <prière> ».

On dérive donc le raccourci en trois retouches, sans rien réécrire d'autre :

  1. l'action Texte de tête porte l'URL du calendrier au lieu des paramètres ;
  2. « Obtenir le contenu de l'URL » utilise ce texte tel quel, sans y coller la date ;
  3. une action « Obtenir la valeur du dictionnaire » s'intercale, avec pour clé la
     date du jour au format dd-MM — elle donne les horaires du jour ; dans la
     boucle, la clé se réduit alors au nom de la prière.

Le fichier produit n'est pas signé : il s'importe après avoir activé
« Autoriser les raccourcis non fiables » dans Réglages → Raccourcis.
"""

import plistlib
import sys
from pathlib import Path

RACCOURCIS = Path(__file__).resolve().parent.parent / 'raccourcis'
GABARIT = RACCOURCIS / 'athan-aladhan.shortcut'
SORTIE = RACCOURCIS / 'athan-mosquee.shortcut'
SORTIE_REGLAGES = RACCOURCIS / 'reglages-raccourcis.shortcut'

# Safari ne suit plus les liens vers un panneau de Réglages, mais l'action
# « Ouvrir les URL » d'un raccourci, elle, y arrive encore. Depuis iOS 18 la
# syntaxe par identifiant d'app a remplacé l'ancien « root=… ».
URL_REGLAGES = 'App-prefs:com.apple.shortcuts'

# L'URL d'exemple : elle sera remplacée par chacun dans l'action Texte.
URL_EXEMPLE = 'https://ossamabenjemaa.github.io/athan/calendriers/ayoub-el-ansari-paris.json'
UUID_JOUR = 'B1C2D3E4-0000-4000-8000-A7A7A7A7A7A7'   # notre action ajoutée
OBJET = '￼'                                      # le caractère qui porte une variable


def jeton(chaine, pieces):
    """Un champ de texte de Raccourcis : une chaîne + ses variables par position."""
    return {'Value': {'string': chaine, 'attachmentsByRange': pieces},
            'WFSerializationType': 'WFTextTokenString'}


def sortie_action(uuid, nom):
    return {'OutputUUID': uuid, 'Type': 'ActionOutput', 'OutputName': nom}


def trouver(actions, identifiant, depuis=0):
    for i in range(depuis, len(actions)):
        if actions[i]['WFWorkflowActionIdentifier'] == identifiant:
            return i
    raise SystemExit(f'Action introuvable dans le gabarit : {identifiant}')


def construire():
    if not GABARIT.exists():
        raise SystemExit(f'Gabarit absent : {GABARIT}')
    raccourci = plistlib.loads(GABARIT.read_bytes())
    actions = raccourci['WFWorkflowActions']

    i_texte = trouver(actions, 'is.workflow.actions.gettext')
    i_url = trouver(actions, 'is.workflow.actions.downloadurl')
    i_cle = trouver(actions, 'is.workflow.actions.getvalueforkey')

    uuid_texte = actions[i_texte]['WFWorkflowActionParameters']['UUID']
    uuid_url = actions[i_url]['WFWorkflowActionParameters']['UUID']

    # 1. le texte de tête devient l'adresse du calendrier
    actions[i_texte]['WFWorkflowActionParameters']['WFTextActionText'] = URL_EXEMPLE

    # 2. l'URL n'est plus que ce texte : ni date, ni point d'interrogation
    actions[i_url]['WFWorkflowActionParameters']['WFURL'] = jeton(
        OBJET, {'{0, 1}': sortie_action(uuid_texte, 'Texte')})

    # 3. les horaires du jour, par la date au format dd-MM
    action_jour = {
        'WFWorkflowActionIdentifier': 'is.workflow.actions.getvalueforkey',
        'WFWorkflowActionParameters': {
            'UUID': UUID_JOUR,
            'WFGetDictionaryValueType': 'Value',
            'WFInput': jeton(OBJET, {'{0, 1}': sortie_action(uuid_url, 'Contenu de l’URL')}),
            'WFDictionaryKey': jeton(OBJET, {'{0, 1}': {
                'Type': 'CurrentDate',
                'Aggrandizements': [{
                    'WFDateFormatStyle': 'Custom',
                    'WFISO8601IncludeTime': False,
                    'WFDateFormat': 'dd-MM',
                    'Type': 'WFDateFormatVariableAggrandizement',
                }],
            }}),
        },
    }
    actions.insert(i_url + 1, action_jour)
    i_cle += 1  # la boucle a glissé d'un cran

    # dans la boucle : la clé se réduit au nom de la prière, lu dans les horaires du jour
    params = actions[i_cle]['WFWorkflowActionParameters']
    params['WFInput'] = jeton(OBJET, {'{0, 1}': sortie_action(UUID_JOUR, 'Valeur du dictionnaire')})
    params['WFDictionaryKey'] = jeton(OBJET, {'{0, 1}': {'VariableName': 'Repeat Item', 'Type': 'Variable'}})

    SORTIE.write_bytes(plistlib.dumps(raccourci, fmt=plistlib.FMT_BINARY))
    print(f'✓ {SORTIE.relative_to(Path.cwd()) if SORTIE.is_relative_to(Path.cwd()) else SORTIE}'
          f' ({SORTIE.stat().st_size} octets, {len(actions)} actions)')


def construire_reglages():
    """Un raccourci d'une seule chose : ouvrir la page Réglages de Raccourcis."""
    url = {
        'WFWorkflowActionIdentifier': 'is.workflow.actions.url',
        'WFWorkflowActionParameters': {
            'UUID': 'C0FFEE00-0000-4000-8000-B1B1B1B1B1B1',
            'WFURLActionURL': URL_REGLAGES,
        },
    }
    ouvrir = {
        'WFWorkflowActionIdentifier': 'is.workflow.actions.openurl',
        'WFWorkflowActionParameters': {
            'UUID': 'C0FFEE01-0000-4000-8000-B1B1B1B1B1B1',
            'WFInput': jeton(OBJET, {'{0, 1}': sortie_action(
                'C0FFEE00-0000-4000-8000-B1B1B1B1B1B1', 'URL')}),
        },
    }
    gabarit = plistlib.loads(GABARIT.read_bytes())
    raccourci = {
        'WFWorkflowClientVersion': gabarit.get('WFWorkflowClientVersion'),
        'WFWorkflowMinimumClientVersion': gabarit.get('WFWorkflowMinimumClientVersion'),
        'WFWorkflowMinimumClientVersionString': gabarit.get('WFWorkflowMinimumClientVersionString'),
        'WFWorkflowIcon': gabarit.get('WFWorkflowIcon'),
        'WFWorkflowImportQuestions': [],
        'WFWorkflowTypes': [],
        'WFWorkflowInputContentItemClasses': gabarit.get('WFWorkflowInputContentItemClasses', []),
        'WFWorkflowHasShortcutInputVariables': False,
        'WFWorkflowHasOutputFallback': False,
        'WFWorkflowActions': [url, ouvrir],
    }
    SORTIE_REGLAGES.write_bytes(plistlib.dumps(raccourci, fmt=plistlib.FMT_BINARY))
    print(f'✓ {SORTIE_REGLAGES.name} ({SORTIE_REGLAGES.stat().st_size} octets) → {URL_REGLAGES}')


def decrire(chemin):
    raccourci = plistlib.loads(Path(chemin).read_bytes())
    print(f'\n{chemin} — {len(raccourci["WFWorkflowActions"])} actions')
    for i, action in enumerate(raccourci['WFWorkflowActions'], 1):
        params = action.get('WFWorkflowActionParameters', {})
        nom = action['WFWorkflowActionIdentifier'].split('.')[-1]
        détails = []
        for champ in ('WFTextActionText', 'WFTextCustomSeparator', 'WFVariableName'):
            if champ in params:
                détails.append(f'{champ}={params[champ]!r}')
        for champ in ('WFURL', 'WFDictionaryKey', 'WFInput', 'name'):
            valeur = params.get(champ)
            if isinstance(valeur, dict) and 'Value' in valeur and isinstance(valeur['Value'], dict):
                chaine = valeur['Value'].get('string')
                if chaine is None:
                    continue
                pieces = valeur['Value'].get('attachmentsByRange', {})
                noms = []
                for piece in pieces.values():
                    if piece.get('Type') == 'CurrentDate':
                        fmt = piece.get('Aggrandizements', [{}])[0].get('WFDateFormat', '?')
                        noms.append(f'[Date {fmt}]')
                    elif piece.get('Type') == 'Variable':
                        noms.append(f'[{piece.get("VariableName")}]')
                    else:
                        noms.append(f'[{piece.get("OutputName")}]')
                détails.append(f'{champ}={chaine.replace(OBJET, "◆")!r} ◆={", ".join(noms)}')
        print(f'  {i:2}. {nom}' + (f'  {" | ".join(détails)}' if détails else ''))


if __name__ == '__main__':
    if '--verifier' in sys.argv:
        decrire(GABARIT)
        decrire(SORTIE)
        decrire(SORTIE_REGLAGES)
    else:
        construire()
        construire_reglages()
