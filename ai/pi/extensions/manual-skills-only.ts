import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const AUTOMATIC_SKILLS = new Set(["caveman"]);

export default function manualSkillsOnly(pi: ExtensionAPI) {
	pi.on("before_agent_start", (event) => {
		const skills = event.systemPromptOptions.skills;
		const automaticSkills = skills.filter((skill) => AUTOMATIC_SKILLS.has(skill.name));

		// Mutate structured prompt options instead of rewriting rendered prompt text.
		skills.splice(0, skills.length, ...automaticSkills);
	});
}
