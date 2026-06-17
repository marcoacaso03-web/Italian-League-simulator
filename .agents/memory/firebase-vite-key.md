---
name: Firebase API key in Vite (Replit)
description: Come esporre in modo affidabile la Firebase API key al frontend Vite in un progetto Replit monorepo
---

## Regola
Non usare `define` in `vite.config.ts` per esporre `process.env.GOOGLE_API_KEY` al browser — il secret Replit non è disponibile nell'environment di Vite al momento del build/avvio dev server.

**Why:** `process.env.GOOGLE_API_KEY` risulta `undefined` nel processo Vite, producendo `auth/invalid-api-key` e una pagina bianca.

**How to apply:**
1. Aggiungere `GET /api/config` nell'API server Express (che ha accesso affidabile ai secrets):
   ```ts
   router.get("/config", (_req, res) => {
     res.json({ firebase: { apiKey: process.env.GOOGLE_API_KEY, ... } });
   });
   ```
2. In `firebase.ts`, esportare `initFirebase(): Promise<Auth|null>` che fa fetch di `/api/config` prima di chiamare `initializeApp`.
3. In `AuthContext.tsx`, chiamare `initFirebase()` dentro `useEffect` (non al top-level del modulo).
4. Rimuovere qualsiasi `define` da `vite.config.ts`.
