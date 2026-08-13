import {
	formatSkillsForPrompt,
	type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";

export default function manualSkillsOnly(pi: ExtensionAPI) {
	pi.on("before_agent_start", (event) => {
		const skills = event.systemPromptOptions.skills ?? [];
		const skillPrompt = formatSkillsForPrompt(skills);
		if (!skillPrompt) return;

		const cavemanPrompt = formatSkillsForPrompt(
			skills.filter((skill) => skill.name === "caveman"),
		);
		return {
			systemPrompt: event.systemPrompt.replace(skillPrompt, cavemanPrompt),
		};
	});
}
