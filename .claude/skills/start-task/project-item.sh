#!/usr/bin/env bash
# Put an issue or PR on the org board "DSC Learning Hub" (Project #1) and set its fields.
#
#   project-item.sh <issue-or-pr-url> [Field=Option ...]
#   project-item.sh https://github.com/hcmute-dsc/learning-hub/issues/8 \
#     "Status=In progress" "Priority=P1 - Cao" Area=Backend Size=S "Epic=Vận hành"
#
# Option names must match the board exactly (see docs/ops/WORKFLOW.md §1 in learning-hub-docs).
# Needs gh with the `project` scope (gh auth refresh -h github.com -s project).
set -euo pipefail
OWNER=hcmute-dsc
NUMBER=1
url=$1; shift

project_id=$(gh project view "$NUMBER" --owner "$OWNER" --format json -q .id)

# The auto-add workflows may already have added the item; then item-add fails and we look it up.
item=$(gh project item-add "$NUMBER" --owner "$OWNER" --url "$url" --format json -q .id 2>/dev/null || true)
if [ -z "$item" ]; then
  item=$(gh api graphql -f u="$url" -f query='
    query($u: URI!) { resource(url: $u) {
      ... on Issue       { projectItems(first: 20) { nodes { id project { id } } } }
      ... on PullRequest { projectItems(first: 20) { nodes { id project { id } } } } } }' \
    -q ".data.resource.projectItems.nodes[] | select(.project.id == \"$project_id\") | .id")
fi
[ -n "$item" ] || { echo "could not add $url to the project" >&2; exit 1; }

# gh's built-in --jq is used so the script needs no separate jq install.
list_fields() { gh project field-list "$NUMBER" --owner "$OWNER" --format json -q "$1"; }
for pair in "$@"; do
  name=${pair%%=*}; value=${pair#*=}
  field_id=$(list_fields ".fields[] | select(.name == \"$name\") | .id")
  option_id=$(list_fields ".fields[] | select(.name == \"$name\") | .options[]? | select(.name == \"$value\") | .id")
  if [ -z "$field_id" ] || [ -z "$option_id" ]; then
    echo "unknown field or option: $pair" >&2; exit 1
  fi
  gh project item-edit --project-id "$project_id" --id "$item" \
    --field-id "$field_id" --single-select-option-id "$option_id" >/dev/null
  echo "$name = $value"
done
