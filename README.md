# Version mobile de test (iPhone)

Version web de test, à ouvrir dans Safari sur l'iPhone. Elle reprend l'écran de saisie,
l'historique, une liste de tâches, des opérations rapides (+1), des statistiques par
jour/semaine/mois/année et l'envoi du relevé par mail (Gmail ou Mail).

## Statistiques

Onglet Stats : courbes des mouvements (ambre) et des opérations (bleu), par jour (semaine du lundi au dimanche), par semaine (8 dernières semaines), par mois (12 derniers mois) ou par
année. Toucher une zone de la courbe affiche les valeurs de la période.

## Opérations rapides

Sept boutons « +1 » sur l'écran Saisir : palettes vides, benne ferraille, rehausses, chutes,
ferraille, bennes copeaux, bois. Chaque appui enregistre une unité avec l'heure exacte.

Dans l'historique, chaque appui apparaît sur **sa propre ligne**, avec l'heure exacte.
Le détail de la ligne permet de retirer une unité saisie par erreur.

Dans l'export, chaque unité devient une ligne avec la colonne **Opération** renseignée
(les mouvements gardent cette colonne vide).

## Accès

L'adresse est fournie par le tunnel Cloudflare lancé sur le PC. Elle ressemble à
`https://xxxxx.trycloudflare.com` et **change à chaque redémarrage du tunnel**.

- Le PC doit rester allumé et le tunnel actif pendant le test.
- L'adresse doit être ouverte dans **Safari** (pas Chrome) pour l'installation.

## Installation sur l'iPhone

1. Ouvrir l'adresse dans Safari.
2. Bouton **Partager** → **Sur l'écran d'accueil**.
3. Ouvrir l'application depuis l'écran d'accueil : plein écran, puis fonctionne hors réseau.

## Données

- Enregistrées dans le navigateur du téléphone (`localStorage`), sous l'adresse utilisée.
- **Aucun envoi vers Internet** : seul l'export par mail fait sortir des données.
- Aucun partage avec le logiciel PC : les deux historiques sont indépendants.
- Si l'adresse change, les données restent sur le téléphone mais ne sont plus visibles par
  la nouvelle adresse : exporter avant de changer.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `index.html` | écran unique (saisie, historique, données) |
| `app.js` | logique : stockage local, saisie, historique, export |
| `xlsx.js` | génère le fichier Excel sans dépendance |
| `styles.css` | apparence |
| `sw.js` | mode hors ligne (service worker) |
| `manifest.webmanifest`, `icons/` | installation sur l'écran d'accueil |
| `serveur.py` | serveur local (port 8080) |
| `demarrer.ps1` | lance le serveur + le tunnel et affiche l'adresse |

## Relancer

```powershell
.\demarrer.ps1
```

## Tests

```powershell
node tests\xlsx.test.cjs sortie.xlsx                 # génération Excel
node ..\webtest\test.cjs <adresse> <dossier-images>  # parcours complet (Playwright + Edge)
```

Le parcours automatisé vérifie : 15 lieux, blocage du lieu identique, activation du bouton,
confirmation, réinitialisation, historique, recherche, modification, statistiques, export,
opérations rapides (ajout, une ligne par appui, retrait d'une unité),
tâches (ajout, cocher, décocher, filtres, suppression), persistance après rechargement et
fonctionnement hors réseau.
