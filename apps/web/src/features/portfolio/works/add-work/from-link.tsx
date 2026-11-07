import type { UnfurledLink } from "../../media/remote";
import type { StepProps } from "./parts";
import type { PortfolioBlockOf } from "@rezumi/schema/portfolio/blocks";
import type { PortfolioImage } from "@rezumi/schema/portfolio/files";
import { Button, Checkbox, Chip, Label, Modal, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useState } from "react";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { generateId } from "@rezumi/utils/string";
import { TextInput } from "../../editor/fields";
import { editPortfolio, usePortfolioData, usePortfolioEditorStore } from "../../editor/store";
import { usePortfolioEditorUi } from "../../editor/ui";
import { discardUnplacedImages, isAbort } from "../../images/upload";
import { useRequestSignals } from "../../images/use-request-signals";
import { linkBlockFromUnfurl, readLinkAddress, videoBlockFromUnfurl, workFromLink } from "../../media/link-blocks";
import {
	importRemotePicture,
	importVideoThumbnail,
	unfurlErrorMessage,
	unfurlLink,
	videoThumbnailCandidates,
} from "../../media/remote";
import { usePortfolioLimits } from "../limits";
import { workRoom } from "../works";
import { BackButton, StepAlert } from "./parts";

type LinkPreview = { picture: string | null; block: PortfolioBlockOf<"link"> | PortfolioBlockOf<"video"> };

/** A preview from what the server read: the block it makes and the picture it would copy as the cover. */
function previewOf(result: UnfurledLink, pasted: string): LinkPreview {
	if (result.kind === "video") {
		const block = videoBlockFromUnfurl(result);
		return { block, picture: videoThumbnailCandidates(block).at(-1) ?? null };
	}
	return { block: linkBlockFromUnfurl(result, pasted), picture: result.imageUrl ?? null };
}

/**
 * A work from a pasted link (`02-teknis.md` section 20): the server reads the page, the card fills in (all of it can
 * be changed), and its picture becomes the cover only if the person agrees, copied into the portfolio first. A site
 * that can't be read still makes a work: the person fills it in. Closing the dialog stops what's still on its way.
 */
export function FromLink({ onBack, onClose }: StepProps) {
	const data = usePortfolioData();
	const limits = usePortfolioLimits();
	const openWork = usePortfolioEditorUi((state) => state.openWork);
	const requests = useRequestSignals();
	const [text, setText] = useState("");
	const [reading, setReading] = useState(false);
	const [preview, setPreview] = useState<LinkPreview | null>(null);
	const [failure, setFailure] = useState<string | null>(null);
	const [title, setTitle] = useState("");
	const [summary, setSummary] = useState("");
	const [useCover, setUseCover] = useState(true);
	const [adding, setAdding] = useState(false);
	const address = readLinkAddress(text);
	const full = workRoom(data, limits.works) === 0;

	const read = async () => {
		if (!address.ok) return;
		const { url } = address;
		const signal = requests.next("read");
		setReading(true);
		setFailure(null);
		setPreview(null);
		try {
			const result = await unfurlLink(url, signal);
			setPreview(previewOf(result, url));
			setTitle(result.title ?? "");
			setSummary(result.kind === "link" ? (result.description ?? "") : "");
		} catch (error) {
			if (isAbort(error, signal)) return;
			setFailure(unfurlErrorMessage(error));
			setPreview({ block: { id: generateId(), type: "link", url, title: "" }, picture: null });
		} finally {
			if (!signal.aborted) setReading(false);
		}
	};

	const add = async () => {
		if (!preview || !address.ok) return;
		const signal = requests.next("add");
		setAdding(true);
		try {
			const block = { ...preview.block };
			let cover: PortfolioImage | undefined;
			if (useCover && preview.picture) {
				cover =
					block.type === "video"
						? await importVideoThumbnail({ ...block, title: title.trim() }, signal)
						: await importRemotePicture(preview.picture, title.trim(), signal).catch((error: unknown) => {
								if (isAbort(error, signal)) throw error;
								return undefined;
							});
				if (!cover) toast.add({ description: t`The picture couldn't be copied. Add a cover yourself.` });
			}
			if (cover && block.type === "video") block.thumbnail = cover;
			if (cover && block.type === "link") block.image = cover;
			if (block.type === "link" && !block.title.trim())
				block.title = title.trim().slice(0, PORTFOLIO_LIMITS.text.linkTitle);
			const current = usePortfolioEditorStore.getState().portfolio?.data ?? data;
			if (workRoom(current, limits.works) === 0) {
				// The portfolio filled up meanwhile (another tab, an import): the copied cover isn't used.
				if (cover) discardUnplacedImages([cover]);
				return;
			}
			const linkUrl = block.type === "link" ? block.url : address.url;
			const work = workFromLink(current, { url: linkUrl, title: title.trim(), summary: summary.trim() }, block, cover);
			editPortfolio(
				(draft) => {
					draft.works.items.push(work);
				},
				{ structural: true },
			);
			onClose();
			openWork(work.id);
		} catch (error) {
			if (!isAbort(error, signal)) throw error;
		} finally {
			if (!signal.aborted) setAdding(false);
		}
	};

	return (
		<>
			<Modal.Body className="grid gap-4">
				<div className="grid gap-2">
					<TextInput
						label={t`Link`}
						value={text}
						maxLength={PORTFOLIO_LIMITS.text.url}
						placeholder="https://www.behance.net/gallery/…"
						description={t`Behance, Dribbble, GitHub, Figma, Medium, YouTube, Vimeo or any public page.`}
						isDisabled={adding}
						onChange={(value) => {
							setText(value);
							// What was read, and its picture, belong to the link that was there.
							requests.cancel("read");
							setReading(false);
							setPreview(null);
							setFailure(null);
						}}
					/>
					<Button className="w-fit" isDisabled={!address.ok || reading || adding || full} onPress={() => void read()}>
						{reading ? <Spinner size="sm" /> : <Icon name="magnifying-glass" size={16} />}
						<Trans>Read the link</Trans>
					</Button>
					{full && (
						<p className="text-xs text-danger">
							<Trans>This portfolio already holds {limits.works} works.</Trans>
						</p>
					)}
				</div>
				{failure && <StepAlert status="warning" message={failure} />}
				{preview && (
					<div className="grid gap-3 rounded-2xl border border-border p-3">
						{preview.block.type === "video" && (
							<Chip size="sm" variant="soft" className="w-fit">
								<Icon name="play" size={14} />
								<Trans>Video: it plays on your page when a visitor presses play</Trans>
							</Chip>
						)}
						<TextInput
							label={t`Title of the work`}
							value={title}
							maxLength={PORTFOLIO_LIMITS.text.workTitle}
							onChange={setTitle}
						/>
						<TextInput
							label={t`Short summary`}
							multiline
							value={summary}
							maxLength={PORTFOLIO_LIMITS.text.workSummary}
							onChange={setSummary}
						/>
						{preview.picture && (
							<div className="grid gap-2">
								{/* Loaded from the other site for this preview only, without telling it where it's shown. */}
								<img
									src={preview.picture}
									alt=""
									referrerPolicy="no-referrer"
									className="max-h-40 w-auto max-w-full justify-self-start rounded-lg"
								/>
								<Checkbox isSelected={useCover} onChange={setUseCover}>
									<Checkbox.Content>
										<Checkbox.Control>
											<Checkbox.Indicator />
										</Checkbox.Control>
										<Label className="text-sm">
											<Trans>Use this picture as the cover (it's copied into your portfolio)</Trans>
										</Label>
									</Checkbox.Content>
								</Checkbox>
								<span className="text-xs text-muted">
									<Trans>Use it only if you may show it. Your page never loads pictures from other sites.</Trans>
								</span>
							</div>
						)}
					</div>
				)}
			</Modal.Body>
			<Modal.Footer>
				<BackButton onPress={onBack} />
				<Button isDisabled={!preview || adding || reading || full} onPress={() => void add()}>
					{adding && <Spinner size="sm" />}
					<Trans>Add work</Trans>
				</Button>
			</Modal.Footer>
		</>
	);
}
