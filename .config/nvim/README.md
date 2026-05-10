# Neovim

Config is based on [kickstart.nvim](https://github.com/nvim-lua/kickstart.nvim) — a minimal, readable starting point, not a distribution.

## Structure

| Path | Purpose |
|------|---------|
| `init.lua` | Everything: options, keymaps, and plugin specs via lazy.nvim |
| `lua/custom/plugins/init.lua` | Your own plugins — add them here |
| `lazy-lock.json` | Pinned plugin versions |

## Adding plugins

Put new plugin specs in `lua/custom/plugins/init.lua` and uncomment the import at the bottom of `init.lua`:

```lua
{ import = 'custom.plugins' }
```

## Kickstart example plugins

kickstart.nvim ships several optional example plugins that are **not tracked** in this repo:

- `autopairs` — auto-close brackets/quotes
- `debug` — DAP debugger setup
- `gitsigns` — extended gitsigns keymaps
- `indent_line` — indentation guides
- `lint` — async linting via nvim-lint
- `neo-tree` — file explorer

To use one, copy it from the [kickstart.nvim repo](https://github.com/nvim-lua/kickstart.nvim/tree/master/lua/kickstart/plugins) into `lua/custom/plugins/` and uncomment its `require` in `init.lua`.

## Plugin manager

Plugins are managed by [lazy.nvim](https://github.com/folke/lazy.nvim) and install automatically on first launch. Use `:Lazy` to manage them.
