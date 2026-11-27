# Traductions EN / LB du site

Les pages `/en/` et `/lb/` sont générées à partir des pages françaises.

Après une modification d'une page FR :
1. `python3 tools/i18n/i18n.py extract .` → ajoute les nouveaux textes dans `segments.json` (les numéros existants sont conservés)
2. Ajouter les traductions des nouveaux numéros dans `en.json` et `lb.json`
3. `python3 tools/i18n/i18n.py build . en` puis `python3 tools/i18n/i18n.py build . lb`
4. `python3 tools/i18n/i18n.py frswitch .` (sélecteur de langue + hreflang sur les pages FR)
