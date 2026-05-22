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

Keep detailed guidance in `../../../README.md` so this folder does not drift.
