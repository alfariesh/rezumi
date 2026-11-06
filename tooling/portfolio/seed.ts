/**
 * Gives one local account the Lugas persona's portfolio, published, so the public page can be checked before the
 * editor exists (Phase 03): a resume with the persona's career, the portfolio with works, metrics, services,
 * testimonials and clients, and the mockup's pictures stored as the account's uploads.
 *
 *   pnpm portfolio:seed --email you@example.test [--minimal] [--unpublish]
 *
 * It replaces that account's portfolio and its "Portfolio persona" resume, and refuses any database that isn't on this
 * machine. Sign up through the app first and make the account an admin when `PORTFOLIO_MODE=admins`; the seed never
 * creates accounts or changes roles. Pictures go to local storage (`STORAGE_BACKEND=local`).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Pool } from "pg";
import sharp from "sharp";
import { parsePortfolioData, parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { generateId } from "@rezumi/utils/string";
import { MOCKUP_IMAGES, minimalPortfolio, PERSONA_FILES, personaPortfolio, personaResume } from "./persona";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const { values: args } = parseArgs({
	options: {
		email: { type: "string" },
		minimal: { type: "boolean", default: false },
		unpublish: { type: "boolean", default: false },
	},
});

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
	throw new Error("DATABASE_URL is not set. Run through `pnpm portfolio:seed`, which loads .env.local.");
if (!LOCAL_HOSTS.has(new URL(databaseUrl).hostname))
	throw new Error("Refusing to seed: DATABASE_URL must point at a database on this machine.");
if (!args.email) throw new Error("Pass the account to fill: pnpm portfolio:seed --email you@example.test");

const storageRoot = resolve(
	process.env.LOCAL_STORAGE_PATH ?? join(dirname(fileURLToPath(import.meta.url)), "../../data"),
);
const pool = new Pool({ connectionString: databaseUrl });

try {
	const { rows: users } = await pool.query<{ id: string; username: string; role: string | null }>(
		'select id, username, role from "user" where lower(email) = lower($1)',
		[args.email],
	);
	const user = users[0];
	if (!user) throw new Error(`No account with the email ${args.email}. Sign up through the app first.`);

	// The persona's picture keys name a placeholder account; these are the account's own.
	const own = (key: string) => key.replace(/^uploads\/[^/]+\//, `uploads/${user.id}/`);
	const store = async (key: string, bytes: Uint8Array) => {
		const path = join(storageRoot, ...key.split("/"));
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, bytes);
	};

	for (const file of Object.values(PERSONA_FILES)) {
		const svg = await readFile(fileURLToPath(new URL(file.file, MOCKUP_IMAGES)));
		const png = await sharp(svg, { density: 144 }).resize(file.width, file.height, { fit: "cover" }).png().toBuffer();
		const key = own(file.key);
		await store(key, png);
		await pool.query(
			`insert into portfolio_file (id, user_id, kind, key, bytes, width, height) values ($1, $2, 'image', $3, $4, $5, $6)
			 on conflict (key) do update set bytes = excluded.bytes`,
			[generateId(), user.id, key, png.byteLength, file.width, file.height],
		);
	}

	const resume = personaResume();
	const pictureKey = `uploads/${user.id}/pictures/portfolio-persona.jpg`;
	await store(pictureKey, await readFile(fileURLToPath(new URL("nadia.jpg", MOCKUP_IMAGES))));
	resume.picture.url = `/${pictureKey}`;

	await pool.query("delete from resume where user_id = $1 and name = 'Portfolio persona'", [user.id]);
	const { rows: primaries } = await pool.query("select 1 from resume where user_id = $1 and is_primary", [user.id]);
	const resumeId = generateId();
	await pool.query(
		`insert into resume (id, name, slug, data, user_id, is_public, is_primary, show_download_buttons)
		 values ($1, 'Portfolio persona', $2, $3, $4, true, $5, true)`,
		[resumeId, `portfolio-persona-${resumeId.slice(-6)}`, JSON.stringify(resume), user.id, primaries.length === 0],
	);

	const input = args.minimal ? minimalPortfolio() : personaPortfolio();
	const data = parseWritablePortfolioData(
		JSON.parse(JSON.stringify(input).replaceAll("uploads/persona-nadia/", `uploads/${user.id}/`)),
	);
	if (parsePortfolioData(data).works.items.length !== data.works.items.length)
		throw new Error("The persona's works didn't parse.");
	await pool.query("delete from portfolio where user_id = $1", [user.id]);
	await pool.query(
		`insert into portfolio (id, user_id, source_resume_id, is_public, published_at, data)
		 values ($1, $2, $3, $4, now(), $5)`,
		[generateId(), user.id, resumeId, !args.unpublish, JSON.stringify(data)],
	);

	console.log(
		`Seeded ${args.minimal ? "the minimal" : "the full"} portfolio for ${args.email} (/${user.username}), ${args.unpublish ? "unpublished" : "published"}.` +
			(user.role === "admin"
				? ""
				: " The account isn't an admin: with PORTFOLIO_MODE=admins its page still shows the resume."),
	);
} finally {
	await pool.end();
}
