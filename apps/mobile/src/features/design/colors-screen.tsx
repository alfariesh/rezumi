// Design → Colors and levels: the primary, text and background colours as exact values, and how skill and language
// levels draw (their type, and the icon the Icon type repeats, picked by category in the resume's icon style).
import type { DesignProps } from "./types";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { parseColorInput } from "@rezumi/resume/design-presets";
import { iconDesignOf } from "@rezumi/schema/resume/data";
import { IconPickerSheet, iconLabel } from "./icon-picker";
import { ResumeIcon, useIconGlyphs } from "./resume-icon";
import { DesignSubScreen } from "./sub-screen";
import { ColorField, ListRow, ListSection, Sheet } from "@/ui";

const LEVEL_TYPES = ["hidden", "circle", "square", "rectangle", "rectangle-full", "progress-bar", "icon"] as const;
type LevelType = (typeof LEVEL_TYPES)[number];
type ColorName = "primary" | "text" | "background";

export function ColorsScreen({ id }: { id: string }) {
	const { t } = useLingui();
	return (
		<DesignSubScreen id={id} title={t`Colors and levels`}>
			{(props) => (
				<>
					<DesignColorField {...props} name="primary" label={t`Primary color`} />
					<DesignColorField {...props} name="text" label={t`Text color`} />
					<DesignColorField {...props} name="background" label={t`Background color`} />
					<Levels {...props} />
				</>
			)}
		</DesignSubScreen>
	);
}

type DesignColorFieldProps = DesignProps & { name: ColorName; label: string };

/** One document colour as hex or rgba text (the shared field: checked and saved when left, one undo step). */
function DesignColorField({ data, write, disabled, name, label }: DesignColorFieldProps) {
	const { t } = useLingui();
	return (
		<ColorField
			label={label}
			value={data.metadata.design.colors[name]}
			isDisabled={disabled}
			invalidLabel={t`Use a hex value like #3E6B4F or rgba(62, 107, 79, 1).`}
			onChange={(text) => {
				const parsed = parseColorInput(text);
				if (!parsed) return false;
				write(`colors.${name}`, (draft) => void (draft.metadata.design.colors[name] = parsed), true);
				return true;
			}}
		/>
	);
}

function Levels({ data, write, disabled }: DesignProps) {
	const { t } = useLingui();
	const [open, setOpen] = useState<"icon" | "type" | null>(null);
	const { level } = data.metadata.design;
	const style = iconDesignOf(data.metadata.design).style;
	const glyphs = useIconGlyphs(style);
	const names: Record<LevelType, string> = {
		hidden: t`Hidden`,
		circle: t`Circle`,
		square: t`Square`,
		rectangle: t`Rectangle`,
		"rectangle-full": t`Rectangle (full width)`,
		"progress-bar": t`Progress bar`,
		icon: t`Icon`,
	};
	const close = (isOpen: boolean) => !isOpen && setOpen(null);

	return (
		<>
			<ListSection title={t`Levels`} footer={t`How skill and language levels draw on the page.`}>
				<ListRow
					title={t`Type`}
					value={names[level.type as LevelType] ?? level.type}
					isDisabled={disabled}
					onPress={() => setOpen("type")}
				/>
				<ListRow
					title={t`Icon`}
					value={level.icon ? undefined : t`None`}
					leading={level.icon ? <ResumeIcon name={level.icon} glyphs={glyphs} size={20} /> : undefined}
					description={level.icon ? iconLabel(level.icon) : undefined}
					isDisabled={disabled}
					onPress={() => setOpen("icon")}
				/>
			</ListSection>
			<Sheet isOpen={open === "type"} onOpenChange={close} title={t`Level type`} closeLabel={t`Close`}>
				<ListSection>
					{LEVEL_TYPES.map((type) => (
						<ListRow
							key={type}
							title={names[type]}
							chevron={false}
							isSelected={type === level.type}
							onPress={() => {
								setOpen(null);
								write("level.type", (draft) => void (draft.metadata.design.level.type = type), true);
							}}
						/>
					))}
				</ListSection>
			</Sheet>
			<IconPickerSheet
				isOpen={open === "icon"}
				onOpenChange={close}
				value={level.icon}
				iconStyle={style}
				onChange={(icon) => write("level.icon", (draft) => void (draft.metadata.design.level.icon = icon), true)}
			/>
		</>
	);
}
