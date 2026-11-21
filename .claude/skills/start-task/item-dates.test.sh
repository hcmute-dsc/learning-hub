#!/usr/bin/env bash
# Tests for item-dates.sh (learning-hub#89). Run: bash .claude/skills/start-task/item-dates.test.sh
set -uo pipefail

# shellcheck source=item-dates.sh
. "$(dirname "$0")/item-dates.sh"
fails=0
expect() { # expect <description> <want> <item_dates args…>
  local what=$1 want=$2 got
  shift 2
  got=$(item_dates "$@")
  if [ "$got" = "$want" ]; then
    echo "ok   $what"
  else
    echo "FAIL $what: want '$want', got '$got'"
    fails=$((fails + 1))
  fi
}

T=2026-11-21
# args: status today current_start sprint_start sprint_days given_start given_target
expect "In progress sets Start to today, Target to the sprint end" \
  "$T 2026-11-29" "In progress" $T "" 2026-11-16 14 "" ""
expect "In progress keeps an existing Start" \
  "- 2026-11-29" "In progress" $T 2026-11-18 2026-11-16 14 "" ""
expect "the sprint never sets Start" \
  "- 2026-11-29" "Backlog" $T "" 2026-11-16 14 "" ""
expect "Done sets Target to today, even with a sprint" \
  "- $T" "Done" $T 2026-11-18 2026-11-16 14 "" ""
expect "Done fills a missing Start with today" \
  "$T $T" "Done" $T "" "" "" "" ""
expect "In review changes nothing without a sprint" \
  "- -" "In review" $T 2026-11-18 "" "" "" ""
expect "no status, no sprint: nothing" \
  "- -" "" $T "" "" "" "" ""
expect "Start= and Target= given by hand win" \
  "2026-11-10 2026-11-12" "Done" $T "" 2026-11-16 14 2026-11-10 2026-11-12

[ "$fails" -eq 0 ] && echo "all passed" || exit 1
