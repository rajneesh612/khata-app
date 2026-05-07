# Khata App

Web khata manager for a kirana store owner. Track customers, add udhaar/payment entries with item and quantity, and view balances plus aging buckets.

## Tech Stack
- Node.js + Express + TypeScript (API)
- React + Vite (client)
- SQLite (better-sqlite3)

## Scripts
- `npm run dev` - Start API + client dev servers
- `npm run dev:server` - Start API only (port 5174)
- `npm run dev:client` - Start client only (port 5173)
- `npm run build` - Compile server TypeScript to dist
- `npm run build:client` - Build React client
- `npm run build:all` - Build server + client
- `npm run start` - Run compiled server
- `npm run lint` - Run ESLint on TypeScript files

## How To Run
1. `npm install`
2. `npm run dev`

Open http://localhost:5173 in the browser.

The SQLite database is stored in `data/khata.db`.

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
- This project still uses local SQLite at `data/khata.db`.
- On Render free plan, filesystem storage is not reliable for production persistence.
- The app can deploy, but data may reset on redeploy/restart.
- For stable production data, move to a hosted database.

### Deploy Steps
1. Push this repo to GitHub.
2. In Render, create a new Blueprint and select this repository.
3. Render will read `render.yaml` and create both services.
4. After deploy, verify these URLs if Render changes names:
	 - frontend URL should match `CLIENT_URL`
	 - backend URL should match `VITE_API_BASE_URL`
5. If Render assigns different domains, update those env vars in Render dashboard and redeploy.

## Notes
- If you leave rate empty, amount uses quantity only.
- Use "Debit" for udhaar and "Credit" for payments.
