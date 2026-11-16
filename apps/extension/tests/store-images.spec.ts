import type { BrowserContext, Page, Worker } from "@playwright/test";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { localDay } from "../src/shared/follow-ups";
import { connect, server, serverIsUp, signUp } from "./account";
import { expect, serveFixture, test } from "./fixtures";

/**
 * The pictures for the store listings and the user guide (plan: .agents/docs/plans/plugin-browser, Phase 06), only with
 * `EXTENSION_STORE_IMAGES=<dir>` and a local server. A fictional person (Rina Wijaya, a product designer) saves one
 * fictional posting (a Product Designer role at Lumen Health) from a board-neutral demo page
 * (`__fixtures__/linkedin/store-demo.html`), so the extension on show is the real one and no job board's logo, colours or
 * text appear. The crops of the real panel go to `<dir>/raw/<language>/`; five 1280×800 store screenshots per language go
 * to `<dir>/<language>/`.
 */

const outputDir = process.env.EXTENSION_STORE_IMAGES;
const distAssets = fileURLToPath(new URL("../dist/assets", import.meta.url));

const board = {
	origin: "https://www.linkedin.com",
	fixture: "linkedin/store-demo.html",
	url: "https://www.linkedin.com/jobs/view/4012345678/",
};

const copy = {
	"en-US": {
		saveButton: "Save to Rezumi",
		saved: "Saved to Rezumi",
		followUp: "Follow up on",
		settings: "Settings",
		recent: "Recently saved",
		prepare: "Prepare",
		doneButton: /^Done: /,
		slides: [
			[
				"Save any job in one click",
				"A Save to Rezumi button on LinkedIn, Indeed, JobStreet and Glints. Anywhere else, use the toolbar icon.",
			],
			[
				"Check it before you save",
				"Role, company, location, salary and description are filled in for you. Change anything.",
			],
			[
				"See how well your resume fits",
				"A free keyword match with the resume you pick, and the terms it is still missing.",
			],
			["Track it and get ready", "Change the status, add notes, then tailor your resume or write a cover letter."],
			["Never miss a follow-up", "Set a reminder and see what is due, right in the side panel."],
		],
	},
	id: {
		saveButton: "Simpan ke Rezumi",
		saved: "Tersimpan di Rezumi",
		followUp: "Tindak lanjut pada",
		settings: "Pengaturan",
		recent: "Terakhir disimpan",
		prepare: "Persiapan",
		doneButton: /^Selesai: /,
		slides: [
			[
				"Simpan loker dengan satu klik",
				"Tombol Simpan ke Rezumi di LinkedIn, Indeed, JobStreet, dan Glints. Di situs lain, pakai ikon di toolbar.",
			],
			[
				"Periksa dulu sebelum menyimpan",
				"Posisi, perusahaan, lokasi, gaji, dan deskripsi terisi otomatis. Ubah sesukamu.",
			],
			[
				"Lihat seberapa cocok CV-mu",
				"Kecocokan kata kunci gratis dengan CV pilihanmu, lengkap dengan kata yang belum ada.",
			],
			["Pantau dan siapkan lamarannya", "Ubah status, tambah catatan, lalu sesuaikan CV atau tulis surat lamaran."],
			["Jangan lewatkan tindak lanjut", "Pasang pengingat dan lihat yang jatuh tempo langsung di panel samping."],
		],
	},
} as const;

async function tabIdFor(serviceWorker: Worker, url: string) {
	let id: number | undefined;
	await expect
		.poll(async () => {
			id = await serviceWorker.evaluate(async (address) => {
				const all = await chrome.storage.session.get(null);
				const entry = Object.entries(all).find(
					([key, value]) => key.startsWith("tabPage:") && (value as { url: string }).url === address,
				);
				return entry ? Number(entry[0].slice("tabPage:".length)) : undefined;
			}, url);
			return id;
		})
		.toBeDefined();
	return id as number;
}

/** The panel page, 420 CSS pixels wide like a real side panel, light. */
async function sidePanelSize(page: Page) {
	await page.setViewportSize({ width: 420, height: 1100 });
	await page.emulateMedia({ colorScheme: "light" });
}

/** A crop of the whole page, in page coordinates (scrolling doesn't matter). */
const crop = (page: Page, y: number, height: number) =>
	page.screenshot({ fullPage: true, clip: { x: 0, y, width: 420, height } });

/** The card the element sits in: its first ancestor that spans the panel's width. */
async function cardBox(page: Page, testId: string) {
	return page.getByTestId(testId).evaluate((element) => {
		let node: HTMLElement = element as HTMLElement;
		while (node.parentElement && node.getBoundingClientRect().width < window.innerWidth - 40) node = node.parentElement;
		const box = node.getBoundingClientRect();
		return { top: box.top + window.scrollY, bottom: box.bottom + window.scrollY };
	});
}

/** Stacks pictures of equal width into one (a short page for the listing, leaving out the part between). */
async function joinVertically(context: BrowserContext, parts: Buffer[]) {
	const page = await context.newPage();
	await page.setContent(
		`<body style="margin:0;background:#f6f6f6;width:420px">${parts.map((part) => `<img style="display:block;width:420px" src="${dataUri(part)}">`).join("")}</body>`,
	);
	await page.setViewportSize({ width: 420, height: 400 });
	await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode())));
	const joined = await page.screenshot({ fullPage: true });
	await page.close();
	return joined;
}

const dataUri = (buffer: Buffer) => `data:image/png;base64,${buffer.toString("base64")}`;

async function fontCss() {
	const files = await readdir(distAssets);
	const file = files.find((name) => /^google-sans-latin-wght-normal-.*\.woff2$/.test(name));
	if (!file) throw new Error("Build the extension first: no Google Sans file in dist/assets");
	const base64 = (await readFile(`${distAssets}/${file}`)).toString("base64");
	return `@font-face{font-family:"Google Sans";font-weight:100 900;src:url(data:font/woff2;base64,${base64}) format("woff2")}`;
}

type Slide = { title: string; text: string; kind: "board" | "panel"; image: Buffer };

/** One 1280×800 store screenshot: the headline on the brand blue, and the real picture on the right. */
function slideHtml(font: string, logo: string, slide: Slide) {
	const figure =
		slide.kind === "board"
			? `<div class="frame"><div class="bar"><i></i><i></i><i></i></div><img src="${dataUri(slide.image)}" /></div>`
			: `<div class="card"><img src="${dataUri(slide.image)}" /></div>`;
	return `<!doctype html><html><head><meta charset="utf-8"><style>
${font}
*{box-sizing:border-box;margin:0}
body{width:1280px;height:800px;overflow:hidden;font-family:"Google Sans","Inter",system-ui,sans-serif;color:#fff;
 background:linear-gradient(135deg,#0284fe 0%,#0366c9 55%,#0158a8 100%);display:flex;align-items:center;gap:56px;padding:0 96px}
.text{flex:1;min-width:0}
.logo{width:72px;height:72px;border-radius:18px;background:#fff;display:grid;place-items:center;margin-bottom:36px}
.logo img{width:46px;height:46px}
h1{font-size:60px;line-height:1.08;font-weight:700;letter-spacing:-0.02em;margin-bottom:22px}
p{font-size:25px;line-height:1.45;font-weight:400;opacity:.94;max-width:480px}
.card{width:400px;border-radius:26px;overflow:hidden;background:#f6f6f6;box-shadow:0 40px 80px -20px rgba(0,30,80,.55),0 0 0 1px rgba(255,255,255,.18)}
.card img{display:block;width:100%}
.frame{width:640px;border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 40px 80px -20px rgba(0,30,80,.55),0 0 0 1px rgba(255,255,255,.18)}
.bar{height:34px;background:#e9ecef;display:flex;align-items:center;gap:7px;padding:0 14px}
.bar i{width:11px;height:11px;border-radius:50%;background:#c4cad0}
.frame img{display:block;width:100%}
</style></head><body>
<div class="text"><div class="logo"><img src="${logo}" /></div><h1>${slide.title}</h1><p>${slide.text}</p></div>
${figure}
</body></html>`;
}

for (const uiLanguage of ["en-US", "id"] as const) {
	test.describe(`store pictures in ${uiLanguage}`, () => {
		test.use({ uiLanguage, pixelRatio: 2 });
		test.beforeEach(async () => {
			test.skip(!outputDir, "Set EXTENSION_STORE_IMAGES to save the pictures");
			test.skip(!(await serverIsUp()), `No Rezumi server at ${server}`);
		});

		test("five screenshots of one fictional save", async ({ context, serviceWorker, extensionId }) => {
			test.setTimeout(180_000);
			const t = copy[uiLanguage];
			const english = uiLanguage === "en-US";
			const raw = `${outputDir}/raw/${uiLanguage}`;
			const out = `${outputDir}/${uiLanguage}`;
			await mkdir(raw, { recursive: true });
			await mkdir(out, { recursive: true });

			await signUp(context);
			const panel = await context.newPage();
			await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
			if (english) {
				const consent = await connect(context, panel);
				await consent.getByRole("button", { name: "Allow access" }).click();
			} else {
				const consentWindow = context.waitForEvent("page");
				await panel.getByRole("button", { name: "Hubungkan ke Rezumi" }).click();
				const consent = await consentWindow;
				await consent.waitForURL(/\/auth\/consent/);
				await consent.getByRole("button", { name: "Allow access" }).click();
			}
			await expect(panel.getByRole("button", { name: t.settings })).toBeVisible();

			// The resume to compare: the summary names most of what the posting asks for, not all of it.
			const resume = await context.request.post(`${server}/api/openapi/resumes`, {
				headers: { origin: server },
				data: { name: "Rina Wijaya — Product Designer", tags: [], withSampleData: false },
			});
			const resumeId = (await resume.json()) as string;
			await context.request.patch(`${server}/api/openapi/resumes/${resumeId}`, {
				headers: { origin: server },
				data: {
					operations: [
						{
							op: "replace",
							path: "/summary/content",
							value:
								"<p>Product designer with four years shipping web products. Strong in Figma, prototyping, user research and design systems, working closely with engineers.</p>",
						},
					],
				},
			});

			// The board page, sharp, with the real button on it.
			await serveFixture(context, board.origin, board.fixture);
			const page = await context.newPage();
			await page.setViewportSize({ width: 1280, height: 800 });
			await page.goto(board.url);
			await expect
				.poll(() =>
					page
						.locator("rezumi-save-button")
						.getAttribute("data-rezumi-state", { timeout: 5_000 })
						.catch(() => null),
				)
				.not.toBeNull();
			await page.waitForTimeout(400);
			const boardClip = { x: 190, y: 60, width: 900, height: 600 };
			const boardPicture = await page.screenshot({ clip: boardClip });
			await writeFile(`${raw}/board.png`, boardPicture);

			// The save form.
			const tabId = await tabIdFor(serviceWorker, board.url);
			await panel.goto(`chrome-extension://${extensionId}/sidepanel.html?tab=${tabId}&clean`);
			await sidePanelSize(panel);
			const save = panel.getByRole("button", { name: t.saveButton });
			await expect(save).toBeVisible();
			await expect(panel.getByTestId("match-percent")).toBeVisible();
			await panel.getByLabel(t.followUp).fill(localDay());
			await panel.mouse.move(0, 0);
			await panel.waitForTimeout(500);
			const matchTop = (await cardBox(panel, "match-percent")).top;
			const form = await crop(panel, 0, Math.max(300, matchTop - 14));
			const match = await crop(panel, Math.max(0, matchTop - 14), 440);
			await writeFile(`${raw}/form.png`, form);
			await writeFile(`${raw}/match.png`, match);

			// Saved: the status, the match, the preparation buttons.
			await save.click();
			await expect(panel.getByText(t.saved, { exact: true })).toBeVisible();
			await expect(panel.getByTestId("match-percent")).toBeVisible();
			await panel.mouse.move(0, 0);
			await panel.waitForTimeout(600);
			// The status and the match, then the preparation buttons: the AI score card between them is left out.
			const prepareTop = await panel
				.getByText(t.prepare, { exact: true })
				.evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
			const header = await crop(panel, 0, 112);
			const savedMatchTop = (await cardBox(panel, "match-percent")).top;
			const status = await crop(panel, 112, savedMatchTop - 112 - 8);
			const prepare = await crop(panel, prepareTop - 14, 168);
			const saved = await joinVertically(context, [header, status, prepare]);
			await writeFile(`${raw}/saved.png`, saved);

			// The chip on the board.
			await expect
				.poll(() => page.locator("rezumi-save-button").getAttribute("data-rezumi-state"))
				.not.toBe(t.saveButton);
			await page.waitForTimeout(500);
			await writeFile(`${raw}/board-saved.png`, await page.screenshot({ clip: boardClip }));

			// Home: the reminder due today (the panel shows it when the tab isn't a posting).
			await page.close();
			await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
			await sidePanelSize(panel);
			await expect(panel.getByText(t.recent)).toBeVisible();
			await expect(panel.getByRole("button", { name: t.doneButton })).toBeVisible();
			await panel.mouse.move(0, 0);
			await panel.waitForTimeout(500);
			const home = await crop(panel, 0, 520);
			await writeFile(`${raw}/home.png`, home);

			// Compose the five store screenshots.
			const font = await fontCss();
			const logo = `data:image/svg+xml;base64,${(await readFile(fileURLToPath(new URL("../public/icon/light.svg", import.meta.url)))).toString("base64")}`;
			const pictures: Pick<Slide, "kind" | "image">[] = [
				{ kind: "board", image: boardPicture },
				{ kind: "panel", image: form },
				{ kind: "panel", image: match },
				{ kind: "panel", image: saved },
				{ kind: "panel", image: home },
			];
			const slides: Slide[] = t.slides.map(([title, text], index) => ({
				title,
				text,
				kind: pictures[index]?.kind ?? "panel",
				image: pictures[index]?.image ?? form,
			}));
			const composer = await context.newPage();
			await composer.setViewportSize({ width: 1280, height: 800 });
			for (const [index, slide] of slides.entries()) {
				await composer.setContent(slideHtml(font, logo, slide));
				await composer.evaluate(() => document.fonts.ready);
				await composer.screenshot({ path: `${out}/screenshot-${index + 1}.png` });
			}
		});
	});
}
