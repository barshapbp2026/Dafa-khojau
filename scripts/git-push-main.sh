#!/usr/bin/env bash
# ==============================================================================
# Dafa Khojau: Push to barshapbp2026/Dafa-khojau on main branch
# ==============================================================================

set -e

REPO_OWNER="${GITHUB_OWNER:-barshapbp2026}"
REPO_NAME="${GITHUB_REPO:-Dafa-khojau}"
BRANCH="${GITHUB_BRANCH:-main}"

echo "=== Dafa Khojau GitHub Sync (${REPO_OWNER}/${REPO_NAME} -> ${BRANCH}) ==="

if [ -z "$GITHUB_TOKEN" ]; then
  echo "[-] GITHUB_TOKEN उपलब्ध छैन। कृपया Netrun Secrets मा GITHUB_TOKEN थप्नुहोस्।"
  echo "    कमान्ड चलाउँदा: GITHUB_TOKEN='ghp_your_token' ./scripts/git-push-main.sh"
  exit 1
fi

echo "[+] Authenticating with GitHub using GITHUB_TOKEN..."
git remote set-url origin "https://${GITHUB_TOKEN}@github.com/${REPO_OWNER}/${REPO_NAME}.git"

echo "[+] Pushing local commits to branch '${BRANCH}'..."
git push -u origin "${BRANCH}"

echo ""
echo "=== GitHub Push सफलतापूर्वक सम्पन्न भयो! ==="
echo "Repository: https://github.com/${REPO_OWNER}/${REPO_NAME}.git"
echo "Branch: ${BRANCH}"
