# dotfiles

Personal macOS dotfiles for a new laptop setup.

## What's included

| Path | Purpose |
|------|---------|
| `.config/fish/config.fish` | Fish shell config — aliases, env vars, PATH, functions |
| `.config/fish/fish_plugins` | Fisher plugin list |
| `.config/fish/conf.d/rustup.fish` | Rust/cargo env sourcing |
| `.config/nvim/` | Neovim config (kickstart-based) |
| `.tmux.conf` | tmux config with vim keybindings, TPM plugins, copy-mode fixes |
| `.gitconfig` | Git config — signing, push defaults, pager |
| `ai/pi/settings.json` | pi coding agent config — packages, model, powerline |
| `ai/pi/extensions/` | pi extensions (cmux-notify, exit, uber-genai, etc.) |
| `ai/AGENTS.md` | Shared agent instructions for pi and Claude |

## pi-powerline-footer fork

The pi status bar is driven by a personal fork of [pi-powerline-footer](https://github.com/Kevin-379/pi-powerline-footer) on the `personal` branch. It adds:

- `user_host` segment — `user@host` format
- `context_bar` segment — token count with progress bar
- Chat/editor separator line
- vim-motions-pi compatibility (removed `setEditorComponent` override)

The fork lives at `~/Personal/pi-powerline-footer` and is referenced by path in `ai/pi/settings.json`. See Install.md step 17 for setup.

## Fresh install

See [Install.md](Install.md) for the full new laptop setup guide.

## Notes

- **Fish functions** (fzf.fish, nvm.fish, etc.) are managed by [fisher](https://github.com/jorgebucaran/fisher) — run `fisher update` to reinstall them.
- **tmux plugins** are managed by [tpm](https://github.com/tmux-plugins/tpm) — press `prefix + I` inside tmux to install.
- **Neovim plugins** are managed by [lazy.nvim](https://github.com/folke/lazy.nvim) — they install automatically on first launch.
- **`.gitconfig`** contains some machine-specific `[maintenance]` repo paths — update or remove those on a new machine.
