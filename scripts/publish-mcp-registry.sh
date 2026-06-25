#!/usr/bin/env bash
# Manual publish to npm, Docker Hub (via Podman), and the MCP Registry.
# Run from the repository root after authenticating to each service.
#
# npm 2FA: if publish fails with E403, either:
#   npm publish --access public --otp=YOUR_6_DIGIT_CODE
# or create a granular token with "Bypass 2FA" at https://www.npmjs.com/settings/~/tokens
# and add it to ~/.npmrc:
#   //registry.npmjs.org/:_authToken=npm_xxxxxxxx
#
# Usage:
#   ./scripts/publish-mcp-registry.sh              # full publish
#   NPM_OTP=123456 ./scripts/publish-mcp-registry.sh
#   ./scripts/publish-mcp-registry.sh --skip-npm     # resume after npm already published
#   ./scripts/publish-mcp-registry.sh --skip-build   # skip npm ci/test/build
set -euo pipefail

SKIP_NPM=false
SKIP_BUILD=false

for arg in "$@"; do
  case "$arg" in
    --skip-npm) SKIP_NPM=true ;;
    --skip-build) SKIP_BUILD=true ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg (try --help)" >&2
      exit 1
      ;;
  esac
done

VERSION="$(node -p "require('./package.json').version")"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CONTAINER_CMD="${CONTAINER_CMD:-podman}"

echo "==> Publishing mcp-server-openshift v${VERSION}"
echo "==> Using container runtime: ${CONTAINER_CMD}"

if [ "$SKIP_BUILD" = false ]; then
  echo "==> Building..."
  npm ci
  npm test
  npm run build
else
  echo "==> Skipping build (--skip-build)"
fi

if [ "$SKIP_NPM" = false ]; then
  echo "==> Checking npm authentication..."
  if ! npm whoami >/dev/null 2>&1; then
    echo "error: not logged in to npm. Add a token to ~/.npmrc:" >&2
    echo "  //registry.npmjs.org/:_authToken=npm_xxxxxxxx" >&2
    exit 1
  fi
  echo "    logged in as: $(npm whoami)"

  echo "==> Publishing to npm..."
  NPM_PUBLISH_ARGS=(publish --access public)
  if [ -n "${NPM_OTP:-}" ]; then
    NPM_PUBLISH_ARGS+=(--otp="$NPM_OTP")
  fi
  if ! npm "${NPM_PUBLISH_ARGS[@]}"; then
    cat >&2 <<'EOF'

npm publish failed with E403 (2FA required).

Your token can read npm (npm whoami works) but cannot publish without 2FA.
This usually means the granular token was created WITHOUT "Bypass 2FA" checked.
That option can ONLY be enabled when creating the token — not afterward.

Fix — create a new granular token:
  1. https://www.npmjs.com/settings/~/tokens → Generate New Token → Granular
  2. Permissions: Read and Write
  3. Packages: select "mcp-server-openshift" (or all packages you own)
  4. CHECK "Bypass two-factor authentication (2FA)" before creating
  5. Replace ~/.npmrc with ONLY this line (remove any other auth lines):
       //registry.npmjs.org/:_authToken=npm_NEW_TOKEN
  6. Clear stale web login: npm logout
  7. Verify: npm whoami
  8. Re-run: ./scripts/publish-mcp-registry.sh --skip-build

Alternative — if your npm account has 2FA enabled:
  NPM_OTP=123456 ./scripts/publish-mcp-registry.sh --skip-build

After npm succeeds, resume Podman + MCP Registry only:
  ./scripts/publish-mcp-registry.sh --skip-npm --skip-build

EOF
    exit 1
  fi
else
  echo "==> Skipping npm publish (--skip-npm)"
fi

echo "==> Building and pushing OCI image to Docker Hub..."
IMAGE="docker.io/sanjaypsachdev/mcp-server-openshift"
"${CONTAINER_CMD}" build -t "${IMAGE}:${VERSION}" -t "${IMAGE}:latest" .
"${CONTAINER_CMD}" push "${IMAGE}:${VERSION}"
"${CONTAINER_CMD}" push "${IMAGE}:latest"

echo "==> Stamping server.json for MCP Registry..."
jq --arg v "$VERSION" '
  .version = $v
  | .packages[0].version = $v
  | .packages[1].identifier = "docker.io/sanjaypsachdev/mcp-server-openshift:" + $v
' server.json > server.publish.json

echo "==> Validating registry metadata..."
mcp-publisher validate --file=server.publish.json

echo "==> Authenticating to MCP Registry (GitHub device flow)..."
mcp-publisher login github

echo "==> Publishing to MCP Registry..."
mcp-publisher publish --file=server.publish.json

echo "==> Done!"
echo "Verify: curl \"https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.sanjaypsachdev/mcp-server-openshift\""
