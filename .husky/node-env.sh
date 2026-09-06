# Sourced by hooks: keep the selected runtime in the hook's own process.
# Do not install runtimes or change the user's default nvm version.
woordenaar_required_node=$(cat .nvmrc 2>/dev/null) || {
  echo 'Git hook: cannot read .nvmrc from the repository root.' >&2
  return 1
}

woordenaar_current_node=$(node --version 2>/dev/null || true)
if [ "$woordenaar_current_node" != "v$woordenaar_required_node" ]; then
  woordenaar_nvm_dir=${NVM_DIR:-${HOME}/.nvm}
  if [ -s "$woordenaar_nvm_dir/nvm.sh" ]; then
    export NVM_DIR="$woordenaar_nvm_dir"
    # Loading without auto-use avoids selecting an unrelated default runtime.
    . "$NVM_DIR/nvm.sh" --no-use
    nvm use --silent "$woordenaar_required_node" >/dev/null 2>&1 || true
  fi
fi

# Check again even if nvm failed or another runtime manager is in use.
woordenaar_current_node=$(node --version 2>/dev/null || true)
if [ "$woordenaar_current_node" != "v$woordenaar_required_node" ]; then
  echo "Git hook: Node $woordenaar_required_node is required by .nvmrc; found ${woordenaar_current_node:-no Node executable}." >&2
  echo 'Run nvm install && nvm use in the repository, then retry the commit.' >&2
  echo 'For other runtime managers, expose the .nvmrc version in the Git process PATH.' >&2
  return 1
fi
