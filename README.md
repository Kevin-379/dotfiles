# dotfiles

Personal macOS dotfiles for a new laptop setup.

## What's included

| Path | Purpose |
|------|---------|
| `.config/fish/config.fish` | Fish shell config — aliases, env vars, PATH, functions |
| `.config/fish/fish_plugins` | Fisher plugin list |
| `.config/fish/conf.d/rustup.fish` | Rust/cargo env sourcing |
| `.config/nvim/` | Neovim config (kickstart-based) |
| `.tmux.conf` | tmux config with vim keybindings, TPM plugins |
| `.gitconfig` | Git config — signing, push defaults, pager |

## Fresh install

See [Install.md](Install.md) for the full new laptop setup guide.

## Notes

- **Fish functions** (fzf.fish, nvm.fish, etc.) are managed by [fisher](https://github.com/jorgebucaran/fisher) — run `fisher update` to reinstall them.
- **tmux plugins** are managed by [tpm](https://github.com/tmux-plugins/tpm) — press `prefix + I` inside tmux to install.
- **Neovim plugins** are managed by [lazy.nvim](https://github.com/folke/lazy.nvim) — they install automatically on first launch.
- **`.gitconfig`** contains some machine-specific `[maintenance]` repo paths — update or remove those on a new machine.
