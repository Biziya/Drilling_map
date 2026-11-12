# Versioning

The website has one version number, shown in grey under the backend status in
the sidebar. It lives in the [`VERSION`](VERSION) file at the root of the
repository and nowhere else. The frontend reads it at build time
(`frontend/src/config/version.ts`). `frontend/package.json` has its own npm
version, which is not the website version.

## Format: `MAJOR.MINOR.PATCH.BUILD`

Four whole numbers, for example `1.1.1.1`.

| Part | Bump it when you ship... | Example |
|---|---|---|
| **MAJOR** | a big redesign, or a change that breaks how people use the site or how it gets data | a new data source, a page removed |
| **MINOR** | a new feature or page | the selection table, table export |
| **PATCH** | a bug fix, or a small change users notice | a wrong label, a slow table made fast |
| **BUILD** | anything else that is deployed | tests, docs, refactors, dependency updates |

Bumping a part sets every part to its right back to 0:

```
1.1.1.1  --patch-->  1.1.2.0
1.1.2.0  --minor-->  1.2.0.0
1.2.0.0  --major-->  2.0.0.0
2.0.0.0  --build-->  2.0.0.1
```

Pick the biggest part that applies. A change with a new feature and a few fixes
is a MINOR bump.

## How to release a change

Once per merge to `main` that changes the website:

1. Bump the version from `frontend/`:

   ```bash
   npm run version:bump -- patch
   ```

   Use `major`, `minor`, `patch` or `build`. The script updates `VERSION` and
   adds a dated section at the top of `CHANGELOG.md`.

2. Fill in that section of [`CHANGELOG.md`](CHANGELOG.md): short bullets
   for the people using the site, saying what changed for them.

3. Commit `VERSION` and `CHANGELOG.md` with the change.

The sidebar picks the new number up on the next build; restart `npm run dev`
to see it locally.

If two branches bump at the same time, whoever merges second re-runs the bump
on top of `main`, so every version number is used once.

## Checks

`npm test` fails when:

- `VERSION` is not four whole numbers, or
- the newest section of `CHANGELOG.md` is not for the version in `VERSION`.

So a version bump without a changelog entry, or a changelog entry without a
bump, cannot reach `main` unnoticed (`frontend/tests/config/version.test.js`).
