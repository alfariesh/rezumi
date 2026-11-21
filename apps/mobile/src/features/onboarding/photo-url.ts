/** An upload's address is relative to its server (`/uploads/...`); a source's photo is already absolute. */
export const photoUrl = (server: string, url: string) => (url.startsWith("/") ? `${server}${url}` : url);

/** "AP" for "Ayu Pratiwi": the avatar's fallback. */
export const initialsOf = (name: string) =>
	name
		.trim()
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part.charAt(0).toUpperCase())
		.join("");
