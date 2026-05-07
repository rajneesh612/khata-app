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

## Notes
- If you leave rate empty, amount uses quantity only.
- Use "Debit" for udhaar and "Credit" for payments.
