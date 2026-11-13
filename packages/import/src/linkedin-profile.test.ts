import { describe, expect, it } from "vite-plus/test";
import { linkedInProfileNotes, parseLinkedInProfile } from "./linkedin";

// A fictional person, in the shape the LinkedIn scraper returns, including the nulls and gaps it really has.
const profile = {
	publicIdentifier: "dewi-lestari-example",
	linkedinUrl: "https://www.linkedin.com/in/dewi-lestari-example",
	firstName: "Dewi",
	lastName: " Lestari ",
	headline: "Product designer at Kopi Nusantara",
	about: "I design checkout flows.\nBefore that I taught art.",
	openToWork: false,
	photo: "https://media.licdn.com/dms/image/v2/photo-800?e=1790000000&t=x",
	profilePicture: {
		url: "https://media.licdn.com/dms/image/v2/photo-800?e=1790000000&t=x",
		sizes: [
			{ url: "https://media.licdn.com/dms/image/v2/photo-100?e=1790000000&t=x", width: 100, height: 100 },
			{ url: "https://media.licdn.com/dms/image/v2/photo-400?e=1790000000&t=x", width: 400, height: 400 },
		],
	},
	websites: ["dewi.example"],
	location: { linkedinText: "Bandung, West Java, Indonesia", parsed: { text: "Bandung, Indonesia", city: "Bandung" } },
	primaryLocale: { country: "ID", language: "in" },
	industry: { name: "Design" },
	sectionTotals: { experience: 2, education: 1, skills: 3 },
	topSkills: "Figma • User Research • Prototyping",
	experience: [
		{
			position: "Product Designer",
			location: null,
			employmentType: null,
			workplaceType: null,
			companyName: "Kopi Nusantara ",
			companyLinkedinUrl: "https://www.linkedin.com/company/kopi-nusantara-example",
			duration: "2 yrs",
			description: "Redesigned checkout.\nRan weekly user tests.",
			skills: null,
			startDate: { month: "Jan", year: 2024, text: "Jan 2024" },
			endDate: { text: "Present" },
		},
		{
			position: "Art Teacher",
			location: "Bandung",
			companyName: "Sekolah Pelangi",
			description: null,
			startDate: { year: 2018, text: "2018" },
			endDate: { month: "Dec", year: 2023, text: "Dec 2023" },
		},
	],
	education: [
		{
			schoolName: "Institut Seni Contoh",
			degree: null,
			fieldOfStudy: "Visual Communication",
			grade: null,
			description: null,
			period: null,
			startDate: null,
			endDate: null,
		},
	],
	certifications: [{ title: "UX Certificate", issuedAt: "Issued Sep 2023", issuedBy: "Design School Example" }],
	projects: [
		{ title: "Checkout kit", description: "A small design system.", startDate: { year: 2024 }, endDate: null },
	],
	volunteering: [
		{
			role: "Mentor",
			organizationName: "Kelas Desain Gratis",
			cause: "Education",
			startDate: { month: "Mar", year: 2022, text: "Mar 2022" },
			endDate: { text: "Present" },
		},
	],
	publications: [
		{
			title: "Designing for slow networks",
			publishedAt: "Jurnal Desain Contoh · Sep 5, 2023",
			link: "https://example.org/p",
		},
	],
	honorsAndAwards: [{ title: "Best Teacher", issuedBy: "Kota Contoh", issuedAt: "Oct 2004", description: null }],
	languages: [
		{ name: "Indonesian", proficiency: "Native or bilingual proficiency" },
		{ name: "English", proficiency: "Professional working proficiency" },
	],
	status: 200,
};

describe("parseLinkedInProfile", () => {
	const data = parseLinkedInProfile(profile);

	it("reads the details, summary and photo", () => {
		expect(data.basics).toMatchObject({
			name: "Dewi Lestari",
			headline: "Product designer at Kopi Nusantara",
			location: "Bandung, West Java, Indonesia",
			website: { url: "https://dewi.example/", label: "" },
			email: "",
		});
		expect(data.summary.content).toBe("<p>I design checkout flows.</p><p>Before that I taught art.</p>");
		expect(data.picture.url).toContain("photo-400");
	});

	it("reads experience with month, year-only and ongoing dates, trimmed and without nulls", () => {
		const [current, earlier] = data.sections.experience.items;
		expect(current).toMatchObject({
			company: "Kopi Nusantara",
			position: "Product Designer",
			location: "",
			dates: { start: "2024-01", end: null, present: true },
			description: "<p>Redesigned checkout.</p><p>Ran weekly user tests.</p>",
			hidden: false,
		});
		expect(earlier).toMatchObject({
			company: "Sekolah Pelangi",
			location: "Bandung",
			dates: { start: "2018", end: "2023-12", present: false },
			description: "",
		});
	});

	it("reads education whose dates and degree are null", () => {
		expect(data.sections.education.items).toEqual([
			expect.objectContaining({
				school: "Institut Seni Contoh",
				degree: "",
				area: "Visual Communication",
				dates: undefined,
			}),
		]);
	});

	it("reads the other sections", () => {
		expect(data.sections.skills.items.map((skill) => skill.name)).toEqual(["Figma", "User Research", "Prototyping"]);
		expect(data.sections.languages.items).toEqual([
			expect.objectContaining({ language: "Indonesian", level: 5 }),
			expect.objectContaining({ language: "English", level: 3 }),
		]);
		expect(data.sections.certifications.items[0]).toMatchObject({
			title: "UX Certificate",
			issuer: "Design School Example",
			dates: { start: "2023-09", end: null, present: false },
		});
		expect(data.sections.projects.items[0]).toMatchObject({ name: "Checkout kit", dates: { start: "2024" } });
		expect(data.sections.volunteer.items[0]).toMatchObject({
			organization: "Kelas Desain Gratis",
			description: "<p>Mentor</p><p>Education</p>",
			dates: { start: "2022-03", present: true },
		});
		expect(data.sections.publications.items[0]).toMatchObject({
			title: "Designing for slow networks",
			publisher: "Jurnal Desain Contoh",
			dates: { start: "2023-09" },
			website: { url: "https://example.org/p" },
		});
		expect(data.sections.awards.items[0]).toMatchObject({
			title: "Best Teacher",
			awarder: "Kota Contoh",
			dates: { start: "2004-10" },
		});
		expect(data.sections.profiles.items[0]).toMatchObject({
			network: "LinkedIn",
			username: "dewi-lestari-example",
			website: { url: "https://www.linkedin.com/in/dewi-lestari-example" },
		});
	});

	it("reads a profile with only a name, and anything that isn't an object, without failing", () => {
		const bare = parseLinkedInProfile({ firstName: "Ari", lastName: null, experience: null, skills: "x" });
		expect(bare.basics.name).toBe("Ari");
		expect(bare.sections.experience.items).toEqual([]);
		expect(bare.picture.url).toBe("");
		expect(parseLinkedInProfile(null).basics.name).toBe("");
	});
});

describe("linkedInProfileNotes", () => {
	it("says when LinkedIn counts more entries than came back", () => {
		expect(linkedInProfileNotes(profile)).toEqual([]);
		expect(linkedInProfileNotes({ ...profile, sectionTotals: { experience: 9 } })).toEqual(["truncated"]);
	});

	it("says when the profile shows nothing past the name", () => {
		expect(linkedInProfileNotes({ firstName: "Ari", headline: "Engineer", sectionTotals: { experience: 4 } })).toEqual([
			"private-profile",
		]);
	});
});
