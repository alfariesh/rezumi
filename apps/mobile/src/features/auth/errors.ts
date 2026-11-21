import type { I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { AuthError } from "@/auth/auth-http";
import { signInErrorMessage } from "@/auth/messages";

/** Which screen asked: the same code reads differently on sign-in and on sign-up. */
export type AuthStep = "sign-in" | "sign-up" | "two-factor" | "reset" | "social";

/**
 * The sentence a native sign-in screen shows for a failure: what happened and what to do, never a code. Unknown
 * failures fall back to "try again"; browser sign-in errors keep their own messages (`signInErrorMessage`).
 */
export function authErrorMessage(i18n: I18n, error: unknown, step: AuthStep): string {
	if (!(error instanceof AuthError)) return signInErrorMessage(i18n, error);
	switch (error.code) {
		case "NETWORK":
			return i18n._(msg`You're offline, or the server didn't answer. Check your connection and try again.`);
		case "TOO_MANY_REQUESTS":
			return i18n._(msg`Too many attempts. Wait a minute, then try again.`);
		case "INVALID_EMAIL_OR_PASSWORD":
		case "INVALID_PASSWORD":
		case "INVALID_EMAIL":
			return step === "sign-up"
				? i18n._(msg`Check the email address and password, then try again.`)
				: i18n._(msg`That email and password don't match. Try again, or reset your password.`);
		case "EMAIL_NOT_VERIFIED":
			return i18n._(msg`Verify your email first. We sent you a link; open it on this phone, then sign in.`);
		case "USER_ALREADY_EXISTS":
		case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
			return i18n._(msg`An account with this email already exists. Sign in instead, or reset your password.`);
		case "PASSWORD_TOO_SHORT":
			return i18n._(msg`Use at least 8 characters.`);
		case "PASSWORD_TOO_LONG":
			return i18n._(msg`Use 64 characters or fewer.`);
		case "INVALID_CODE":
		case "INVALID_TWO_FACTOR_CODE":
		case "INVALID_BACKUP_CODE":
		case "INVALID_TOTP":
			return i18n._(msg`That code didn't work. Check it and try again.`);
		case "TWO_FACTOR_EXPIRED":
		case "INVALID_TWO_FACTOR_COOKIE":
			return i18n._(msg`This sign-in took too long. Start again.`);
		case "INVALID_TOKEN":
			return step === "reset"
				? i18n._(msg`This reset link expired or was already used. Ask for a new one.`)
				: i18n._(msg`This sign-in attempt expired. Start again.`);
		case "SIGNUP_DISABLED":
		case "SIGN_UP_DISABLED":
			return i18n._(msg`New account sign-ups are turned off. Sign in with an account you already have.`);
		case "ID_TOKEN_NOT_SUPPORTED":
		case "INVALID_ID_TOKEN":
		case "PROVIDER_NOT_FOUND":
			return i18n._(msg`This sign-in option isn't available right now. Use another way to sign in.`);
		default:
			return error.status >= 500
				? i18n._(msg`Something went wrong on the server. Try again in a moment.`)
				: i18n._(msg`Couldn't sign you in. Try again.`);
	}
}
