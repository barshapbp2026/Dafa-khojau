#!/usr/bin/env bash
# ==============================================================================
# Dafa Khojau: Git LFS Migration Script for Large Legal PDFs (>50MB)
# ==============================================================================

set -e

echo "=== नेपाली कानुनी PDF सहायक — Git LFS Migration ==="
echo ""

# 1. Check if git-lfs is installed
if ! command -v git-lfs &> /dev/null; then
  echo "[-] Git LFS स्थापना गरिएको छैन। कृपया पहिले git-lfs स्थापना गर्नुहोस्:"
  echo "    sudo apt-get update && sudo apt-get install -y git-lfs"
  exit 1
fi

echo "[+] Git LFS स्थापना भएको पुष्टि भयो:"
git-lfs --version

# 2. Initialize Git LFS in repository
echo ""
echo "[+] Git LFS repository initialization..."
git lfs install

# 3. Configure .gitattributes for PDF files
echo "[+] Setting up .gitattributes tracking for *.pdf..."
git lfs track "*.pdf"
git lfs track "*.PDF"
git add .gitattributes

# 4. Migrate existing large PDFs to Git LFS
echo ""
echo "[+] Migrating existing PDF files into Git LFS tracking..."
git lfs migrate import --everything --include="*.pdf,*.PDF"

# 5. Verify tracked files
echo ""
echo "[+] Verification of LFS tracked files:"
git lfs ls-files

echo ""
echo "=== Git LFS Migration सम्पन्न भयो! ==="
echo "अब तपाईंले Git commit र push गर्न सक्नुहुन्छ:"
echo "    git push origin <branch-name>"
