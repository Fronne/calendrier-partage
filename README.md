# Calendrier partagé

Un calendrier à deux : rendez-vous, anniversaires et tâches partagés entre deux personnes, avec rappels par notification. L'application s'installe sur le téléphone (PWA) et existe aussi en application Android avec widgets.

## Ce que fait l'application

- **Calendrier** en vue Mois ou Semaine, avec une couleur par personne et un filtre « Tous / moi / l'autre ».
- **Rendez-vous** : horaires ou journée entière, sur plusieurs jours, répétés (jour, semaine, 2 semaines, mois, an), avec lieu, notes et catégorie (Travail, Santé, Sport et ses activités, Voyage…).
- **Anniversaires**, avec l'âge quand l'année est connue.
- **Tâches**, avec échéance, répétition et rappel.
- **Rappels** par notification, et notification quand l'autre ajoute, modifie ou supprime quelque chose.
- **Journal d'activité** : les derniers changements, pour qui a manqué une notification.
- **Jours fériés et vacances scolaires** françaises (zones A, B, C), numéros de semaine en option.
- **Hors ligne** : les saisies sont gardées sur le téléphone et envoyées au retour du réseau.
- **Recherche**, thème clair / sombre, export et restauration des données.
- **Android** : application plein écran et widgets « À venir » et « Mois ».

L'accès se fait par un code partagé par les deux personnes ; le calendrier accepte deux membres au maximum.

## Technique

| Partie | Dossier | Outils |
|---|---|---|
| Application web | `src/` | React 18, TypeScript, Vite |
| Serveur (API, rappels, notifications) | `worker/` | Cloudflare Workers, Hono, base D1 (SQLite) |
| Code commun (types, répétitions) | `shared/` | TypeScript |
| Schéma de la base | `migrations/` | SQL |
| Application Android | `android/` | Java, Trusted Web Activity, widgets natifs |

Le Worker sert à la fois le site (dossier `dist/`) et l'API sous `/api`. Une tâche planifiée vérifie les rappels chaque minute.

## Lancer en local

Il faut Node.js.

```bash
npm install
npm run setup
npm run dev
```

`npm run setup` crée `.dev.vars` (code de couple de test et clés de notification) et la base locale. `npm run dev` lance le Worker sur le port 8787 et le site sur http://localhost:5173.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Site et API en local |
| `npm test` | Tests (Vitest) |
| `npm run typecheck` | Vérification des types, site et Worker |
| `npm run db:remote` | Applique les migrations à la base de production |
| `npm run deploy` | Construit le site et met en ligne le Worker |
| `npm run apk` | Construit l'APK Android signé |
| `npm run icons` | Régénère les icônes |

## Mise en ligne

Le projet se déploie sur Cloudflare avec `wrangler` (configuration dans `wrangler.jsonc`). Les secrets du Worker — `COUPLE_CODE`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — se définissent avec `wrangler secret put` ; `node scripts/setup-dev.mjs --print-vapid` génère une paire de clés de notification.

Quand une migration est ajoutée, lancer `npm run db:remote` avant `npm run deploy`.

## Application Android

L'application affiche le site en plein écran ; l'adresse du site est fixée dans `android/app/build.gradle` (`host`). La signature utilise `android/keystore.properties` et `android/keystore/`, qui ne sont pas dans le dépôt : sans cette clé, impossible de publier une mise à jour de l'APK, elle est donc à sauvegarder à part.

## Ce qui n'est pas dans le dépôt

`.dev.vars`, la clé de signature Android, `node_modules/`, `dist/` et les dossiers de construction.
