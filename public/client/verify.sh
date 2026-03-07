#!/bin/bash
# Pre-push verification script
# Mirrors the CI pipeline locally to catch failures before pushing.
# Run from public/client/: bash verify.sh

set -e
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "========================================="
echo "  Pre-push verification"
echo "========================================="
echo ""

FAIL=0

# 1. Check for untracked source files (non-test) that are imported by tracked files
echo -e "${YELLOW}[1/4] Checking for untracked source files referenced by imports...${NC}"
UNTRACKED_SRC=$(git ls-files --others --exclude-standard -- 'src/**/*.js' 'src/**/*.jsx' | grep -v '\.test\.' | grep -v '__test__' || true)
if [ -n "$UNTRACKED_SRC" ]; then
    # Check if any tracked file imports an untracked file
    for f in $UNTRACKED_SRC; do
        BASENAME=$(basename "$f" .js)
        # Search tracked files for imports of this basename
        if git grep -l "from.*['\"].*${BASENAME}['\"]" -- '*.js' '*.jsx' 2>/dev/null | head -1 > /dev/null 2>&1; then
            MATCH=$(git grep -l "from.*['\"].*${BASENAME}['\"]" -- '*.js' '*.jsx' 2>/dev/null | head -1)
            if [ -n "$MATCH" ]; then
                echo -e "${RED}  FAIL: Untracked file '$f' is imported by '$MATCH'${NC}"
                echo -e "${RED}        Run: git add $f${NC}"
                FAIL=1
            fi
        fi
    done
    if [ $FAIL -eq 0 ]; then
        echo -e "${GREEN}  OK (untracked files exist but none are imported by tracked code)${NC}"
    fi
else
    echo -e "${GREEN}  OK (no untracked source files)${NC}"
fi

# 2. Format check
echo -e "${YELLOW}[2/4] Checking Prettier formatting...${NC}"
if npm run format:check > /dev/null 2>&1; then
    echo -e "${GREEN}  OK${NC}"
else
    echo -e "${RED}  FAIL: Formatting issues found. Run: npm run format${NC}"
    FAIL=1
fi

# 3. Tests
echo -e "${YELLOW}[3/4] Running tests...${NC}"
if npm test -- --watchAll=false --ci 2>&1 | tail -5; then
    echo -e "${GREEN}  OK${NC}"
else
    echo -e "${RED}  FAIL: Tests failed${NC}"
    FAIL=1
fi

# 4. Build
echo -e "${YELLOW}[4/4] Running build...${NC}"
if npm run build 2>&1 | tail -3; then
    echo -e "${GREEN}  OK${NC}"
else
    echo -e "${RED}  FAIL: Build failed${NC}"
    FAIL=1
fi

echo ""
echo "========================================="
if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}  All checks passed! Safe to push.${NC}"
else
    echo -e "${RED}  Some checks failed. Fix before pushing.${NC}"
fi
echo "========================================="
echo ""

exit $FAIL
