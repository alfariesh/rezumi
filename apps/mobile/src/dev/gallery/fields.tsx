// Gallery: form controls (src/ui/fields.tsx), HeroUI Native's fields as shipped, in every state a screen shows.
import type { ReactNode } from "react";
import { Surface } from "heroui-native";
import { Fragment, useState } from "react";
import { View } from "react-native";
import { Caption, GallerySection } from "./section";
import {
	Checkbox,
	ControlField,
	Description,
	FieldError,
	Icon,
	Input,
	InputGroup,
	InputOTP,
	Label,
	Radio,
	RadioGroup,
	SearchField,
	Select,
	Separator,
	Slider,
	Switch,
	TextArea,
	TextField,
	cx,
} from "@/ui";

const languages = [
	{ value: "en", label: "English" },
	{ value: "id", label: "Bahasa Indonesia" },
	{ value: "ar", label: "العربية" },
];

type Option = { value: string; label: string };
type VariantProps = { variant: "primary" | "secondary" };

/** A field and its state name, stacked. */
function Sample({ caption, children }: { caption: string; children: ReactNode }) {
	return (
		<View className="gap-1.5">
			{children}
			<Caption>{caption}</Caption>
		</View>
	);
}

/** The text field in each state; `secondary` is the fill for fields on a white surface. */
function TextFieldStates({ variant }: VariantProps) {
	const [email, setEmail] = useState("");
	return (
		<View className="gap-5">
			<Sample caption="Empty">
				<TextField>
					<Label>Email</Label>
					<Input
						variant={variant}
						value={email}
						onChangeText={setEmail}
						placeholder="name@example.com"
						keyboardType="email-address"
						autoCapitalize="none"
					/>
					<Description>We send the sign-in link here.</Description>
				</TextField>
			</Sample>
			<Sample caption="Filled · required">
				<TextField isRequired>
					<Label>Full name</Label>
					<Input variant={variant} defaultValue="Ana Rahma" />
				</TextField>
			</Sample>
			<Sample caption="Focused (ring drawn for review; real focus draws it the same way)">
				<TextField>
					<Label>Job title</Label>
					<Input
						variant={variant}
						defaultValue="Product designer"
						className="android:border-accent ios:outline-accent"
					/>
				</TextField>
			</Sample>
			<Sample caption="Error, shown after blur or submit, with the remedy">
				<TextField isInvalid>
					<Label>Email</Label>
					<Input variant={variant} defaultValue="ana@" />
					<FieldError>Enter an email like name@example.com.</FieldError>
				</TextField>
			</Sample>
			<Sample caption="Disabled">
				<TextField isDisabled>
					<Label>Username</Label>
					<Input variant={variant} value="ana" />
					<Description>Usernames can't change after sign-up.</Description>
				</TextField>
			</Sample>
		</View>
	);
}

function SelectSample({ variant, isDisabled = false }: VariantProps & { isDisabled?: boolean }) {
	const [value, setValue] = useState<Option | undefined>(languages[0]);
	return (
		<Select value={value} onValueChange={setValue} isDisabled={isDisabled}>
			<Label>Language</Label>
			<Select.Trigger accessibilityLabel="Language" className={cx(variant === "secondary" && "bg-default")}>
				<Select.Value placeholder="Choose a language" />
				<Select.TriggerIndicator />
			</Select.Trigger>
			<Select.Portal>
				<Select.Overlay />
				<Select.Content presentation="popover" width="trigger">
					{languages.map((language, index) => (
						<Fragment key={language.value}>
							{index > 0 ? <Separator /> : null}
							<Select.Item value={language.value} label={language.label} />
						</Fragment>
					))}
				</Select.Content>
			</Select.Portal>
		</Select>
	);
}

function Toggles() {
	const [terms, setTerms] = useState(true);
	const [digest, setDigest] = useState(false);
	const [haptic, setHaptic] = useState(true);
	return (
		<View className="gap-4">
			<ControlField isSelected={terms} onSelectedChange={setTerms}>
				<ControlField.Indicator>
					<Checkbox />
				</ControlField.Indicator>
				<View className="flex-1">
					<Label>Show my email on the public resume</Label>
					<Description>Recruiters can write to you directly.</Description>
				</View>
			</ControlField>
			<ControlField isSelected={digest} onSelectedChange={setDigest} isInvalid={!digest}>
				<ControlField.Indicator>
					<Checkbox />
				</ControlField.Indicator>
				<View className="flex-1">
					<Label>I agree to the terms</Label>
					<FieldError>Agree to the terms to continue.</FieldError>
				</View>
			</ControlField>
			<ControlField isSelected isDisabled>
				<ControlField.Indicator>
					<Checkbox />
				</ControlField.Indicator>
				<View className="flex-1">
					<Label>Included in your plan</Label>
				</View>
			</ControlField>
			<ControlField isSelected={haptic} onSelectedChange={setHaptic}>
				<View className="flex-1">
					<Label>Haptic feedback</Label>
					<Description>A light tap when you pick or finish something.</Description>
				</View>
				<ControlField.Indicator />
			</ControlField>
			<View className="flex-row items-center gap-4">
				<Switch isSelected accessibilityLabel="On" />
				<Switch isSelected={false} accessibilityLabel="Off" />
				<Switch isSelected isDisabled accessibilityLabel="On, disabled" />
				<Switch isSelected={false} isDisabled accessibilityLabel="Off, disabled" />
			</View>
		</View>
	);
}

function PageSize() {
	const [value, setValue] = useState("a4");
	return (
		<RadioGroup value={value} onValueChange={setValue}>
			<RadioGroup.Item value="a4">
				<View className="flex-1">
					<Label>A4</Label>
					<Description>210 × 297 mm, most countries</Description>
				</View>
				<Radio />
			</RadioGroup.Item>
			<RadioGroup.Item value="letter">
				<View className="flex-1">
					<Label>Letter</Label>
					<Description>8.5 × 11 in, United States and Canada</Description>
				</View>
				<Radio />
			</RadioGroup.Item>
			<RadioGroup.Item value="legal" isDisabled>
				<View className="flex-1">
					<Label>Legal</Label>
					<Description>Not available for resumes</Description>
				</View>
				<Radio />
			</RadioGroup.Item>
		</RadioGroup>
	);
}

function Search() {
	const [query, setQuery] = useState("");
	return (
		<SearchField value={query} onChange={setQuery}>
			<SearchField.Group>
				<SearchField.SearchIcon />
				<SearchField.Input placeholder="Search applications" accessibilityLabel="Search applications" />
				<SearchField.ClearButton accessibilityLabel="Clear search" />
			</SearchField.Group>
		</SearchField>
	);
}

export function FieldsGallery() {
	const [summary, setSummary] = useState("");
	const [volume, setVolume] = useState(40);
	return (
		<View className="gap-8">
			<GallerySection
				title="TextField"
				note="Label, input, then description or error. Fields sit flat: a fill, no border, no shadow."
			>
				<TextFieldStates variant="primary" />
			</GallerySection>

			<GallerySection title="TextField on a surface" note='On a white card pass variant="secondary".'>
				<Surface className="gap-5 rounded-3xl p-4">
					<TextFieldStates variant="secondary" />
				</Surface>
			</GallerySection>

			<GallerySection title="TextArea" note="Multi-line text: summaries, notes, cover letter paragraphs.">
				<TextField>
					<Label>Summary</Label>
					<TextArea value={summary} onChangeText={setSummary} placeholder="Two or three lines on what you do best" />
					<Description>{`${summary.length} / 600`}</Description>
				</TextField>
				<TextField isInvalid>
					<Label>Notes</Label>
					<TextArea defaultValue="Too short" />
					<FieldError>Write at least 20 characters.</FieldError>
				</TextField>
			</GallerySection>

			<GallerySection title="InputGroup" note="Prefix and suffix inside the field: a currency, a domain, an icon.">
				<TextField>
					<Label>Portfolio address</Label>
					<InputGroup>
						<InputGroup.Prefix isDecorative>
							<Icon name="globe" size={16} tone="muted" />
						</InputGroup.Prefix>
						<InputGroup.Input defaultValue="ana" autoCapitalize="none" />
						<InputGroup.Suffix isDecorative>
							<Caption>.rezumi.app</Caption>
						</InputGroup.Suffix>
					</InputGroup>
				</TextField>
			</GallerySection>

			<GallerySection title="SearchField" note="Clear button appears once there is text.">
				<Search />
			</GallerySection>

			<GallerySection title="Select" note="A short list of choices; long lists open a sheet.">
				<SelectSample variant="primary" />
				<SelectSample variant="primary" isDisabled />
				<Surface className="rounded-3xl p-4">
					<SelectSample variant="secondary" />
				</Surface>
			</GallerySection>

			<GallerySection
				title="Checkbox · Switch"
				note="Wrap a control and its text in ControlField so the whole row toggles. Switch acts at once; Checkbox waits for submit."
			>
				<Toggles />
			</GallerySection>

			<GallerySection title="RadioGroup" note="One choice from a few visible options. Whole row is the target.">
				<Surface className="rounded-3xl p-4">
					<PageSize />
				</Surface>
			</GallerySection>

			<GallerySection title="Slider" note="Approximate values with a visible output.">
				<Slider value={volume} onChange={(next) => setVolume(Array.isArray(next) ? (next[0] ?? 0) : next)}>
					<View className="flex-row items-center justify-between">
						<Label>Photo size</Label>
						<Slider.Output />
					</View>
					<Slider.Track>
						<Slider.Fill />
						<Slider.Thumb />
					</Slider.Track>
				</Slider>
				<Slider defaultValue={70} isDisabled>
					<View className="flex-row items-center justify-between">
						<Label>Disabled</Label>
						<Slider.Output />
					</View>
					<Slider.Track>
						<Slider.Fill />
						<Slider.Thumb />
					</Slider.Track>
				</Slider>
			</GallerySection>

			<GallerySection title="InputOTP" note="Six-digit codes; pastes and SMS autofill fill every slot.">
				<InputOTP maxLength={6}>
					<InputOTP.Group>
						<InputOTP.Slot index={0} />
						<InputOTP.Slot index={1} />
						<InputOTP.Slot index={2} />
					</InputOTP.Group>
					<InputOTP.Separator />
					<InputOTP.Group>
						<InputOTP.Slot index={3} />
						<InputOTP.Slot index={4} />
						<InputOTP.Slot index={5} />
					</InputOTP.Group>
				</InputOTP>
			</GallerySection>
		</View>
	);
}
