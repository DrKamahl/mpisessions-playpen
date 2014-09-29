#!/bin/dash

set -o errexit

rustc - --opt-level=$1 -o out
printf '\377' # 255 in octal
exec ./out
