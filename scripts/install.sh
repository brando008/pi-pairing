#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
PI_AGENT_DIR=${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}
SKILL_DIR=$PI_AGENT_DIR/skills/pi-pairing
BIN_DIR=$PI_AGENT_DIR/bin
START_SERVER=1

for argument in "$@"; do
    case "$argument" in
        --no-server) START_SERVER=0 ;;
        *) echo "Unknown option: $argument" >&2; exit 1 ;;
    esac
done

if ! command -v node >/dev/null 2>&1; then
    echo "Node.js 18 or newer is required." >&2
    exit 1
fi

if ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 18 ? 0 : 1)'; then
    echo "Node.js 18 or newer is required (found $(node --version))." >&2
    exit 1
fi

mkdir -p "$PI_AGENT_DIR/skills" "$BIN_DIR"

if [ -e "$SKILL_DIR" ] || [ -L "$SKILL_DIR" ]; then
    if [ -L "$SKILL_DIR" ]; then
        rm -f "$SKILL_DIR"
    else
        BACKUP_DIR=$SKILL_DIR.backup-$(date +%Y%m%d%H%M%S)
        mv "$SKILL_DIR" "$BACKUP_DIR"
        echo "Backed up the previous skill to $BACKUP_DIR"
    fi
fi

ln -s "$ROOT_DIR/skills/pi-pairing" "$SKILL_DIR"
echo "Installed the pi-pairing skill at $SKILL_DIR"

cat >"$BIN_DIR/pi-pairing" <<EOF
#!/bin/sh
exec node "$ROOT_DIR/cli.js" "\$@"
EOF
chmod +x "$BIN_DIR/pi-pairing"
echo "Installed the CLI wrapper at $BIN_DIR/pi-pairing"

if [ "$START_SERVER" -eq 1 ]; then
    "$ROOT_DIR/scripts/ensure-server.sh"
fi

cat <<EOF

Pi Pairing is installed.

  Dashboard: http://127.0.0.1:4173
  CLI:       "$BIN_DIR/pi-pairing" --help
  Skill:     /skill:pi-pairing <project> <goal>

Start a new Pi session and say:
  Let's use the Pi Pairing method on ~/GitHub/<project>
EOF
