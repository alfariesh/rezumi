// The native sign-in screens (plans/mobile Phase 04): validation, the human error sentences, two-step verification,
// the Welcome options a server offers, and the reset link. The sign-in engine is replaced; the screens are real.
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { CreateAccountScreen } from "./create-account-screen";
import { EmailSignInScreen } from "./email-sign-in-screen";
import { ForgotPasswordScreen } from "./forgot-password-screen";
import { ResetPasswordScreen } from "./reset-password-screen";
import { TwoFactorScreen } from "./two-factor-screen";
import { WelcomeScreen } from "./welcome-screen";
import { AuthError } from "@/auth/auth-http";
import { renderScreen } from "@/test/render-screen";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockEngine = {
	signInWithEmail: jest.fn(),
	signUpWithEmail: jest.fn(),
	verifyTwoFactor: jest.fn(),
	hasPendingTwoFactor: jest.fn(() => true),
	requestPasswordReset: jest.fn(),
	resetPassword: jest.fn(),
	signInAsGuest: jest.fn(),
	signInWithIdToken: jest.fn(),
};
const mockServer = {
	flags: { disableSignups: false, disableEmailAuth: false, allowGuestLogin: false },
	providers: { credential: "Password", passkey: "Passkey" } as Record<string, string>,
	native: { apple: false, google: null } as unknown,
};
const mockSetAfterSignIn = jest.fn();

jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn(), canGoBack: () => false }),
}));
// Delegates, because jest.mock factories run before this file's constants exist.
jest.mock("@/auth/native-sign-in", () =>
	Object.fromEntries(
		[
			"signInWithEmail",
			"signUpWithEmail",
			"verifyTwoFactor",
			"hasPendingTwoFactor",
			"requestPasswordReset",
			"resetPassword",
			"signInAsGuest",
			"signInWithIdToken",
		].map((name) => [name, (...args: unknown[]) => (mockEngine as Record<string, jest.Mock>)[name]?.(...args)]),
	),
);
jest.mock("@/auth/after-sign-in", () => ({ setAfterSignIn: (href: unknown) => mockSetAfterSignIn(href) }));
jest.mock("@/auth/session", () => ({ signIn: jest.fn(), getServer: () => "https://rezumi.app" }));
jest.mock("@/auth/apple", () => ({ getAppleIdToken: jest.fn() }));
jest.mock("@/auth/google", () => ({ canUseGoogle: (ids: unknown) => !!ids, getGoogleIdToken: jest.fn() }));
jest.mock("./use-auth-server", () => ({
	useAuthServer: () => ({
		server: "https://rezumi.app",
		flags: { data: mockServer.flags },
		options: { data: { providers: mockServer.providers, native: mockServer.native }, isPending: false },
	}),
}));

beforeEach(() => {
	jest.clearAllMocks();
	mockServer.flags = { disableSignups: false, disableEmailAuth: false, allowGuestLogin: false };
	mockServer.providers = { credential: "Password", passkey: "Passkey" };
	mockServer.native = { apple: false, google: null };
	mockEngine.hasPendingTwoFactor.mockReturnValue(true);
});

describe("Sign in with email", () => {
	it("validates before sending, then shows the server's answer as a sentence", async () => {
		await renderScreen(<EmailSignInScreen />);
		await fireEvent.press(screen.getByTestId("sign-in-submit"));
		expect(screen.getByText("Enter an email like name@example.com.")).toBeOnTheScreen();
		expect(mockEngine.signInWithEmail).not.toHaveBeenCalled();

		mockEngine.signInWithEmail.mockRejectedValueOnce(new AuthError("INVALID_EMAIL_OR_PASSWORD", 401));
		await fireEvent.changeText(screen.getByTestId("email"), " Ana@Example.com ");
		await fireEvent.changeText(screen.getByTestId("password"), "wrong-password");
		await fireEvent.press(screen.getByTestId("sign-in-submit"));
		expect(mockEngine.signInWithEmail).toHaveBeenCalledWith("https://rezumi.app", "ana@example.com", "wrong-password");
		expect(
			await screen.findByText("That email and password don't match. Try again, or reset your password."),
		).toBeOnTheScreen();
	});

	it.each([
		[new AuthError("TOO_MANY_REQUESTS", 429), "Too many attempts. Wait a minute, then try again."],
		[new AuthError("NETWORK", 0), "You're offline, or the server didn't answer. Check your connection and try again."],
	])("explains %s", async (error, message) => {
		mockEngine.signInWithEmail.mockRejectedValueOnce(error);
		await renderScreen(<EmailSignInScreen email="ana@example.com" />);
		await fireEvent.changeText(screen.getByTestId("password"), "secret-password");
		await fireEvent.press(screen.getByTestId("sign-in-submit"));
		expect(await screen.findByText(message)).toBeOnTheScreen();
	});

	it("continues to two-step verification", async () => {
		mockEngine.signInWithEmail.mockResolvedValueOnce({ status: "two-factor" });
		await renderScreen(<EmailSignInScreen email="ana@example.com" />);
		await fireEvent.changeText(screen.getByTestId("password"), "secret-password");
		await fireEvent.press(screen.getByTestId("sign-in-submit"));
		await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/two-factor"));
	});
});

describe("Create account", () => {
	it("checks every field, rates the password and opens Check your email after sign-up", async () => {
		await renderScreen(<CreateAccountScreen />);
		await fireEvent.press(screen.getByTestId("create-account-submit"));
		expect(screen.getByText("Enter your name.")).toBeOnTheScreen();
		expect(screen.getByText("Use at least 8 characters.")).toBeOnTheScreen();
		expect(mockEngine.signUpWithEmail).not.toHaveBeenCalled();

		mockEngine.signUpWithEmail.mockResolvedValueOnce({ status: "signed-in" });
		await fireEvent.changeText(screen.getByTestId("name"), "Ana Putri");
		await fireEvent.changeText(screen.getByTestId("email"), "Ana@example.com");
		await fireEvent.changeText(screen.getByTestId("password"), "Letters1234!");
		expect(screen.getByText("Password strength: Strong")).toBeOnTheScreen();
		await fireEvent.press(screen.getByTestId("create-account-submit"));
		expect(mockSetAfterSignIn).toHaveBeenCalledWith("/check-email?email=ana%40example.com");
		expect(mockEngine.signUpWithEmail).toHaveBeenCalledWith("https://rezumi.app", {
			name: "Ana Putri",
			email: "ana@example.com",
			password: "Letters1234!",
		});
	});

	it("points an existing address to sign in and clears the destination", async () => {
		mockEngine.signUpWithEmail.mockRejectedValueOnce(new AuthError("USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", 422));
		await renderScreen(<CreateAccountScreen />);
		await fireEvent.changeText(screen.getByTestId("name"), "Ana");
		await fireEvent.changeText(screen.getByTestId("email"), "ana@example.com");
		await fireEvent.changeText(screen.getByTestId("password"), "long-enough-password");
		await fireEvent.press(screen.getByTestId("create-account-submit"));
		expect(
			await screen.findByText("An account with this email already exists. Sign in instead, or reset your password."),
		).toBeOnTheScreen();
		expect(mockSetAfterSignIn).toHaveBeenLastCalledWith(null);
	});

	it("says so when the server turned sign-ups off", async () => {
		mockServer.flags.disableSignups = true;
		await renderScreen(<CreateAccountScreen />);
		expect(
			screen.getByText("New account sign-ups are turned off on this server. Sign in with an account you already have."),
		).toBeOnTheScreen();
		expect(screen.queryByTestId("create-account-submit")).toBeNull();
	});
});

describe("Two-step verification", () => {
	it("sends a backup code and explains a wrong one", async () => {
		mockEngine.verifyTwoFactor.mockRejectedValueOnce(new AuthError("INVALID_BACKUP_CODE", 401));
		await renderScreen(<TwoFactorScreen />);
		await fireEvent.press(screen.getByText("Use a backup code instead"));
		await fireEvent.changeText(screen.getByTestId("backup-code"), "a1b2c-d3e4f");
		await fireEvent.press(screen.getByTestId("two-factor-submit"));
		expect(mockEngine.verifyTwoFactor).toHaveBeenCalledWith("a1b2c-d3e4f", "backup");
		expect(await screen.findByText("That code didn't work. Check it and try again.")).toBeOnTheScreen();
	});

	it("starts again when no sign-in is waiting for a code", async () => {
		mockEngine.hasPendingTwoFactor.mockReturnValue(false);
		await renderScreen(<TwoFactorScreen />);
		expect(mockReplace).toHaveBeenCalledWith("/sign-in/email");
	});
});

describe("Welcome", () => {
	it("offers email and Create account, hides what the server does not allow", async () => {
		await renderScreen(<WelcomeScreen />);
		expect(screen.getByTestId("sign-in-email")).toBeOnTheScreen();
		expect(screen.getByTestId("create-account-link")).toBeOnTheScreen();
		expect(screen.getByText("More ways to sign in")).toBeOnTheScreen();
		expect(screen.queryByTestId("sign-in-google")).toBeNull();
		expect(screen.queryByTestId("sign-in-guest")).toBeNull();
	});

	it("shows Google and guests when the server offers them, and no Create account when sign-ups are off", async () => {
		mockServer.native = { apple: false, google: { webClientId: "web", iosClientId: "ios" } };
		mockServer.flags = { disableSignups: true, disableEmailAuth: false, allowGuestLogin: true };
		mockServer.providers = { credential: "Password" };
		await renderScreen(<WelcomeScreen />);
		expect(screen.getByTestId("sign-in-google")).toBeOnTheScreen();
		expect(screen.getByTestId("sign-in-guest")).toBeOnTheScreen();
		expect(screen.queryByTestId("create-account-link")).toBeNull();
		expect(screen.queryByText("More ways to sign in")).toBeNull();
		expect(screen.getByText("New account sign-ups are turned off on this server.")).toBeOnTheScreen();
	});
});

describe("Password reset", () => {
	it("answers the same for any address", async () => {
		mockEngine.requestPasswordReset.mockResolvedValueOnce(undefined);
		await renderScreen(<ForgotPasswordScreen email="ana@example.com" />);
		await fireEvent.press(screen.getByTestId("forgot-password-submit"));
		expect(await screen.findByTestId("forgot-password-sent")).toBeOnTheScreen();
	});

	it("offers a new link when the reset link expired", async () => {
		await renderScreen(<ResetPasswordScreen error="INVALID_TOKEN" />);
		expect(screen.getByTestId("reset-password-expired")).toBeOnTheScreen();
	});

	it("saves the new password and returns to sign in", async () => {
		mockEngine.resetPassword.mockResolvedValueOnce(undefined);
		await renderScreen(<ResetPasswordScreen token="tok_123456" />);
		await fireEvent.changeText(screen.getByTestId("new-password"), "a-new-long-password");
		await fireEvent.press(screen.getByTestId("reset-password-submit"));
		await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/sign-in/email"));
		expect(mockEngine.resetPassword).toHaveBeenCalledWith("https://rezumi.app", "tok_123456", "a-new-long-password");
	});
});
