import type { AIProvider } from "@rezumi/ai/types";
import { ORPCError } from "@orpc/client";
import { and, asc, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { aiProviderSchema } from "@rezumi/ai/types";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { env } from "@rezumi/env/server";
import {
	assertCredentialEncryptionConfigured,
	decryptCredential,
	encryptCredential,
	isCredentialEncryptionConfigured,
} from "../ai/credentials";
import { testConnection } from "../ai/service";
import { resolveAiBaseUrl } from "../ai/url-policy";
import { isBillingAppliedTo } from "../billing/entitlements";

type AiProviderRecord = typeof schema.aiProvider.$inferSelect;

export type AiProviderResponse = {
	managed: boolean;
	id: string;
	label: string;
	provider: AIProvider;
	model: string;
	baseURL: string | null;
	enabled: boolean;
	isDefault: boolean;
	testStatus: string;
	testError: string | null;
	apiKeyPreview: string;
	apiKeyFingerprint: string;
	lastTestedAt: Date | null;
	lastUsedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
};

type CreateAiProviderInput = {
	userId: string;
	label: string;
	provider: AIProvider;
	model: string;
	baseURL?: string | null;
	apiKey: string;
};

type UpdateAiProviderInput = {
	id: string;
	userId: string;
	label?: string;
	provider?: AIProvider;
	model?: string;
	baseURL?: string | null;
	apiKey?: string;
	enabled?: boolean;
};

function toResponse(row: AiProviderRecord): AiProviderResponse {
	const provider = aiProviderSchema.parse(row.provider);

	return {
		managed: row.id === serverProviderId(row.userId),
		id: row.id,
		label: row.label,
		provider,
		model: row.model,
		baseURL: row.baseUrl,
		enabled: row.enabled,
		isDefault: row.isDefault,
		testStatus: row.testStatus,
		testError: row.testError,
		apiKeyPreview: row.apiKeyPreview,
		// The hash identifies the key without revealing it; the ciphertext and salt never leave the server.
		apiKeyFingerprint: row.apiKeyHash,
		lastTestedAt: row.lastTestedAt,
		lastUsedAt: row.lastUsedAt,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

function normalizeBaseUrl(input: { provider: AIProvider; baseURL?: string | null }) {
	const trimmed = input.baseURL?.trim() ?? "";
	if (!trimmed) return null;

	return resolveAiBaseUrl({ provider: input.provider, baseURL: trimmed });
}

async function getOwnedProvider(input: { id: string; userId: string }) {
	if (input.id === serverProviderId(input.userId)) throw new ORPCError("NOT_FOUND");
	const [provider] = await db
		.select()
		.from(schema.aiProvider)
		.where(and(eq(schema.aiProvider.id, input.id), eq(schema.aiProvider.userId, input.userId)))
		.limit(1);

	if (!provider) throw new ORPCError("NOT_FOUND");

	return provider;
}

const serverProviderId = (userId: string) => `server-ai:${userId}`;

/**
 * How a connection is picked when nobody chose one: the default, then the most recently used, then the oldest. Lists
 * use the same order, so the first usable connection on screen is the one the server uses.
 */
const automaticOrder = [
	desc(schema.aiProvider.isDefault),
	desc(sql<Date>`coalesce(${schema.aiProvider.lastUsedAt}, '1970-01-01T00:00:00.000Z'::timestamptz)`),
	asc(schema.aiProvider.createdAt),
];

const serverAiConfigured = () => Boolean(env.AI_PROVIDER && env.AI_MODEL);

/**
 * With server AI set up, accounts paid plans apply to choose between it (Rezumi AI) and their own connections; for
 * everyone else the server's AI is the only one, as before plans existed.
 */
async function personalProvidersAllowed(userId: string) {
	return !env.AI_PROVIDER || (await isBillingAppliedTo(userId));
}

async function assertPersonalProvidersAllowed(userId: string) {
	if (!(await personalProvidersAllowed(userId)))
		throw new ORPCError("FORBIDDEN", {
			message: "AI is set up by the server administrator and can't be changed here.",
		});
}

/**
 * A persisted reference keeps Assistant thread foreign keys valid; server credentials stay in the environment. Without
 * a choice of connections it's always the default; as Rezumi AI it stays the default only while the user keeps it so.
 */
async function serverProvider(userId: string, options: { choice: boolean }) {
	if (!env.AI_PROVIDER || !env.AI_MODEL) return null;
	const values = {
		userId,
		label: options.choice ? "Rezumi AI" : "Server AI",
		provider: env.AI_PROVIDER,
		model: env.AI_MODEL,
		baseUrl: env.AI_BASE_URL ?? null,
		enabled: true,
		testStatus: "success",
		encryptedApiKey: "",
		apiKeySalt: "",
		apiKeyHash: "",
		apiKeyPreview: "",
	};
	const [row] = await db
		.insert(schema.aiProvider)
		.values({ id: serverProviderId(userId), ...values, isDefault: !options.choice })
		.onConflictDoUpdate({
			target: schema.aiProvider.id,
			set: options.choice ? values : { ...values, isDefault: true },
		})
		.returning();
	if (!row) throw new Error("SERVER_AI_PROVIDER_UNAVAILABLE");
	return { ...toResponse(row), apiKey: env.AI_API_KEY ?? "", baseURL: env.AI_BASE_URL ?? "" };
}

function toRunnable(provider: AiProviderRecord) {
	return {
		...toResponse(provider),
		apiKey: decryptCredential(provider.encryptedApiKey),
		baseURL: provider.baseUrl ?? "",
	};
}

export type RunnableAiProvider = AiProviderResponse & { apiKey: string; baseURL: string };

/**
 * The rows an account's list and automatic choice cover: its own connections, plus Rezumi AI when the server has AI.
 * Without ENCRYPTION_SECRET own connections can't be read, but Rezumi AI still works.
 */
function choiceScope(userId: string, managed: { id: string } | null) {
	if (!managed) return ne(schema.aiProvider.id, serverProviderId(userId));
	return isCredentialEncryptionConfigured() ? undefined : eq(schema.aiProvider.id, managed.id);
}

/** The user's own connection: the one named, or the first usable in automatic order. Never Rezumi AI. */
async function ownRunnable(input: { userId: string; id?: string | null | undefined }) {
	assertCredentialEncryptionConfigured();
	if (input.id) {
		const provider = await getOwnedProvider({ id: input.id, userId: input.userId });
		if (!provider.enabled || provider.testStatus !== "success")
			throw new ORPCError("BAD_REQUEST", { message: "Test and turn on this AI provider before using it." });
		return toRunnable(provider);
	}
	const [provider] = await db
		.select()
		.from(schema.aiProvider)
		.where(
			and(
				eq(schema.aiProvider.userId, input.userId),
				eq(schema.aiProvider.enabled, true),
				eq(schema.aiProvider.testStatus, "success"),
				ne(schema.aiProvider.id, serverProviderId(input.userId)),
			),
		)
		.orderBy(...automaticOrder)
		.limit(1);
	return provider ? toRunnable(provider) : null;
}

export const aiProvidersService = {
	list: async (input: { userId: string }) => {
		if (!(await personalProvidersAllowed(input.userId))) {
			const global = await serverProvider(input.userId, { choice: false });
			if (global) {
				const { apiKey: _apiKey, ...response } = global;
				return [response];
			}
		}
		// Rezumi AI, when the server has AI, listed with the user's own connections in the order the server picks.
		const managed = await serverProvider(input.userId, { choice: true });
		if (!managed) assertCredentialEncryptionConfigured();

		const providers = await db
			.select()
			.from(schema.aiProvider)
			.where(and(eq(schema.aiProvider.userId, input.userId), choiceScope(input.userId, managed)))
			.orderBy(...automaticOrder);

		return providers.map(toResponse);
	},

	getRunnableById: async (input: { id: string; userId: string }): Promise<RunnableAiProvider> => {
		if (!(await personalProvidersAllowed(input.userId))) {
			const global = await serverProvider(input.userId, { choice: false });
			if (global) return global;
		}
		if (input.id === serverProviderId(input.userId)) {
			const managed = await serverProvider(input.userId, { choice: true });
			if (managed) return managed;
		}
		const provider = await ownRunnable(input);
		if (!provider) throw new ORPCError("NOT_FOUND");
		return provider;
	},

	getDefaultRunnable: async (input: { userId: string }): Promise<RunnableAiProvider | null> => {
		if (!(await personalProvidersAllowed(input.userId))) {
			const global = await serverProvider(input.userId, { choice: false });
			if (global) return global;
		}
		const managed = await serverProvider(input.userId, { choice: true });
		if (!managed) return ownRunnable(input);
		const [first] = await db
			.select()
			.from(schema.aiProvider)
			.where(
				and(
					eq(schema.aiProvider.userId, input.userId),
					eq(schema.aiProvider.enabled, true),
					eq(schema.aiProvider.testStatus, "success"),
					choiceScope(input.userId, managed),
				),
			)
			.orderBy(...automaticOrder)
			.limit(1);
		return !first || first.id === managed.id ? managed : toRunnable(first);
	},

	/**
	 * Whether the account chooses between Rezumi AI and its own connections. Off while billing doesn't apply to it or the
	 * server has no AI of its own: then the server picks the connection as before plans existed.
	 */
	offersChoice: async (userId: string) => serverAiConfigured() && (await isBillingAppliedTo(userId)),

	/** Rezumi AI for this account, or null when the server has no AI of its own. */
	getManagedRunnable: (input: { userId: string }) => serverProvider(input.userId, { choice: true }),

	/** One of the user's own connections (the one named, or the default), never Rezumi AI. Null when they have none. */
	getOwnRunnable: (input: { userId: string; id?: string | null | undefined }) => ownRunnable(input),

	isManagedId: (input: { userId: string; id: string }) => input.id === serverProviderId(input.userId),

	create: async (input: CreateAiProviderInput) => {
		await assertPersonalProvidersAllowed(input.userId);
		assertCredentialEncryptionConfigured();

		const encrypted = encryptCredential(input.apiKey.trim());
		const [provider] = await db
			.insert(schema.aiProvider)
			.values({
				userId: input.userId,
				label: input.label.trim(),
				provider: input.provider,
				model: input.model.trim(),
				baseUrl: normalizeBaseUrl(input),
				...encrypted,
			})
			.returning();

		if (!provider) throw new Error("AI_PROVIDER_CREATE_FAILED");

		return toResponse(provider);
	},

	update: async (input: UpdateAiProviderInput) => {
		await assertPersonalProvidersAllowed(input.userId);
		assertCredentialEncryptionConfigured();

		const existing = await getOwnedProvider(input);
		const provider = input.provider ?? aiProviderSchema.parse(existing.provider);
		const nextApiKey = input.apiKey?.trim();
		const nextBaseUrl =
			input.baseURL !== undefined ? normalizeBaseUrl({ provider, baseURL: input.baseURL }) : existing.baseUrl;
		const providerChanged = input.provider !== undefined && input.provider !== existing.provider;
		const modelChanged = input.model !== undefined && input.model.trim() !== existing.model;
		const baseUrlChanged = input.baseURL !== undefined && nextBaseUrl !== existing.baseUrl;
		const hostChanged = providerChanged || baseUrlChanged;

		// The saved key only goes where it was saved for: a new provider or address needs the key sent with it.
		if (hostChanged && nextApiKey === undefined) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Enter the API key again to change the provider or base URL.",
			});
		}

		// On a new host the key is replaced even when empty (Ollama runs without one).
		const encrypted = nextApiKey || hostChanged ? encryptCredential(nextApiKey ?? "") : {};
		const credentialChanged = !!nextApiKey;
		const runtimeChanged = credentialChanged || providerChanged || modelChanged || baseUrlChanged;

		if (input.enabled === true && existing.testStatus !== "success" && !runtimeChanged) {
			throw new ORPCError("BAD_REQUEST", { message: "Test this AI provider before turning it on." });
		}

		const [updated] = await db
			.update(schema.aiProvider)
			.set({
				...(input.label !== undefined ? { label: input.label.trim() } : {}),
				...(input.provider !== undefined ? { provider: input.provider } : {}),
				...(input.model !== undefined ? { model: input.model.trim() } : {}),
				...(input.baseURL !== undefined ? { baseUrl: nextBaseUrl } : {}),
				...(input.enabled !== undefined && !runtimeChanged ? { enabled: input.enabled } : {}),
				...(runtimeChanged ? { enabled: false, testStatus: "untested", lastTestedAt: null, testError: null } : {}),
				...encrypted,
			})
			.where(
				and(
					eq(schema.aiProvider.id, input.id),
					eq(schema.aiProvider.userId, input.userId),
					eq(schema.aiProvider.provider, existing.provider),
					eq(schema.aiProvider.model, existing.model),
					existing.baseUrl === null
						? isNull(schema.aiProvider.baseUrl)
						: eq(schema.aiProvider.baseUrl, existing.baseUrl),
					eq(schema.aiProvider.encryptedApiKey, existing.encryptedApiKey),
					eq(schema.aiProvider.testStatus, existing.testStatus),
				),
			)
			.returning();

		if (!updated) throw new ORPCError("CONFLICT", { message: "The provider changed. Reload it before saving again." });
		return toResponse(updated);
	},

	delete: async (input: { id: string; userId: string }) => {
		await assertPersonalProvidersAllowed(input.userId);
		assertCredentialEncryptionConfigured();

		// Rezumi AI isn't the user's to delete.
		await db
			.delete(schema.aiProvider)
			.where(
				and(
					eq(schema.aiProvider.id, input.id),
					eq(schema.aiProvider.userId, input.userId),
					ne(schema.aiProvider.id, serverProviderId(input.userId)),
				),
			);
	},

	test: async (input: { id: string; userId: string }) => {
		await assertPersonalProvidersAllowed(input.userId);
		assertCredentialEncryptionConfigured();

		const provider = await getOwnedProvider(input);
		const parsedProvider = aiProviderSchema.parse(provider.provider);
		const apiKey = decryptCredential(provider.encryptedApiKey);
		// A result applies only to the settings it tested: an edit made while the request ran resets the connection
		// to untested, and a late result must not mark the new settings as working.
		const tested = and(
			eq(schema.aiProvider.id, input.id),
			eq(schema.aiProvider.userId, input.userId),
			eq(schema.aiProvider.provider, provider.provider),
			eq(schema.aiProvider.model, provider.model),
			provider.baseUrl === null ? isNull(schema.aiProvider.baseUrl) : eq(schema.aiProvider.baseUrl, provider.baseUrl),
			eq(schema.aiProvider.encryptedApiKey, provider.encryptedApiKey),
		);
		const changed = () =>
			new ORPCError("CONFLICT", { message: "The provider changed during the test. Test it again." });

		try {
			const result = await testConnection({
				provider: parsedProvider,
				model: provider.model,
				apiKey,
				baseURL: provider.baseUrl ?? "",
			});

			// A provider that answers "no" is a completed test, not a failed request: it comes back as
			// data so the client can show why, instead of a generic transport error.
			const [updated] = await db
				.update(schema.aiProvider)
				.set({
					enabled: result.ok,
					testStatus: result.ok ? "success" : "failure",
					testError: result.ok ? null : result.message,
					lastTestedAt: new Date(),
				})
				.where(tested)
				.returning();

			if (!updated) throw changed();
			return toResponse(updated);
		} catch (error) {
			if (error instanceof ORPCError && error.code === "CONFLICT") throw error;
			// Only unexpected failures reach here now: provider-side outcomes come back as data above.
			await db
				.update(schema.aiProvider)
				.set({
					enabled: false,
					testStatus: "failure",
					testError: error instanceof Error ? error.message : "Failed to test provider.",
					lastTestedAt: new Date(),
				})
				.where(tested);

			throw error;
		}
	},

	/** Makes one tested, switched-on connection the default; the previous default stops being one. */
	setDefault: async (input: { id: string; userId: string }) => {
		await assertPersonalProvidersAllowed(input.userId);
		// Rezumi AI can be the default too, for an account that chooses.
		const managed =
			input.id === serverProviderId(input.userId) && (await aiProvidersService.offersChoice(input.userId))
				? await serverProvider(input.userId, { choice: true })
				: null;
		const provider = managed ?? (await getOwnedProvider(input));
		if (!provider.enabled || provider.testStatus !== "success")
			throw new ORPCError("BAD_REQUEST", {
				message: "Test and turn on this provider before making it the default.",
			});
		const [updated] = await db.transaction(async (tx) => {
			await tx
				.update(schema.aiProvider)
				.set({ isDefault: false })
				.where(and(eq(schema.aiProvider.userId, input.userId), eq(schema.aiProvider.isDefault, true)));
			return tx
				.update(schema.aiProvider)
				.set({ isDefault: true })
				.where(and(eq(schema.aiProvider.id, input.id), eq(schema.aiProvider.userId, input.userId)))
				.returning();
		});
		if (!updated) throw new ORPCError("NOT_FOUND");
		return toResponse(updated);
	},

	markUsed: async (input: { id: string; userId: string }) => {
		await db
			.update(schema.aiProvider)
			.set({ lastUsedAt: new Date() })
			.where(and(eq(schema.aiProvider.id, input.id), eq(schema.aiProvider.userId, input.userId)));
	},
};
