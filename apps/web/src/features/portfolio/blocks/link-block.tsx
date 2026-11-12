import type { EditBlock } from "./video-block";
import type { PortfolioBlockOf } from "@rezumi/schema/portfolio/blocks";
import type { PortfolioWork } from "@rezumi/schema/portfolio/data";
import { Button, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useRef, useState } from "react";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { Icon } from "@rezumi/ui/components/icon";
import { TextInput, UrlInput } from "../editor/fields";
import { ImageField } from "../images/image-field";
import { discardUploadedImages, isAbort } from "../images/upload";
import { useRequestSignals } from "../images/use-request-signals";
import { linkBlockFromUnfurl, siteOf, useLinkSuggestions } from "../media/link-blocks";
import { importRemotePicture, remotePictureErrorMessage, unfurlErrorMessage, unfurlLink } from "../media/remote";
import { currentBlock, ErrorNote } from "./add-media-block";
import { openPlanDialogForError } from "@/features/billing/plan-dialog";

const { text: max } = PORTFOLIO_LIMITS;

type LinkBlockEditorProps = { work: PortfolioWork; block: PortfolioBlockOf<"link">; edit: EditBlock<"link"> };

/**
 * A link card: the address, what the page said about itself (all editable), and a picture: one the person uploads,
 * or the page's own once they agree to copy it. A new address drops the page's suggested picture, and the site name
 * and description when it's another site.
 */
export function LinkBlockEditor({ work, block, edit }: LinkBlockEditorProps) {
	const suggestion = useLinkSuggestions((state) => state.pictures[block.id]);
	const [reading, setReading] = useState(false);
	const [copying, setCopying] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const requests = useRequestSignals();
	const key = (field: string) => ({ key: `works.${work.id}.blocks.${block.id}.${field}` });
	// The site the card's text came from. While the address is typed it passes through other sites ("https://d" on the
	// way to dribbble.com), so the site name and description are only dropped once typing ends on another site.
	const cardSite = useRef(siteOf(block.url));

	const readAgain = async () => {
		const signal = requests.next("read");
		setReading(true);
		setError(null);
		try {
			const result = await unfurlLink(block.url, signal);
			if (result.kind === "video") {
				setError(t`This is a video. Add it as a Video block to play it on the page.`);
				return;
			}
			const fresh = linkBlockFromUnfurl(result, block.url);
			edit(
				(draft) => {
					draft.url = fresh.url;
					draft.title = fresh.title;
					if (fresh.description) draft.description = fresh.description;
					if (fresh.siteName) draft.siteName = fresh.siteName;
					if (fresh.brandIcon) draft.brandIcon = fresh.brandIcon;
					else delete draft.brandIcon;
				},
				{ structural: true },
			);
			cardSite.current = siteOf(fresh.url);
			if (result.imageUrl) useLinkSuggestions.getState().suggest(block.id, result.imageUrl);
			else useLinkSuggestions.getState().dismiss(block.id);
		} catch (failure) {
			if (!isAbort(failure, signal)) setError(unfurlErrorMessage(failure));
		} finally {
			if (!signal.aborted) setReading(false);
		}
	};

	const copyPicture = async (url: string) => {
		const signal = requests.next("picture");
		setCopying(true);
		setError(null);
		try {
			const image = await importRemotePicture(url, block.title, signal);
			if (currentBlock(work.id, block.id)?.type !== "link") {
				void discardUploadedImages([image]);
				return;
			}
			edit(
				(draft) => {
					draft.image = image;
				},
				{ structural: true },
			);
			useLinkSuggestions.getState().dismiss(block.id);
		} catch (failure) {
			if (isAbort(failure, signal)) return;
			openPlanDialogForError(failure);
			setError(remotePictureErrorMessage(failure));
		} finally {
			if (!signal.aborted) setCopying(false);
		}
	};

	const changeUrl = (url: string | undefined) => {
		if (!url) return;
		// The suggested picture belongs to the page the card pointed at.
		useLinkSuggestions.getState().dismiss(block.id);
		requests.cancel("picture");
		edit((draft) => {
			draft.url = url;
			delete draft.brandIcon;
		}, key("url"));
	};

	/** Typing is over: what the page said goes when the address now leads to another site. */
	const leaveUrl = () => {
		const site = siteOf(block.url);
		if (site === cardSite.current) return;
		cardSite.current = site;
		if (block.siteName === undefined && block.description === undefined) return;
		edit((draft) => {
			delete draft.siteName;
			delete draft.description;
		}, key("url"));
	};

	return (
		<div className="grid gap-3">
			<UrlInput label={t`Link`} webOnly value={block.url} onChange={changeUrl} onBlur={leaveUrl} />
			<Button size="sm" variant="secondary" className="w-fit" isDisabled={reading} onPress={() => void readAgain()}>
				{reading ? <Spinner size="sm" /> : <Icon name="arrows-clockwise" size={16} />}
				<Trans>Fill in from the link</Trans>
			</Button>
			<TextInput
				label={t`Title`}
				icon="text-t"
				value={block.title}
				maxLength={max.linkTitle}
				placeholder={block.url}
				onChange={(value) =>
					edit((draft) => {
						draft.title = value;
					}, key("title"))
				}
			/>
			<TextInput
				label={t`Description (optional)`}
				multiline
				value={block.description ?? ""}
				maxLength={max.linkDescription}
				onChange={(value) =>
					edit((draft) => {
						draft.description = value;
					}, key("description"))
				}
			/>
			<TextInput
				label={t`Site name (optional)`}
				icon="globe"
				value={block.siteName ?? ""}
				maxLength={max.siteName}
				placeholder="Behance"
				onChange={(value) =>
					edit((draft) => {
						draft.siteName = value;
					}, key("siteName"))
				}
			/>
			{suggestion && !block.image && (
				<div className="grid gap-2 rounded-xl border border-separator p-3">
					<span className="text-sm font-medium">
						<Trans>Use the page's picture?</Trans>
					</span>
					{/* Loaded from the other site for this preview only, without telling it where it's shown. */}
					<img
						src={suggestion}
						alt=""
						referrerPolicy="no-referrer"
						className="max-h-40 w-auto max-w-full justify-self-start rounded-lg"
					/>
					<span className="text-body-xs text-muted">
						<Trans>
							It's copied into your portfolio, so your page never loads pictures from other sites. Use it only if you
							may show it.
						</Trans>
					</span>
					<div className="flex flex-wrap gap-2">
						<Button size="sm" isDisabled={copying} onPress={() => void copyPicture(suggestion)}>
							{copying && <Spinner size="sm" />}
							<Trans>Use this picture</Trans>
						</Button>
						<Button size="sm" variant="ghost" onPress={() => useLinkSuggestions.getState().dismiss(block.id)}>
							<Trans>No picture</Trans>
						</Button>
					</div>
				</div>
			)}
			<ImageField
				label={t`Picture (optional)`}
				value={block.image}
				altSuggestion={block.title}
				onChange={(image) =>
					edit(
						(draft) => {
							if (image) draft.image = image;
							else delete draft.image;
						},
						{ structural: true },
					)
				}
			/>
			{error && <ErrorNote message={error} />}
		</div>
	);
}
