# Git hook runtime

The pre-commit hook sources `.husky/node-env.sh` before linting, formatting,
or tests. The script uses the exact Node version in `.nvmrc`:

- Keep the current runtime when it already matches.
- Otherwise load nvm from `NVM_DIR` (or `~/.nvm`) without selecting its default
  and use the installed project version.
- Verify the selected version and stop immediately on a mismatch or missing Node.

This is repository-local and works for non-interactive Git processes, including
WebStorm commits. It does not depend on an interactive shell startup file or
change another project's runtime. No global Husky initialization is required.
The hook never installs Node, changes the nvm default, or downloads dependencies
as part of runtime selection.

If the runtime is missing, run `nvm install && nvm use` from the repository root,
then retry the commit. A custom nvm installation must expose `NVM_DIR` to the
Git process. Other runtime managers must expose the exact `.nvmrc` version via
`PATH`; an already matching Node works without nvm.

The application `engines` constraint and npm's `engine-strict` setting do not
replace this early hook check. Separate shell/tool invocations do not inherit
an earlier invocation's temporary `PATH` override.
