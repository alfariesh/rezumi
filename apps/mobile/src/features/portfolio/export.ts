import { t } from "@lingui/core/macro";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

export async function sharePortfolioFile(name: string, data: string, mimeType: "text/csv" | "image/png") {
	if (!(await Sharing.isAvailableAsync())) throw new Error(t`File sharing is unavailable on this device.`);
	const prefix = "portfolio-export-";
	const created = Date.now();
	for (const entry of Paths.cache.list()) {
		if (!(entry instanceof Directory) || !entry.name.startsWith(prefix)) continue;
		const savedAt = Number(entry.name.slice(prefix.length));
		if (!Number.isSafeInteger(savedAt) || savedAt <= 0 || created - savedAt < 24 * 60 * 60 * 1000) continue;
		try {
			entry.delete();
		} catch {
			/* An old export may still be in use. */
		}
	}
	const directory = new Directory(Paths.cache, `${prefix}${created}`);
	directory.create({ idempotent: true });
	const file = new File(directory, name);
	file.write(data, mimeType === "image/png" ? { encoding: "base64" } : undefined);
	await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: t`Save or share file` });
}
