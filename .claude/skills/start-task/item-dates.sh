#!/usr/bin/env bash
# Start date / Target date for an issue on the board (learning-hub#89). Sourced by project-item.sh;
# tested by item-dates.test.sh. Pure: no gh calls, so the rules are easy to read and test.
#
#   item_dates <status> <today> <current start> <sprint start> <sprint days> <given start> <given target>
#
# Prints "<start> <target>"; "-" means "leave the field as it is". Rules:
#   - Start=/Target= given on the command line always win.
#   - In progress: Start = today, unless the issue already has a Start (moving back and forth
#     must not lose the real start day).
#   - Done: Target = today (the real finish day); Start = today if it was never set.
#   - Any other status with Sprint=: Target = last day of the sprint (the planned deadline).
#     The sprint never overwrites Start: the start is when work really began.
item_dates() {
  local status=$1 today=$2 current_start=$3 sprint_start=$4 sprint_days=$5 given_start=$6 given_target=$7
  local start=- target=-

  case "$status" in
  "In progress") [ -n "$current_start" ] || start=$today ;;
  Done)
    [ -n "$current_start" ] || start=$today
    target=$today
    ;;
  esac
  if [ "$status" != Done ] && [ -n "$sprint_start" ]; then
    target=$(date -d "$sprint_start + $((sprint_days - 1)) days" +%F)
  fi

  [ -z "$given_start" ] || start=$given_start
  [ -z "$given_target" ] || target=$given_target
  echo "$start $target"
}
