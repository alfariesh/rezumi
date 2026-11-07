import type { ReactNode } from "react";
import { Modal } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useId, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { editPortfolio, usePortfolioData } from "../../editor/store";
import { usePortfolioEditorUi } from "../../editor/ui";
import { newWork } from "../works";
import { FromLink } from "./from-link";
import { FromPictures } from "./from-pictures";
import { FromResume } from "./from-resume";

type Way = "empty" | "resume" | "pictures" | "link";

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

type AddWorkDialogProps = { onClose: () => void };

/** "Add work": empty, from resume projects, from pictures, or from a pasted link. */
export function AddWorkDialog({ onClose }: AddWorkDialogProps) {
	const id = useId();
	const data = usePortfolioData();
	const openWork = usePortfolioEditorUi((state) => state.openWork);
	const [way, setWay] = useState<Way | null>(null);

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
	};

	return (
		<Modal.Backdrop isOpen onOpenChange={(open) => !open && onClose()}>
			<Modal.Container size="md">
				<Modal.Dialog aria-labelledby={`${id}-title`}>
					<Modal.CloseTrigger aria-label={t`Close`} />
					<Modal.Header>
						<Modal.Heading id={`${id}-title`}>
							{way === "resume" ? (
								<Trans>Add work from your resume</Trans>
							) : way === "pictures" ? (
								<Trans>Add work from pictures</Trans>
							) : way === "link" ? (
								<Trans>Add work from a link</Trans>
							) : (
								<Trans>Add work</Trans>
							)}
						</Modal.Heading>
					</Modal.Header>
					{way === "resume" ? (
						<FromResume onBack={() => setWay(null)} onClose={onClose} />
					) : way === "pictures" ? (
						<FromPictures onBack={() => setWay(null)} onClose={onClose} />
					) : way === "link" ? (
						<FromLink onBack={() => setWay(null)} onClose={onClose} />
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
								title={<Trans>From my resume</Trans>}
								text={<Trans>Pick projects from your resume: title, summary, dates and link come along.</Trans>}
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
						</Modal.Body>
					)}
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}
