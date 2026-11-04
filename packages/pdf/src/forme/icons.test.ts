import { beforeAll, expect, it } from "vite-plus/test";
import { loadAllIcons, ResumeIcon } from "./icons";

beforeAll(loadAllIcons);

it("serializes only numeric paint, even when a colour contains markup", () => {
	const icon = ResumeIcon({ name: "call-02", color: 'rgb(0,0,0)"><script>test()</script>)' });
	expect(icon).not.toBeNull();
	expect(icon?.props.content).toContain('stroke="#000000"');
	expect(icon?.props.content).not.toContain("<script");
});

it("combines hex alpha with icon opacity", () => {
	const icon = ResumeIcon({ name: "call-02", color: "#00000080", opacity: 0.5 });
	expect(icon?.props.content).toContain(`stroke-opacity="${(128 / 255) * 0.5}"`);
});

it("draws a former Phosphor name as its closest resume icon, in the resume's style", () => {
	const standard = ResumeIcon({ name: "phone" });
	const sharp = ResumeIcon({ name: "phone", variant: "sharp" });
	expect(standard?.props.content).toBe(ResumeIcon({ name: "call-02" })?.props.content);
	expect(sharp?.props.content).not.toBe(standard?.props.content);
	expect(ResumeIcon({ name: "no-such-icon" })).toBeNull();
});
