// Design for letters: by default a letter matches its resume's design, changed on the resume. Turned off, the letter
// keeps a design of its own: template, type, colour and page, with the presets the resume's Design uses
// (`@rezumi/resume/design-presets`).
import type { LetterDocument } from "@/draft/types";
import type { FontPairingId, MarginId } from "@rezumi/resume/design-presets";
import type { Template } from "@rezumi/schema/templates";
import type { WritableDraft } from "immer";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import {
	ACCENTS,
	FONT_PAIRINGS,
	TEXT_SIZE,
	applyFontPairing,
	applyMargins,
	applyTextSize,
	hexToRgba,
	isValidHex,
	matchFontPairing,
	matchMargins,
	rgbaToHex,
	templateName,
} from "@rezumi/resume/design-presets";
import { templateLineup } from "@rezumi/schema/templates";
import { useResumes } from "./queries";
import { relinkLetter } from "./save";
import { relinked } from "./write";
import { useLetterStore } from "@/draft";
import { isLabelledTemplate, isLockedTemplate, showPlanAlert, usePlan } from "@/features/billing/plan";
import { ACCENT_NAMES, MARGIN_NAMES, PAIRING_NAMES } from "@/features/design/preset-names";
import { routes } from "@/routes";
import {
	Alert,
	Button,
	Card,
	FieldError,
	Icon,
	IconButton,
	Input,
	Label,
	ListRow,
	ListSection,
	Screen,
	Segment,
	Sheet,
	Switch,
	Text,
	TextField,
	Typography,
	cx,
} from "@/ui";

type Metadata = WritableDraft<LetterDocument["style"]["metadata"]>;

/** The letter's own type, colours and page; editing any of them ends the design link, as on the server. */
const design = (key: string, recipe: (metadata: Metadata) => void) =>
	useLetterStore.getState().update(
		(letter) => {
			letter.designLinked = false;
			recipe(letter.style.metadata);
		},
		{ coalesceKey: `design.${key}` },
	);

export function LetterDesign({ id }: { id: string }) {
	const router = useRouter();
	const { t } = useLingui();
	const letter = useLetterStore((state) => (state.document?.id === id ? state.document : null));
	const resumes = useResumes();
	if (!letter) return null;

	const resumeName = resumes.data?.find((item) => item.id === letter.sourceResumeId)?.name;
	const matchLabel = resumeName ? t`Match “${resumeName}”` : t`Match the resume`;
	const disabled = letter.isLocked;

	const setLinked = (designLinked: boolean) => {
		void relinkLetter((draft) => void (draft.designLinked = designLinked)).then((result) =>
			relinked(
				result,
				designLinked ? t`The letter matches the resume's design again` : t`The letter keeps this design as its own`,
			),
		);
	};

	return (
		<Screen>
			{disabled ? (
				<Alert status="accent">
					<Alert.Indicator />
					<Alert.Content>
						<Alert.Description>{t`This letter is locked. Unlock it in Documents to edit.`}</Alert.Description>
					</Alert.Content>
				</Alert>
			) : null}
			{letter.sourceResumeId ? (
				<View className="gap-2">
					<ListSection title={t`Matching the resume`}>
						<ListRow
							title={matchLabel}
							description={
								letter.designLinked
									? t`Template, type and colors follow the resume, so the pair always matches.`
									: t`The letter keeps a design of its own.`
							}
							trailing={
								<Switch
									isSelected={letter.designLinked}
									isDisabled={disabled}
									onSelectedChange={setLinked}
									accessibilityLabel={matchLabel}
								/>
							}
						/>
					</ListSection>
					{letter.designLinked ? (
						<Button
							variant="secondary"
							onPress={() => router.push(routes.builder(letter.sourceResumeId ?? "", "design"))}
						>
							<Icon name="palette" size={16} />
							<Button.Label>{t`Change the resume's design`}</Button.Label>
						</Button>
					) : null}
				</View>
			) : (
				<Text tone="muted" className="px-1">
					{t`Choose a resume under From in Write to match its design. Until then, the letter has its own.`}
				</Text>
			)}
			{letter.designLinked ? null : <OwnDesign letter={letter} disabled={disabled} />}
		</Screen>
	);
}

type OwnDesignProps = { letter: LetterDocument; disabled: boolean };

function OwnDesign({ letter, disabled }: OwnDesignProps) {
	const { t, i18n } = useLingui();
	const plan = usePlan();
	const metadata = letter.style.metadata;
	const primary = rgbaToHex(metadata.design.colors.primary);
	const [hex, setHex] = useState(primary ?? "");
	// Undo, redo or another device can change the colour under the field: show it, unless the field already says it.
	const [shownPrimary, setShownPrimary] = useState(primary);
	if (primary !== shownPrimary) {
		setShownPrimary(primary);
		if (!isValidHex(hex) || rgbaToHex(hex.trim()) !== primary) setHex(primary ?? "");
	}
	const [picking, setPicking] = useState<"template" | "pairing" | null>(null);
	const textSize = metadata.typography.body.fontSize;
	const pairing = matchFontPairing(metadata);
	const step = (delta: number) =>
		design("size", (value) =>
			applyTextSize(value, Math.min(TEXT_SIZE.max, Math.max(TEXT_SIZE.min, textSize + delta * TEXT_SIZE.step))),
		);

	const chooseTemplate = (template: Template) => {
		setPicking(null);
		if (template !== metadata.template && isLockedTemplate(plan, template))
			return showPlanAlert({ kind: "feature", feature: "premiumTemplates" });
		useLetterStore.getState().update(
			(draft) => {
				draft.designLinked = false;
				draft.style.metadata.template = template;
			},
			{ newStep: true },
		);
	};

	return (
		<View className={cx("gap-4", disabled && "opacity-60")} pointerEvents={disabled ? "none" : "auto"}>
			<ListSection title={t`Template and type`}>
				<ListRow
					icon="squares-four"
					title={t`Template`}
					value={templateName(metadata.template)}
					onPress={() => setPicking("template")}
				/>
				<ListRow
					icon="text-aa"
					title={t`Font pairing`}
					value={pairing ? i18n._(PAIRING_NAMES[pairing]) : t`Custom`}
					onPress={() => setPicking("pairing")}
				/>
				<ListRow
					icon="text-t"
					title={t`Text size`}
					trailing={
						<View className="flex-row items-center gap-1">
							<IconButton
								icon="minus"
								variant="ghost"
								label={t`Smaller text`}
								isDisabled={textSize <= TEXT_SIZE.min}
								onPress={() => step(-1)}
							/>
							<Text mono tabular accessibilityLiveRegion="polite">{t`${textSize} pt`}</Text>
							<IconButton
								icon="plus"
								variant="ghost"
								label={t`Larger text`}
								isDisabled={textSize >= TEXT_SIZE.max}
								onPress={() => step(1)}
							/>
						</View>
					}
				/>
			</ListSection>

			<Card>
				<Card.Body className="gap-3">
					<Typography.Heading type="h6">{t`Color`}</Typography.Heading>
					<View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
						{ACCENTS.map((accent) => {
							const selected = accent.hex === primary;
							return (
								<Pressable
									key={accent.hex}
									accessibilityRole="radio"
									accessibilityLabel={i18n._(ACCENT_NAMES[accent.label])}
									accessibilityState={{ checked: selected }}
									onPress={() => {
										setHex(accent.hex);
										design("color", (value) => void (value.design.colors.primary = hexToRgba(accent.hex)));
									}}
									className={cx(
										"size-11 rounded-xl border-2 p-0.5",
										selected ? "border-foreground" : "border-transparent",
									)}
								>
									{/* A document colour from the shared palette, not an app colour: computed, so a style. */}
									<View className="flex-1 rounded-lg" style={[{ backgroundColor: accent.hex }]} />
								</Pressable>
							);
						})}
					</View>
					<TextField isInvalid={!!hex && !isValidHex(hex)}>
						<Label>{t`Hex`}</Label>
						<Input
							variant="secondary"
							value={hex}
							autoCapitalize="characters"
							autoCorrect={false}
							maxLength={7}
							accessibilityLabel={t`Hex`}
							onChangeText={(value) => {
								setHex(value);
								if (isValidHex(value))
									design("color", (draft) => void (draft.design.colors.primary = hexToRgba(value)));
							}}
						/>
						<FieldError>{t`Use six hex digits, like #3E6B4F.`}</FieldError>
					</TextField>
				</Card.Body>
			</Card>

			<Card>
				<Card.Body className="gap-3">
					<Typography.Heading type="h6">{t`Page`}</Typography.Heading>
					<Segment
						accessibilityLabel={t`Page format`}
						value={metadata.page.format}
						onValueChange={(format) => design("format", (value) => void (value.page.format = format))}
						options={[
							{ value: "a4", label: "A4" },
							{
								value: "letter",
								label: t({ message: "Letter", context: "US Letter paper size (8.5 × 11 in), shown beside A4" }),
							},
							{ value: "free-form", label: t`Free-form` },
						]}
					/>
					<Text size="xs" weight="semibold" tone="muted">{t`Margins`}</Text>
					<Segment<MarginId | "custom">
						accessibilityLabel={t`Margins`}
						value={matchMargins(metadata) ?? "custom"}
						onValueChange={(id) => {
							if (id !== "custom") design("margins", (value) => applyMargins(value, id));
						}}
						options={(["narrow", "normal", "wide"] as const).map((id) => ({
							value: id,
							label: i18n._(MARGIN_NAMES[id]),
						}))}
					/>
				</Card.Body>
			</Card>

			<Sheet
				isOpen={picking === "template"}
				onOpenChange={(open) => !open && setPicking(null)}
				title={t`Template`}
				closeLabel={t`Close`}
				detents={[0.6, 0.95]}
			>
				<ListSection>
					{templateLineup.map((template) => (
						<ListRow
							key={template}
							title={templateName(template)}
							description={isLabelledTemplate(plan, template) ? "Plus" : undefined}
							chevron={false}
							isSelected={template === metadata.template}
							onPress={() => chooseTemplate(template)}
						/>
					))}
				</ListSection>
			</Sheet>
			<Sheet
				isOpen={picking === "pairing"}
				onOpenChange={(open) => !open && setPicking(null)}
				title={t`Font pairing`}
				closeLabel={t`Close`}
			>
				<ListSection>
					{FONT_PAIRINGS.map((option) => (
						<ListRow
							key={option.id}
							title={i18n._(PAIRING_NAMES[option.id as FontPairingId])}
							description={option.heading === option.body ? option.body : `${option.heading} · ${option.body}`}
							chevron={false}
							isSelected={option.id === pairing}
							onPress={() => {
								setPicking(null);
								design("pairing", (value) => applyFontPairing(value, option.id));
							}}
						/>
					))}
				</ListSection>
			</Sheet>
		</View>
	);
}
