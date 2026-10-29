import { describe, expect, it } from "vite-plus/test";
import { deploymentEnvironment } from "./deployment";

describe("deployment environment", () => {
	it("preserves defaults and explicit settings", () => {
		expect(
			deploymentEnvironment({ APP_URL: "https://resume.example", DATABASE_URL: "postgresql://db/app" }),
		).toMatchObject({
			APP_URL: "https://resume.example",
			DATABASE_URL: "postgresql://db/app",
			STORAGE_BACKEND: "local",
			DEPLOYMENT_NAMESPACE: "default",
		});
		expect(
			deploymentEnvironment({ S3_ACCESS_KEY_ID: "id", S3_SECRET_ACCESS_KEY: "secret", S3_BUCKET: "bucket" })
				.STORAGE_BACKEND,
		).toBe("s3");
	});
	it("selects Hyperdrive and R2 on Cloudflare without overriding explicit settings", () => {
		expect(deploymentEnvironment({ CLOUDFLARE: "1" })).toMatchObject({
			DATABASE_URL: "postgresql://hyperdrive",
			STORAGE_BACKEND: "r2",
		});
		expect(
			deploymentEnvironment({ CLOUDFLARE: "1", DATABASE_URL: "postgresql://db/app", STORAGE_BACKEND: "local" }),
		).toMatchObject({ DATABASE_URL: "postgresql://db/app", STORAGE_BACKEND: "local" });
	});
});
