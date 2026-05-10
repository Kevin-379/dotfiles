oh-my-posh init fish --config /opt/homebrew/opt/oh-my-posh/themes/robbyrussell.omp.json | source

direnv hook fish | source

set -gx EDITOR nvim
# Use fd for fzf default command
set -gx FZF_DEFAULT_COMMAND 'fd --type f --hidden --exclude .git'

# Also use fd for CTRL-T (file search)
set -gx FZF_CTRL_T_COMMAND "$FZF_DEFAULT_COMMAND"

fish_add_path /opt/homebrew/bin
fish_add_path /opt/homebrew/sbin
fish_add_path /opt/uber/bin
fish_add_path /opt/uber/uber-devpod-cli
fish_add_path /Applications/Docker.app/Contents/Resources/bin/
fish_add_path $HOME/.ghcup/bin
fish_add_path $HOME/.local/bin
fish_add_path /Users/skevin/flutter
fish_add_path /Users/skevin/flutter/bin
fish_add_path '/Applications/Sublime Text.app/Contents/SharedSupport/bin'

set -Ux PYENV_ROOT $HOME/.pyenv
set -U fish_user_paths $PYENV_ROOT/bin $fish_user_paths
pyenv init - fish | source

export UBER_LDAP_UID=skevin
export UBER_OWNER=skevin@uber.com
export UBER_HOME=\"\$HOME/Uber\"
export JAVA_HOME="$(/usr/libexec/java_home -v11 -aarm64)"
export ANDROID_HOME=$HOME/android-sdk
export ANDROID_NDK=$HOME/android-ndk
export ANDROID_NDK_HOME=$HOME/android-ndk

export PI_CACHE_RETENTION="long"

alias cc "aifx agent run claude --dangerously-skip-permissions"

#function notify
#    if $argv
#        osascript -e 'display notification "Task Complete" with title "Task Status" sound name "Submarine"'
#    else
#        osascript -e 'display notification "Task Failed" with title "Task Status" sound name "Sosumi"'
#    end
#end
alias notify "and osascript -e 'display notification \"Task Complete\" with title \"Task Status\" sound name \"Submarine\"'; or osascript -e 'display notification \"Task Failed\" with title \"Task Status\" sound name \"Sosumi\"'"
#alias notify "osascript -e 'display notification \"Task Complete\" with title \"Task Status\" sound name \"Submarine\"' || osascript -e 'display notification \"Task Complete\" with title \"Task Failed\" sound name \"Sosumi\"'"

alias gs "git status"
alias gl "git log"
alias gd "git diff"
alias grim "git rebase -i main --update-refs"
alias grc "git rebase --continue"
alias gra "git rebase --abort"
alias gsm "git switch main"
alias gbr "git-bzl -v refresh; notify"
alias gca "git add . && git commit --amend --no-edit"
alias grh "git rev-parse HEAD"
alias gpf "git push -f origin (git branch --show-current)"

alias bbm "bazel build //src/code.uber.internal/rider/presentation/micromobility/rider-presentation/... //src/code.uber.internal/rider/product/micromobility/...; notify"
alias btm "bazel test //src/code.uber.internal/rider/presentation/micromobility/rider-presentation/... //src/code.uber.internal/rider/product/micromobility/...; notify"
alias bterp "bazel test //src/code.uber.internal/rider/presentation/micromobility/rider-presentation/...; notify"
alias gzm "gazelle src/code.uber.internal/rider/presentation/micromobility/rider-presentation src/code.uber.internal/rider/product/micromobility"
alias gzerp "gazelle src/code.uber.internal/rider/presentation/micromobility/rider-presentation"
alias mbe "./monorepo build //apps/iphone-helix/src/Uber/Modules/Optional/EMobility:EMobility; notify"
alias mte "./monorepo test //apps/iphone-helix/src/Uber/Modules/Optional/EMobility:EMobilityTests //libraries/feature/EMobility/EMobilityShared:EMobilitySharedTests; notify"
alias nukemonorepocache "./xcode clean && rm -rf /opt/uber/ios-devex/bazel.noindex/cache/ && ./bazelw clean --expunge"

function myssh -d "Create cmux ssh workspace and tmux session with same name"
    if test (count $argv) -ge 2
        set -f destination $argv[1]
        set -f name $argv[2]
    else if test (count $argv) -eq 1
        set -f destination "skevin.devpod-ind"
        set -f name $argv[1]
    else
        set -f destination "skevin.devpod-ind"
        set -f name "main"
    end

    cmux ssh $destination --name $name -- -t tmux new -A -s $name
end

if status is-interactive
    # Commands to run in interactive sessions can go here
end


# BEGIN opam configuration
# This is useful if you're using opam as it adds:
#   - the correct directories to the PATH
#   - auto-completion for the opam binary
# This section can be safely removed at any time if needed.
test -r '/Users/skevin/.opam/opam-init/init.fish' && source '/Users/skevin/.opam/opam-init/init.fish' > /dev/null 2> /dev/null; or true
# END opam configuration

# opencode
fish_add_path /Users/skevin/.opencode/bin

# Bypass Uber's `unpm` user-agent placeholder bug that breaks electron-forge's
# package-manager detection (`Could not check npm version "{npm-version}"`).
# Setting NODE_INSTALLER tells electron-forge to spawn `pnpm --version`
# directly instead of parsing the corrupted `npm_config_user_agent` env var.
# Required for `pnpm start` / `make start` in uTerm and any other
# electron-forge project run from this shell.
set -gx NODE_INSTALLER pnpm
