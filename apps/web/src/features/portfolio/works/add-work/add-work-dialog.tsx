import type { ReactNode } from "react";
import { Modal } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { newWork } from "@rezumi/portfolio/editing";
import { Icon } from "@rezumi/ui/components/icon";
import { usePortfolioSource } from "../../editor/context";
import { editPortfolio, usePortfolioData } from "../../editor/store";
import { usePortfolioEditorUi } from "../../editor/ui";
import { focusWorkTitle } from "../doc-focus";
import { FromLink } from "./from-link";
import { FromPictures } from "./from-pictures";
import { FromResume } from "./from-resume";
import { FromSite } from "./from-site";
import { orpc } from "@/libs/orpc/client";

export type AddWorkWay = "empty" | "resume" | "pictures" | "link" | "site";

/** Whether this account's server imports websites (and the account may: it isn't a guest). */
export function useCanImportSite() {
	const { data } = useQuery(orpc.profile.sources.status.queryOptions());
	return Boolean(data?.website && data.websiteImportFree !== undefined);
}

type WayCardProps = {
	icon: Parameters<typeof Icon>[0]["name"];
	title: ReactNode;
	text: ReactNode;
	onPress: () => void;
};

function WayCard({ icon, title, text, onPress }: WayCardProps) {
	return (
		<button
			type="button"
			onClick={onPress}
			className="flex cursor-(--cursor-interactive) items-start gap-3 rounded-2xl border border-border p-3 text-start outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus"
		>
			<span className="grid size-9 shrink-0 place-items-center rounded-xl bg-default text-muted">
				<Icon name={icon} size={18} />
			</span>
			<span className="grid gap-0.5">
				<span className="text-sm font-medium">{title}</span>
				<span className="text-xs text-muted">{text}</span>
			</span>
		</button>
	);
}

type AddWorkDialogProps = {
	onClose: () => void;
	/** Opens straight on one way (the empty list's "Import from your website"). */
	initialWay?: AddWorkWay | null;
};

/** "Add work": empty, from resume projects, from pictures, from a pasted link, or from the person's own website. */
export function AddWorkDialog({ onClose, initialWay = null }: AddWorkDialogProps) {
	const id = useId();
	const data = usePortfolioData();
	const openWork = usePortfolioEditorUi((state) => state.openWork);
	const [way, setWay] = useState<AddWorkWay | null>(initialWay);
	const canImportSite = useCanImportSite();
	const fromProfile = usePortfolioSource().from === "profile";
	// A step in the middle of an upload or import: closing would cut it short, so only its own buttons end it.
	const [busy, setBusy] = useState(false);

	const addEmpty = () => {
		const work = newWork(data);
		editPortfolio(
			(draft) => {
				draft.works.items.push(work);
			},
			{ structural: true },
		);
		onClose();
		openWork(work.id);
		// An empty work starts with its name.
		focusWorkTitle(work.id);
	};

	return (
		<Modal.Backdrop
			isOpen
			isDismissable={!busy}
			isKeyboardDismissDisabled={busy}
			onOpenChange={(open) => !open && onClose()}
		>
			<Modal.Container size="md">
				<Modal.Dialog aria-labelledby={`${id}-title`}>
					{!busy && <Modal.CloseTrigger aria-label={t`Close`} />}
					<Modal.Header>
						<Modal.Heading id={`${id}-title`}>
							{way === "resume" ? (
								fromProfile ? (
									<Trans>Add work from your Profile</Trans>
								) : (
									<Trans>Add work from your resume</Trans>
								)
							) : way === "pictures" ? (
								<Trans>Add work from pictures</Trans>
							) : way === "link" ? (
								<Trans>Add work from a link</Trans>
							) : way === "site" ? (
								<Trans>Import from your website</Trans>
							) : (
								<Trans>Add work</Trans>
							)}
						</Modal.Heading>
					</Modal.Header>
					{way === "resume" ? (
						<FromResume onBack={() => setWay(null)} onClose={onClose} onBusy={setBusy} />
					) : way === "pictures" ? (
						<FromPictures onBack={() => setWay(null)} onClose={onClose} onBusy={setBusy} />
					) : way === "link" ? (
						<FromLink onBack={() => setWay(null)} onClose={onClose} onBusy={setBusy} />
					) : way === "site" ? (
						<FromSite onBack={() => setWay(null)} onClose={onClose} onBusy={setBusy} />
					) : (
						<Modal.Body className="grid gap-2">
							<WayCard
								icon="file-plus"
								title={<Trans>Empty</Trans>}
								text={<Trans>Fill in the card, then build the detail from blocks.</Trans>}
								onPress={addEmpty}
							/>
							<WayCard
								icon="file-text"
								title={fromProfile ? <Trans>From my Profile</Trans> : <Trans>From my resume</Trans>}
								text={
									fromProfile ? (
										<Trans>Pick projects from your Profile: title, summary, dates and link come along.</Trans>
									) : (
										<Trans>Pick projects from your resume: title, summary, dates and link come along.</Trans>
									)
								}
								onPress={() => setWay("resume")}
							/>
							<WayCard
								icon="image"
								title={<Trans>Upload pictures</Trans>}
								text={<Trans>Many at once: one work with all of them, or one work per picture.</Trans>}
								onPress={() => setWay("pictures")}
							/>
							<WayCard
								icon="link-simple-horizontal"
								title={<Trans>Paste a link</Trans>}
								text={<Trans>Behance, Dribbble, GitHub, YouTube or any site fills in the card.</Trans>}
								onPress={() => setWay("link")}
							/>
							{canImportSite && (
								<WayCard
									icon="globe"
									title={<Trans>Import from your website</Trans>}
									text={<Trans>Your own site's works at once, with their story, numbers and pictures.</Trans>}
									onPress={() => setWay("site")}
								/>
							)}
						</Modal.Body>
					)}
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}
