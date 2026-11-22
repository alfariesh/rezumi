// Export file names, shared by the web and the native app so a download is named the same way on both.

// Characters Windows and macOS won't take in a file name.
const UNSAFE_FILE_NAME_CHARACTERS = /[\\/:*?"<>|]/g;

/** A file name as the user typed it, minus the characters file systems reject. */
export const sanitizeFileName = (value: string) => value.replace(UNSAFE_FILE_NAME_CHARACTERS, "").trim();

/** What a default file name is built from: the person's name on the document, else the document's own name. */
export type FileNameSource = {
	name: string;
	slug?: string | undefined;
	data: { basics: { name: string } };
};

/**
 * "First-Last-Resume" (or "First-Last-Cover-Letter"): recruiters see this name. Without a person's name it falls back
 * to the document's name (or slug).
 */
export function getDefaultFileName(document: FileNameSource, target: "resume" | "cover-letter" = "resume") {
	const words = (text: string) => sanitizeFileName(text).split(/\s+/).filter(Boolean);
	const person = words(document.data.basics.name);
	const suffix = target === "cover-letter" ? ["Cover", "Letter"] : ["Resume"];
	if (person.length > 0) return [...person, ...suffix].join("-");
	return (
		[...words(document.name || (document.slug ?? "")), ...(target === "cover-letter" ? suffix : [])].join("-") ||
		"Resume"
	);
}
