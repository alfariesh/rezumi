import type { ExpoConfig } from "expo/config";

// The official host. Universal Links, App Links and the OAuth callback (`/auth/native-callback`) verify against it.
const host = "rezumi.app";
/** Web pages under /dashboard that open their app screen (with `/dashboard` itself). */
const appLinkPrefixes = [
	"/dashboard/career",
	"/dashboard/documents",
	"/dashboard/resumes",
	"/dashboard/cover-letters",
	"/dashboard/trash",
	"/dashboard/applications",
	"/dashboard/jobs",
	"/dashboard/coach",
	"/dashboard/profile",
	"/dashboard/portfolio",
	"/dashboard/settings/account",
	"/dashboard/settings/profile",
	"/dashboard/settings/preferences",
	"/dashboard/settings/app",
	"/dashboard/settings/ai",
];
const microphonePermission = "Rezumi records your answers when you practise for an interview.";

const config: ExpoConfig = {
	name: "Rezumi",
	slug: "rezumi",
	platforms: ["ios", "android"],
	scheme: "app.rezumi",
	version: "1.0.0",
	runtimeVersion: { policy: "fingerprint" },
	// OTA (EAS Update) is off until the owner has an Expo project of their own (plans/mobile 02-teknis 13, Phase 16).
	// The fingerprint runtime version still tells a JavaScript-only change from one that needs a store build.
	updates: { enabled: false, checkAutomatically: "NEVER" },
	icon: "./assets/icon.png",
	orientation: "default",
	userInterfaceStyle: "automatic",
	ios: {
		buildNumber: process.env.MOBILE_BUILD_NUMBER ?? "1",
		icon: {
			light: "./assets/icon.png",
			dark: "./assets/icon-dark.png",
		},
		bundleIdentifier: "app.rezumi",
		// Sign in with Apple (K4): the `com.apple.developer.applesignin` entitlement.
		usesAppleSignIn: true,
		appleTeamId: "ZAVWN3Z2YX",
		deploymentTarget: "17.4",
		supportsTablet: true,
		infoPlist: { CADisableMinimumFrameDurationOnPhone: true },
		config: { usesNonExemptEncryption: false },
		privacyManifests: {
			NSPrivacyTracking: false,
			NSPrivacyTrackingDomains: [],
			NSPrivacyAccessedAPITypes: [
				{
					NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
					NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
				},
				{
					NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp",
					NSPrivacyAccessedAPITypeReasons: ["C617.1", "3B52.1", "0A2A.1"],
				},
				{
					NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime",
					NSPrivacyAccessedAPITypeReasons: ["35F9.1"],
				},
				{
					NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace",
					NSPrivacyAccessedAPITypeReasons: ["E174.1", "85F4.1"],
				},
			],
		},
		// `webcredentials` lets ASWebAuthenticationSession complete the https callback (iOS 17.4+).
		associatedDomains: [`applinks:${host}`, `webcredentials:${host}`],
	},
	android: {
		versionCode: Number(process.env.MOBILE_BUILD_NUMBER ?? "1"),
		package: "app.rezumi",
		predictiveBackGestureEnabled: false,
		adaptiveIcon: {
			foregroundImage: "./assets/adaptive-foreground.png",
			backgroundImage: "./assets/adaptive-background.png",
			monochromeImage: "./assets/adaptive-monochrome.png",
			backgroundColor: "#0485F7",
		},
		// Legacy camera capture needs WRITE_EXTERNAL_STORAGE; dependencies cap it at API 32. Keep read access blocked.
		blockedPermissions: [
			"android.permission.SYSTEM_ALERT_WINDOW",
			"android.permission.READ_EXTERNAL_STORAGE",
			"android.permission.READ_MEDIA_IMAGES",
			"android.permission.READ_MEDIA_VIDEO",
			"android.permission.READ_MEDIA_AUDIO",
			"android.permission.FOREGROUND_SERVICE",
			"android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
			"android.permission.FOREGROUND_SERVICE_MICROPHONE",
			// expo-notifications bundles Firebase and vendor badge helpers; app uses neither push nor badge counts.
			"android.permission.WAKE_LOCK",
			"com.google.android.c2dm.permission.RECEIVE",
			"com.sec.android.provider.badge.permission.READ",
			"com.sec.android.provider.badge.permission.WRITE",
			"com.htc.launcher.permission.READ_SETTINGS",
			"com.htc.launcher.permission.UPDATE_SHORTCUT",
			"com.sonyericsson.home.permission.BROADCAST_BADGE",
			"com.sonymobile.home.permission.PROVIDER_INSERT_BADGE",
			"com.anddoes.launcher.permission.UPDATE_COUNT",
			"com.majeur.launcher.permission.UPDATE_BADGE",
			"com.huawei.android.launcher.permission.CHANGE_BADGE",
			"com.huawei.android.launcher.permission.READ_SETTINGS",
			"com.huawei.android.launcher.permission.WRITE_SETTINGS",
			"android.permission.READ_APP_BADGE",
			"com.oppo.launcher.permission.READ_SETTINGS",
			"com.oppo.launcher.permission.WRITE_SETTINGS",
			"me.everything.badger.permission.BADGE_COUNT_READ",
			"me.everything.badger.permission.BADGE_COUNT_WRITE",
		],
		intentFilters: [
			{
				action: "VIEW",
				autoVerify: true,
				category: ["BROWSABLE", "DEFAULT"],
				// The pages with an app screen (plans/mobile 02-teknis 7); keep in step with apps/server/src/http/app-links.ts.
				// Billing and admin stay on the web: a checkout returning to /dashboard/settings/billing must not open the app.
				data: [
					{ scheme: "https", host, path: "/auth/native-callback" },
					{ scheme: "https", host, path: "/auth/reset-password" },
					{ scheme: "https", host, pathPrefix: "/builder/" },
					{ scheme: "https", host, path: "/dashboard" },
					...appLinkPrefixes.map((pathPrefix) => ({ scheme: "https", host, pathPrefix })),
				],
			},
		],
	},
	plugins: [
		"expo-router",
		"expo-dev-client",
		"expo-font",
		"expo-asset",
		"expo-image",
		"expo-sqlite",
		["expo-secure-store", { faceIDPermission: false }],
		"expo-web-browser",
		"expo-localization",
		"expo-document-picker",
		"expo-file-system",
		"expo-sharing",
		"expo-system-ui",
		"expo-status-bar",
		[
			"expo-splash-screen",
			{
				image: "./assets/splash-icon.png",
				imageWidth: 160,
				backgroundColor: "#F5F5F5", // the `background` token (DESIGN.md); native config, applies from the next build
				dark: { image: "./assets/splash-icon-dark.png", backgroundColor: "#060607" },
			},
		],
		[
			"expo-image-picker",
			{
				photosPermission: "Rezumi uses your photos to set the picture on your resume.",
				cameraPermission: "Rezumi uses your camera to take a profile photo.",
				microphonePermission,
			},
		],
		[
			"expo-audio",
			{
				microphonePermission,
				recordAudioAndroid: true,
				enableBackgroundPlayback: false,
				enableBackgroundRecording: false,
			},
		],
		["expo-notifications", { enableRemoteNotifications: false, enableBackgroundRemoteNotifications: false }],
		"@react-native-community/datetimepicker",
	],
};

export default config;
