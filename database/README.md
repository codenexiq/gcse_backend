# Database (MySQL) - `educ`

Everything about the database lives in this folder.

```
database/
  migrations/   Numbered .sql files that build the tables (001_..., 002_..., 003_...)
  seeds/        Starter data (GCSE subjects + topics)
  scripts/      The Node scripts that run the files above
```

## Commands (run from `backend/`)
| Command | What it does |
|---|---|
| `npm run db:setup` | Create the `educ` database, build all tables, load starter data. **Start here.** |
| `npm run db:migrate` | Run only new migration files |
| `npm run db:seed` | (Re)load the starter data - safe to repeat |
| `npm run db:reset -- --yes` | DELETE everything and rebuild (development only) |
| `npm run tutor:create -- --name "Sam Jones" --email a@b.com --role tutor` | Create a tutor or admin account (password shown once) |

Connection details come from `backend/.env` (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME=educ`).

## Tables
```
users ──< items >── topics >── subjects
```
| Table | Purpose | Indexes (why) |
|---|---|---|
| `users` | accounts, with a `role` (student / tutor / admin) | `UNIQUE (email)` - fast login, no duplicates; `(role, created_at)` - lists students or tutor newest first without sorting |
| `subjects` | GCSE subjects | `UNIQUE (name)`, `UNIQUE (slug)` |
| `topics` | topics in a subject | `UNIQUE (subject_id, slug)` - also serves "topics of a subject" + the foreign key |
| `items` | a user's study items | `(user_id, created_at)` - finds a user's items already sorted; `(topic_id)` - topic joins |

`schema_migrations` is created automatically and remembers which migrations have run.

## Changing the database
Never edit a migration that has already run. Add a new file instead, e.g.
`004_add_due_date_to_items.sql`, then run `npm run db:migrate`.

## Why the browser does not call the API every time
`subjects` and `topics` are reference data that almost never change, so they are cached in layers:
1. **Server memory** - Express keeps them for 10 minutes, so most requests do not touch MySQL.
2. **HTTP cache** - the API sends `Cache-Control: public, max-age=3600` and an `ETag`,
   so the browser reuses the response (or just gets a tiny `304 Not Modified`).
3. **Browser storage** - the frontend `useSubjects()` hook keeps them in memory and in
   `localStorage` for 1 hour and shares one request between all components.

A user's own `items` are *not* cached this way - they change often and are private.
