#!/bin/bash

verify_eas_identity() {
  local expected_account="oldrefery"
  local expected_project="@oldrefery/dutch-learning-app"
  local account_output
  local active_account
  local project_output
  local linked_project
  local eas_cli=(npx -y eas-cli@latest)
  local mobile_dir

  mobile_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/../apps/mobile" && pwd)

  if ! account_output=$(cd "$mobile_dir" && NO_COLOR=1 "${eas_cli[@]}" account:view); then
    echo "Error: unable to verify the active Expo/EAS account" >&2
    return 1
  fi

  active_account=$(printf '%s\n' "$account_output" | head -n 1)
  if [ "$active_account" != "$expected_account" ] &&
    [ "$active_account" != "$expected_account (authenticated using EXPO_TOKEN)" ]; then
    echo "Error: Expo/EAS account must be ${expected_account}" >&2
    return 1
  fi

  if ! project_output=$(cd "$mobile_dir" && NO_COLOR=1 "${eas_cli[@]}" project:info); then
    echo "Error: unable to verify the linked Expo/EAS project" >&2
    return 1
  fi

  linked_project=$(
    printf '%s\n' "$project_output" |
      awk '$1 == "fullName" { print $2; exit }'
  )

  if [ "$linked_project" != "$expected_project" ]; then
    echo "Error: linked Expo/EAS project must be ${expected_project}" >&2
    return 1
  fi

  echo "Verified Expo/EAS identity: ${expected_account} (${expected_project})"
}
