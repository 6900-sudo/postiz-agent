#!/usr/bin/env bash
set -euo pipefail

POSTIZ_BASE_URL="${POSTIZ_BASE_URL:-https://api.postiz.com}"
UPSTREAM_MANIFEST_URL="${UPSTREAM_MANIFEST_URL:-https://raw.githubusercontent.com/gitroomhq/postiz-app/main/chatgpt-app-submission.json}"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

log() { printf '\n==> %s\n' "$*"; }
fail() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

log "Validating upstream ChatGPT app submission manifest"
curl --fail --silent --show-error --location \
  "$UPSTREAM_MANIFEST_URL" -o "$WORKDIR/chatgpt-app-submission.json"

python3 - "$WORKDIR/chatgpt-app-submission.json" <<'PY'
import json, sys
p = sys.argv[1]
with open(p, encoding="utf-8") as f:
    data = json.load(f)

assert data.get("schema_version") == 1, "schema_version must be 1"
tools = data.get("tools", {})
assert len(tools) == 13, f"expected 13 tools, got {len(tools)}"
assert len(data.get("test_cases", [])) == 5, "expected exactly 5 positive test cases"
assert len(data.get("negative_test_cases", [])) == 3, "expected exactly 3 negative test cases"

required = ("readOnlyHint", "openWorldHint", "destructiveHint")
for name, spec in tools.items():
    annotations = spec.get("annotations", {})
    for key in required:
        assert key in annotations, f"{name}: missing {key}"
        assert isinstance(annotations[key], bool), f"{name}: {key} must be boolean"

print(f"manifest OK: {len(tools)} tools, 5 positive tests, 3 negative tests")
PY

log "Checking OAuth protected-resource metadata"
PROTECTED_URL="$POSTIZ_BASE_URL/.well-known/oauth-protected-resource/mcp-oauth"
curl --fail --silent --show-error --location \
  -H 'Accept: application/json' \
  "$PROTECTED_URL" -o "$WORKDIR/protected.json"

python3 - "$WORKDIR/protected.json" "$POSTIZ_BASE_URL" <<'PY'
import json, sys
p, base = sys.argv[1], sys.argv[2].rstrip('/')
with open(p, encoding="utf-8") as f:
    data = json.load(f)
resource = data.get("resource")
auth_servers = data.get("authorization_servers") or data.get("authorizationServers")
assert resource, "protected-resource metadata missing resource"
assert auth_servers, "protected-resource metadata missing authorization_servers"
assert any(str(x).rstrip('/') == f"{base}/mcp-oauth" for x in auth_servers), \
    f"expected {base}/mcp-oauth in authorization servers: {auth_servers}"
print("protected-resource metadata OK")
PY

log "Checking OAuth authorization-server metadata"
AUTH_URL="$POSTIZ_BASE_URL/.well-known/oauth-authorization-server/mcp-oauth"
curl --fail --silent --show-error --location \
  -H 'Accept: application/json' \
  "$AUTH_URL" -o "$WORKDIR/auth.json"

python3 - "$WORKDIR/auth.json" "$POSTIZ_BASE_URL" <<'PY'
import json, sys
p, base = sys.argv[1], sys.argv[2].rstrip('/')
with open(p, encoding="utf-8") as f:
    data = json.load(f)
for key in ("issuer", "authorization_endpoint", "token_endpoint", "registration_endpoint"):
    assert data.get(key), f"authorization metadata missing {key}"
assert data["issuer"].rstrip('/') == f"{base}/mcp-oauth", \
    f"unexpected issuer: {data['issuer']}"
methods = data.get("code_challenge_methods_supported", [])
assert "S256" in methods, "PKCE S256 is not advertised"
scopes = data.get("scopes_supported", [])
assert "mcp:read" in scopes and "mcp:write" in scopes, \
    f"missing MCP scopes: {scopes}"
print("authorization-server metadata OK")
PY

log "Checking unauthenticated MCP request is rejected"
HTTP_CODE="$(curl --silent --show-error --output "$WORKDIR/mcp-unauth.txt" --write-out '%{http_code}' \
  -X POST \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"postiz-agent-smoke","version":"1.0.0"}}}' \
  "$POSTIZ_BASE_URL/mcp-oauth")"
case "$HTTP_CODE" in
  401|403) printf 'unauthenticated MCP protection OK (HTTP %s)\n' "$HTTP_CODE" ;;
  *) cat "$WORKDIR/mcp-unauth.txt" >&2 || true; fail "expected 401/403 from unauthenticated /mcp-oauth, got HTTP $HTTP_CODE" ;;
esac

if [[ -n "${POSTIZ_API_KEY:-}" ]]; then
  log "Running authenticated MCP initialize request"
  HTTP_CODE="$(curl --silent --show-error --dump-header "$WORKDIR/init.headers" \
    --output "$WORKDIR/init.body" --write-out '%{http_code}' \
    -X POST \
    -H "Authorization: Bearer $POSTIZ_API_KEY" \
    -H 'Accept: application/json, text/event-stream' \
    -H 'Content-Type: application/json' \
    --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"postiz-agent-smoke","version":"1.0.0"}}}' \
    "$POSTIZ_BASE_URL/mcp")"
  [[ "$HTTP_CODE" == "200" ]] || { cat "$WORKDIR/init.body" >&2 || true; fail "authenticated MCP initialize returned HTTP $HTTP_CODE"; }
  grep -Eq '"result"|event: message' "$WORKDIR/init.body" || { cat "$WORKDIR/init.body" >&2; fail "MCP initialize response did not contain a result"; }
  printf 'authenticated MCP initialize OK\n'
else
  log "POSTIZ_API_KEY is not set; authenticated MCP handshake skipped"
  printf 'Add POSTIZ_API_KEY as a repository Actions secret to enable the authenticated check.\n'
fi

log "Postiz MCP smoke test passed"
