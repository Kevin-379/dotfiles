/**
 * Notification Extension
 *
 * On every agent_end, fires two notifications in parallel:
 * - cmux notify (native macOS via cmux CLI, with sound from cmux settings)
 * - OSC 777 escape sequence (for terminals that support it: Ghostty, iTerm2, WezTerm)
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const TITLE = "π";
const SUBTITLE = "Done";
const NOTIFY_TIMEOUT_MS = 5000;

export default function cmuxNotifyExtension(pi: ExtensionAPI) {
	pi.on("agent_end", async () => {
		await Promise.allSettled([
			pi.exec("cmux", ["notify", "--title", TITLE, "--subtitle", SUBTITLE, "--body", ""], {
				timeout: NOTIFY_TIMEOUT_MS,
			}),
			Promise.resolve(
				process.stdout.write(`\x1b]777;notify;${TITLE};${SUBTITLE}\x07`),
			),
		]);
	});
}
