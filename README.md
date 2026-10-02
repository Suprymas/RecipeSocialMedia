# HackathonApp

Expo app with a small self-hosted backend in `server/` (Node + `ws`, data in SQLite via Node's built-in `node:sqlite`, so Node 22.13+ is required).

## Run

```bash
npm install && npm install --prefix server
npm run server   # backend on http://localhost:4000
npm start        # Expo
```

The app finds the backend on port 4000 of the machine running Expo, so a phone on
the same Wi-Fi works without config. To point it elsewhere, set
`EXPO_PUBLIC_API_URL=http://<host>:4000` in `.env`.

With `expo start --localhost` on an Android emulator/USB device, forward the
backend port as well as Metro's (redo this whenever the emulator restarts):

```bash
adb reverse tcp:4000 tcp:4000
```

Server data lives in `server/data/`: the SQLite database is `app.db` (open it with
any SQLite browser or `sqlite3 server/data/app.db`) and uploaded images are in
`uploads/`. Delete that folder to reset. Demo accounts: `anna@demo.app` / `ben@demo.app`, password `password`.

Server env vars: `PORT` (default 4000), `DATA_DIR` (default `server/data`).
