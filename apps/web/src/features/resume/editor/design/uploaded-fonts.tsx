import type { CustomFontFace } from "@rezumi/schema/resume/data";
import { Button } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ORPCError } from "@orpc/client";
import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";
import { MAX_DOCUMENT_FONT_FACES, uploadedFontFamilies, uploadedFontWeights } from "@rezumi/fonts/uploaded";
import { addUploadedFontFace, removeUploadedFontFamily } from "@rezumi/resume/uploaded-fonts";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { toast } from "@rezumi/ui/components/toast";
import { getNextWeights } from "@/components/typography/get-next-weights";
import { usePlanFeature } from "@/features/billing/plan";
import { openPlanDialog, openPlanDialogForError } from "@/features/billing/plan-dialog";
import { useIsResumeLocked, useUpdateResumeData } from "@/features/resume/builder/draft";
import { useConfirm } from "@/hooks/use-confirm";
import { getReadableErrorMessage } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";

/** Why the server refused a font file, in the user's language; null for any other error. */
function describeFontProblem(error: unknown) {
	const problem = error instanceof ORPCError ? (error.data as { problem?: unknown } | undefined)?.problem : undefined;
	if (problem === "unsupported-format")
		return t`Upload a single TTF or OTF file. Web fonts (WOFF, WOFF2) and font collections (TTC) can't be used.`;
	if (problem === "invalid") return t`This file isn't a font Rezumi can read. Upload a TTF or OTF file.`;
	if (problem === "no-embedding")
		return t`This font's licence doesn't allow embedding it in documents, so it can't be used in a PDF.`;
	return null;
}

const faceLabel = (face: Pick<CustomFontFace, "weight" | "italic">) =>
	face.italic ? t`${face.weight} italic` : face.weight;

type UploadedFontsProps = { faces: CustomFontFace[] | undefined };

/** The fonts uploaded for this document, and the button that uploads more (with the plan's lock when it lacks them). */
export function UploadedFonts({ faces = [] }: UploadedFontsProps) {
	const updateResumeData = useUpdateResumeData();
	const isLocked = useIsResumeLocked();
	const planLocked = !usePlanFeature("customFonts");
	const confirm = useConfirm();
	const inputRef = useRef<HTMLInputElement>(null);
	const { mutateAsync: uploadFont, isPending } = useMutation(
		orpc.storage.uploadFont.mutationOptions({ meta: { noInvalidate: true } }),
	);
	const full = faces.length >= MAX_DOCUMENT_FONT_FACES;

	const upload = async (files: File[]) => {
		const added = new Set<string>();
		for (const file of files.slice(0, MAX_DOCUMENT_FONT_FACES - faces.length)) {
			try {
				const { family, weight, italic, url } = await uploadFont(file);
				updateResumeData((draft) => addUploadedFontFace(draft.metadata.typography, { family, weight, italic, url }));
				added.add(family);
			} catch (error) {
				if (openPlanDialogForError(error)) return;
				toast.add({
					type: "error",
					title: file.name,
					description:
						describeFontProblem(error) ?? getReadableErrorMessage(error, t`Couldn't upload the font. Try again.`),
				});
			}
		}
		const [family, ...others] = added;
		if (family && others.length === 0)
			toast.add({ type: "success", description: t`${family} is ready. Choose it under Font family.` });
		else if (family)
			toast.add({ type: "success", description: t`Your fonts are ready. Choose them under Font family.` });
	};

	const remove = async (family: string) => {
		const confirmed = await confirm(t`Remove ${family}?`, {
			description: t`Text set in it moves to the default font. You can upload the font again later.`,
			confirmText: t`Remove font`,
		});
		if (confirmed) updateResumeData((draft) => removeUploadedFontFamily(draft.metadata.typography, family));
	};

	return (
		<div className="col-span-full grid gap-2">
			<h4 className="text-sm font-semibold">
				<Trans>Your fonts</Trans>
			</h4>

			{uploadedFontFamilies(faces).map((family) => {
				const familyFaces = faces
					.filter((face) => face.family === family)
					.toSorted((a, b) => Number(a.weight) - Number(b.weight) || Number(a.italic) - Number(b.italic));
				return (
					<div key={family} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2">
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-medium">{family}</p>
							<p className="truncate text-xs text-muted tabular-nums">{familyFaces.map(faceLabel).join(" · ")}</p>
						</div>
						<IconButton
							icon="trash"
							label={t`Remove ${family}`}
							variant="ghost"
							size="sm"
							isDisabled={isLocked}
							onPress={() => void remove(family)}
						/>
					</div>
				);
			})}

			<p className="text-xs text-muted">
				{planLocked ? (
					<Trans>Your own fonts aren't in your plan. Fonts already added keep working on the page.</Trans>
				) : (
					<Trans>
						Upload TTF or OTF files you have the right to use, one file per weight or style. Anyone who opens a shared
						link to this document can download them.
					</Trans>
				)}
			</p>

			<input
				ref={inputRef}
				type="file"
				accept=".ttf,.otf,font/ttf,font/otf"
				multiple
				hidden
				onChange={(event) => {
					const files = [...(event.target.files ?? [])];
					event.target.value = "";
					if (files.length > 0) void upload(files);
				}}
			/>
			<Button
				variant="secondary"
				fullWidth
				isPending={isPending}
				isDisabled={isLocked || full}
				onPress={() => {
					if (planLocked) openPlanDialog({ kind: "feature", feature: "customFonts" });
					else inputRef.current?.click();
				}}
			>
				<Icon name={planLocked ? "lock" : "upload-simple"} />
				{full ? <Trans>Font limit reached</Trans> : <Trans>Upload font</Trans>}
			</Button>
		</div>
	);
}

/** The weights to give text when it switches to `family`: an uploaded family's own, else the catalog's. */
export function nextFontWeights(faces: CustomFontFace[] | undefined, family: string, heading: boolean) {
	return getNextWeights(family, heading, uploadedFontWeights(faces, family));
}
