# Shared by entourage-job-back and entourage-job-front (keep both copies identical).
# Gives every Orca worktree a "slot" (1..99) used to offset local ports, so several
# worktrees can run servers / docker stacks / tests at the same time.
# The slot is keyed by branch name and stored in a registry shared by both repos:
# a front and a back worktree on the same branch get the same slot, so they talk to each other.
# Override the key with ORCA_PORT_KEY if the two branches are named differently.

REGISTRY="${ORCA_PORT_REGISTRY:-$HOME/.entourage-orca-port-slots}"

# Main checkout keeps the default ports.
if [ -n "$ORCA_ROOT_PATH" ] && [ "$(pwd -P)" = "$(cd "$ORCA_ROOT_PATH" && pwd -P)" ]; then
  echo "[orca-ports] main checkout: default ports kept"
  exit 0
fi

KEY="${ORCA_PORT_KEY:-$(git rev-parse --abbrev-ref HEAD)}"
touch "$REGISTRY"

SLOT=$(awk -v k="$KEY" '$1 == k { print $2; exit }' "$REGISTRY")
if [ -z "$SLOT" ]; then
  SLOT=1
  while awk -v s="$SLOT" '$2 == s { found = 1 } END { exit !found }' "$REGISTRY"; do
    SLOT=$((SLOT + 1))
  done
  if [ "$SLOT" -gt 99 ]; then
    echo "[orca-ports] no free slot left in $REGISTRY: remove stale lines" >&2
    exit 1
  fi
  echo "$KEY $SLOT" >> "$REGISTRY"
fi

# set_env KEY VALUE: create or replace KEY in ./.env
set_env() {
  touch .env
  # .env may lack a trailing newline: avoid gluing the new line to the last one
  [ -n "$(tail -c1 .env)" ] && echo >> .env
  if grep -q "^$1=" .env; then
    sed -i.bak "s|^$1=.*|$1=$2|" .env && rm -f .env.bak
  else
    printf '%s=%s\n' "$1" "$2" >> .env
  fi
}

FRONT_PORT=$((4000 + SLOT))
API_PORT=$((5000 + SLOT))
echo "[orca-ports] branch '$KEY' -> slot $SLOT (front $FRONT_PORT, api $API_PORT)"

set_env PORT "$API_PORT"
set_env WORKER_PORT "$((5100 + SLOT))"
set_env FRONT_URL "http://localhost:$FRONT_PORT"
set_env LINKEDIN_REDIRECT_URI "http://localhost:$FRONT_PORT/auth/linkedin/callback"

# Docker compose: separate project (own containers, network and volumes => own databases)
# and host ports shifted by the slot. Read by docker-compose*.yml.
set_env COMPOSE_PROJECT_NAME "entourage-job-back-wt$SLOT"
set_env CONTAINER_PREFIX "wt$SLOT-"
set_env DB_HOST_PORT "$((6000 + SLOT))"
set_env REDIS_HOST_PORT "$((6100 + SLOT))"
set_env DB_TEST_HOST_PORT "$((6200 + SLOT))"
set_env DD_STATSD_HOST_PORT "$((6300 + SLOT))"
set_env DD_APM_HOST_PORT "$((6400 + SLOT))"

