import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createRouterClient, ORPCError } from "@orpc/server";
import { emptyProfileData } from "@rezumi/schema/profile/data";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { templatePresets } from "@rezumi/schema/templates";

const mocks = vi.hoisted(() => ({
	create: vi.fn(),
	getById: vi.fn(),
	update: vi.fn(),
	snapshot: vi.fn(),
	readProfile: vi.fn(),
	completeFrom: vi.fn(),
	assertDesignChange: vi.fn(),
}));

vi.mock("../../context", async () => {
	const { os } = await vi.importActual<typeof import("@orpc/server")>("@orpc/server");
	return {
		protectedProcedure: os.$context<{
			locale: "en-US";
			reqHeaders: Headers;
			user: { id: string };
		}>(),
	};
});

vi.mock("./service", () => ({
	resumeService: {
		create: mocks.create,
		getById: mocks.getById,
		update: mocks.update,
		versions: { snapshot: mocks.snapshot },
	},
}));

vi.mock("../profile/service", () => ({
	profileService: { read: mocks.readProfile, completeFrom: mocks.completeFrom },
}));

vi.mock("../billing/limits", () => ({ assertDesignChange: mocks.assertDesignChange }));

const { crudRouter } = await import("./crud");

/** A Profile with a name, a headline and one job, as `profileService.read` gives it. */
function savedProfile() {
	const data = emptyProfileData();
	data.basics.name = "Sam Taylor";
	data.basics.headline = "Product designer";
	data.sections.experience = [
		{
			id: "job-lumen",
			hidden: false,
			company: "Lumen",
			position: "Designer",
			location: "",
			period: "",
			website: { url: "", label: "", inlineLink: false },
			description: "",
			roles: [],
		},
	] as never;
	return { data, updatedAt: new Date() };
}

describe("resume write route validation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.create.mockResolvedValue("resume-id");
		mocks.getById.mockResolvedValue({
			id: "resume-id",
			name: "Original",
			tags: [],
			data: defaultResumeData,
		});
		mocks.update.mockResolvedValue({});
		mocks.snapshot.mockResolvedValue(undefined);
		mocks.readProfile.mockResolvedValue(savedProfile());
		mocks.completeFrom.mockResolvedValue(undefined);
		mocks.assertDesignChange.mockResolvedValue(undefined);
	});

	it.each(["import", "update"] as const)("rejects invalid %s input before calling persistence", async (operation) => {
		const client = createRouterClient(crudRouter, {
			context: { locale: "en-US", reqHeaders: new Headers(), user: { id: "user-id" } } as never,
		});
		const data = structuredClone(defaultResumeData);
		data.metadata.page.marginX = 500;

		const result = operation === "import" ? client.import({ data }) : client.update({ id: "resume-id", data });
		const error = await result.catch((caught: unknown) => caught);

		expect(error).toMatchObject({ code: "BAD_REQUEST", status: 400 });
		expect(error).toHaveProperty("cause.issues.0.path", ["data", "metadata", "page", "marginX"]);
		expect(mocks.create).not.toHaveBeenCalled();
		expect(mocks.update).not.toHaveBeenCalled();
		expect(mocks.snapshot).not.toHaveBeenCalled();
	});

	it.each([false, true])("puts the Profile's name on a new resume (sample data: %s)", async (withSampleData) => {
		const client = createRouterClient(crudRouter, {
			context: { locale: "en-US", reqHeaders: new Headers(), user: { id: "user-id", name: "Account name" } } as never,
		});

		await client.create({ name: "Outstanding Blue Whale", tags: [], withSampleData });

		expect(mocks.readProfile).toHaveBeenCalledWith("user-id");
		expect(mocks.create).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Outstanding Blue Whale",
				data: expect.objectContaining({ basics: expect.objectContaining({ name: "Sam Taylor" }) }),
			}),
		);
	});

	it("starts an empty resume from the Profile: its details and items, on the default design", async () => {
		const client = createRouterClient(crudRouter, {
			context: { locale: "id-ID", reqHeaders: new Headers(), user: { id: "user-id" } } as never,
		});

		await client.create({ name: "From my Profile", tags: [] });

		const data = mocks.create.mock.lastCall?.[0].data;
		expect(data.basics).toMatchObject({ name: "Sam Taylor", headline: "Product designer" });
		expect(data.sections.experience.items.map((item: { id: string }) => item.id)).toEqual(["job-lumen"]);
		expect(data.metadata).toMatchObject({ template: defaultResumeData.metadata.template, page: { locale: "id-ID" } });
		// The example resume keeps its own career; only the name is the person's.
		await client.create({ name: "Example", tags: [], withSampleData: true });
		expect(
			mocks.create.mock.lastCall?.[0].data.sections.experience.items.map((item: { id: string }) => item.id),
		).not.toContain("job-lumen");
	});

	it("starts a resume on a chosen template in its own look, checked against the plan", async () => {
		const client = createRouterClient(crudRouter, {
			context: { locale: "en-US", reqHeaders: new Headers(), user: { id: "user-id" } } as never,
		});

		await client.create({ name: "First resume", tags: [], template: "senja" });

		const data = mocks.create.mock.lastCall?.[0].data;
		expect(data.metadata.template).toBe("senja");
		expect(data.metadata.design.colors.primary).toBe(templatePresets.senja.primary);
		expect(data.metadata.typography.heading.fontFamily).toBe(templatePresets.senja.heading.fontFamily);
		expect(data.basics.name).toBe("Sam Taylor");
		const [userId, before, after] = mocks.assertDesignChange.mock.lastCall ?? [];
		expect(userId).toBe("user-id");
		expect(before).toMatchObject({ template: defaultResumeData.metadata.template });
		expect(after).toMatchObject({ template: "senja", stylesheet: before.stylesheet });

		// A former template ID is read as its successor.
		await client.create({ name: "Old ID", tags: [], template: "onyx" as never });
		expect(mocks.create.mock.lastCall?.[0].data.metadata.template).toBe("meridian");
	});

	it("doesn't create a resume on a template the plan doesn't include", async () => {
		mocks.assertDesignChange.mockRejectedValueOnce(new ORPCError("PLAN_FEATURE_REQUIRED", { status: 403 }));
		const client = createRouterClient(crudRouter, {
			context: { locale: "en-US", reqHeaders: new Headers(), user: { id: "user-id" } } as never,
		});

		await expect(client.create({ name: "Premium", tags: [], template: "senja" })).rejects.toMatchObject({
			code: "PLAN_FEATURE_REQUIRED",
		});
		expect(mocks.create).not.toHaveBeenCalled();

		await client.create({ name: "Plain", tags: [] });
		expect(mocks.assertDesignChange).toHaveBeenCalledOnce();
	});

	it("fills what the Profile lacks from an imported resume, after the resume is saved", async () => {
		const client = createRouterClient(crudRouter, {
			context: { locale: "en-US", reqHeaders: new Headers(), user: { id: "user-id" } } as never,
		});
		const data = structuredClone(defaultResumeData);
		data.basics.name = "Imported Person";

		await client.import({ data });

		expect(mocks.create).toHaveBeenCalledOnce();
		expect(mocks.completeFrom).toHaveBeenCalledWith("user-id", expect.objectContaining({ basics: data.basics }));
		expect(mocks.create.mock.invocationCallOrder[0]).toBeLessThan(mocks.completeFrom.mock.invocationCallOrder[0] ?? 0);
	});

	it("allows overlong slug on update to reach the service for change-sensitive check", async () => {
		const client = createRouterClient(crudRouter, {
			context: { locale: "en-US", reqHeaders: new Headers(), user: { id: "user-id", name: "Sam" } } as never,
		});
		const tooLongSlug = "a".repeat(65);
		mocks.update.mockResolvedValueOnce({
			id: "resume-id",
			name: "Resume",
			slug: tooLongSlug,
			tags: [],
			isPublic: false,
			showDownloadButtons: true,
			showInSearchEngines: false,
			hideContactDetails: false,
			isPrimary: false,
			isLocked: false,
			data: defaultResumeData,
			createdAt: new Date(),
			updatedAt: new Date(),
			hasPassword: false,
		});

		await client.update({ id: "resume-id", slug: tooLongSlug });
		expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ id: "resume-id", slug: tooLongSlug }));
	});

	it.each(
		["create", "duplicate", "update"].flatMap((operation) =>
			["", "a".repeat(65), "Invalid Slug@123!"].map((slug) => ({ operation, slug })),
		),
	)("returns INVALID_SLUG for $operation with slug '$slug'", async ({ operation, slug }) => {
		mocks.create.mockRejectedValueOnce(new ORPCError("INVALID_SLUG", { status: 400 }));
		mocks.update.mockRejectedValueOnce(new ORPCError("INVALID_SLUG", { status: 400 }));

		const client = createRouterClient(crudRouter, {
			context: { locale: "en-US", reqHeaders: new Headers(), user: { id: "user-id", name: "Sam" } } as never,
		});

		const result =
			operation === "create"
				? client.create({ name: "Resume", tags: [], slug })
				: operation === "duplicate"
					? client.duplicate({ id: "resume-id", slug })
					: client.update({ id: "resume-id", slug });

		await expect(result).rejects.toMatchObject({ code: "INVALID_SLUG", status: 400 });
	});

	it("propagates NOT_FOUND when duplicating a non-existent resume", async () => {
		mocks.getById.mockRejectedValueOnce(new ORPCError("NOT_FOUND", { status: 404 }));

		const client = createRouterClient(crudRouter, {
			context: { locale: "en-US", reqHeaders: new Headers(), user: { id: "user-id", name: "Sam" } } as never,
		});

		await expect(client.duplicate({ id: "missing-id" })).rejects.toMatchObject({
			code: "NOT_FOUND",
			status: 404,
		});
	});
});
