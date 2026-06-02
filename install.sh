#!/usr/bin/env bash
# install.sh — symlink dotfiles into $HOME
# Run from the repo root: bash install.sh

set -euo pipefail

DOTFILES="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

link() {
  local src="$DOTFILES/$1"
  local dst="$HOME/$1"
  mkdir -p "$(dirname "$dst")"
  ln -sf "$src" "$dst"
  echo "  linked $dst -> $src"
}

linkto() {
  local src="$DOTFILES/$1"
  local dst="$HOME/$2"
  mkdir -p "$(dirname "$dst")"
  ln -sf "$src" "$dst"
  echo "  linked $dst -> $src"
}

echo "==> Linking dotfiles from $DOTFILES"

link ".config/fish/config.fish"
link ".config/fish/fish_plugins"
link ".config/fish/conf.d/rustup.fish"
link ".config/nvim/init.lua"
link ".config/nvim/lazy-lock.json"
link ".config/nvim/lua/custom/plugins/init.lua"
link ".config/ghostty/config"

# AI configs
linkto "ai/pi/settings.json"                       ".pi/agent/settings.json"
linkto "ai/AGENTS.md"                          ".pi/agent/AGENTS.md"
linkto "ai/CLAUDE.md"                          ".claude/CLAUDE.md"
linkto "ai/pi/extensions/cmux-notify.ts"       ".pi/agent/extensions/cmux-notify.ts"
linkto "ai/pi/extensions/exit.ts"              ".pi/agent/extensions/exit.ts"
# statusline.ts superseded by pi-powerline-footer fork — not linked
linkto "ai/pi/extensions/uber-genai.js"        ".pi/agent/extensions/uber-genai.js"
linkto "ai/pi/extensions/utrim-bash.ts"        ".pi/agent/extensions/utrim-bash.ts"
linkto "ai/pi/extensions/whimsical.ts"         ".pi/agent/extensions/whimsical.ts"
linkto "ai/pi/skills/mcp-usage/SKILL.md"      ".pi/agent/skills/mcp-usage/SKILL.md"
linkto "ai/pi/skills/kevin-go-conventions-reviewer/SKILL.md" ".pi/agent/skills/kevin-go-conventions-reviewer/SKILL.md"
link ".tmux.conf"
link ".gitconfig"

echo ""
echo "==> Manual steps after linking"
echo ""
echo "  1. Install Homebrew:"
echo '     /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
echo ""
echo "  2. Install packages — see Install.md for the brew install commands"
echo ""
echo "  3. Set fish as default shell:"
echo "     echo /opt/homebrew/bin/fish | sudo tee -a /etc/shells"
echo "     chsh -s /opt/homebrew/bin/fish"
echo ""
echo "  4. Install fisher plugins:"
echo "     fish -c 'fisher update'"
echo ""
echo "  5. Install tmux plugins (inside tmux):"
echo "     prefix + I   (Ctrl-a + I)"
echo ""
echo "  6. Ghostty terminfo for remote SSH:"
echo '     infocmp -x xterm-ghostty | ssh <host> -- tic -x -'
echo ""
echo "  7. Claude settings:"
echo "     Copy ai/claude/settings.json.template to ~/.claude/settings.json and edit as needed"
echo "     (Uber hooks and plugin config are managed separately by aifx/uterm)"
echo ""
echo "  8. Enable Touch ID for sudo:"
echo "     Add 'auth sufficient pam_tid.so' as first line in /etc/pam.d/sudo"
