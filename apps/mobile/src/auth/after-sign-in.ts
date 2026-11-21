import type { Href } from "expo-router";

// Where the app goes once a sign-in commits; the default is Home. Create account sends the new account to Check your
// email; a link opened while signed out, and signing in again after an expired session, return to their screen.
// Kept apart from session-gate.tsx so the link handler (+native-intent) can set it without loading any UI.
let afterSignIn: Href | null = null;

/** Sets the screen the next successful sign-in opens (instead of Home). Pass null to clear it after a failure. */
export function setAfterSignIn(href: Href | null): void {
	afterSignIn = href;
}

/** The screen to open after this sign-in, once; null means Home. */
export function takeAfterSignIn(): Href | null {
	const next = afterSignIn;
	afterSignIn = null;
	return next;
}
