import type { PortfolioImageKind } from "./compress";
import type { UploadedImage, UploadProgress } from "./upload";
import type { PortfolioImage } from "@rezumi/schema/portfolio/files";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import type { DropEvent } from "react-aria";
import { DropZone, useDropZonePickerContext } from "@heroui-pro/react";
import { Alert, Button, Description, FieldError, Input, Label, ProgressBar, TextField } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useEffect, useRef, useState } from "react";
import { isFileDropItem } from "react-aria-components";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { pictureFiles } from "./compress";
import { discardUploadedImages, MAX_BATCH_PICTURES, uploadImageBatch } from "./upload";

/** A stored picture's address in the editor (the upload route serves `uploads/...` at the app's origin). */
export function portfolioImageSrc(image: Pick<PortfolioImage, "key" | "thumbKey">, small = true): string {
	return `/${small && image.thumbKey ? image.thumbKey : image.key}`;
}

const DROP_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/avif", "image/svg+xml"];

type ImageDropProps = {
	label: ReactNode;
	description?: ReactNode;
	multiple?: boolean;
	/** A short row instead of a tall area, for a field among others. */
	compact?: boolean;
	isDisabled?: boolean;
	trigger?: ReactNode;
	onFiles: (files: File[]) => void;
};

/**
 * Where pictures come in: drop them on it, choose them, or paste one (focus the area and press Ctrl/⌘+V). Files that
 * aren't pictures are ignored; the compressor checks the rest.
 */
export function ImageDrop({
	label,
	description,
	multiple = false,
	compact = false,
	isDisabled = false,
	trigger,
	onFiles,
}: ImageDropProps) {
	const take = (files: Iterable<File>) => {
		const pictures = pictureFiles(files);
		if (pictures.length) onFiles(multiple ? pictures : pictures.slice(0, 1));
	};

	const drop = async ({ items }: DropEvent) => {
		take(await Promise.all(items.filter(isFileDropItem).map((item) => item.getFile())));
	};

	return (
		<div
			className="contents"
			onPaste={(event) => {
				const files = pictureFiles(event.clipboardData.files);
				if (!files.length || isDisabled) return;
				event.preventDefault();
				take(files);
			}}
		>
			<DropZone className="w-full">
				<DropZone.Area
					isDisabled={isDisabled}
					onDrop={(event) => void drop(event)}
					getDropOperation={(types) => (DROP_TYPES.some((type) => types.has(type)) ? "copy" : "cancel")}
					className={cn(compact && "min-h-0 flex-row gap-3 px-4 py-3 text-start")}
				>
					<DropZone.Icon>
						<Icon name="image" size={compact ? 20 : 26} />
					</DropZone.Icon>
					<div className={cn("grid gap-0.5", !compact && "justify-items-center text-center")}>
						<DropZone.Label>{label}</DropZone.Label>
						{description && <DropZone.Description>{description}</DropZone.Description>}
					</div>
					<PickerButton compact={compact} isDisabled={isDisabled}>
						{trigger ?? (multiple ? <Trans>Choose pictures</Trans> : <Trans>Choose a picture</Trans>)}
					</PickerButton>
				</DropZone.Area>
				<DropZone.Input accept="image/*" multiple={multiple} onSelect={(files) => take(Array.from(files))} />
			</DropZone>
		</div>
	);
}

type PickerButtonProps = { compact: boolean; isDisabled: boolean; children: ReactNode };

function PickerButton({ compact, isDisabled, children }: PickerButtonProps) {
	const { openFilePicker } = useDropZonePickerContext();
	return (
		<Button
			size="sm"
			variant="secondary"
			isDisabled={isDisabled}
			className={cn(compact ? "ms-auto shrink-0" : "mt-1")}
			onPress={openFilePicker}
		>
			<Icon name="upload-simple" size={16} />
			{children}
		</Button>
	);
}

type UploadStatusProps = { progress: UploadProgress | null; errors: readonly string[] };

/** Progress of a batch of uploads, and what went wrong with any picture in it. */
export function UploadStatus({ progress, errors }: UploadStatusProps) {
	return (
		<>
			{progress && progress.done < progress.total && (
				<ProgressBar
					aria-label={t`Uploading pictures`}
					value={progress.done}
					maxValue={progress.total}
					className="grid gap-1"
				>
					<span className="text-xs text-muted">
						{progress.total > 1 ? (
							<Trans>
								Preparing and uploading picture {progress.done + 1} of {progress.total}…
							</Trans>
						) : (
							<Trans>Preparing and uploading the picture…</Trans>
						)}
					</span>
					<ProgressBar.Track>
						<ProgressBar.Fill />
					</ProgressBar.Track>
				</ProgressBar>
			)}
			{errors.length > 0 && (
				<Alert status="danger">
					<Alert.Indicator>
						<Icon name="warning-circle" />
					</Alert.Indicator>
					<Alert.Content>
						{errors.map((error, index) => (
							// Two files can fail the same way: the place keeps each message apart.
							<Alert.Description key={`${index}:${error}`}>{error}</Alert.Description>
						))}
					</Alert.Content>
				</Alert>
			)}
		</>
	);
}

type UploadOptions = {
	kind?: PortfolioImageKind;
	/** The alternative text each picture starts with, by its place in the batch. */
	alt?: (index: number) => string;
};

/**
 * Uploads pictures one at a time with progress, keeping the reasons any of them failed for `UploadStatus`. Resolves
 * with the pictures that made it. The batch is cancelled when the component goes away (a dialog closed, an item
 * removed) or on `cancel()`: it then resolves with none, so nothing is added to the portfolio afterwards, and the
 * pictures already uploaded are deleted.
 */
export function useImageUploads() {
	const [progress, setProgress] = useState<UploadProgress | null>(null);
	const [errors, setErrors] = useState<string[]>([]);
	const running = useRef<AbortController | null>(null);
	const busy = progress !== null && progress.done < progress.total;

	useEffect(() => () => running.current?.abort(), []);

	/** The pictures that made it, with the names of their files. */
	const uploadNamed = async (files: readonly File[], options: UploadOptions = {}): Promise<UploadedImage[]> => {
		running.current?.abort();
		const controller = new AbortController();
		running.current = controller;
		setErrors([]);
		setProgress({ done: 0, total: Math.min(files.length, MAX_BATCH_PICTURES), current: null });
		try {
			const outcome = await uploadImageBatch(files, { ...options, signal: controller.signal, onProgress: setProgress });
			if (controller.signal.aborted) {
				void discardUploadedImages(outcome.uploaded.map((entry) => entry.image));
				return [];
			}
			setErrors(outcome.errors);
			return outcome.uploaded;
		} finally {
			if (running.current === controller) {
				running.current = null;
				setProgress(null);
			}
		}
	};

	const upload = async (files: readonly File[], options: UploadOptions = {}) =>
		(await uploadNamed(files, options)).map((entry) => entry.image);

	return {
		upload,
		uploadNamed,
		busy,
		progress,
		errors,
		clearErrors: () => setErrors([]),
		cancel: () => running.current?.abort(),
	};
}

type AltTextInputProps = {
	value: string;
	onChange: (value: string) => void;
	/** What the page reads out when the field is left empty. */
	fallback?: string;
	label?: string;
};

/**
 * The picture's description for screen readers and search engines. It's required: an empty one is marked, and the
 * page falls back to the work's title or the person's name meanwhile.
 */
export function AltTextInput({ value, onChange, fallback, label }: AltTextInputProps) {
	const [touched, setTouched] = useState(false);
	const empty = value.trim() === "";
	return (
		<TextField
			fullWidth
			isRequired
			value={value}
			maxLength={PORTFOLIO_LIMITS.text.alt}
			isInvalid={touched && empty}
			onChange={onChange}
			onBlur={() => setTouched(true)}
			className="gap-1.5"
		>
			<Label>{label ?? t`Describe the picture`}</Label>
			<Input variant="secondary" placeholder={t`What it shows, for people who can't see it`} />
			<Description>
				{fallback && empty
					? t`Read aloud by screen readers. Until you write one, the page uses “${fallback}”.`
					: t`Read aloud by screen readers and read by search engines.`}
			</Description>
			<FieldError>{t`Describe the picture in a few words.`}</FieldError>
		</TextField>
	);
}

type Focus = { x: number; y: number };

const clamp = (value: number) => Math.min(1, Math.max(0, Math.round(value * 100) / 100));

type FocusPickerProps = {
	image: PortfolioImage;
	focus: Focus | undefined;
	onChange: (focus: Focus) => void;
};

/**
 * Picks the part of a cover to keep when a card crops it: tap or drag on the picture, or use the arrow keys. The
 * small frames show how the card and the wide header will cut it.
 */
function FocusPicker({ image, focus, onChange }: FocusPickerProps) {
	const ref = useRef<HTMLDivElement>(null);
	const point = focus ?? { x: 0.5, y: 0.5 };
	const position = `${Math.round(point.x * 100)}% ${Math.round(point.y * 100)}%`;

	const pick = (event: PointerEvent<HTMLDivElement>) => {
		const box = ref.current?.getBoundingClientRect();
		if (!box || !box.width || !box.height) return;
		onChange({ x: clamp((event.clientX - box.left) / box.width), y: clamp((event.clientY - box.top) / box.height) });
	};

	const key = (event: KeyboardEvent<HTMLDivElement>) => {
		const step = event.shiftKey ? 0.1 : 0.05;
		const moves: Record<string, Focus> = {
			ArrowLeft: { x: point.x - step, y: point.y },
			ArrowRight: { x: point.x + step, y: point.y },
			ArrowUp: { x: point.x, y: point.y - step },
			ArrowDown: { x: point.x, y: point.y + step },
		};
		const next = moves[event.key];
		if (!next) return;
		event.preventDefault();
		onChange({ x: clamp(next.x), y: clamp(next.y) });
	};

	return (
		<div className="grid gap-2">
			<span className="text-sm font-medium">
				<Trans>Focus point</Trans>
			</span>
			<div
				ref={ref}
				role="slider"
				tabIndex={0}
				aria-label={t`Focus point of the cover`}
				aria-valuetext={t`${Math.round(point.x * 100)}% from the left, ${Math.round(point.y * 100)}% from the top`}
				aria-valuenow={Math.round(point.x * 100)}
				aria-valuemin={0}
				aria-valuemax={100}
				onPointerDown={(event) => {
					event.currentTarget.setPointerCapture(event.pointerId);
					pick(event);
				}}
				onPointerMove={(event) => {
					if (event.currentTarget.hasPointerCapture(event.pointerId)) pick(event);
				}}
				onKeyDown={key}
				className="relative cursor-crosshair touch-none overflow-hidden rounded-xl outline-none select-none focus-visible:ring-2 focus-visible:ring-focus"
			>
				<img
					src={portfolioImageSrc(image)}
					alt=""
					draggable={false}
					className="block h-auto w-full"
					width={image.width}
					height={image.height}
				/>
				<span
					aria-hidden="true"
					className="pointer-events-none absolute size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.45),0_2px_8px_rgba(0,0,0,.4)]"
					style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
				/>
			</div>
			<div className="flex gap-2" aria-hidden="true">
				<img
					src={portfolioImageSrc(image)}
					alt=""
					className="aspect-[4/3] w-24 rounded-lg object-cover"
					style={{ objectPosition: position }}
				/>
				<img
					src={portfolioImageSrc(image)}
					alt=""
					className="aspect-video w-36 rounded-lg object-cover"
					style={{ objectPosition: position }}
				/>
			</div>
			<span className="text-xs text-muted">
				<Trans>Tap the part to keep in view when a card crops the cover. Arrow keys move it too.</Trans>
			</span>
		</div>
	);
}

type ImageFieldProps = {
	label: string;
	value: PortfolioImage | undefined;
	onChange: (image: PortfolioImage | undefined) => void;
	kind?: PortfolioImageKind;
	/** The alternative text a new picture starts with (the work's title, the client's name…). */
	altSuggestion: string;
	description?: ReactNode;
	/** Shows the focus point picker (covers). */
	focus?: { value: Focus | undefined; onChange: (focus: Focus) => void };
	/** Extra fields under the picture (a caption). */
	children?: ReactNode;
};

/**
 * One picture: drop or choose it, then describe it. Replacing or removing keeps the old file until the portfolio no
 * longer uses it; the server deletes unused files a day later, so Undo can still bring it back.
 */
export function ImageField({
	label,
	value,
	onChange,
	kind = "photo",
	altSuggestion,
	description,
	focus,
	children,
}: ImageFieldProps) {
	const uploads = useImageUploads();

	const choose = async (files: File[]) => {
		const [image] = await uploads.upload(files.slice(0, 1), { kind, alt: () => altSuggestion });
		if (image) onChange(image);
	};

	return (
		<div className="grid gap-2">
			<span className="text-sm font-medium">{label}</span>
			{value ? (
				<div className="grid gap-3 rounded-xl border border-border p-3">
					{focus ? (
						<FocusPicker image={value} focus={focus.value} onChange={focus.onChange} />
					) : (
						<img
							src={portfolioImageSrc(value)}
							alt=""
							width={value.width}
							height={value.height}
							className={cn(
								"h-auto max-h-48 w-auto max-w-full justify-self-start rounded-lg",
								kind === "logo" &&
									"bg-[repeating-conic-gradient(#0000000d_0_25%,transparent_0_50%)] bg-size-[16px_16px] p-2",
							)}
						/>
					)}
					<AltTextInput value={value.alt} fallback={altSuggestion} onChange={(alt) => onChange({ ...value, alt })} />
					{children}
					<div className="flex flex-wrap gap-2">
						<ReplaceButton isDisabled={uploads.busy} onFiles={(files) => void choose(files)} />
						<Button size="sm" variant="danger-soft" onPress={() => onChange(undefined)}>
							<Icon name="trash" size={16} />
							<Trans>Remove picture</Trans>
						</Button>
					</div>
				</div>
			) : (
				<ImageDrop
					compact
					label={label}
					description={description}
					isDisabled={uploads.busy}
					onFiles={(files) => void choose(files)}
				/>
			)}
			<UploadStatus progress={uploads.progress} errors={uploads.errors} />
		</div>
	);
}

type ReplaceButtonProps = { onFiles: (files: File[]) => void; isDisabled?: boolean };

/** "Replace": opens the file picker for one picture. */
function ReplaceButton({ onFiles, isDisabled = false }: ReplaceButtonProps) {
	const picker = useFilePicker(onFiles);
	return (
		<>
			<Button size="sm" variant="secondary" isDisabled={isDisabled} onPress={picker.open}>
				<Icon name="arrows-clockwise" size={16} />
				<Trans>Replace picture</Trans>
			</Button>
			{picker.element}
		</>
	);
}

type FilePickerOptions = {
	/** What the system's picker offers: pictures unless told otherwise. */
	accept?: string;
	multiple?: boolean;
	/** Keeps the chosen files the caller can use: pictures unless told otherwise. */
	filter?: (files: readonly File[]) => File[];
};

/**
 * A hidden file picker opened by code ("Replace" buttons, "add pictures" menu items, a PDF block): render `element`
 * anywhere, call `open`. Only files `filter` keeps reach `onFiles`, never none.
 */
export function useFilePicker(onFiles: (files: File[]) => void, options: FilePickerOptions = {}) {
	const { accept = "image/*", multiple = false, filter = pictureFiles } = options;
	const input = useRef<HTMLInputElement>(null);
	const element = (
		<input
			ref={input}
			type="file"
			accept={accept}
			multiple={multiple}
			hidden
			onChange={(event) => {
				const files = filter([...(event.currentTarget.files ?? [])]);
				event.currentTarget.value = "";
				if (files.length) onFiles(files);
			}}
		/>
	);
	return { open: () => input.current?.click(), element };
}
