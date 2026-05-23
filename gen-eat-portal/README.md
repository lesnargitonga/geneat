# Gen-Eat Portal

This package is documented in the root single source of truth:

- [Frontends](../README.md#14-frontends)
- [Gen-Eat USIU Pilot](../README.md#15-gen-eat-usiu-pilot)
- [Local Development](../README.md#18-local-development)
- [Testing](../README.md#22-testing)

Package-local quick commands:

```bash
npm install
npm run dev
npm run build
npm run start
```

The chat widget posts to `/api/chat`, and the Next route handler forwards to
`BACKEND_URL/mock/message`. Keep detailed portal data, deployment, and menu
photography notes in `../README.md`, not here.

Important current truth:

- café pages now also fetch backend photo overrides from
  `/catalog/businesses/{slug}/menu-photos`,
- so the portal can show tenant-managed menu imagery without hardcoding every
  image into `lib/cafes.ts`.
