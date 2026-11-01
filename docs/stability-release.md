# Stability release boundary

The synchronization and swipe lifetime fixes are merged independently of a release.
Automatic Vercel Git deployments are disabled for `main` and
`feature/app-stability-after-transition`, and `feature/add-word-screen-recovery`
in `apps/web/vercel.json`, so publishing
the review branch and merging it do not publish a new website version. Other
branches retain their existing deployment behavior.

GitHub Actions quality, database, web fixture, and test-flow checks remain enabled.
No mobile update, application build distribution, database migration, or server
function release is part of this change.

A later release requires a separate decision. Before restoring automatic
deployments, review the complete release revision and validation results; removing
the `main` restriction can itself trigger a production deployment. The restriction
does not prevent an explicitly requested manual deployment.

See the [Vercel Git configuration reference](https://vercel.com/docs/project-configuration/git-configuration#git.deploymentenabled)
for the branch controls and [runtime diagnostics](runtime-diagnostics.md) for the
bounded crash context added by these fixes.
