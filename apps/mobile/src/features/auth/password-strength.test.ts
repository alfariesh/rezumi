import { passwordStrength } from "./password-strength";

describe("passwordStrength", () => {
	it("rates by length first, then variety", () => {
		expect(passwordStrength("")).toBe("empty");
		expect(passwordStrength("abc123")).toBe("too-short");
		expect(passwordStrength("abcdefgh")).toBe("weak");
		expect(passwordStrength("aaaaaaaaaaaaaaaa")).toBe("weak");
		expect(passwordStrength("12345678")).toBe("weak");
		expect(passwordStrength("letters1")).toBe("weak");
		expect(passwordStrength("letters1234")).toBe("fair");
		expect(passwordStrength("Letters1234!")).toBe("strong");
		expect(passwordStrength("correct horse battery")).toBe("strong");
	});
});
