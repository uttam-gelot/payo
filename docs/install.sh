#!/bin/sh
#
# Payo installer — https://payo.uttamgelot.com
#
#   curl -fsSL https://payo.uttamgelot.com/install.sh | sh
#
# Installs the `payo` CLI. If bun or a new enough node is already on PATH the
# published npm package is used (a ~300 KB download you can update with tools
# you already have); otherwise a standalone binary is fetched from the GitHub
# release, so machines with no JavaScript runtime at all are supported.
#
# Options (flags, or the matching env var):
#   --version <v>   PAYO_VERSION         install this version instead of latest
#   --dir <path>    PAYO_INSTALL_DIR     where the binary goes (~/.local/bin)
#   --method <m>    PAYO_INSTALL_METHOD  auto | binary | npm | bun
#                   PAYO_FORCE=1         reinstall even if already current
#
# POSIX sh — no bashisms. Never runs sudo.

set -eu

REPO="uttam-gelot/payo"
PKG="@uge/payo"
# Overridable so the installer can be exercised against a local server before a
# release exists. Not part of the documented interface.
API_URL="${PAYO_API_URL:-https://api.github.com/repos/$REPO/releases/latest}"
RELEASE_BASE="${PAYO_RELEASE_BASE:-https://github.com/$REPO/releases/download}"
INSTALL_DIR="${PAYO_INSTALL_DIR:-$HOME/.local/bin}"
METHOD="${PAYO_INSTALL_METHOD:-auto}"
VERSION="${PAYO_VERSION:-}"
FORCE="${PAYO_FORCE:-}"
TMPDIR_PAYO=""

# ---------------------------------------------------------------- output ----

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  BOLD=$(printf '\033[1m')
  DIM=$(printf '\033[2m')
  RED=$(printf '\033[31m')
  GREEN=$(printf '\033[32m')
  YELLOW=$(printf '\033[33m')
  RESET=$(printf '\033[0m')
else
  BOLD=''; DIM=''; RED=''; GREEN=''; YELLOW=''; RESET=''
fi

info() { printf '%s\n' "$*"; }
step() { printf '%s▸%s %s\n' "$BOLD" "$RESET" "$*"; }
warn() { printf '%s!%s %s\n' "$YELLOW" "$RESET" "$*" >&2; }
die() {
  printf '%serror:%s %s\n' "$RED" "$RESET" "$*" >&2
  exit 1
}

cleanup() {
  if [ -n "$TMPDIR_PAYO" ]; then rm -rf "$TMPDIR_PAYO"; fi
  return 0
}
trap cleanup EXIT INT TERM

has() { command -v "$1" >/dev/null 2>&1; }

usage() {
  cat <<'EOF'
Payo installer — https://payo.uttamgelot.com

  curl -fsSL https://payo.uttamgelot.com/install.sh | sh

Uses bun or npm if they are already available; otherwise downloads a
standalone binary, so no JavaScript runtime is required.

  --version <v>   PAYO_VERSION         install this version instead of latest
  --dir <path>    PAYO_INSTALL_DIR     where the binary goes (~/.local/bin)
  --method <m>    PAYO_INSTALL_METHOD  auto | binary | npm | bun
  --force         PAYO_FORCE=1         reinstall even if already current
EOF
}

# ------------------------------------------------------------------ args ----

while [ $# -gt 0 ]; do
  case "$1" in
    --version) VERSION="${2:-}"; shift 2 ;;
    --version=*) VERSION="${1#*=}"; shift ;;
    --dir) INSTALL_DIR="${2:-}"; shift 2 ;;
    --dir=*) INSTALL_DIR="${1#*=}"; shift ;;
    --method) METHOD="${2:-}"; shift 2 ;;
    --method=*) METHOD="${1#*=}"; shift ;;
    --force) FORCE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done

case "$METHOD" in
  auto|binary|npm|bun) ;;
  *) die "--method must be auto, binary, npm or bun (got '$METHOD')" ;;
esac

# ------------------------------------------------------------- download ----

# Print a URL's body on stdout. curl and wget are both common; require either.
fetch() {
  if has curl; then
    curl -fsSL "$1"
  elif has wget; then
    wget -qO- "$1"
  else
    die "neither curl nor wget is available"
  fi
}

# Save a URL to a file, failing loudly on a 404 rather than writing an error page.
download() {
  if has curl; then
    curl -fsSL -o "$2" "$1"
  elif has wget; then
    wget -qO "$2" "$1"
  else
    die "neither curl nor wget is available"
  fi
}

# --------------------------------------------------------------- version ----

# Latest release tag, via the API (the redirect trick only gives an asset URL,
# and the version is needed up front for the npm path and the up-to-date check).
resolve_version() {
  if [ -n "$VERSION" ]; then
    printf '%s' "${VERSION#v}"
    return 0
  fi
  tag=$(fetch "$API_URL" | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)
  [ -n "$tag" ] || die "could not determine the latest version from $API_URL"
  printf '%s' "${tag#v}"
}

# Extract the semver from `payo --version` output, empty if the binary is broken.
installed_version() {
  "$1" --version 2>/dev/null | sed -n 's/.*\([0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\).*/\1/p' | head -n1
}

# 0 if $1 >= $2, comparing major.minor only — used for the node engines floor.
version_ge() {
  have_major=${1%%.*}; have_rest=${1#*.}; have_minor=${have_rest%%.*}
  want_major=${2%%.*}; want_rest=${2#*.}; want_minor=${want_rest%%.*}
  [ "$have_major" -gt "$want_major" ] && return 0
  [ "$have_major" -lt "$want_major" ] && return 1
  [ "$have_minor" -ge "$want_minor" ]
}

# -------------------------------------------------------------- platform ----

detect_platform() {
  os=$(uname -s)
  arch=$(uname -m)

  case "$os" in
    Darwin) os=darwin ;;
    Linux) os=linux ;;
    MINGW*|MSYS*|CYGWIN*) os=windows ;;
    *) die "unsupported OS '$os'. Install with npm instead: npm i -g $PKG" ;;
  esac

  case "$arch" in
    x86_64|amd64) arch=x64 ;;
    arm64|aarch64) arch=arm64 ;;
    *) die "unsupported architecture '$arch'. Install with npm instead: npm i -g $PKG" ;;
  esac

  # The binaries link against glibc. Alpine would get a binary that cannot
  # start, so fail with something actionable instead.
  if [ "$os" = linux ]; then
    if ldd --version 2>&1 | grep -qi musl; then
      die "musl/Alpine has no prebuilt binary yet. Install with npm instead: npm i -g $PKG"
    fi
    for musl_ld in /lib/ld-musl-*; do
      if [ -e "$musl_ld" ]; then
        die "musl/Alpine has no prebuilt binary yet. Install with npm instead: npm i -g $PKG"
      fi
    done
  fi

  if [ "$os" = windows ] && [ "$arch" = arm64 ]; then
    die "Windows on ARM has no prebuilt binary. Install with npm instead: npm i -g $PKG"
  fi

  printf '%s-%s' "$os" "$arch"
}

# --------------------------------------------------------------- strategy ---

# Prefer a runtime the user already has: it is a far smaller download and they
# can update it with a tool they already know.
pick_method() {
  if [ "$METHOD" != auto ]; then
    printf '%s' "$METHOD"
    return 0
  fi
  if has bun; then
    printf 'bun'
  elif has npm && has node && version_ge "$(node -v 2>/dev/null | sed 's/^v//')" 20.12; then
    printf 'npm'
  else
    printf 'binary'
  fi
}

# ---------------------------------------------------------------- installs --

install_via_bun() {
  step "Installing $PKG@$1 with bun"
  bun add -g "$PKG@$1"
}

install_via_npm() {
  step "Installing $PKG@$1 with npm"
  npm install -g "$PKG@$1"
}

install_binary() {
  version=$1
  platform=$(detect_platform)
  case "$platform" in
    windows-*) asset="payo-$platform.zip"; binname="payo.exe" ;;
    *) asset="payo-$platform.tar.gz"; binname="payo" ;;
  esac
  base="$RELEASE_BASE/v$version"

  TMPDIR_PAYO=$(mktemp -d)
  step "Downloading $asset (v$version)"
  download "$base/$asset" "$TMPDIR_PAYO/$asset" ||
    die "download failed — is there a v$version release with a $platform build?"

  verify_checksum "$TMPDIR_PAYO" "$asset" "$base"

  case "$asset" in
    *.zip)
      has unzip || die "unzip is required to install on Windows"
      unzip -qo "$TMPDIR_PAYO/$asset" -d "$TMPDIR_PAYO"
      ;;
    *) tar -xzf "$TMPDIR_PAYO/$asset" -C "$TMPDIR_PAYO" ;;
  esac
  [ -f "$TMPDIR_PAYO/$binname" ] || die "archive did not contain $binname"

  mkdir -p "$INSTALL_DIR"
  chmod +x "$TMPDIR_PAYO/$binname"
  # mv within the install dir is atomic, so a running payo is never half-replaced.
  mv -f "$TMPDIR_PAYO/$binname" "$INSTALL_DIR/$binname"
  step "Installed to $INSTALL_DIR/$binname"
}

# Compare against the release SHA256SUMS. Only skipped if the host has no
# hashing tool at all, and then loudly.
verify_checksum() {
  dir=$1; asset=$2; base=$3
  if has sha256sum; then
    hasher="sha256sum"
  elif has shasum; then
    hasher="shasum -a 256"
  else
    warn "no sha256sum/shasum found — skipping checksum verification"
    return 0
  fi

  sums="$dir/SHA256SUMS"
  download "$base/SHA256SUMS" "$sums" || {
    warn "could not download SHA256SUMS — skipping checksum verification"
    return 0
  }

  expected=$(grep " $asset\$" "$sums" | awk '{print $1}' | head -n1)
  [ -n "$expected" ] || die "$asset is missing from SHA256SUMS"
  actual=$(cd "$dir" && $hasher "$asset" | awk '{print $1}')
  [ "$expected" = "$actual" ] ||
    die "checksum mismatch for $asset
  expected $expected
  actual   $actual"
  info "${DIM}  checksum ok${RESET}"
}

# ---------------------------------------------------------------- cleanup ---

# Every place an install could live, so switching methods does not leave an
# older payo shadowing the new one earlier on PATH.
existing_installs() {
  {
    printf '%s\n' "$INSTALL_DIR/payo"
    printf '%s\n' "$HOME/.local/bin/payo"
    printf '%s\n' "$HOME/.bun/bin/payo"
    if has npm; then
      prefix=$(npm prefix -g 2>/dev/null || true)
      if [ -n "$prefix" ]; then printf '%s\n' "$prefix/bin/payo"; fi
    fi
    command -v payo || true
  } 2>/dev/null | sort -u | while IFS= read -r p; do
    # -L as well as -e: an uninstalled package can leave a dangling symlink,
    # which still shadows the real payo on PATH.
    if [ -n "$p" ] && { [ -e "$p" ] || [ -L "$p" ]; }; then printf '%s\n' "$p"; fi
  done
}

# Remove installs that are not the one just made. Runs after a successful
# install so a failed download never leaves the user with no payo at all.
remove_stale() {
  kept=$1
  existing_installs | while IFS= read -r p; do
    [ "$p" = "$kept" ] && continue
    # Resolve both sides — npm's global bin is usually a symlink to the same file.
    if [ -n "$kept" ] && [ "$(readlink "$p" 2>/dev/null || printf '%s' "$p")" = "$kept" ]; then
      continue
    fi
    case "$p" in
      "$HOME"/.bun/bin/payo)
        step "Removing the older bun install"
        bun remove -g "$PKG" >/dev/null 2>&1 || rm -f "$p"
        ;;
      *)
        npm_prefix=$(has npm && npm prefix -g 2>/dev/null || true)
        if [ -n "$npm_prefix" ] && [ "$p" = "$npm_prefix/bin/payo" ]; then
          step "Removing the older npm install"
          npm rm -g "$PKG" >/dev/null 2>&1 || rm -f "$p"
        else
          step "Removing the older binary at $p"
          rm -f "$p"
        fi
        ;;
    esac
  done
}

# ------------------------------------------------------------------- path ----

rc_file_hint() {
  # shellcheck disable=SC2088 # these are shown to the user, not expanded
  case "${SHELL:-}" in
    */zsh) printf '~/.zshrc' ;;
    */fish) printf '~/.config/fish/config.fish' ;;
    *) printf '~/.bashrc' ;;
  esac
}

check_path() {
  dir=$1
  case ":$PATH:" in
    *":$dir:"*) return 0 ;;
  esac
  warn "$dir is not on your PATH."
  info "  Add it by appending this to $(rc_file_hint), then open a new terminal:"
  info ""
  info "    ${BOLD}export PATH=\"$dir:\$PATH\"${RESET}"
  info ""
}

# ------------------------------------------------------------------- main ----

main() {
  version=$(resolve_version)
  method=$(pick_method)

  # Already current? Say so and stop, unless there is more than one copy around
  # (in which case the run is worth doing just to clean up).
  current=$(existing_installs | head -n1)
  count=$(existing_installs | wc -l | tr -d ' ')
  if [ -z "$FORCE" ] && [ -n "$current" ] && [ "$count" = "1" ]; then
    have=$(installed_version "$current")
    if [ "$have" = "$version" ]; then
      info "${GREEN}✓${RESET} payo $version is already installed at $current"
      info "${DIM}  Re-run with PAYO_FORCE=1 to reinstall.${RESET}"
      return 0
    fi
    if [ -n "$have" ]; then step "Upgrading payo $have → $version"; fi
  fi

  # Install first, remove the old copies after — a failed install must never
  # leave the machine with no payo.
  if [ "$method" = bun ]; then
    if ! install_via_bun "$version"; then
      warn "bun install failed — falling back to the standalone binary"
      method=binary
    fi
  elif [ "$method" = npm ]; then
    if ! install_via_npm "$version"; then
      warn "npm install failed (a permissions error on a system-owned prefix is
  the usual cause) — falling back to the standalone binary"
      method=binary
    fi
  fi
  if [ "$method" = binary ]; then install_binary "$version"; fi

  case "$method" in
    bun) installed_path="$HOME/.bun/bin/payo" ;;
    npm) installed_path="$(npm prefix -g 2>/dev/null)/bin/payo" ;;
    *) installed_path="$INSTALL_DIR/payo" ;;
  esac

  remove_stale "$installed_path"
  check_path "$(dirname "$installed_path")"

  if [ -x "$installed_path" ]; then
    got=$(installed_version "$installed_path")
    info ""
    info "${GREEN}✓${RESET} payo ${BOLD}$got${RESET} installed via $method"
  else
    info ""
    info "${GREEN}✓${RESET} payo $version installed via $method"
  fi
  info "${DIM}  Run it in any project:${RESET} ${BOLD}payo${RESET}"
  case "$method" in
    bun) info "${DIM}  Remove with: bun remove -g $PKG${RESET}" ;;
    npm) info "${DIM}  Remove with: npm rm -g $PKG${RESET}" ;;
    *) info "${DIM}  Remove with: rm $installed_path${RESET}" ;;
  esac
}

main
