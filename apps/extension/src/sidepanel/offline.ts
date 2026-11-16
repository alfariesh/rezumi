/** The browser is offline, or a token refresh could not reach Rezumi. */
export class OfflineError extends Error {
	constructor() {
		super("Offline");
		this.name = "OfflineError";
	}
}
