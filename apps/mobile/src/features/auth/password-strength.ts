/** How the Create account screen rates a new password while it is typed. The server only requires 8–64 characters. */
export type PasswordStrength = "empty" | "too-short" | "weak" | "fair" | "strong";

export const passwordLimits = { min: 8, max: 64 } as const;

/**
 * Length counts most; mixing letter case, digits and symbols adds a little. A password of the same character repeated
 * or a plain sequence stays weak at any length.
 */
export function passwordStrength(password: string): PasswordStrength {
	if (!password) return "empty";
	if (password.length < passwordLimits.min) return "too-short";
	if (/^(.)\1+$/.test(password) || "0123456789abcdefghijklmnopqrstuvwxyz".includes(password.toLowerCase()))
		return "weak";
	const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((kind) => kind.test(password)).length;
	const score = (password.length >= 12 ? 2 : password.length >= 10 ? 1 : 0) + (kinds >= 3 ? 2 : kinds === 2 ? 1 : 0);
	return score >= 3 ? "strong" : score >= 2 ? "fair" : "weak";
}
