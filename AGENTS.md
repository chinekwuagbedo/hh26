Tideline is a standalone React website built with Vite and a Node/Express API. Do not add Expo or React Native dependencies or native app configuration.

## Commands

```powershell
npm run dev
npm run lint
npm run typecheck
npm run build
```

`npm run dev` starts the Vite website and the local API proxy together. The FoodData Central API key is server-only and belongs in `.env`; never expose it through client code or commit it.

Keep browser features responsive and accessible. User profile and food logs are stored in browser local storage unless a feature explicitly uses a server-side store.
