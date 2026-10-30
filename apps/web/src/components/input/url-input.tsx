import type { InputGroupInputProps } from "@heroui/react";
import type { Website } from "@rezumi/schema/resume/data";
import { Input, InputGroup, Label, Popover } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { cn } from "@rezumi/utils/style";

const DEFAULT_PREFIX = "https://";
const HTTP_PREFIX = /^https?:\/\//i;

function stripPrefix(url: string) {
	return url.replace(HTTP_PREFIX, "");
}

function ensurePrefix(url: string, prefix: string) {
	if (url === "") return "";
	return HTTP_PREFIX.test(url) ? url : prefix + url;
}

type Props<TValue extends Website = Website> = Omit<InputGroupInputProps, "value" | "onChange"> & {
	value: TValue;
	onChange: (value: TValue) => void;
	hideLabelButton?: boolean;
};

export function URLInput<TValue extends Website>({ value, onChange, hideLabelButton, ...props }: Props<TValue>) {
	const prefix = value.url.match(HTTP_PREFIX)?.[0] ?? DEFAULT_PREFIX;
	const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		onChange({
			...value,
			url: ensurePrefix(e.target.value, prefix),
		});
	};

	const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		onChange({ ...value, label: e.target.value });
	};

	const urlValue = stripPrefix(value.url);

	return (
		<InputGroup fullWidth>
			<InputGroup.Prefix>
				<span>{prefix}</span>
			</InputGroup.Prefix>

			<InputGroup.Input
				value={urlValue}
				className={cn(props.className, "ps-0")}
				onChange={handleUrlChange}
				{...props}
			/>

			{!hideLabelButton && (
				<InputGroup.Suffix className="pe-0">
					<Popover>
						<IconButton
							icon="tag"
							iconSize={16}
							size="sm"
							label={t({
								comment: "Tooltip for action button that opens URL label editor",
								message: "Add a label to the URL",
							})}
						/>

						<Popover.Content placement="bottom end">
							<Popover.Dialog className="grid gap-2 outline-hidden">
								<Label htmlFor="url-label">
									<Trans comment="Short field label for custom display text associated with a URL">Label</Trans>
								</Label>
								<Input fullWidth id="url-label" name="url-label" value={value.label} onChange={handleLabelChange} />
							</Popover.Dialog>
						</Popover.Content>
					</Popover>
				</InputGroup.Suffix>
			)}
		</InputGroup>
	);
}
