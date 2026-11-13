import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { describe, expect, it } from "vite-plus/test";
import { MockLanguageModelV4 } from "ai/test";
import { parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { createDefaultPortfolioData } from "@rezumi/schema/portfolio/default";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { draftOutputSchema, draftPortfolio } from "./draft";
import {
	fitSentences,
	knownFacts,
	newNames,
	newNumbers,
	quoteHoldsValue,
	quoteIsIn,
	supportedSentences,
} from "./facts";
import { entriesWithNumbers, findMetricsOutputSchema, findResumeMetrics } from "./metrics";
import { rewriteField, rewriteInputSchema } from "./rewrite";
import { resumeForDraft, withoutContact } from "./source";

/** A model that answers `text` and remembers what it was asked. */
function modelAnswering(text: string) {
	const prompts: string[] = [];
	const model = new MockLanguageModelV4({
		modelId: "test",
		doGenerate: async (options) => {
			prompts.push(JSON.stringify(options.prompt));
			return {
				content: [{ type: "text", text }],
				finishReason: { unified: "stop", raw: "end_turn" },
				usage: {
					inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
					outputTokens: { total: 10, text: 10, reasoning: 0 },
				},
				warnings: [],
			};
		},
	});
	return { model, prompts };
}

function resumeOf(locale: string, description: string): ResumeData {
	const resume = structuredClone(defaultResumeData);
	resume.metadata.page.locale = locale as never;
	resume.basics.name = "Nadia Rahma";
	resume.basics.email = "nadia@contoh.test";
	resume.basics.phone = "+62 812 3456 7890";
	resume.basics.location = "Bandung";
	resume.basics.headline = "Desainer produk";
	resume.summary.content = "<p>Desainer produk di Kopi Senja selama 6 tahun.</p>";
	resume.sections.experience.items = [
		{
			id: "job-1",
			hidden: false,
			company: "Kopi Senja",
			position: "Desainer Produk",
			location: "",
			period: "2020 - 2024",
			website: { url: "", label: "", inlineLink: false },
			description,
			roles: [],
		},
		{
			id: "job-hidden",
			hidden: true,
			company: "Rahasia Corp",
			position: "Konsultan",
			location: "",
			period: "2019",
			website: { url: "", label: "", inlineLink: false },
			description: "<p>Rahasia sekali.</p>",
			roles: [],
		},
	] as never;
	return resume;
}

const indonesian = resumeOf(
	"id-ID",
	"<p>Meningkatkan konversi checkout 35% dalam 3 bulan. Hubungi nadia@contoh.test.</p>",
);

function portfolioWith(titles: string[]): PortfolioData {
	const data = createDefaultPortfolioData();
	return parseWritablePortfolioData({
		...data,
		locale: "id-ID",
		works: {
			items: titles.map((title, index) => ({
				id: `work-${index}`,
				slug: `work-${index}`,
				title,
				blocks: [{ id: `text-${index}`, type: "text", html: `<p>${title} untuk Kopi Senja.</p>` }],
			})),
		},
	});
}

describe("what AI reads", () => {
	it("leaves out how to reach the person, and what the resume hides", () => {
		const text = resumeForDraft(indonesian, portfolioWith([]));
		expect(text).toContain("Kopi Senja");
		for (const secret of ["Nadia Rahma", "nadia@contoh.test", "812", "Bandung", "Rahasia"])
			expect(text).not.toContain(secret);
	});

	it("blanks contact details written inside a description", () => {
		expect(withoutContact("Mail a.b@c.co or +62 812-3456-7890, see https://x.io/me. Cut costs 40%.")).toBe(
			"Mail [email] or [phone], see [link] Cut costs 40%.",
		);
	});
});

describe("blanking contact details", () => {
	it("catches phone numbers however they're written", () => {
		for (const phone of [
			"0812-3456-7890",
			"0812.3456.7890",
			"08123456789",
			"(021) 555 1234",
			"+62 812 3456 7890",
			"628123456789",
			"٠٨١٢٣٤٥٦٧٨٩",
		])
			expect(withoutContact(`Hubungi ${phone} ya`)).toBe("Hubungi [phone] ya");
	});

	it("catches profile links without https://", () => {
		expect(withoutContact("Lihat linkedin.com/in/budi atau wa.me/62812345")).toBe("Lihat [link] atau [link]");
	});

	it("leaves amounts and periods alone", () => {
		for (const text of [
			"Omzet Rp 1.250.000.000 setahun",
			"Bekerja 2020-2024",
			"Melayani 1200000 pengguna",
			"Naik +1.200.000 pengguna",
		])
			expect(withoutContact(text)).toBe(text);
	});
});

describe("checking AI's answer against the input", () => {
	const facts = knownFacts("Meningkatkan konversi 35% di Kopi Senja, 1.200 pengguna, 2,8 detik, sejak 2020.");

	it("recognizes a number however it's written", () => {
		expect(newNumbers("35 persen, 1,200 pengguna, 2.8 detik, ٢٠٢٠", facts)).toEqual([]);
	});

	it("finds a number the input doesn't have", () => {
		expect(newNumbers("Naik 50% untuk 35 klien", facts)).toEqual(["50"]);
	});

	it("doesn't count a place left to fill in, unless it makes a claim", () => {
		expect(newNumbers("Hasilnya [tambahkan angka]", facts)).toEqual([]);
		expect(newNumbers("Penjualan naik [sebesar 40%]", facts)).toEqual(["40"]);
	});

	it("tells a decimal from a thousands separator", () => {
		const years = knownFacts("Bekerja 1,5 tahun untuk 1.200 klien.");
		expect(newNumbers("1.5 tahun dan 1,200 klien", years)).toEqual([]);
		expect(newNumbers("15 tahun", years)).toEqual(["15"]);
		expect(newNumbers("١٢٫٥", knownFacts("12.5"))).toEqual([]);
	});

	it("splits sentences in scripts without spaces or Latin stops", () => {
		const known = knownFacts("35");
		expect(supportedSentences("你好35。世界90。再见。", known, { names: false })).toBe("你好35。再见。");
		expect(supportedSentences("राम 35 है। श्याम 90 है।", known, { names: false })).toBe("राम 35 है।");
	});

	it("finds a capitalized name the input doesn't have", () => {
		expect(newNames("Saya bekerja dengan Tokopedia di Kopi Senja.", facts)).toEqual(["Tokopedia"]);
		expect(newNames("Tokopedia bukan nama baru di awal kalimat.", facts)).toEqual([]);
	});

	it("leaves out only the sentence that isn't backed up", () => {
		expect(supportedSentences("Saya menaikkan konversi 35%. Omzet naik 90%. Tim senang.", facts, { names: true })).toBe(
			"Saya menaikkan konversi 35%. Tim senang.",
		);
	});

	it("ends a sentence that's too long at a clause, not mid-thought", () => {
		expect(fitSentences("Saya desainer. Saya juga fotografer.", 20)).toBe("Saya desainer.");
		expect(fitSentences("Saya merancang produk digital, dan saya memotret kampanye", 40)).toBe(
			"Saya merancang produk digital.",
		);
		expect(fitSentences("Saya merancang produk digital dan memotret kampanye", 20)).toBe("Saya merancang…");
	});

	it("finds a quote whatever its spacing or quote marks", () => {
		expect(quoteIsIn("naik  35%", "Konversi Naik 35% tahun ini")).toBe(true);
		expect(quoteIsIn("naik 36%", "Konversi naik 35%")).toBe(false);
	});

	it("reads a value from its sentence", () => {
		expect(quoteHoldsValue("Konversi naik 35%", 35, "percent")).toBe(true);
		expect(quoteHoldsValue("Waktu 2,8 detik", 2.8, "plain")).toBe(true);
		expect(quoteHoldsValue("Mencapai 1,2 juta pengguna", 1_200_000, "compact")).toBe(true);
		expect(quoteHoldsValue("Hemat Rp 500 juta", 500_000_000, "currency")).toBe(true);
		expect(quoteHoldsValue("Konversi naik 35%", 350, "percent")).toBe(false);
		expect(quoteHoldsValue("Tim 5 orang", 5_000, "plain")).toBe(false);
		expect(quoteHoldsValue("Melayani 500 klien", 500_000, "compact")).toBe(false);
		expect(quoteHoldsValue("Mencapai 1,2 juta pengguna", 12_000_000, "compact")).toBe(false);
		expect(quoteHoldsValue("Omzet 1,2 M", 1_200_000_000, "currency")).toBe(true);
	});
});

describe("portfolio.ai.draft", () => {
	const data = portfolioWith(["Checkout baru"]);
	const answer = (overrides: object = {}) =>
		JSON.stringify({
			greeting: "Saya mendesain produk untuk Kopi Senja.",
			about: ["Saya desainer produk.", "Saya menaikkan konversi checkout 35%."],
			works: [
				{
					id: "1",
					summary: "Checkout baru untuk Kopi Senja.",
					story: ["Saya mendesain ulang checkout. [tambahkan hasil]"],
				},
			],
			...overrides,
		});

	it("gives a greeting, About me and each work's story, as the output schema says", async () => {
		const { model } = modelAnswering(answer());
		const result = await draftPortfolio({ data, source: { data: indonesian }, model });
		expect(draftOutputSchema.parse(result)).toEqual({
			greeting: "Saya mendesain produk untuk Kopi Senja.",
			about: "<p>Saya desainer produk.</p><p>Saya menaikkan konversi checkout 35%.</p>",
			works: [
				{
					id: "work-0",
					summary: "Checkout baru untuk Kopi Senja.",
					html: "<p>Saya mendesain ulang checkout. [tambahkan hasil]</p>",
				},
			],
		});
	});

	it("names the page's language and sends no contact details", async () => {
		const { model, prompts } = modelAnswering(answer());
		await draftPortfolio({ data, source: { data: indonesian }, model, note: "Telepon saya +62 812 3456 7890" });
		const prompt = prompts[0] ?? "";
		expect(prompt).toContain("Language of the page: Indonesian");
		for (const secret of ["Nadia Rahma", "nadia@contoh.test", "812 3456"]) expect(prompt).not.toContain(secret);
	});

	it("leaves out sentences with numbers or names the input doesn't have", async () => {
		const { model } = modelAnswering(
			answer({
				greeting: "Saya bekerja untuk Gojek. Saya mendesain produk.",
				about: ["Konversi naik 90%.", "Saya desainer produk."],
			}),
		);
		const result = await draftPortfolio({ data, source: { data: indonesian }, model });
		expect(result.greeting).toBe("Saya mendesain produk.");
		expect(result.about).toBe("<p>Saya desainer produk.</p>");
	});

	it("doesn't count the works' own numbering as facts", async () => {
		const five = portfolioWith(["Satu", "Dua", "Tiga", "Empat", "Lima"]);
		const { model } = modelAnswering(answer({ greeting: "Saya punya 5 klien. Saya desainer." }));
		expect((await draftPortfolio({ data: five, source: { data: indonesian }, model })).greeting).toBe("Saya desainer.");
	});

	it("keeps places to fill in out of the greeting and the card", async () => {
		const { model } = modelAnswering(
			answer({
				greeting: "Saya mendesain produk [tambahkan hasil].",
				works: [{ id: "1", summary: "Checkout baru [tambahkan hasil].", story: ["Saya mendesain. [tambahkan hasil]"] }],
			}),
		);
		const result = await draftPortfolio({ data, source: { data: indonesian }, model });
		expect(result.greeting).toBe("Saya mendesain produk.");
		expect(result.works[0]).toMatchObject({
			summary: "Checkout baru.",
			html: "<p>Saya mendesain. [tambahkan hasil]</p>",
		});
	});

	it("reads nothing from a project whose work is hidden", async () => {
		const resume = structuredClone(indonesian);
		resume.sections.projects.items = [
			{
				id: "secret",
				hidden: false,
				name: "Proyek Rahasia",
				period: "",
				website: { url: "", label: "", inlineLink: false },
				description: "<p>Rahasia.</p>",
			},
		] as never;
		const hidden = parseWritablePortfolioData({
			...portfolioWith([]),
			works: { items: [{ id: "w", slug: "w", title: "Karya", hidden: true, fromResumeItemId: "secret" }] },
		});
		expect(resumeForDraft(resume, hidden)).not.toContain("Rahasia");
	});

	it("skips the name check when the page's language isn't the resume's", async () => {
		const english = parseWritablePortfolioData({ ...data, locale: "en-US" });
		const { model } = modelAnswering(answer({ greeting: "I design products in Germany." }));
		expect((await draftPortfolio({ data: english, source: { data: indonesian }, model })).greeting).toBe(
			"I design products in Germany.",
		);
	});

	it("escapes what the model writes, and keeps every field within its limit", async () => {
		const long = "Saya desainer produk. ".repeat(40).trim();
		const { model } = modelAnswering(
			answer({ greeting: long, works: [{ id: "1", summary: long, story: ["<b>Kopi</b> & desainer."] }] }),
		);
		const result = await draftPortfolio({ data, source: { data: indonesian }, model });
		expect(result.greeting.length).toBeLessThanOrEqual(PORTFOLIO_LIMITS.text.greeting);
		expect(result.works[0]?.summary.length).toBeLessThanOrEqual(PORTFOLIO_LIMITS.text.workSummary);
		expect(result.works[0]?.html).toBe("<p>&lt;b&gt;Kopi&lt;/b&gt; &amp; desainer.</p>");
	});

	it("ignores works it wasn't asked about", async () => {
		const { model } = modelAnswering(answer({ works: [{ id: "9", summary: "x", story: [] }] }));
		expect((await draftPortfolio({ data, source: { data: indonesian }, model })).works).toEqual([]);
	});

	it("refuses an answer with nothing usable, so its credits come back", async () => {
		const { model } = modelAnswering(answer({ greeting: "", about: [], works: [] }));
		await expect(draftPortfolio({ data, source: { data: indonesian }, model })).rejects.toMatchObject({
			code: "PORTFOLIO_AI_UNUSABLE",
		});
	});
});

describe("portfolio.ai.rewrite", () => {
	const data = portfolioWith([]);
	const rewrite = (
		text: string,
		answer: string,
		field: "about" | "greeting" = "about",
		instruction: "shorter" | "professional" = "shorter",
	) =>
		rewriteField({
			field,
			text,
			instruction,
			data,
			source: { data: indonesian },
			model: modelAnswering(JSON.stringify({ text: answer })).model,
		});

	it("keeps rich text clean", async () => {
		await expect(
			rewrite("<p>Saya mendesain aplikasi seluler.</p>", '<p onclick="x">Saya <b>mendesain</b>.</p><script>x</script>'),
		).resolves.toEqual({ text: "<p>Saya <strong>mendesain</strong>.</p>" });
	});

	it("refuses a shorter version that isn't shorter", async () => {
		await expect(rewrite("<p>Saya desainer.</p>", "<p>Saya seorang desainer.</p>")).rejects.toMatchObject({
			code: "PORTFOLIO_AI_UNUSABLE",
		});
	});

	it("refuses an answer with a new number or link", async () => {
		await expect(rewrite("<p>Omzet kami naik 35%.</p>", "<p>Naik 90%.</p>")).rejects.toMatchObject({
			code: "PORTFOLIO_AI_UNUSABLE",
		});
		await expect(
			rewrite('<p><a href="https://a.test">Situs saya</a></p>', '<p><a href="https://b.test">Situs</a></p>'),
		).rejects.toMatchObject({ code: "PORTFOLIO_AI_UNUSABLE" });
	});

	it("refuses a plain field past its limit, rather than cutting what was written", async () => {
		await expect(
			rewrite("Saya desainer.", "Saya desainer produk. ".repeat(30), "greeting", "professional"),
		).rejects.toMatchObject({ code: "PORTFOLIO_AI_UNUSABLE" });
	});

	it("refuses a new name, except when translating", async () => {
		await expect(
			rewrite("<p>Saya membuat halaman.</p>", "<p>Saya membuat halaman Tokopedia.</p>", "about", "professional"),
		).rejects.toMatchObject({ code: "PORTFOLIO_AI_UNUSABLE" });
	});

	it("sends marks instead of contact details, and puts them back", async () => {
		const { model, prompts } = modelAnswering(JSON.stringify({ text: "Saya desainer, tulis ke {{1}}." }));
		const result = await rewriteField({
			field: "greeting",
			text: "Saya seorang desainer, silakan tulis ke budi@contoh.test.",
			instruction: "shorter",
			data,
			source: { data: indonesian },
			model,
		});
		expect(prompts[0]).not.toContain("budi@contoh.test");
		expect(result.text).toBe("Saya desainer, tulis ke budi@contoh.test.");
	});

	it("refuses text longer than its field, and fields AI may not touch", () => {
		const text = "x".repeat(PORTFOLIO_LIMITS.text.greeting + 1);
		expect(rewriteInputSchema.safeParse({ field: "greeting", text, instruction: "shorter" }).success).toBe(false);
		expect(rewriteInputSchema.safeParse({ field: "testimonial", text: "x", instruction: "shorter" }).success).toBe(
			false,
		);
	});
});

describe("portfolio.ai.findMetrics", () => {
	const data = portfolioWith([]);
	const resume = resumeOf(
		"id-ID",
		"<p>Meningkatkan konversi checkout 35% dalam 3 bulan.</p><p>Melayani 1,2 juta pengguna.</p>",
	);
	const entries = entriesWithNumbers(resume, data);
	const metric = (overrides: object) => ({
		label: "Konversi checkout",
		value: 35,
		format: "percent",
		currency: null,
		unit: null,
		prefix: "+",
		suffix: "",
		quote: "Meningkatkan konversi checkout 35% dalam 3 bulan.",
		...overrides,
	});
	const find = (metrics: object[]) =>
		findResumeMetrics(
			{ data, source: { data: resume }, model: modelAnswering(JSON.stringify({ metrics })).model },
			entries,
		);

	it("gives each metric with the sentence it came from, which holds its number", async () => {
		const result = await find([
			metric({}),
			metric({
				label: "Pengguna",
				value: 1_200_000,
				format: "compact",
				prefix: "",
				quote: "Melayani 1,2 juta pengguna.",
			}),
		]);
		expect(findMetricsOutputSchema.parse(result).candidates).toHaveLength(2);
		expect(result.candidates[0]).toEqual({
			metric: { label: "Konversi checkout", value: { kind: "number", number: 35 }, format: "percent", prefix: "+" },
			quote: "Meningkatkan konversi checkout 35% dalam 3 bulan.",
			source: "Desainer Produk · Kopi Senja",
		});
		for (const candidate of result.candidates)
			expect(quoteHoldsValue(candidate.quote, candidate.metric.value.number, candidate.metric.format)).toBe(true);
	});

	it("keeps a suffix that sticks to the number, not a word", async () => {
		const [plus, word] = (
			await find([
				metric({ label: "A", format: "plain", suffix: "+" }),
				metric({ label: "B", format: "plain", suffix: "merchant" }),
			])
		).candidates;
		expect(plus?.metric.suffix).toBe("+");
		expect(word?.metric.suffix).toBeUndefined();
	});

	it("draws a sign once and leaves the unit to the format", async () => {
		const [negative, percent, rupiah, symbol] = (
			await find([
				metric({ label: "A", value: -35, prefix: "-" }),
				metric({ label: "B", suffix: "%" }),
				metric({ label: "C", format: "plain", prefix: "€" }),
				metric({ label: "D", format: "percent", prefix: "Rp" }),
			])
		).candidates;
		expect(negative?.metric).toMatchObject({ value: { number: 35 }, prefix: "-" });
		expect(percent?.metric.suffix).toBeUndefined();
		expect(rupiah?.metric.prefix).toBe("€");
		expect(symbol?.metric.prefix).toBeUndefined();
	});

	it("leaves out a metric whose quote isn't in the resume", async () => {
		expect((await find([metric({ quote: "Meningkatkan omzet 35% dalam 3 bulan." })])).candidates).toEqual([]);
	});

	it("leaves out a metric whose number isn't in its quote", async () => {
		expect((await find([metric({ value: 60 })])).candidates).toEqual([]);
	});

	it("leaves out a currency without its currency, and repeats", async () => {
		expect((await find([metric({ format: "currency" })])).candidates).toEqual([]);
		expect((await find([metric({}), metric({})])).candidates).toHaveLength(1);
	});

	it("asks nothing about a resume with no numbers", () => {
		expect(entriesWithNumbers(resumeOf("id-ID", "<p>Mendesain aplikasi.</p>"), data)).toEqual([]);
	});
});
