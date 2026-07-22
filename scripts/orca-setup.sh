#!/usr/bin/env bash
#
# Orca worktree SETUP script - OriginalByteMe portfolio ("Ask-Me dynamic portfolio").
#
# Paste the whole file into Orca -> Setup Script, OR put a one-line bootstrap there:
#     bash "$ORCA_WORKTREE_PATH/scripts/orca-setup.sh"
#
# It bootstraps a freshly-created worktree so a future agent can pick up the
# Ask-Me plan/issues immediately: checks the toolchain, scaffolds .env.local
# (inheriting real secrets from the primary checkout when possible), installs
# npm deps, and prints where the work is defined.
#
# Orca provides these env vars (the same ones the Archive Script exposes):
#   $ORCA_ROOT_PATH       primary checkout  (source for an inherited .env.local)
#   $ORCA_WORKTREE_PATH   this worktree     (what we set up)
#   $ORCA_WORKSPACE_NAME  worktree / workspace label
#
# Best-effort by design: it logs warnings but never blocks worktree creation
# (always exits 0). Re-runnable / idempotent.

set -u

WORKTREE="${ORCA_WORKTREE_PATH:-$(pwd)}"
ROOT_PATH="${ORCA_ROOT_PATH:-$WORKTREE}"
NAME="${ORCA_WORKSPACE_NAME:-$(basename "$WORKTREE")}"
APP_SUBDIR="noah-portfolio"
APP_DIR="$WORKTREE/$APP_SUBDIR"
WARN=0

log()  { printf '    %s\n' "$*"; }
warn() { printf '    [!] %s\n' "$*" >&2; WARN=$((WARN + 1)); }
step() { printf '\n==> %s\n' "$*"; }

printf '=== Orca setup: %s ===\n' "$NAME"
log "worktree : $WORKTREE"
log "root     : $ROOT_PATH"
log "app dir  : $APP_DIR"

if [ ! -d "$APP_DIR" ]; then
  warn "App directory $APP_DIR not found - is this the OriginalByteMe repo? Skipping."
  printf '\n=== setup finished (%s warning(s)) ===\n' "$WARN"
  exit 0
fi
cd "$APP_DIR" || { warn "Could not cd into $APP_DIR"; exit 0; }

# --- toolchain -----------------------------------------------------------------
step "Toolchain"
if command -v node >/dev/null 2>&1; then
  log "node $(node -v)   npm $(npm -v 2>/dev/null || echo 'missing')"
  NODE_MAJOR=$(node -v | sed 's/^v//; s/\..*//')
  if [ "${NODE_MAJOR:-0}" -lt 18 ]; then
    warn "Node $(node -v) < 18.18 required by Next.js 15 - the app may not build."
  fi
else
  warn "Node.js not on PATH. Install Node >= 18.18, then re-run this script in $APP_DIR."
fi

# --- .env.local (inherit secrets from the primary checkout when possible) ------
step "Environment (.env.local)"
ENV_FILE="$APP_DIR/.env.local"
ROOT_ENV="$ROOT_PATH/$APP_SUBDIR/.env.local"
EXAMPLE="$APP_DIR/.env.local.example"
if [ -f "$ENV_FILE" ]; then
  log ".env.local already present - left untouched."
elif [ "$ROOT_ENV" != "$ENV_FILE" ] && [ -f "$ROOT_ENV" ]; then
  if cp "$ROOT_ENV" "$ENV_FILE"; then log "Inherited .env.local from the primary checkout."; else warn "Failed to copy $ROOT_ENV"; fi
elif [ -f "$EXAMPLE" ]; then
  if cp "$EXAMPLE" "$ENV_FILE"; then log "Created .env.local from .env.local.example - fill in the secrets."; else warn "Failed to copy the example env."; fi
else
  warn "No .env.local.example found - create $ENV_FILE manually."
fi

# --- dependencies --------------------------------------------------------------
step "Dependencies (npm)"
if command -v npm >/dev/null 2>&1; then
  if npm install --no-audit --no-fund; then
    log "node_modules ready."
  else
    warn "npm install failed - run it manually in $APP_DIR."
  fi
else
  warn "npm not found - skipping dependency install."
fi

# --- orient the agent ----------------------------------------------------------
step "What this worktree is for"
cat <<'INFOEOF'
    Ask-Me dynamic portfolio (Phase 1) - the page re-composes around a visitor's
    question via json-render.

      Plan   : docs/superpowers/plans/2026-06-28-ask-me-dynamic-portfolio.md
      Spec   : docs/superpowers/specs/2026-06-28-ask-me-dynamic-portfolio-design.md
      Epic   : GitHub issue #21 (label: ask-me); tasks #7-#20 in dependency order.
      Branch : feat/ask-me-dynamic-portfolio

    Key contracts (from the PR #22 review):
      * Fact components take a LITERAL statePath pointer (e.g. "/corpus/projects"),
        NOT a {"$state": ...} binding - they resolve it via useStateValue.
      * Compute corpusState() in the SERVER app/layout.tsx and pass it to the
        client JsonUiProvider as a serializable initialState prop (never import
        @/lib/corpus from a "use client" module).
      * Optional catalog props use .nullable().optional().

    Start at issue #7 (deps, env, vitest harness).
INFOEOF

printf '\n=== setup finished for %s (%s warning(s)) ===\n' "$NAME" "$WARN"
exit 0
