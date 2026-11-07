import type { UploadedImage } from "../../images/upload";
import type { StepProps } from "./parts";
import { Button, Label, Modal, RadioGroup } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useState } from "react";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { RadioOption, TextInput } from "../../editor/fields";
import { editPortfolio, usePortfolioData, usePortfolioEditorStore } from "../../editor/store";
import { usePortfolioEditorUi } from "../../editor/ui";
import { ImageDrop, portfolioImageSrc, UploadStatus, useImageUploads } from "../../images/image-field";
import { discardUnplacedImages } from "../../images/upload";
import { usePortfolioLimits } from "../limits";
import { titleFromFileName, workRoom, worksFromImages } from "../works";
import { BackButton } from "./parts";

/**
 * Pictures as works: uploaded one by one (shrunk in the browser), then one work for all, or one per picture. Closing
 * the dialog or going back cancels the upload: no work is added after that, and pictures already up are deleted.
 */
export function FromPictures({ onBack, onClose }: StepProps) {
	const data = usePortfolioData();
	const limits = usePortfolioLimits();
	const openWork = usePortfolioEditorUi((state) => state.openWork);
	const uploads = useImageUploads();
	const [mode, setMode] = useState<"one" | "each">("one");
	const [title, setTitle] = useState("");
	const [done, setDone] = useState<UploadedImage[]>([]);

	const upload = async (files: File[]) => {
		const room = workRoom(data, limits.works);
		const picked = files.slice(0, mode === "one" ? PORTFOLIO_LIMITS.imagesPerBlock * room : room);
		const kept = await uploads.uploadNamed(picked, {
			alt: (index) => (mode === "one" ? title.trim() : titleFromFileName(picked[index]?.name ?? "")),
		});
		// Nothing came through, or the upload was cancelled (the dialog closed): the portfolio stays as it is.
		if (!kept.length) return;
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
		if (kept.length === picked.length) {
			onClose();
			if (works.length === 1 && works[0]) openWork(works[0].id);
		}
	};

	return (
		<>
			<Modal.Body className="grid gap-4">
				<RadioGroup
					value={mode}
					onChange={(value) => setMode(value as "one" | "each")}
					isDisabled={uploads.busy || done.length > 0}
				>
					<Label>
						<Trans>Make</Trans>
					</Label>
					<RadioOption value="one">
						<Trans>One work with all the pictures</Trans>
					</RadioOption>
					<RadioOption value="each">
						<Trans>One work per picture (photographers, illustrators)</Trans>
					</RadioOption>
				</RadioGroup>
				{mode === "one" && (
					<TextInput
						label={t`Title of the work`}
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
						description={t`JPG, PNG or WebP. Each is shrunk in your browser before it's uploaded, and its location data is removed.`}
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
				<UploadStatus progress={uploads.progress} errors={uploads.errors} />
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
