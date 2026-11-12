/** Hands a file to the browser to save, then lets go of its memory. */
export function saveFile(blob: Blob, filename: string) {
	const href = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = href;
	link.download = filename;
	link.rel = "noopener";
	document.body.append(link);
	link.click();
	link.remove();
	// Safari reads the file after `click` returns; a moment later it's safe to release.
	setTimeout(() => URL.revokeObjectURL(href), 1000);
}
