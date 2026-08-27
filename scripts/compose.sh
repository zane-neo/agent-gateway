#!/bin/sh
set -eu

requested_runtime="${RUNTIME:-auto}"

detect_runtime() {
  case "$requested_runtime" in
    docker)
      command -v docker >/dev/null 2>&1 || {
        echo "Docker CLI is not installed." >&2
        exit 1
      }
      echo docker
      ;;
    finch)
      command -v finch >/dev/null 2>&1 || {
        echo "Finch is not installed. Run: brew install --cask finch" >&2
        exit 1
      }
      echo finch
      ;;
    auto)
      if command -v docker >/dev/null 2>&1 &&
        docker compose version >/dev/null 2>&1 &&
        docker info >/dev/null 2>&1; then
        echo docker
      elif command -v finch >/dev/null 2>&1; then
        echo finch
      else
        echo "No usable container runtime found. Install Docker Desktop or Finch." >&2
        exit 1
      fi
      ;;
    *)
      echo "Unsupported RUNTIME '$requested_runtime'. Use docker, finch, or auto." >&2
      exit 1
      ;;
  esac
}

runtime="$(detect_runtime)"
action="${1:-help}"

case "$action" in
  runtime)
    echo "$runtime"
    ;;
  init)
    if [ "$runtime" = "finch" ]; then
      finch vm init
    else
      echo "Docker selected; no VM initialization is required."
    fi
    ;;
  compose)
    shift
    if [ "$runtime" = "docker" ]; then
      exec docker compose "$@"
    else
      exec finch compose "$@"
    fi
    ;;
  help|*)
    cat <<EOF
Usage:
  RUNTIME=auto|docker|finch $0 runtime
  RUNTIME=auto|docker|finch $0 init
  RUNTIME=auto|docker|finch $0 compose <compose arguments>
EOF
    [ "$action" = "help" ] || exit 1
    ;;
esac
