# Releasing

The package is published from GitHub Actions with npm Trusted Publishing.
No npm access token is stored in GitHub.

## One-time npm configuration

Open the package settings for `@maxkabechani/mtn-momo-sdk` on npm and add a
GitHub Actions trusted publisher:

- Organization or user: `maxkabechani`
- Repository: `mtn-momo-sdk`
- Workflow filename: `publish.yml`
- Environment: leave blank
- Allowed action: `npm publish`

After the first successful trusted publish, set Publishing access to
**Require two-factor authentication and disallow tokens**.

## Publishing a release

1. Update `package.json` and `bun.lock` to the intended version.
2. Commit and push the release to `main`.
3. Wait for the CI workflow to pass.
4. Create and push an annotated tag matching the package version:

   ```bash
   git tag -a v1.0.0 -m "v1.0.0"
   git push origin v1.0.0
   ```

The publish workflow rejects tags that do not match `package.json` or do not
point to a commit contained in `main`. It runs validation and packed-package
smoke tests before publishing.
