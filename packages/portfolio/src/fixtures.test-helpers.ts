import type { ProjectItem, ResumeData } from "@rezumi/schema/resume/data";
import { defaultResumeData } from "@rezumi/schema/resume/default";

/** A fictional resume for portfolio tests. */
export function testResume(): ResumeData {
	const data = structuredClone(defaultResumeData);
	data.basics = {
		...data.basics,
		name: "Nadia Rahmawati",
		headline: "Product Designer",
		email: "nadia@example.test",
		phone: "+62 812 0000 0000",
		location: "Bandung, Indonesia",
		website: { url: "https://nadia.example.test", label: "nadia.example.test" },
	};
	data.picture.url = "/uploads/user-1/pictures/formal.webp";
	data.summary.content = '<p>I design <strong style="color:red">calm</strong> apps.</p>';
	data.metadata.design.colors.primary = "rgba(15, 118, 110, 1)";
	data.metadata.page.locale = "id-ID";
	data.metadata.typography.heading.fontFamily = "Lora";
	data.metadata.typography.body.fontFamily = "Figtree";
	data.sections.projects.items = [
		project(
			"p1",
			"Aplikasi Kopi",
			"<p>Redesigned ordering for a coffee chain.</p>",
			"https://behance.example.test/kopi",
		),
		project("p2", "Hidden one", "<p>Not for the portfolio.</p>", "", true),
		project("p3", "", "", ""),
	];
	data.sections.experience.items = [
		{
			id: "e1",
			hidden: false,
			company: "Tokopedia",
			position: "Product Designer",
			location: "Jakarta",
			period: "2021 – now",
			website: { url: "", label: "", inlineLink: false },
			description: "<p>Checkout.</p>",
			roles: [],
		},
		{
			id: "e2",
			hidden: true,
			company: "Hidden Co",
			position: "Intern",
			location: "",
			period: "2019",
			website: { url: "", label: "", inlineLink: false },
			description: "",
			roles: [],
		},
		{
			id: "e3",
			hidden: false,
			company: "Startup",
			position: "Designer",
			location: "",
			period: "2020",
			website: { url: "", label: "", inlineLink: false },
			description: "",
			roles: [],
		},
	] as ResumeData["sections"]["experience"]["items"];
	data.sections.profiles.items = [
		{
			id: "pr1",
			hidden: false,
			icon: "linkedin-02",
			iconColor: "",
			network: "LinkedIn",
			username: "nadia",
			website: { url: "https://linkedin.example.test/in/nadia", label: "", inlineLink: false },
		},
	];
	data.sections.references.items = [
		{
			id: "r1",
			hidden: false,
			name: "Someone Else",
			position: "Manager",
			phone: "+62 800",
			website: { url: "", label: "", inlineLink: false },
			description: "<p>Call me.</p>",
		},
	] as ResumeData["sections"]["references"]["items"];
	return data;
}

function project(id: string, name: string, description: string, url: string, hidden = false): ProjectItem {
	return { id, hidden, name, period: "2024", website: { url, label: "", inlineLink: false }, description };
}
