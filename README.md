# HungryBear

A recipe social app: publish recipes and food stories, add friends, create groups and chat.

- **App:** React Native with Expo (`App.js`, `screens/`, `components/`)
- **Backend:** a small Node server in `server/` — auth, SQLite database, image uploads and live chat
- **Client for the backend:** `services/Backend.js`

## Requirements

- **Node.js 22.13 or newer** (the backend uses Node's built-in SQLite). Check with `node -v`.
- One of:
  - **Android emulator** (Android Studio) or an Android phone connected by USB, or
  - a phone with the **Expo Go** app on the same Wi-Fi as your computer.

## Quick start

```bash
git clone git@github.com:Suprymas/RecipeSocialMedia.git
cd RecipeSocialMedia
npm install
```

`npm install` also installs the backend's dependencies. No configuration or `.env` file is needed.

Then start everything with one command, depending on where you run the app:

| Where | Command | Then |
|---|---|---|
| Android emulator or USB device | `npm run emulator` | press `a` in the terminal |
| Phone with Expo Go (same Wi-Fi) | `npm run dev` | scan the QR code |

Both commands start the backend on port 4000 and Expo together. Start the emulator
before running `npm run emulator`.

## Log in

Two demo accounts exist on first start:

| Email | Password |
|---|---|
| `anna@demo.app` | `password` |
| `ben@demo.app` | `password` |

You can also sign up in the app with any email and a password of at least 6 characters.
No email confirmation is needed.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Backend + Expo |
| `npm run emulator` | Forwards ports to the Android emulator, then backend + Expo |
| `npm run server` | Backend only, with its log output |
| `npm start` | Expo only |

## Data

Everything the backend stores is in `server/data/` (not committed to git):

- `app.db` — the SQLite database. Open it with any SQLite viewer or `sqlite3 server/data/app.db`.
- `uploads/` — uploaded images.

To reset to a clean state with only the demo accounts, stop the backend and delete `server/data/`.

## Troubleshooting

**"Could not reach the server at http://127.0.0.1:4000"** on an emulator —
the port forward was lost (this happens every time the emulator restarts). Run:

```bash
node scripts/adb-reverse.js
```

**"Could not reach the server"** on a phone — the phone and computer must be on the
same Wi-Fi and port 4000 must not be blocked by a firewall. If the app guesses the
wrong address, copy `.env.example` to `.env`, set `EXPO_PUBLIC_API_URL` to your
computer's address and restart Expo.

**"Could not find adb"** — install Android platform-tools and add it to `PATH`, or set `ANDROID_HOME`.

**`npm install` fails with an "engine" error** — your Node.js is older than 22.13.

**Port 4000 is already in use** — another backend is running; `npm run dev` reuses it.
To use a different port, set `PORT` (and `EXPO_PUBLIC_API_URL` to match).

**Using WSL2 with a phone** — the phone usually cannot reach ports inside WSL.
Use the Android emulator instead, or forward port 4000 from Windows.

## Backend settings

Optional environment variables for the server:

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `4000` | Port the backend listens on |
| `DATA_DIR` | `server/data` | Where the database and uploads are stored |
