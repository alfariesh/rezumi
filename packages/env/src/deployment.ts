/** Normalize deployment-provided defaults without overriding explicit settings. */
export function deploymentEnvironment(input: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
	const value = (key: string) => input[key]?.trim() || undefined;
	const cloudflare = value("CLOUDFLARE") === "1";
	const hasS3 = value("S3_ACCESS_KEY_ID") && value("S3_SECRET_ACCESS_KEY") && value("S3_BUCKET");
	return {
		...input,
		APP_URL: value("APP_URL"),
		// Hyperdrive's actual URL is supplied to the request-scoped pool, never shared across requests.
		DATABASE_URL: value("DATABASE_URL") ?? (cloudflare ? "postgresql://hyperdrive" : undefined),
		DATABASE_MIGRATION_URL: value("DATABASE_MIGRATION_URL"),
		REDIS_URL: value("REDIS_URL"),
		STORAGE_BACKEND: value("STORAGE_BACKEND") ?? (cloudflare ? "r2" : hasS3 ? "s3" : "local"),
		DEPLOYMENT_NAMESPACE: value("DEPLOYMENT_NAMESPACE") ?? "default",
	};
}
