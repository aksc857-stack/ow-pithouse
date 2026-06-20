#!/usr/bin/env bash
set -e
GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

echo -e "${CYAN}╔═══════════════════════════════════════╗"
echo -e "║   Odrive Wheel Pit House — Install    ║"
echo -e "╚═══════════════════════════════════════╝${NC}\n"

echo -e "${CYAN}[1/3] Vérification Node.js...${NC}"
if ! command -v node &>/dev/null; then
  echo -e "${RED}✗ Node.js non trouvé — https://nodejs.org${NC}"; exit 1
fi
echo -e "${GREEN}✓ Node.js $(node --version)${NC}\n"

echo -e "${CYAN}[2/3] npm install...${NC}"
npm install
echo -e "${GREEN}✓ Dépendances installées${NC}\n"

echo -e "${CYAN}[3/3] Rebuild serialport pour Electron...${NC}"
npm run rebuild || echo -e "${YELLOW}⚠ rebuild échoué — installez node-gyp${NC}"

# Linux udev rules
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  RULE='SUBSYSTEM=="tty", ATTRS{idVendor}=="0483", MODE="0666", GROUP="dialout"'
  if [ -w /etc/udev/rules.d ]; then
    echo "$RULE" > /etc/udev/rules.d/99-odrive-wheel.rules
    udevadm control --reload-rules 2>/dev/null || true
    echo -e "${GREEN}✓ Règles udev installées${NC}"
  else
    echo -e "${YELLOW}⚠ sudo requis pour udev: sudo sh -c 'echo \"$RULE\" > /etc/udev/rules.d/99-odrive-wheel.rules'${NC}"
  fi
fi

echo -e "\n${GREEN}✓ Terminé !${NC}"
echo -e "  Dev:   ${CYAN}npm run dev${NC}"
echo -e "  Build: ${CYAN}npm run build:win${NC} / build:mac / build:linux\n"
