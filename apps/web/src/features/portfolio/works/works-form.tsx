import type { UnfurledLink } from "../media/remote";
import type { PortfolioBlockOf } from "@rezumi/schema/portfolio/blocks";
import type { PortfolioImage } from "@rezumi/schema/portfolio/files";
import type { ReactNode } from "react";
import { Alert, Button, Checkbox, Chip, Label, Modal, RadioGroup, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useId, useState } from "react";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { toast } from "@rezumi/ui/components/toast";
import { generateId } from "@rezumi/utils/string";
import { cn } from "@rezumi/utils/style";
import { useSourceResume } from "../editor/context";
import { moveItem, normalizePortfolioUrl, RadioOption, TextInput } from "../editor/fields";
import { editPortfolio, usePortfolioData, usePortfolioEditorStore, usePortfolioRecord } from "../editor/store";
import { usePortfolioEditorUi } from "../editor/ui";
import { ImageDrop, portfolioImageSrc, UploadStatus, useImageUploads } from "../images/image-field";
import { linkBlockFromUnfurl, videoBlockFromUnfurl, workFromLink } from "../media/link-blocks";
import {
	importRemotePicture,
	importVideoThumbnail,
	unfurlErrorMessage,
	unfurlLink,
	videoThumbnailCandidates,
} from "../media/remote";
import { newWork, resumeProjects, titleFromFileName, workRoom, worksFromImages } from "./works";
import { useConfirm } from "@/hooks/use-confirm";
import { client } from "@/libs/orpc/client";

/**
 * Work: the list of works in page order, each opening its own editor. Hidden works stay listed; featured ones are
 * marked. "Add work" starts empty, from resume projects, or from pictures.
 */
export function WorksForm() {
	const { works } = usePortfolioData();
	const openWork = usePortfolioEditorUi((state) => state.openWork);
	const confirm = useConfirm();
	const [adding, setAdding] = useState(false);
	const items = works.items;

	const remove = async (id: string, title: string) => {
		const confirmed = await confirm(t`Delete “${title}”?`, {
			description: t`The work and its blocks leave the portfolio. You can undo this.`,
			confirmText: t`Delete work`,
		});
		if (!confirmed) return;
		editPortfolio(
			(draft) => {
				draft.works.items = draft.works.items.filter((work) => work.id !== id);
			},
			{ structural: true },
		);
	};

	return (
		<div className="grid gap-3">
			{items.length === 0 && (
				<p className="text-sm text-muted">
					<Trans>
						Show what you made: a project, a design, an article. Each work has a card in the list and a detail built
						from text, pictures and results.
					</Trans>
				</p>
			)}
			<ul className="grid gap-2">
				{items.map((work, index) => {
					const title = work.title.trim() || t`Untitled work`;
					return (
						<li key={work.id} className="flex items-center gap-2 rounded-2xl bg-surface-secondary p-2">
							<button
								type="button"
								onClick={() => openWork(work.id)}
								className="flex min-w-0 flex-1 cursor-(--cursor-interactive) items-center gap-3 rounded-xl text-start outline-none focus-visible:ring-2 focus-visible:ring-focus"
							>
								{work.cover ? (
									<img
										src={portfolioImageSrc(work.cover)}
										alt=""
										className="size-12 shrink-0 rounded-lg object-cover"
										style={
											work.cover.focus
												? { objectPosition: `${work.cover.focus.x * 100}% ${work.cover.focus.y * 100}%` }
												: undefined
										}
									/>
								) : (
									<span className="grid size-12 shrink-0 place-items-center rounded-lg bg-default text-muted">
										<Icon name="image" size={20} />
									</span>
								)}
								<span className="grid min-w-0 gap-0.5">
									<span className={cn("truncate text-sm font-medium", work.hidden && "text-muted line-through")}>
										{title}
									</span>
									<span className="flex flex-wrap items-center gap-1 text-xs text-muted">
										{work.featured && (
											<Chip size="sm" variant="soft" color="accent">
												<Trans>Featured</Trans>
											</Chip>
										)}
										{work.hidden && (
											<Chip size="sm" variant="soft">
												<Trans>Hidden</Trans>
											</Chip>
										)}
										<Plural value={work.blocks.length} _0="No blocks yet" one="# block" other="# blocks" />
									</span>
								</span>
							</button>
							<div className="flex shrink-0 items-center">
								<IconButton
									icon={work.hidden ? "eye-slash" : "eye"}
									size="sm"
									aria-pressed={work.hidden}
									label={work.hidden ? t`Show ${title} on the page` : t`Hide ${title} from the page`}
									className={cn(work.hidden && "text-muted")}
									onPress={() =>
										editPortfolio((draft) => {
											const target = draft.works.items[index];
											if (target) target.hidden = !target.hidden;
										})
									}
								/>
								<IconButton
									icon="arrow-up"
									size="sm"
									label={t`Move ${title} up`}
									isDisabled={index === 0}
									onPress={() =>
										editPortfolio((draft) => moveItem(draft.works.items, index, index - 1), { structural: true })
									}
								/>
								<IconButton
									icon="arrow-down"
									size="sm"
									label={t`Move ${title} down`}
									isDisabled={index === items.length - 1}
									onPress={() =>
										editPortfolio((draft) => moveItem(draft.works.items, index, index + 1), { structural: true })
									}
								/>
								<IconButton
									icon="trash"
									size="sm"
									label={t`Delete ${title}`}
									className="text-danger"
									onPress={() => void remove(work.id, title)}
								/>
							</div>
						</li>
					);
				})}
			</ul>
			<div className="flex flex-wrap items-center gap-3">
				<Button variant="secondary" isDisabled={workRoom({ works }) === 0} onPress={() => setAdding(true)}>
					<Icon name="plus" size={18} />
					<Trans>Add work</Trans>
				</Button>
				{items.length > 0 && (
					<span className="text-xs text-muted">
						{items.length}/{PORTFOLIO_LIMITS.works}
					</span>
				)}
			</div>
			{adding && <AddWorkDialog onClose={() => setAdding(false)} />}
		</div>
	);
}

type Way = "empty" | "resume" | "pictures" | "link";

type WayCardProps = {
	icon: Parameters<typeof Icon>[0]["name"];
	title: ReactNode;
	text: ReactNode;
	soon?: boolean;
	onPress: () => void;
};

function WayCard({ icon, title, text, soon = false, onPress }: WayCardProps) {
	return (
		<button
			type="button"
			disabled={soon}
			onClick={onPress}
			className="flex cursor-(--cursor-interactive) items-start gap-3 rounded-2xl border border-border p-3 text-start outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
		>
			<span className="grid size-9 shrink-0 place-items-center rounded-xl bg-default text-muted">
				<Icon name={icon} size={18} />
			</span>
			<span className="grid gap-0.5">
				<span className="flex items-center gap-2 text-sm font-medium">
					{title}
					{soon && (
						<Chip size="sm" variant="soft">
							<Trans>Coming soon</Trans>
						</Chip>
					)}
				</span>
				<span className="text-xs text-muted">{text}</span>
			</span>
		</button>
	);
}

/** "Add work": empty, from resume projects, from pictures, or from a pasted link. */
function AddWorkDialog({ onClose }: { onClose: () => void }) {
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

type StepProps = { onBack: () => void; onClose: () => void };

function BackButton({ onPress }: { onPress: () => void }) {
	return (
		<Button type="button" variant="ghost" onPress={onPress}>
			<Icon name="arrow-left" size={16} />
			<Trans>Back</Trans>
		</Button>
	);
}

/** Resume projects as works: copied through the server, which checks the resume and saves the new works. */
function FromResume({ onBack, onClose }: StepProps) {
	const data = usePortfolioData();
	const record = usePortfolioRecord();
	const source = useSourceResume();
	const openWork = usePortfolioEditorUi((state) => state.openWork);
	const projects = resumeProjects(source.data, data.works.items);
	const [chosen, setChosen] = useState<Set<string>>(() => new Set());
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const room = workRoom(data);

	const add = async () => {
		setBusy(true);
		setError(null);
		try {
			const store = usePortfolioEditorStore.getState();
			if (!(await store.flush())) throw new Error("save");
			const current = usePortfolioEditorStore.getState().portfolio;
			if (!current) return;
			const ids = projects.filter((project) => chosen.has(project.id)).map((project) => project.id);
			const saved = await client.portfolio.importWorks({ resumeItemIds: ids, expectedUpdatedAt: current.updatedAt });
			usePortfolioEditorStore.getState().applyServerEdit(saved);
			const added = saved.data.works.items.filter(
				(work) => work.fromResumeItemId && ids.includes(work.fromResumeItemId),
			);
			onClose();
			if (added.length === 1 && added[0]) openWork(added[0].id);
		} catch {
			setError(t`The projects couldn't be added. Check your connection, then try again.`);
		} finally {
			setBusy(false);
		}
	};

	return (
		<>
			<Modal.Body className="grid gap-3">
				{!record.sourceResume || !source.data ? (
					<p className="text-sm text-muted">
						<Trans>This portfolio has no resume to take projects from. Choose one in Publish → Source resume.</Trans>
					</p>
				) : projects.length === 0 ? (
					<p className="text-sm text-muted">
						<Trans>Your resume has no projects yet. Add them in the resume editor, or start an empty work.</Trans>
					</p>
				) : (
					<ul className="grid gap-1">
						{projects.map((project) => (
							<li key={project.id}>
								<Checkbox
									isDisabled={project.imported || (!chosen.has(project.id) && chosen.size >= room)}
									isSelected={project.imported || chosen.has(project.id)}
									onChange={(selected) =>
										setChosen((previous) => {
											const next = new Set(previous);
											if (selected) next.add(project.id);
											else next.delete(project.id);
											return next;
										})
									}
									className="w-full rounded-xl p-2 hover:bg-default"
								>
									<Checkbox.Content className="w-full items-start">
										<Checkbox.Control className="mt-0.5">
											<Checkbox.Indicator />
										</Checkbox.Control>
										<Label className="grid flex-1 gap-0.5 text-sm">
											<span>{project.name}</span>
											{(project.period || project.imported) && (
												<span className="text-xs text-muted">
													{[project.period, project.imported ? t`Already in your work` : ""]
														.filter(Boolean)
														.join(" · ")}
												</span>
											)}
										</Label>
									</Checkbox.Content>
								</Checkbox>
							</li>
						))}
					</ul>
				)}
				{error && (
					<Alert status="danger">
						<Alert.Indicator>
							<Icon name="warning-circle" />
						</Alert.Indicator>
						<Alert.Content>
							<Alert.Description>{error}</Alert.Description>
						</Alert.Content>
					</Alert>
				)}
			</Modal.Body>
			<Modal.Footer>
				<BackButton onPress={onBack} />
				<Button isDisabled={chosen.size === 0 || busy} onPress={() => void add()}>
					{busy && <Spinner size="sm" color="current" />}
					<Plural value={chosen.size} _0="Add work" one="Add # work" other="Add # works" />
				</Button>
			</Modal.Footer>
		</>
	);
}

/** Pictures as works: uploaded one by one (shrunk in the browser), then one work for all, or one per picture. */
function FromPictures({ onBack, onClose }: StepProps) {
	const data = usePortfolioData();
	const openWork = usePortfolioEditorUi((state) => state.openWork);
	const uploads = useImageUploads();
	const [mode, setMode] = useState<"one" | "each">("one");
	const [title, setTitle] = useState("");
	const [done, setDone] = useState<{ image: PortfolioImage; fileName: string }[]>([]);

	const upload = async (files: File[]) => {
		const room = mode === "one" ? PORTFOLIO_LIMITS.imagesPerBlock * workRoom(data) : workRoom(data);
		const picked = files.slice(0, room);
		const kept = await uploads.uploadNamed(picked, {
			alt: (index) => (mode === "one" ? title.trim() : titleFromFileName(picked[index]?.name ?? "")),
		});
		if (!kept.length) return;
		setDone(kept);
		const current = usePortfolioEditorStore.getState().portfolio?.data ?? data;
		const works = worksFromImages(current, kept, mode, title.trim());
		editPortfolio(
			(draft) => {
				draft.works.items.push(...works);
			},
			{ structural: true },
		);
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
				{done.length === 0 ? (
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

type LinkPreview = { picture: string | null; block: PortfolioBlockOf<"link"> | PortfolioBlockOf<"video"> };

/** A preview from what the server read: the block it makes and the picture it would copy as the cover. */
function previewOf(result: UnfurledLink): LinkPreview {
	if (result.kind === "video") {
		const block = videoBlockFromUnfurl(result);
		return { block, picture: videoThumbnailCandidates(block).at(-1) ?? null };
	}
	return { block: linkBlockFromUnfurl(result), picture: result.imageUrl ?? null };
}

/**
 * A work from a pasted link (`02-teknis.md` section 20): the server reads the page, the card fills in (all of it can
 * be changed), and its picture becomes the cover only if the person agrees, copied into the portfolio first. A site
 * that can't be read still makes a work: the person fills it in.
 */
function FromLink({ onBack, onClose }: StepProps) {
	const data = usePortfolioData();
	const openWork = usePortfolioEditorUi((state) => state.openWork);
	const [text, setText] = useState("");
	const [reading, setReading] = useState(false);
	const [preview, setPreview] = useState<LinkPreview | null>(null);
	const [failure, setFailure] = useState<string | null>(null);
	const [title, setTitle] = useState("");
	const [summary, setSummary] = useState("");
	const [useCover, setUseCover] = useState(true);
	const [adding, setAdding] = useState(false);
	const url = normalizePortfolioUrl(text.trim());
	const valid = /^https?:\/\/[^\s/]+\.[^\s]+/i.test(url);
	const full = workRoom(data) === 0;

	const read = async () => {
		setReading(true);
		setFailure(null);
		setPreview(null);
		try {
			const result = await unfurlLink(url);
			const next = previewOf(result);
			setPreview(next);
			setTitle(result.title ?? "");
			setSummary(result.kind === "link" ? (result.description ?? "") : "");
		} catch (error) {
			setFailure(unfurlErrorMessage(error));
			setPreview({ block: { id: generateId(), type: "link", url, title: "" }, picture: null });
		} finally {
			setReading(false);
		}
	};

	const add = async () => {
		if (!preview) return;
		setAdding(true);
		try {
			const block = { ...preview.block };
			let cover: PortfolioImage | undefined;
			if (useCover && preview.picture) {
				cover =
					block.type === "video"
						? await importVideoThumbnail({ ...block, title: title.trim() })
						: await importRemotePicture(preview.picture, title.trim()).catch(() => undefined);
				if (!cover) toast.add({ description: t`The picture couldn't be copied. Add a cover yourself.` });
			}
			if (cover && block.type === "video") block.thumbnail = cover;
			if (cover && block.type === "link") block.image = cover;
			if (block.type === "link" && !block.title.trim()) block.title = title.trim().slice(0, 140);
			const current = usePortfolioEditorStore.getState().portfolio?.data ?? data;
			const linkUrl = block.type === "link" ? block.url : url;
			const work = workFromLink(current, { url: linkUrl, title: title.trim(), summary: summary.trim() }, block, cover);
			editPortfolio(
				(draft) => {
					draft.works.items.push(work);
				},
				{ structural: true },
			);
			onClose();
			openWork(work.id);
		} finally {
			setAdding(false);
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
						isDisabled={reading || adding}
						onChange={(value) => {
							setText(value);
							setPreview(null);
							setFailure(null);
						}}
					/>
					<Button className="w-fit" isDisabled={!valid || reading || adding || full} onPress={() => void read()}>
						{reading ? <Spinner size="sm" /> : <Icon name="magnifying-glass" size={16} />}
						<Trans>Read the link</Trans>
					</Button>
					{full && (
						<p className="text-xs text-danger">
							<Trans>This portfolio already holds {PORTFOLIO_LIMITS.works} works.</Trans>
						</p>
					)}
				</div>
				{failure && (
					<Alert status="warning">
						<Alert.Indicator>
							<Icon name="warning" />
						</Alert.Indicator>
						<Alert.Content>
							<Alert.Description>{failure}</Alert.Description>
						</Alert.Content>
					</Alert>
				)}
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
								<img
									src={preview.picture}
									alt=""
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
