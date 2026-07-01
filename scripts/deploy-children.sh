#!/bin/bash
# Deploy to all child Cloudflare accounts
# This script fetches child configs from the master dashboard, then deploys
# the full system (static files + Functions) to each child using wrangler.
#
# Usage: ./scripts/deploy-children.sh [child_project_name]
# - No args: deploys to ALL children
# - With arg: deploys to specific child by project name

set -e

MASTER_URL="https://outlook-token-dashboard.pages.dev"
ADMIN_PASSWORD="OutlookAdmin2024!"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DEPLOY_DIR="/tmp/child-deploy-$$"

echo "=== Child Deployment Script ==="
echo ""

# Step 1: Build the dashboard
echo "[1/4] Building dashboard..."
cd "$PROJECT_DIR"
npm run build:dashboard > /dev/null 2>&1
echo "  Done."

# Step 2: Prepare deployment directory
echo "[2/4] Preparing deployment files..."
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"
cp -r dist/dashboard/* "$DEPLOY_DIR/"
cp -r functions "$DEPLOY_DIR/functions"
echo "  Done. $(find "$DEPLOY_DIR" -type f | wc -l) files ready."

# Step 3: Fetch child accounts from master
echo "[3/4] Fetching child accounts from master..."
children_json=$(curl -s "$MASTER_URL/api/deploy" -H "X-Admin-Password: $ADMIN_PASSWORD")

if echo "$children_json" | grep -q '"error"'; then
  echo "  Error: $(echo "$children_json" | grep -o '"error":"[^"]*"')"
  exit 1
fi

# Parse children
child_count=$(echo "$children_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('children',[])))" 2>/dev/null || echo "0")
echo "  Found $child_count child account(s)."

if [ "$child_count" = "0" ]; then
  echo "  No children to deploy. Add child accounts via the Deploy panel first."
  rm -rf "$DEPLOY_DIR"
  exit 0
fi

# Step 4: Deploy to each child
echo "[4/4] Deploying..."
echo ""

target_project="${1:-}"
deployed=0
failed=0

for i in $(seq 0 $((child_count - 1))); do
  name=$(echo "$children_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['children'][$i]['name'])")
  account_id=$(echo "$children_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['children'][$i]['accountId'])")
  api_token=$(echo "$children_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['children'][$i]['apiToken'])")
  project_name=$(echo "$children_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['children'][$i]['projectName'])")

  # Skip if targeting specific child
  if [ -n "$target_project" ] && [ "$project_name" != "$target_project" ]; then
    continue
  fi

  echo "  Deploying to: $name ($project_name.pages.dev)"

  cd "$DEPLOY_DIR"
  if CLOUDFLARE_ACCOUNT_ID="$account_id" CLOUDFLARE_API_TOKEN="$api_token" \
    npx wrangler pages deploy . --project-name="$project_name" 2>&1 | tail -2; then
    echo "  -> Success!"
    ((deployed++))

    # Update status on master
    child_id=$(echo "$children_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['children'][$i]['id'])")
    curl -s "$MASTER_URL/api/deploy" -X POST \
      -H "Content-Type: application/json" \
      -H "X-Admin-Password: $ADMIN_PASSWORD" \
      -d "{\"action\":\"update_status\",\"childId\":\"$child_id\",\"status\":\"success\"}" > /dev/null 2>&1 || true
  else
    echo "  -> FAILED"
    ((failed++))
  fi
  echo ""
done

# Cleanup
rm -rf "$DEPLOY_DIR"

echo "=== Deployment Complete ==="
echo "  Deployed: $deployed"
echo "  Failed: $failed"
