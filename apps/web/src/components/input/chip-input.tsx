import { Chip, Input, Kbd } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import * as React from "react";
import { mergeProps } from "react-aria";
import { useFormControl } from "@rezumi/ui/components/form";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { SortableEdge, SortableProvider, useSortableItem } from "@/components/input/sortable";
import { useControlledState } from "@/hooks/use-controlled-state";
import { isImeComposing } from "@/libs/keyboard";

const RETURN_KEY = "Enter";
const COMMA_KEY = ",";
const EMPTY_CHIPS: string[] = [];

type ChipItemProps = {
	id: string;
	chip: string;
	index: number;
	isEditing: boolean;
	onEdit: (index: number) => void;
	onRemove: (index: number) => void;
};

function ChipDragPreview({ chip }: { chip: string }) {
	return (
		<Chip
			size="sm"
			color="accent"
			variant="soft"
			className="h-6 max-w-44 cursor-grabbing justify-start px-2 shadow-overlay select-none sm:max-w-52"
		>
			<span className="truncate">{chip}</span>
		</Chip>
	);
}

function ChipItem({ id, chip, index, isEditing, onEdit, onRemove }: ChipItemProps) {
	const sortable = useSortableItem({ id, list: "chips", index, label: chip, hasHandle: false });

	return (
		// The chip itself is the handle: Enter lifts it for the keyboard, then the arrow keys pick the slot.
		<div
			{...mergeProps(sortable.dropTargetProps, sortable.dragProps)}
			role="button"
			tabIndex={0}
			aria-roledescription={t`sortable`}
			aria-label={chip}
			className={cn(
				"group/chip relative rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-focus",
				sortable.isDragging && "opacity-60",
			)}
		>
			<SortableEdge edge={sortable.edge} orientation="horizontal" />
			<Chip
				size="sm"
				color="accent"
				variant="soft"
				className={cn(
					"h-6 max-w-full cursor-grab justify-start gap-0 px-2 select-none active:cursor-grabbing",
					isEditing && "ring-1 ring-accent",
				)}
			>
				<span className="max-w-32 truncate sm:max-w-44">{chip}</span>
				{/* Raw buttons: tiny pointer shortcuts inside the draggable chip, out of the tab order (the chip itself takes
				    keyboard drag, the field edits by typing). */}
				<div
					className={cn(
						"ms-1.5 flex shrink-0 items-center gap-x-0.5 transition-opacity duration-quick group-focus-within/chip:opacity-100 group-hover/chip:opacity-100",
						isEditing ? "opacity-100" : "opacity-65",
					)}
				>
					<button
						type="button"
						tabIndex={-1}
						className="cursor-(--cursor-interactive) rounded-sm p-0.5 transition-colors outline-none hover:bg-accent-soft-hover"
						aria-label={t({
							comment:
								"Screen reader label for button that edits a keyword chip. Variable is the current keyword text.",
							message: `Edit ${chip}`,
						})}
						onClick={(e) => {
							e.stopPropagation();
							onEdit(index);
						}}
					>
						<Icon name="pencil-simple" size={14} />
					</button>
					<button
						type="button"
						tabIndex={-1}
						className="cursor-(--cursor-interactive) rounded-sm p-0.5 transition-colors outline-none hover:bg-danger-soft hover:text-danger"
						aria-label={t({
							comment:
								"Screen reader label for button that removes a keyword chip. Variable is the current keyword text.",
							message: `Remove ${chip}`,
						})}
						onClick={(e) => {
							e.stopPropagation();
							onRemove(index);
						}}
					>
						<Icon name="x" size={14} />
					</button>
				</div>
			</Chip>
		</div>
	);
}

type Props = Omit<React.ComponentProps<"div">, "value" | "onChange"> & {
	value?: string[];
	defaultValue?: string[];
	onChange?: (value: string[]) => void;
	allowCommas?: boolean;
};

export function ChipInput({
	value,
	defaultValue = EMPTY_CHIPS,
	onChange,
	className,
	allowCommas = false,
	id: idProp,
	"aria-describedby": ariaDescribedByProp,
	"aria-invalid": ariaInvalidProp,
	...props
}: Props) {
	const formControl = useFormControl();
	const controlId = idProp ?? formControl.id;
	const describedBy = ariaDescribedByProp ?? formControl["aria-describedby"];
	const invalid = ariaInvalidProp ?? formControl["aria-invalid"];
	const labelId = formControl.labelId;

	const [chips, setChips] = useControlledState<string[]>({
		value,
		defaultValue,
		onChange,
	});

	const [input, setInput] = React.useState("");
	const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
	const inputRef = React.useRef<HTMLInputElement>(null);
	const isEditingKeyword = editingIndex !== null;
	const hasChips = chips.length > 0;

	const addChips = (values: string[]) => {
		const nextValues = values.flatMap((chip) => {
			const trimmed = chip.trim();
			return trimmed ? [trimmed] : [];
		});
		if (nextValues.length === 0) return;

		setChips([...new Set([...chips, ...nextValues])]);
	};

	const updateChip = (index: number, newValue: string) => {
		const trimmed = newValue.trim();
		if (!trimmed || index < 0 || index >= chips.length) return;

		const existingIndex = chips.findIndex((c, i) => c === trimmed && i !== index);
		if (existingIndex !== -1) return;

		const newChips = [...chips];
		newChips[index] = trimmed;
		setChips(newChips);
	};

	const removeChip = (index: number) => {
		if (index < 0 || index >= chips.length) return;
		setChips(chips.slice(0, index).concat(chips.slice(index + 1)));

		if (editingIndex === index) {
			setEditingIndex(null);
			setInput("");
		} else if (editingIndex !== null && editingIndex > index) {
			setEditingIndex((current) => (current !== null && current > index ? current - 1 : current));
		}
	};

	const handleEdit = (index: number) => {
		const chip = chips[index];
		if (chip === undefined) return;
		setEditingIndex(index);
		setInput(chip);
		inputRef.current?.focus();
	};

	const moveChip = (id: string, to: number) => {
		const from = chips.indexOf(id);
		if (from === -1 || to < 0 || to >= chips.length || from === to) return;

		const newOrder = [...chips];
		newOrder.splice(to, 0, ...newOrder.splice(from, 1));
		if (editingIndex !== null) {
			const editingChip = chips[editingIndex];
			const movedIndex = editingChip === undefined ? -1 : newOrder.indexOf(editingChip);
			if (movedIndex !== -1 && movedIndex !== editingIndex) setEditingIndex(movedIndex);
		}
		setChips(newOrder);
	};

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = e.target.value;

		if (editingIndex !== null) {
			if (!allowCommas && newValue.includes(",")) {
				updateChip(editingIndex, newValue.replace(",", ""));
				setEditingIndex(null);
				setInput("");
			} else {
				setInput(newValue);
			}
			return;
		}

		if (!allowCommas && newValue.includes(",")) {
			const parts = newValue.split(",");
			addChips(parts.slice(0, -1));
			setInput(parts.at(-1) ?? "");
		} else {
			setInput(newValue);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (isImeComposing(e)) return;
		if (e.key === "Enter" || (!allowCommas && e.key === ",")) {
			e.preventDefault();

			if (editingIndex !== null) {
				if (input.trim()) {
					updateChip(editingIndex, input);
				}
				setEditingIndex(null);
				setInput("");
			} else if (input.trim()) {
				addChips([input]);
				setInput("");
			}
		} else if (e.key === "Escape" && editingIndex !== null) {
			setEditingIndex(null);
			setInput("");
		}
	};

	return (
		<div className={cn("space-y-1.5", className)} {...props}>
			<SortableProvider
				onMove={(id, { index }) => moveChip(id, index)}
				renderPreview={(label) => <ChipDragPreview chip={label} />}
			>
				<div
					role="none"
					onClick={() => inputRef.current?.focus()}
					// Looks like a secondary HeroUI field: its fill, radius, hover and focus ring.
					className={cn(
						"overflow-hidden rounded-field bg-default text-field-foreground transition-[background-color,box-shadow] duration-quick focus-within:bg-default focus-within:ring-2 focus-within:ring-focus hover:bg-default-hover",
						(invalid === true || invalid === "true") && "ring-1 ring-danger focus-within:ring-danger",
					)}
				>
					<div className="flex flex-col">
						<div className={cn("max-h-24 overflow-y-auto px-2 pt-2 pb-1", !hasChips && "hidden")}>
							<div className="flex flex-wrap gap-1">
								{chips.map((chip, idx) => (
									<ChipItem
										key={chip}
										id={chip}
										chip={chip}
										index={idx}
										isEditing={editingIndex === idx}
										onEdit={handleEdit}
										onRemove={removeChip}
									/>
								))}
							</div>
						</div>
						<div className="flex items-center gap-1.5 pe-1">
							<Input
								ref={inputRef}
								type="text"
								id={controlId}
								value={input}
								autoComplete="off"
								// A resolvable aria-labelledby outranks aria-label, so a rendered FormLabel still wins;
								// when the FormControl has no FormLabel the reference dangles and the accessible name
								// falls back to aria-label instead of going empty.
								aria-label={isEditingKeyword ? t`Edit keyword` : t`Add keyword`}
								aria-labelledby={labelId}
								aria-describedby={describedBy}
								aria-invalid={invalid}
								placeholder={isEditingKeyword ? t`Editing keyword...` : t`Add a keyword...`}
								onKeyDown={handleKeyDown}
								onChange={handleInputChange}
								// The frame is the field; the input inside it stays bare.
								className="h-9 flex-1 border-none bg-transparent px-3 py-0 shadow-none ring-0 hover:bg-transparent focus:bg-transparent focus:ring-0"
							/>
							{chips.length > 0 && (
								<Chip
									size="sm"
									variant={isEditingKeyword ? "soft" : "tertiary"}
									color={isEditingKeyword ? "accent" : "default"}
									className="shrink-0 tabular-nums"
								>
									{isEditingKeyword ? <Trans>Edit</Trans> : chips.length}
								</Chip>
							)}
						</div>
					</div>
				</div>
			</SortableProvider>

			<p className="text-xs text-muted">
				{allowCommas ? (
					<Trans>
						Press <Kbd>{RETURN_KEY}</Kbd> to add or save the current keyword.
					</Trans>
				) : (
					<Trans>
						Press <Kbd>{RETURN_KEY}</Kbd> or <Kbd>{COMMA_KEY}</Kbd> to add or save the current keyword.
					</Trans>
				)}
			</p>
		</div>
	);
}
