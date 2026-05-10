# Git — large repo performance setup

Run these once after cloning a large monorepo (e.g. Uber go-code).

1. Clone with minimal history
   ```sh
   git clone <repo> --branch main --single-branch --no-tags
   # optionally add --depth 1 for a shallow clone
   ```
2. Pre-warm the commit graph
   ```sh
   git show-ref -s | git commit-graph write --stdin-commits
   ```
3. Auto-update commit graph on fetch
   ```sh
   git config fetch.writeCommitGraph true
   ```
4. Suppress noisy merge/rebase stat output
   ```sh
   git config merge.stat false
   git config rebase.stat false
   ```
5. Hide dirty state in oh-my-zsh prompt (speeds up prompt in large repos)
   ```sh
   git config --add oh-my-zsh.hide-dirty 1
   git config --add oh-my-zsh.hide-status 1
   ```
6. Fetch only main + your own branches (skip all other remote branches)
   ```sh
   git config --add remote.origin.tagOpt --no-tags
   git config --unset-all remote.origin.fetch
   git config --add remote.origin.fetch +refs/heads/main:refs/remotes/origin/main
   git config --add remote.origin.fetch "+refs/heads/${UBER_LDAP_UID}/*:refs/remotes/origin/${UBER_LDAP_UID}/*"
   ```
7. Enable filesystem monitor and large-repo optimisations
   ```sh
   git config core.fsmonitor true
   git config feature.manyFiles true
   ```
8. Start background maintenance
   ```sh
   git maintenance start
   git config maintenance.strategy geometric
   ```
