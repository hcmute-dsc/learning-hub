#!/usr/bin/env bash
# Put an issue or PR on the org board "HCMUTE DSC Learning Hub" (Project #1) and fill in everything
# the sidebar shows, so no issue is left half-described (learning-hub#10).
#
#   project-item.sh <issue-or-pr-url> [Key=Value ...]
#
#   project-item.sh https://github.com/hcmute-dsc/learning-hub/issues/8 \
#     Type=Bug "Status=In progress" "Priority=P1 - Cao" Area=Backend Size=S "Epic=Vận hành" \
#     Sprint=@current "Milestone=Phase 0 — Dùng thử" Assignee=@me Label=bug
#
# Keys:
#   Status, Priority, Area, Epic, Size   project fields (option names exactly as on the board)
#   Sprint=@current | "Sprint 2"         project iteration
#   Type=Bug|Feature|Task                issue type (issues only)
#   Milestone=<title>  Assignee=<login|@me>  Label=<name>
#   Start=YYYY-MM-DD  Target=YYYY-MM-DD  org issue fields (issues only)
# Derived automatically for issues (org fields shown in the issue sidebar):
#   Priority P0/P1/P2 -> org Priority Urgent/High/Medium
#   Size S/M/L        -> org Effort Low/Medium/High
#   Start/Target dates (item-dates.sh, learning-hub#89):
#     In progress -> Start = today (kept if already set); Done -> Target = today (real finish)
#     Sprint (until Done) -> Target = last day of the sprint; Start=/Target= given by hand win
#
# Needs gh with the `project` scope (gh auth refresh -h github.com -s project). No jq needed.
set -euo pipefail
# shellcheck source=item-dates.sh
. "$(dirname "$0")/item-dates.sh"
OWNER=hcmute-dsc
NUMBER=1
url=$1
shift
case "$url" in */pull/*) kind=pr ;; */issues/*) kind=issue ;; *)
  echo "not an issue or PR url: $url" >&2
  exit 1
  ;;
esac

# Read each lookup table once (tab-separated: field, field id, option, option id) and search it
# locally. Small hand-written queries on purpose: `gh project view` and `gh project field-list`
# also load items, and a few runs of those hit GitHub's per-minute GraphQL limit.
TAB=$'\t'
project_table=$(gh api graphql -f query='{ organization(login: "'"$OWNER"'") { projectV2(number: '"$NUMBER"') { id
    fields(first: 50) { nodes { ... on ProjectV2FieldCommon { id name }
      ... on ProjectV2SingleSelectField { options { id name } } } } } } }' \
  -q '.data.organization.projectV2 | ["@project", .id, "", ""], (.fields.nodes[] | . as $f
      | (.options // [{name: "", id: ""}])[] | [$f.name, $f.id, .name, .id]) | @tsv')
org_table=$(gh api graphql -f query='{ organization(login: "'"$OWNER"'") { issueFields(first: 50) { nodes {
    ... on IssueFieldSingleSelect { id name options { id name } }
    ... on IssueFieldDate { id name } } } } }' \
  -q '.data.organization.issueFields.nodes[] | . as $f | (.options // [{name: "", id: ""}])[] | [$f.name, $f.id, .name, .id] | @tsv')
lookup() { # <table> <field> [option] -> "field_id<TAB>option_id"
  awk -F'\t' -v f="$2" -v o="${3-}" '$1 == f && (o == "" || $3 == o) { print $2 "\t" $4; exit }' <<<"$1"
}

project_id=$(awk -F'\t' '$1 == "@project" { print $2 }' <<<"$project_table")

# The auto-add workflows may already have added the item; then item-add fails and we look it up.
item=$(gh project item-add "$NUMBER" --owner "$OWNER" --url "$url" --format json -q .id 2>/dev/null || true)
if [ -z "$item" ]; then
  item=$(gh api graphql -f u="$url" -f query='
    query($u: URI!) { resource(url: $u) {
      ... on Issue       { projectItems(first: 20) { nodes { id project { id } } } }
      ... on PullRequest { projectItems(first: 20) { nodes { id project { id } } } } } }' \
    -q ".data.resource.projectItems.nodes[] | select(.project.id == \"$project_id\") | .id")
fi
[ -n "$item" ] || {
  echo "could not add $url to the project" >&2
  exit 1
}

die() {
  echo "$1" >&2
  exit 1
}

set_project_option() { # <field> <option>
  local field_id option_id
  IFS=$TAB read -r field_id option_id <<<"$(lookup "$project_table" "$1" "$2")"
  [ -n "$field_id" ] && [ -n "$option_id" ] || die "unknown project field or option: $1=$2"
  gh project item-edit --project-id "$project_id" --id "$item" \
    --field-id "$field_id" --single-select-option-id "$option_id" >/dev/null
  echo "$1 = $2"
}

sprint_start=""
sprint_days=""
set_sprint() { # <@current | title>
  local field_id iteration
  field_id=$(lookup "$project_table" Sprint | cut -f1)
  if [ "$1" = "@current" ]; then
    local today
    today=$(date +%F)
    # the iteration whose [start, start + duration) contains today
    iteration=$(gh api graphql -f p="$project_id" -f query='query($p: ID!) { node(id: $p) {
      ... on ProjectV2 { field(name: "Sprint") { ... on ProjectV2IterationField {
        configuration { iterations { id title startDate duration } } } } } } }' \
      -q '.data.node.field.configuration.iterations[] | "\(.id) \(.startDate) \(.duration) \(.title)"' |
      while read -r id start days title; do
        end=$(date -d "$start + $days days" +%F)
        if [[ ! "$today" < "$start" && "$today" < "$end" ]]; then echo "$id $start $days $title"; fi
      done)
  else
    iteration=$(gh api graphql -f p="$project_id" -f query='query($p: ID!) { node(id: $p) {
      ... on ProjectV2 { field(name: "Sprint") { ... on ProjectV2IterationField {
        configuration { iterations { id title startDate duration } } } } } } }' \
      -q ".data.node.field.configuration.iterations[] | select(.title == \"$1\") | \"\(.id) \(.startDate) \(.duration) \(.title)\"")
  fi
  [ -n "$iteration" ] || die "no sprint matches '$1' (add one: Project → Settings → Sprint → Add iteration)"
  read -r iteration_id sprint_start sprint_days sprint_title <<<"$iteration"
  gh project item-edit --project-id "$project_id" --id "$item" \
    --field-id "$field_id" --iteration-id "$iteration_id" >/dev/null
  echo "Sprint = $sprint_title"
}

org_values=()
add_org_option() { # <org field> <option>
  local field_id option_id
  IFS=$TAB read -r field_id option_id <<<"$(lookup "$org_table" "$1" "$2")"
  [ -n "$field_id" ] && [ -n "$option_id" ] || die "unknown org field or option: $1=$2"
  org_values+=("{\"fieldId\":\"$field_id\",\"singleSelectOptionId\":\"$option_id\"}")
  echo "$1 (issue field) = $2"
}
add_org_date() { # <org field> <YYYY-MM-DD>
  local field_id
  field_id=$(lookup "$org_table" "$1" | cut -f1)
  [ -n "$field_id" ] || die "unknown org field: $1"
  org_values+=("{\"fieldId\":\"$field_id\",\"dateValue\":\"$2\"}")
  echo "$1 = $2"
}

start=""
target=""
status=""
for pair in "$@"; do
  key=${pair%%=*}
  value=${pair#*=}
  case "$key" in
  Status | Area | Epic)
    set_project_option "$key" "$value"
    [ "$key" != Status ] || status=$value
    ;;
  Priority)
    set_project_option Priority "$value"
    if [ "$kind" = issue ]; then
      case "$value" in P0*) add_org_option Priority Urgent ;; P1*) add_org_option Priority High ;; P2*) add_org_option Priority Medium ;; esac
    fi
    ;;
  Size)
    set_project_option Size "$value"
    if [ "$kind" = issue ]; then
      case "$value" in S) add_org_option Effort Low ;; M) add_org_option Effort Medium ;; L) add_org_option Effort High ;; esac
    fi
    ;;
  Sprint) set_sprint "$value" ;;
  Type)
    [ "$kind" = issue ] || die "Type applies to issues only"
    type_id=$(gh api graphql -f query='{ organization(login: "'"$OWNER"'") { issueTypes(first: 20) { nodes { id name } } } }' \
      -q ".data.organization.issueTypes.nodes[] | select(.name == \"$value\") | .id")
    [ -n "$type_id" ] || die "unknown issue type: $value"
    gh api graphql -f i="$(gh issue view "$url" --json id -q .id)" -f t="$type_id" \
      -f query='mutation($i: ID!, $t: ID!) { updateIssueIssueType(input: {issueId: $i, issueTypeId: $t}) { issue { number } } }' >/dev/null
    echo "Type = $value"
    ;;
  Milestone)
    gh "$kind" edit "$url" --milestone "$value" >/dev/null
    echo "Milestone = $value"
    ;;
  Assignee)
    gh "$kind" edit "$url" --add-assignee "$value" >/dev/null
    echo "Assignee + $value"
    ;;
  Label)
    gh "$kind" edit "$url" --add-label "$value" >/dev/null
    echo "Label + $value"
    ;;
  Start) start=$value ;;
  Target) target=$value ;;
  *) die "unknown key: $key (see the header of this script)" ;;
  esac
done

if [ "$kind" = issue ]; then
  current_start=$(gh api graphql -f u="$url" -f query='query($u: URI!) { resource(url: $u) {
    ... on Issue { issueFieldValues(first: 20) { nodes { ... on IssueFieldDateValue {
      value field { ... on IssueFieldDate { name } } } } } } } }' \
    -q '.data.resource.issueFieldValues.nodes[] | select(.field.name == "Start date") | .value')
  read -r start target <<<"$(item_dates "$status" "$(date +%F)" "$current_start" \
    "$sprint_start" "${sprint_days:-0}" "$start" "$target")"
  [ "$start" = - ] || add_org_date "Start date" "$start"
  [ "$target" = - ] || add_org_date "Target date" "$target"
  if [ ${#org_values[@]} -gt 0 ]; then
    issue_id=$(gh issue view "$url" --json id -q .id)
    values=$(
      IFS=,
      echo "${org_values[*]}"
    )
    gh api graphql --input - >/dev/null <<JSON
{"query": "mutation(\$in: SetIssueFieldValueInput!) { setIssueFieldValue(input: \$in) { clientMutationId } }",
 "variables": {"in": {"issueId": "$issue_id", "issueFields": [$values]}}}
JSON
  fi
fi
