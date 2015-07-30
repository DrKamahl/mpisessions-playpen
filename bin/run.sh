#!/bin/dash

set -o errexit
out=$(mktemp)
trap "rm -f $out" EXIT
# Only lets programs run for 30 seconds
timeout 1200 java -jar "$1" > $out
printf '\377' # 255 in octal
cat $out

