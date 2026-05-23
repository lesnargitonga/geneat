# Admin UI

This package is documented in the root single source of truth:

- [Admin Console](../README.md#13-admin-console)
- [Frontends](../README.md#14-frontends)
- [Local Development](../README.md#18-local-development)
- [Testing](../README.md#22-testing)

Package-local quick commands:

```bash
npm install
npm run dev
npm run build
npm run preview
```

Keep detailed architecture, route, auth, and deployment notes in
`../README.md`, not here.

Important current truth:

- the admin SPA is fully buildable locally,
- a public admin deployment is optional and not assumed by the live doctor
  unless `GENEAT_ADMIN_URL` is configured.
