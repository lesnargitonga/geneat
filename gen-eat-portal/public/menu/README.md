# Menu Photography

Menu image guidance lives in the root single source of truth:

- [Frontends](../../../README.md#14-frontends)

Short version:

```text
gen-eat-portal/public/menu/<cafe-slug>/<item>.jpg
```

Reference local images from `gen-eat-portal/lib/cafes.ts` as:

```ts
image: "/menu/<cafe-slug>/<item>.jpg"
```

Important current truth:

- local files in this folder are only one layer of image truth,
- the live portal also pulls menu photo overrides from the backend catalog
  endpoint,
- tenant-owned `Business.profile["menu_photos"]` values override the static
  local/demo imagery when present.

Keep detailed guidance in `../../../README.md` so this folder does not drift.
