#!/usr/bin/env bash
# Se ejecuta una sola vez, cuando el Codespace se crea.
# Objetivo: que el Codespace quede usable sin ningun paso manual adicional.
set -euo pipefail

echo "==> Node $(node -v) / npm $(npm -v)"

echo "==> Instalando dependencias del proyecto..."
npm ci --no-audit --no-fund || npm install --no-audit --no-fund

# Claude Code es una comodidad, no un requisito del proyecto. Si el install
# global falla (permisos sobre el prefix de npm, red), no debe abortar el setup
# por culpa de `set -e` y dejar el Codespace sin cliente de Prisma.
echo "==> Instalando Claude Code..."
npm install -g @anthropic-ai/claude-code --no-audit --no-fund \
  || echo "    (aviso) no se pudo instalar Claude Code; el resto del setup sigue."

# El cliente de Prisma se genera a src/generated/prisma, que esta gitignoreado.
# Sin este paso el Codespace arranca sin cliente y cualquier import falla.
# No necesita conexion a la base: solo lee el schema.
echo "==> Generando el cliente de Prisma..."
npm run db:generate

echo ""
echo "=========================================================="
echo " Codespace listo."
echo ""
echo "   npm run dev     -> servidor de desarrollo (puerto 3000)"
echo "   claude          -> Claude Code"
echo ""
echo " Recorda: los secrets (Supabase, etc.) se configuran en"
echo " GitHub > Settings > Secrets and variables > Codespaces."
echo " No se usan archivos .env en disco. Ver docs/setup.md."
echo "=========================================================="
