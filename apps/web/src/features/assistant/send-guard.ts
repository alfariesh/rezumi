/**
 * A message the open document isn't ready for yet: the portfolio's latest changes aren't saved, say, and the assistant
 * works on the saved document. The message isn't sent; `message` says why, in the user's words.
 */
export class DocumentNotReadyError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DocumentNotReadyError";
	}
}
