# Khata App

Web khata manager for a kirana store owner. Track customers, add udhaar/payment entries with item and quantity, and view balances plus aging buckets.

## Tech Stack
- Node.js + Express + TypeScript (API)
- React + Vite (client)
- SQLite for local fallback and migration
- Postgres via `DATABASE_URL` for persistent cloud storage

## Scripts
- `npm run dev` - Start API + client dev servers
- `npm run dev:server` - Start API only (port 5174)
- `npm run dev:client` - Start client only (port 5173)
- `npm run build` - Compile server TypeScript to dist
- `npm run build:client` - Build React client
- `npm run build:all` - Build server + client
- `npm run migrate:sqlite-to-postgres` - Copy local SQLite data into Postgres
- `npm run start` - Run compiled server
- `npm run lint` - Run ESLint on TypeScript files

## How To Run
1. `npm install`
2. `npm run dev`

Open http://localhost:5173 in the browser.

The SQLite database is stored in `data/khata.db`.

If `DATABASE_URL` is set, the backend uses Postgres instead of SQLite.

## Render Deployment
- `render.yaml` defines two Render services:
	- `khata-app-api` as a free Node web service
	- `khata-app-web` as a static site for the React frontend
- Backend build command: `npm install && npm run build`
- Backend start command: `npm start`
- Frontend root directory: `client`
- Frontend build command: `npm install && npm run build`
- Frontend publish directory: `dist`

### Important Free Plan Note
- Do not rely on local SQLite for Render free-plan persistence.
- Set `DATABASE_URL` on the backend service to use hosted Postgres.
- SQLite remains useful locally and for one-time migration into Postgres.
- You can still set `DATA_DIR` to point at a persistent disk mount if you move to a paid Render web service with a disk attached.

### Deploy Steps
1. Push this repo to GitHub.
2. In Render, create a new Blueprint and select this repository.
3. Render will read `render.yaml` and create both services.
4. After deploy, verify these URLs if Render changes names:
	 - frontend URL should match `CLIENT_URL`
	 - backend URL should match `VITE_API_BASE_URL`
5. Set backend `DATABASE_URL` in Render from your hosted Postgres provider.
6. If Render assigns different domains, update those env vars in Render dashboard and redeploy.

## Postgres Setup
1. Create a hosted Postgres database in Neon, Supabase, or Render Postgres.
2. Copy the connection string.
3. Set `DATABASE_URL` on the backend service.
4. Redeploy the backend.

## Migrate Existing Local Data
1. Make sure your local SQLite data exists at `data/khata.db`.
2. Set `DATABASE_URL` in your local shell.
3. Run `npm run migrate:sqlite-to-postgres`.
4. Redeploy the backend so production starts using the same Postgres database.

## Notes
- If you leave rate empty, amount uses quantity only.
- Use "Debit" for udhaar and "Credit" for payments.
