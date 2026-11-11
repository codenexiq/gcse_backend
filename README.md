# Backend (Express 5 + TypeScript + MySQL)

## Setup
1. ```bash
   npm install
   copy .env.example .env   # macOS/Linux: cp .env.example .env
   ```
2. Open `.env` and set `JWT_SECRET` (the server refuses to start without it) and your DB password.
   Generate a secret with:
   `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
3. `npm run db:setup` - creates the **educ** database, its tables (with indexes) and starter data.
   All database files live in [database/](database/README.md).
4. `npm run dev` -> http://localhost:5000/api/health

The public website (blog posts, shop packs, tutors, reviews) reads its content from the database. `npm run db:seed-site` fills the empty tables with the starting content (it never overwrites existing rows). Contact-form messages are saved in `site_enquiries`; admins read them in the dashboard (Settings > Website enquiries).

After pulling or writing new code, run `npm run db:migrate` again. If you forget, the server prints a clear **WARNING** at start-up
listing the migrations that have not been run (otherwise you would only see 'Unknown column' errors).

Other commands: `npm run typecheck` (check types), `npm run build` (compile to `dist/`), `npm start` (run the compiled build - use this in production).
Development runs the TypeScript directly with `tsx`.

## Security features
| Threat | Protection | Where |
|---|---|---|
| Unauthorised access | Every route needs a valid session, except `/health`, `/auth/*` and the read-only `/subjects` list (public school data, shown on the home page) | `routes/index.js`, `middleware/authenticate` |
| Wrong role | Every account is a `student`, `tutor` or `admin`. The role is read from the database on every request (never from the browser) and `requireRole()` guards each tutor route | `middleware/requireRole`, `modules/tutor` |
| Privilege escalation | `/auth/register` always makes a student and ignores any `role` sent to it; there is no public tutor sign-up | `modules/auth/user.model.ts` |
| Stolen passwords | bcrypt (12 rounds); same error + same timing for wrong email / wrong password | `modules/auth` |
| Session theft (XSS) | JWT stored in an `HttpOnly`, `SameSite=Strict`, `Secure` (production) cookie, expires in 2h | `modules/auth/auth.controller.js` |
| CSRF | Origin check + required `X-Requested-With` header on POST/PUT/DELETE | `middleware/csrfProtection` |
| Brute force / spam | 100 req / 15 min per IP, only 10 login/register attempts / 15 min | `middleware/rateLimiters` |
| SQL injection | Only `?` placeholders in queries | `modules/*/*.model.js` |
| Bad input | zod schemas validate and clean every request body | `middleware/validate`, `*.schemas.js` |
| Reading other users' data | Every item query filters by `user_id` | `modules/items/item.model.js` |
| Info leaks | Generic 500 messages, no stack traces, no `X-Powered-By` | `middleware/errorHandler` |
| Browser attacks | `helmet` security headers, CORS limited to the frontend, 10kb body limit | `app.js` |
| Weak config | Server won't start with a short/missing `JWT_SECRET` | `config/env` |

In production: set `NODE_ENV=production`, serve over HTTPS, use a strong `DB_PASSWORD`,
a dedicated MySQL user (not `root`), and `TRUST_PROXY=1` if behind a proxy.

## Roles and tutor accounts
| Role | How the account is made | Can use |
|---|---|---|
| `student` | Registers on the website | Their own items, subjects |
| `tutor` | `npm run tutor:create` | Everything a student can, plus `GET /api/tutor/overview` and `/students` |
| `admin` | `npm run tutor:create` | Everything a tutor can, plus `GET /api/tutor/accounts` |

Create a tutor or admin account (a strong random password is shown **once** - copy it straight away):
```bash
npm run tutor:create -- --name "Jane Smith" --email jane@school.com --role admin
npm run tutor:create -- --name "Sam Jones" --email sam@school.com --role tutor
```
Tutors and admins sign in with `POST /api/auth/tutor/login` (the page is a direct link that nothing on the website points to - see the front-end README). A student using that form gets exactly the same
error as a wrong password, so nobody can tell which emails belong to tutor. Tutor who use the student form are told to use the tutor one
(only after their password was correct). The tutor sign-in uses an allow-list (`tutor` / `admin`), so an unknown or blank role can never get in.
The database connection runs in strict mode, so a bad value (for example a role that does not exist) is refused with an error instead of being saved as a blank.
There is no password-change feature yet.

## Folder structure
```
database/       migrations/ (tables + indexes), seeds/ (starter data), scripts/ (runners) - see database/README.md
src/
  types/        express.d.ts (adds req.user to Express)
  config/       env/ (settings + validation), db/ (MySQL pool)
  middleware/   authenticate/, requireRole/, csrfProtection/, rateLimiters/, validate/, errorHandler/
  modules/      one folder per feature
    auth/         routes, controller, schemas, user.model.ts
    tutor/        tutor/admin-only routes (overview, students, accounts)
    items/        routes, controller, schemas, model
    subjects/     routes, controller, model (cached reference data)
    health/       health.routes.js
  routes/       index.js - mounts each module under /api
  utils/        AppError/ (errors safe to show the user)
  app.js        Express setup      server.js  starts the server
```
To add a feature (e.g. "subjects"): create `modules/subjects/` with its
routes/controller/model/schemas, then add one line in `routes/index.js`
(below `router.use(authenticate)` so it is protected automatically).
