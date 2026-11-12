import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import { describe, expect, it } from "vite-plus/test";
import { produce } from "immer";
import { parsePortfolioData, parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import {
	changeWorkSlug,
	cleanSlugHistory,
	newWork,
	resumeProjects,
	retitleWork,
	titleFromFileName,
	workRoom,
	worksFromImages,
	workSlugProblem,
} from "./works";

const empty = (): PortfolioData => parsePortfolioData({});

const picture = (name: string) => ({
	image: { key: `uploads/u1/pictures/portfolio/${name}.webp`, width: 1200, height: 800, alt: "" },
	fileName: `${name}.jpg`,
});

describe("works", () => {
	it("gives a new work its own ASCII address", () => {
		const data = produce(empty(), (draft) => {
			draft.works.items.push(newWork(draft, "Kopi Senja"));
			draft.works.items.push(newWork(draft, "Kopi Senja"));
			draft.works.items.push(newWork(draft, "Café Ümlaut"));
			draft.works.items.push(newWork(draft));
		});
		expect(data.works.items.map((work) => work.slug)).toEqual(["kopi-senja", "kopi-senja-2", "cafe-umlaut", "work"]);
		expect(() => parseWritablePortfolioData(data)).not.toThrow();
	});

	it("moves the address with the title while it's the automatic one", () => {
		const data = produce(empty(), (draft) => {
			draft.works.items.push(newWork(draft, "Draft"));
			draft.works.items.push(newWork(draft, "Kopi app"));
		});
		const renamed = produce(data, (draft) => {
			const work = draft.works.items[0];
			if (work) retitleWork(draft, work, "Kopi app");
		});
		expect(renamed.works.items[0]?.slug).toBe("kopi-app-2");

		const kept = produce(data, (draft) => {
			const work = draft.works.items[0];
			if (!work) return;
			work.slug = "chosen-address";
			retitleWork(draft, work, "Something else");
		});
		expect(kept.works.items[0]?.slug).toBe("chosen-address");
	});

	it("titles works after their files", () => {
		expect(titleFromFileName("kopi-senja_final.v2.JPG")).toBe("kopi senja final.v2");
		expect(titleFromFileName("a-very-long-name.jpg", 6)).toBe("a very");
	});

	it("counts room against the account's limit, never beyond the technical one", () => {
		const data = produce(empty(), (draft) => {
			for (let index = 0; index < 3; index++) draft.works.items.push(newWork(draft, `W${index}`));
		});
		expect(workRoom(data)).toBe(PORTFOLIO_LIMITS.works - 3);
		expect(workRoom(data, 5)).toBe(2);
		expect(workRoom(data, 2)).toBe(0);
		expect(workRoom(data, 10_000)).toBe(PORTFOLIO_LIMITS.works - 3);
		expect(worksFromImages(data, [picture("a"), picture("b"), picture("c")], "each", "", 5)).toHaveLength(2);
	});

	it("makes one work for all pictures, twelve per work at most", () => {
		const pictures = Array.from({ length: 14 }, (_, index) => picture(`p${index}`));
		const works = worksFromImages(empty(), pictures, "one", "Wedding");
		expect(works).toHaveLength(2);
		expect(works.map((work) => work.slug)).toEqual(["wedding", "wedding-2"]);
		expect(works[0]?.cover).toMatchObject({ key: pictures[0]?.image.key, alt: "Wedding" });
		expect(works[0]?.blocks[0]).toMatchObject({ type: "images", layout: "grid" });
		expect(works[0]?.blocks[0]?.type === "images" && works[0].blocks[0].images).toHaveLength(12);
	});

	it("makes one work per picture, as far as the portfolio has room", () => {
		const works = worksFromImages(empty(), [picture("sunset-01"), picture("sunset-02")], "each", "");
		expect(works.map((work) => work.title)).toEqual(["sunset 01", "sunset 02"]);
		expect(works.every((work) => work.blocks.length === 0 && work.cover)).toBe(true);

		const nearlyFull = produce(empty(), (draft) => {
			for (let index = 0; index < PORTFOLIO_LIMITS.works - 1; index++)
				draft.works.items.push(newWork(draft, `W${index}`));
		});
		expect(workRoom(nearlyFull)).toBe(1);
		expect(worksFromImages(nearlyFull, [picture("a"), picture("b")], "each", "")).toHaveLength(1);
		const data = produce(nearlyFull, (draft) => {
			draft.works.items.push(...worksFromImages(draft, [picture("a")], "each", ""));
		});
		expect(() => parseWritablePortfolioData(data)).not.toThrow();
	});

	it("offers the resume's shown projects, marking ones already in", () => {
		const resume = produce(defaultResumeData, (draft) => {
			const base = { hidden: false, period: "2024", description: "", website: { url: "", label: "" }, options: {} };
			draft.sections.projects.items = [
				{ ...base, id: "p1", name: "Kopi app" },
				{ ...base, id: "p2", name: "Hidden", hidden: true },
				{ ...base, id: "p3", name: " " },
			] as never;
		});
		const data = produce(empty(), (draft) => {
			draft.works.items.push({ ...newWork(draft, "Kopi app"), fromResumeItemId: "p1" });
		});
		expect(resumeProjects(resume, data.works.items)).toEqual([
			{ id: "p1", name: "Kopi app", period: "2024", imported: true },
		]);
		expect(resumeProjects(null, [])).toEqual([]);
	});
});

describe("work page addresses", () => {
	const twoWorks = () =>
		produce(empty(), (draft) => {
			draft.works.items.push(newWork(draft, "Kopi Senja"), newWork(draft, "Batik"));
		});

	it("keeps a saved address as an old one when it changes, newest first", () => {
		const saved = twoWorks();
		const next = produce(saved, (draft) => {
			const [work] = draft.works.items;
			if (!work) throw new Error("no work");
			changeWorkSlug(draft, work, "kopi-senja-app", saved);
		});
		expect(next.works.items[0]?.slug).toBe("kopi-senja-app");
		expect(next.works.items[0]?.previousSlugs).toEqual(["kopi-senja"]);
		expect(() => parseWritablePortfolioData(next)).not.toThrow();
	});

	it("doesn't keep the letters of a title being typed, only addresses that were saved", () => {
		const saved = twoWorks();
		const typed = produce(saved, (draft) => {
			const [work] = draft.works.items;
			if (!work) throw new Error("no work");
			retitleWork(draft, work, "Kopi Senj", saved);
			retitleWork(draft, work, "Kopi Senja App", saved);
		});
		expect(typed.works.items[0]?.slug).toBe("kopi-senja-app");
		expect(typed.works.items[0]?.previousSlugs).toEqual(["kopi-senja"]);
	});

	it("drops an old address another work now uses, and never holds more than the limit", () => {
		const saved = twoWorks();
		const next = produce(saved, (draft) => {
			const [first, second] = draft.works.items;
			if (!first || !second) throw new Error("no works");
			changeWorkSlug(draft, first, "kopi", saved);
			changeWorkSlug(draft, second, "kopi-senja", saved);
		});
		expect(next.works.items[0]?.previousSlugs).toEqual([]);
		expect(next.works.items[1]?.previousSlugs).toEqual(["batik"]);
		const many = ["a", "b", "c", "d", "e", "f", "a"];
		expect(cleanSlugHistory(many, new Set(["b"]))).toEqual(
			["a", "c", "d", "e", "f"].slice(0, PORTFOLIO_LIMITS.previousSlugs),
		);
	});

	it("says why a typed address can't be used", () => {
		const data = twoWorks();
		const id = data.works.items[0]?.id ?? "";
		expect(workSlugProblem(data, id, "kopi-senja")).toBeNull();
		expect(workSlugProblem(data, id, "batik")).toBe("taken");
		expect(workSlugProblem(data, id, "Kopi Senja")).toBe("pattern");
		expect(workSlugProblem(data, id, "kopi--senja")).toBe("pattern");
		expect(workSlugProblem(data, id, "")).toBe("pattern");
		expect(workSlugProblem(data, id, "a".repeat(65))).toBe("pattern");
	});
});
