import { readFile } from "node:fs/promises";
import { expect, it } from "vite-plus/test";
import { PORTFOLIO_SOURCE_MESSAGES } from "@rezumi/portfolio/messages";

/** The messages `page-text.ts` declares, as Lingui extracts them: `${name}` becomes `{name}`. */
async function declaredMessages(): Promise<string[]> {
	const source = await readFile(new URL("./page-text.ts", import.meta.url), "utf8");
	return [...source.matchAll(/\bmsg`([^`]*)`|\bmessage:\s*`([^`]*)`/g)].map((match) =>
		(match[1] ?? match[2] ?? "").replace(/\$\{(\w+)\}/g, "{$1}"),
	);
}

it("declares exactly the portfolio page's interface text for translators", async () => {
	const declared = await declaredMessages();
	expect(new Set(declared).size, "A message is declared twice.").toBe(declared.length);
	expect([...declared].sort()).toEqual([...PORTFOLIO_SOURCE_MESSAGES].sort());
});
