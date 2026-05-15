1. Install Arc browser / Zen browser
	1. Add uBlock Origin extension
2. Install AlDente
3. Install Stats
4. Install Ghostty / cmux
5. Enable Touch ID for sudo
	1. Add `auth sufficient pam_tid.so` as the first line in `/etc/pam.d/sudo`
6. Install clipboard manager (Maccy)
7. Install Homebrew
	1. `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`
8. Install packages with Homebrew
	1. `brew install fish fisher jandedobbeleer/oh-my-posh/oh-my-posh tmux direnv thefuck bat dust fd ripgrep fzf tlrc wget neovim`
	2. `brew install --cask ghostty raycast maccy vlc localsend scroll-reverser docker-desktop`
9. Install fish and set as default shell
	1. `echo /opt/homebrew/bin/fish | sudo tee -a /etc/shells`
	2. `chsh -s /opt/homebrew/bin/fish`
10. Clone dotfiles and run install script
	1. `git clone <remote-url> ~/dotfiles`
	2. `bash ~/dotfiles/install.sh`
11. Install fisher plugins
	1. `fish -c 'fisher update'`
12. Install Spotify
	1. Patch with SpotX: https://github.com/SpotX-Official/SpotX
13. Install tmux plugins
	1. Open tmux and press `prefix + I` (Ctrl-a + I)
14. Ghostty SSH terminfo for remote hosts
	1. `infocmp -x xterm-ghostty | ssh <host> -- tic -x -`
15. Install pi coding agent
	1. `npm install -g @earendil-works/pi-coding-agent`
16. Install vim-motions-pi globally
	1. `npm install -g vim-motions-pi`
17. Clone pi-powerline-footer fork
	1. `git clone https://github.com/Kevin-379/pi-powerline-footer.git ~/Personal/pi-powerline-footer`
	2. `cd ~/Personal/pi-powerline-footer && git checkout personal`
	3. Add upstream: `git remote add upstream https://github.com/nicobailon/pi-powerline-footer.git`
## Tools
1. rg
2. fzf
3. fd
4. dust
5. bat
6. btop
7. tldr
8. tmux
