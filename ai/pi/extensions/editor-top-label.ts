import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

// Stamps the session name (set by branch-summary) onto the right end of the
// editor's top border, same trick vim-motions-pi uses for INSERT on the
// bottom border.

export default function (pi: ExtensionAPI) {
	let timer: ReturnType<typeof setInterval> | undefined;
	// The captured ctx goes stale on session replacement; touching it after
	// that throws and kills pi (e.g. RPC hosts sending new_session).
	pi.on("session_shutdown", () => clearInterval(timer));
	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode !== "tui" || typeof ctx.ui.getEditorComponent !== "function") return;
		// Local extensions load before packages, so vim-motions-pi installs its
		// editor after this handler. Retry until a factory exists, then wrap it.
		let attempts = 0;
		timer = setInterval(() => {
			attempts++;
			if (ctx.ui.getEditorComponent()) {
				clearInterval(timer);
				wrapEditor(ctx);
			} else if (attempts >= 50) {
				clearInterval(timer);
			}
		}, 100);
	});
}

function wrapEditor(ctx: ExtensionContext): void {
	const previousFactory = ctx.ui.getEditorComponent();
	if (!previousFactory) return;

	ctx.ui.setEditorComponent((tui, theme, keybindings) => {
		const editor = previousFactory(tui, theme, keybindings);
		const originalRender = editor.render.bind(editor);
		editor.render = (width: number): string[] => {
			const lines = originalRender(width);
			const title = ctx.sessionManager.getSessionName()?.trim();
			if (!title || lines.length === 0) return lines;

			const label = ` ${title} `;
			const labelWidth = visibleWidth(label);
			if (labelWidth >= width) return lines;

			lines[0] = truncateToWidth(lines[0]!, width - labelWidth, "") + label;
			return lines;
		};
		return editor;
	});
}
