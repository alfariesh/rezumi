import type { GroupProps } from "./style-groups";
import type { UploadContext } from "@/features/write/upload";
import type { CustomFontFace } from "@rezumi/schema/resume/data";
import { useLingui } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { getDocumentAsync } from "expo-document-picker";
import { File } from "expo-file-system";
import { useState } from "react";
import { View } from "react-native";
import { MAX_DOCUMENT_FONT_FACES, MAX_UPLOADED_FONT_BYTES, uploadedFontFamilies } from "@rezumi/fonts/uploaded";
import { addUploadedFontFace, removeUploadedFontFamily } from "@rezumi/resume/uploaded-fonts";
import { rest } from "@/api/client";
import { useResumeStore } from "@/draft";
import { nativeEnvironment } from "@/draft/native";
import { canShowPlans, hasPlanFeature, showPlanAlert, usePlan } from "@/features/billing/plan";
import { claimUpload, commitUpload } from "@/features/write/upload";
import { Button, ConfirmDialog, ListRow, Text, showToast, useTheme } from "@/ui";

const uploadContext: UploadContext = {
	resumeId: () => useResumeStore.getState().document?.id,
	scope: () => nativeEnvironment.scope(),
};

/** A refused upload, as the server's REST error describes it. */
class FontUploadError extends Error {
	constructor(
		readonly code: string | undefined,
		readonly problem: string | undefined,
	) {
		super(code ?? "Upload failed");
	}
}

async function uploadFont(uri: string): Promise<CustomFontFace> {
	const form = new FormData();
	form.append("file", new File(uri));
	const response = await rest("/fonts", { method: "POST", body: form });
	const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
	if (!response.ok) {
		const data = (body?.data ?? {}) as { problem?: unknown };
		throw new FontUploadError(
			typeof body?.code === "string" ? body.code : undefined,
			typeof data.problem === "string" ? data.problem : undefined,
		);
	}
	const { family, weight, italic, url } = (body ?? {}) as Partial<CustomFontFace>;
	if (typeof family !== "string" || typeof weight !== "string" || typeof url !== "string")
		throw new FontUploadError(undefined, undefined);
	return { family, weight, italic: italic === true, url };
}

/**
 * Advanced → Typography's uploaded fonts: the document's families with Remove, and Upload font. Android shows Upload
 * locked without the plan's feature; iOS hides it then (the fonts already added still show and draw).
 */
export function UploadedFonts({ data, write, disabled }: Pick<GroupProps, "data" | "write" | "disabled">) {
	const { t } = useLingui();
	const { space } = useTheme();
	const planLocked = !hasPlanFeature(usePlan(), "customFonts");
	const [removing, setRemoving] = useState<string | null>(null);
	const faces = data.metadata.typography.customFonts ?? [];
	const families = uploadedFontFamilies(faces);
	const full = faces.length >= MAX_DOCUMENT_FONT_FACES;

	const describeProblem = (error: unknown) => {
		const problem = error instanceof FontUploadError ? error.problem : undefined;
		if (problem === "unsupported-format")
			return t`Upload a single TTF or OTF file. Web fonts (WOFF, WOFF2) and font collections (TTC) can't be used.`;
		if (problem === "invalid") return t`This file isn't a font Rezumi can read. Upload a TTF or OTF file.`;
		if (problem === "no-embedding")
			return t`This font's licence doesn't allow embedding it in documents, so it can't be used in a PDF.`;
		return t`Couldn't upload the font. Try again.`;
	};

	const upload = useMutation({
		mutationKey: ["design", "font"],
		mutationFn: async () => {
			const owner = await claimUpload(uploadContext);
			if (!owner) return;
			const picked = await getDocumentAsync({ type: ["font/ttf", "font/otf", "*/*"], copyToCacheDirectory: true });
			if (picked.canceled) return;
			const asset = picked.assets[0];
			if (!asset) return;
			if ((asset.size ?? new File(asset.uri).size) > MAX_UPLOADED_FONT_BYTES)
				throw new Error(t`Choose a font file smaller than 8 MB.`);
			const face = await uploadFont(asset.uri);
			// Leaving for another resume, or switching account, while it uploaded: the result is dropped.
			const added = await commitUpload(owner, uploadContext, () =>
				write("typography.fonts", (draft) => addUploadedFontFace(draft.metadata.typography, face), true),
			);
			if (added) showToast({ message: t`${face.family} is ready. Choose it under Font family.` });
		},
		onError: (error) => {
			if (error instanceof FontUploadError && error.code === "PLAN_FEATURE_REQUIRED")
				return showPlanAlert({ kind: "feature", feature: "customFonts" });
			showToast({
				message: error instanceof FontUploadError ? describeProblem(error) : error.message || describeProblem(error),
			});
		},
	});

	if (planLocked && !canShowPlans() && families.length === 0) return null;

	return (
		<View style={{ gap: space.s3 }}>
			<Text variant="label" color="ink2">
				{t`Your fonts`}
			</Text>
			{families.map((family) => {
				const familyFaces = faces
					.filter((face) => face.family === family)
					.toSorted((a, b) => Number(a.weight) - Number(b.weight) || Number(a.italic) - Number(b.italic));
				return (
					<ListRow
						key={family}
						title={family}
						subtitle={familyFaces.map((face) => (face.italic ? t`${face.weight} italic` : face.weight)).join(" · ")}
						leading="text-aa"
						trailing={
							<Button label={t`Remove`} variant="ghost" disabled={disabled} onPress={() => setRemoving(family)} />
						}
					/>
				);
			})}
			{planLocked && !canShowPlans() ? null : (
				<>
					<Text variant="caption" color="ink3">
						{planLocked
							? t`Your own fonts aren't in your plan. Fonts already added keep working on the page.`
							: t`Upload TTF or OTF files you have the right to use, one file per weight or style. Anyone who opens a shared link to this document can download them.`}
					</Text>
					<View style={{ alignSelf: "flex-start" }}>
						<Button
							label={full ? t`Font limit reached` : t`Upload font`}
							icon={planLocked ? "lock" : "upload-simple"}
							variant="secondary"
							loading={upload.isPending}
							disabled={disabled || full || upload.isPending}
							onPress={() =>
								planLocked ? showPlanAlert({ kind: "feature", feature: "customFonts" }) : upload.mutate()
							}
						/>
					</View>
				</>
			)}
			<ConfirmDialog
				open={removing !== null}
				title={t`Remove ${removing ?? ""}?`}
				message={t`Text set in it moves to the default font. You can upload the font again later.`}
				confirmLabel={t`Remove font`}
				destructive
				onCancel={() => setRemoving(null)}
				onConfirm={() => {
					const family = removing;
					setRemoving(null);
					if (family)
						write("typography.fonts", (draft) => removeUploadedFontFamily(draft.metadata.typography, family), true);
				}}
			/>
		</View>
	);
}
