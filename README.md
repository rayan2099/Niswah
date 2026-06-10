# Niswah

Niswah is a Vite/React web app for cycle tracking with Islamic fiqh guidance, health insights, reports, and AI assistants.

## Local Setup

```bash
npm install
npm run dev
```

## Production

Build the static app:

```bash
npm run build
```

Run the Cloud Run compatible server:

```bash
npm start
```

The production server serves `dist/`, exposes `/healthz`, and proxies AI requests through `/api/gemini`.

## Environment Variables

Server-only:

- `GEMINI_API_KEY`: Gemini API key used by `server.cjs`.
- `GEMINI_MODEL`: optional model override. Defaults to `gemini-2.5-flash`.
- `PORT`: provided by Cloud Run; falls back to `3000`.

Client-safe:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Never expose Gemini credentials with a `VITE_` prefix.

## Verification

```bash
npm run lint
npm test
npm run build
npm audit
```

## Cloud Run

The included `Dockerfile` builds the Vite app, installs production dependencies, copies `dist/` and `server.cjs`, and starts the app with `npm start`. Configure `GEMINI_API_KEY` as a Cloud Run secret or environment variable.
