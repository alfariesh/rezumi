import type { UploadedImage } from "../../images/upload";
import type { StepProps } from "./parts";
import { Button, Modal } from "@heroui/react";
import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useState } from "react";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { ChoiceSelect, TextInput } from "../../editor/fields";
import { editPortfolio, usePortfolioData, usePortfolioEditorStore } from "../../editor/store";
import { usePortfolioEditorUi } from "../../editor/ui";
import { ImageDrop, portfolioImageSrc, UploadStatus, useImageUploads } from "../../images/image-field";
import { discardUnplacedImages } from "../../images/upload";
import { usePortfolioLimits } from "../limits";
import { titleFromFileName, workRoom, worksFromImages } from "../works";
import { BackButton, useReportBusy } from "./parts";
import { usePlan } from "@/features/billing/plan";
import { openPlanDialog } from "@/features/billing/plan-dialog";

/**
 * Pictures as works: uploaded one by one (shrunk in the browser), then one work for all, or one per picture. Closing
 * the dialog or going back cancels the upload: no work is added after that, and pictures already up are deleted.
 */
export function FromPictures({ onBack, onClose, onBusy }: StepProps) {
	const data = usePortfolioData();
	const limits = usePortfolioLimits();
	const openWork = usePortfolioEditorUi((state) => state.openWork);
	const uploads = useImageUploads();
	const [mode, setMode] = useState<"one" | "each">("one");
	const [title, setTitle] = useState("");
	const [done, setDone] = useState<UploadedImage[]>([]);
	const plan = usePlan();
	useReportBusy(uploads.busy, onBusy);

	const upload = async (files: File[]) => {
		const room = workRoom(data, limits.works);
		const picked = files.slice(0, mode === "one" ? PORTFOLIO_LIMITS.imagesPerBlock * room : room);
		const kept = await uploads.uploadNamed(picked, {
			alt: (index) => (mode === "one" ? title.trim() : titleFromFileName(picked[index]?.name ?? "")),
		});
		// Nothing came through, or the upload was cancelled (the dialog closed): the portfolio stays as it is.
		if (!kept.length) return;
		const left = files.length - picked.length;
		if (left > 0) {
			// The dialog stays open to say so; a plan's limit is explained by the plan dialog too.
			uploads.addError(
				mode === "one"
					? plural(left, {
							one: "# picture wasn't added: there's no room for it in these works.",
							other: "# pictures weren't added: there's no room for them in these works.",
						})
					: plural(left, {
							one: "# picture wasn't added: your portfolio has no room for another work.",
							other: "# pictures weren't added: your portfolio has no room for more works.",
						}),
			);
			if (plan?.enabled && limits.works < PORTFOLIO_LIMITS.works)
				openPlanDialog({
					kind: "limit",
					limit: "portfolioWorks",
					max: limits.works,
					used: Math.min(limits.works, data.works.items.length + room),
				});
		}
		setDone(kept);
		const current = usePortfolioEditorStore.getState().portfolio?.data ?? data;
		const works = worksFromImages(current, kept, mode, title.trim(), limits.works);
		editPortfolio(
			(draft) => {
				draft.works.items.push(...works);
			},
			{ structural: true },
		);
		// Pictures the portfolio had no more room for when they arrived aren't kept.
		discardUnplacedImages(kept.map((entry) => entry.image));
		// When some pictures failed, the dialog stays open to say which; the rest are already in.
		if (kept.length === files.length) {
			onClose();
			if (works.length === 1 && works[0]) openWork(works[0].id);
		}
	};

	return (
		<>
			<Modal.Body className="grid gap-4">
				<ChoiceSelect
					label={t`Make`}
					value={mode}
					options={[
						{ id: "one", label: t`One work with all the pictures` },
						{ id: "each", label: t`One work per picture` },
					]}
					onChange={setMode}
				/>
				{mode === "one" && (
					<TextInput
						label={t`Title of the work`}
						icon="text-t"
						value={title}
						maxLength={PORTFOLIO_LIMITS.text.workTitle}
						placeholder={t`Wedding photos, Bandung 2025`}
						isDisabled={uploads.busy || done.length > 0}
						onChange={setTitle}
					/>
				)}
				{done.length === 0 && (
					<ImageDrop
						multiple
						label={t`Drop pictures here`}
						isDisabled={uploads.busy}
						onFiles={(files) => void upload(files)}
					/>
				)}
				{done.length > 0 && (
					<div className="flex flex-wrap gap-2" aria-label={t`Uploaded pictures`}>
						{done.map(({ image }) => (
							<img key={image.key} src={portfolioImageSrc(image)} alt="" className="size-14 rounded-lg object-cover" />
						))}
					</div>
				)}
				<UploadStatus progress={uploads.progress} errors={uploads.errors} onDismiss={uploads.clearErrors} />
			</Modal.Body>
			<Modal.Footer>
				{uploads.busy ? (
					<Button variant="ghost" onPress={uploads.cancel}>
						<Trans>Cancel</Trans>
					</Button>
				) : done.length === 0 ? (
					<BackButton onPress={onBack} />
				) : (
					<Button onPress={onClose}>
						<Trans>Done</Trans>
					</Button>
				)}
			</Modal.Footer>
		</>
	);
}
