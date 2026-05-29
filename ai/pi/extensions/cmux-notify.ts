/**
 * Notification Extension
 *
 * On every agent_end, sends a tmux-passthrough OSC 9 notification so the
 * terminal (iTerm2, WezTerm, etc.) can alert when Pi finishes a turn.
 *
 * Escape sequence: ESC P tmux; ESC ESC ] 9 ; MESSAGE BEL ESC \
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { writeFileSync } from "node:fs";

const MESSAGE = "π Done";

function notify(message: string) {
	// Tmux DCS passthrough: ESC must be doubled inside the DCS string.
	// Outer:  ESC P tmux; ... ESC \
	// Inner:  ESC ] 9 ; MESSAGE BEL
	const seq = `\x1bPtmux;\x1b\x1b]9;${message}\x07\x1b\\`;
	try {
		writeFileSync("/dev/tty", seq);
	} catch {
		// Not attached to a tty, ignore.
	}
}

export default function (pi: ExtensionAPI) {
	pi.on("agent_end", async () => {
		notify(MESSAGE);
	});
}
