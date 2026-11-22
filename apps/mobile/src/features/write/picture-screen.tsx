// The photo on this resume's page (the web's picture-settings.tsx): the picture itself (camera, library, address,
// remove), then the frame that belongs to the document: shown or hidden, fit, size, aspect ratio, corner radius,
// border and shadow. Rotation shows but stays off: the PDF renderer can't rotate pictures.
import type { Picture } from "@rezumi/schema/resume/data";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { parseColorInput } from "@rezumi/resume/design-presets";
import { ProfileMarker } from "./profile-link";
import { EditorFrame } from "@/features/entries/entry-editor";
import { PhotoField } from "@/features/entries/photo-field";
import { useWriteData, useWriteSource } from "@/features/entries/source";
import { BoundText } from "@/features/entries/text-fields";
import {
	Alert,
	Button,
	Card,
	ColorField,
	Label,
	ListRow,
	ListSection,
	NumberStepper,
	Segment,
	Switch,
	Text,
} from "@/ui";

export function PictureSettings() {
	const { t } = useLingui();
	const source = useWriteSource();
	const locked = source.useLocked();
	const picture = useWriteData((data) => data.picture, null);
	if (!picture) return null;

	const set = <K extends keyof Picture>(key: K, value: Picture[K], newStep = false) =>
		source.update(
			(draft) => {
				draft.picture[key] = value;
			},
			newStep ? { newStep: true } : { coalesceKey: `picture.${key}` },
		);
	const stepper = (key: "size" | "borderRadius" | "borderWidth" | "shadowWidth", label: string, max?: number) => (
		<NumberStepper
			label={label}
			value={picture[key]}
			unit="pt"
			min={key === "size" ? 32 : 0}
			max={max}
			step={key === "shadowWidth" ? 0.5 : 1}
			isDisabled={locked}
			decreaseLabel={t`Decrease ${label}`}
			increaseLabel={t`Increase ${label}`}
			onChange={(value) => set(key, value)}
		/>
	);
	const color = (key: "borderColor" | "shadowColor", label: string) => (
		<ColorField
			label={label}
			value={picture[key]}
			placeholder="#000000"
			invalidLabel={t`Enter a color like #1a73e8.`}
			isDisabled={locked}
			onChange={(text) => {
				const parsed = text ? parseColorInput(text) : "";
				if (parsed === null) return false;
				set(key, parsed, true);
				return true;
			}}
		/>
	);

	return (
		<EditorFrame title={t`Photo`}>
			{locked ? (
				<Alert status="default">
					<Alert.Content>
						<Alert.Title>{t`Locked. Unlock to edit.`}</Alert.Title>
					</Alert.Content>
				</Alert>
			) : null}
			<Card>
				<Card.Body className="gap-4">
					<View className="flex-row items-center justify-end">
						<ProfileMarker part={{ kind: "picture" }} />
					</View>
					<PhotoField disabled={locked} />
					<BoundText
						label={t`Address`}
						value={picture.url}
						keyboardType="url"
						placeholder="https://"
						disabled={locked}
						onChange={(url) => set("url", url)}
					/>
				</Card.Body>
			</Card>
			<ListSection title={t`On the page`}>
				<ListRow
					title={t`Show photo`}
					trailing={
						<Switch
							isSelected={!picture.hidden}
							isDisabled={locked}
							accessibilityLabel={t`Show photo`}
							onSelectedChange={(shown) => set("hidden", !shown, true)}
						/>
					}
				/>
			</ListSection>
			<Card>
				<Card.Body className="gap-3">
					<View className="gap-1.5">
						<Label>{t`Fit`}</Label>
						<Segment
							accessibilityLabel={t`Fit`}
							value={picture.fit}
							isDisabled={locked}
							options={[
								{ value: "cover", label: t`Cover` },
								{ value: "contain", label: t`Contain` },
							]}
							onValueChange={(fit) => set("fit", fit, true)}
						/>
					</View>
					{stepper("size", t`Size`, 512)}
					<NumberStepper
						label={t`Aspect ratio`}
						value={picture.aspectRatio}
						min={0.5}
						max={2.5}
						step={0.1}
						isDisabled={locked}
						decreaseLabel={t`Decrease aspect ratio`}
						increaseLabel={t`Increase aspect ratio`}
						onChange={(value) => set("aspectRatio", value)}
					/>
					<View className="flex-row flex-wrap gap-2">
						{[
							{ label: t`Square`, value: 1 },
							{ label: t`Landscape`, value: 1.5 },
							{ label: t`Portrait`, value: 0.5 },
						].map((preset) => (
							<Button
								key={preset.value}
								size="sm"
								variant={picture.aspectRatio === preset.value ? "primary" : "secondary"}
								isDisabled={locked}
								onPress={() => set("aspectRatio", preset.value, true)}
							>
								{preset.label}
							</Button>
						))}
					</View>
					{stepper("borderRadius", t`Corner radius`, 100)}
					<View className="gap-1">
						<NumberStepper
							label={t`Rotation`}
							value={picture.rotation}
							unit="°"
							min={0}
							max={360}
							step={5}
							isDisabled
							decreaseLabel={t`Decrease rotation`}
							increaseLabel={t`Increase rotation`}
							onChange={() => undefined}
						/>
						<Text size="xs" tone="muted">{t`Rotation isn't supported by PDF rendering.`}</Text>
					</View>
				</Card.Body>
			</Card>
			<Card>
				<Card.Body className="gap-3">
					{color("borderColor", t`Border color`)}
					{stepper("borderWidth", t`Border width`)}
					{color("shadowColor", t`Shadow color`)}
					{stepper("shadowWidth", t`Shadow width`)}
				</Card.Body>
			</Card>
		</EditorFrame>
	);
}
