-- You can add your own plugins here or in other files in this directory!
--  I promise not to create any merge conflicts in this directory :)
--
-- See the kickstart.nvim README for more information
return {
  {
    'jakewvincent/mkdnflow.nvim',
    ft = { 'markdown', 'rmd' },
    opts = {
      mappings = {
        MkdnEnter = { { 'i', 'n', 'v' }, '<CR>' }, -- also handle Enter in insert mode (new list items, table rows)
        MkdnFoldSection = false,   -- frees <leader>f (used by conform: format buffer)
        MkdnToggleToDo = false,    -- frees <C-Space> (used by blink.cmp: open menu)
        MkdnTableNextCell = false, -- frees insert <Tab> (used by blink.cmp: snippet expand)
        MkdnTablePrevCell = false, -- frees insert <S-Tab>
      },
    },
  },
}
