import type { Website } from "@rezumi/schema/resume/data";
import { buttonVariants } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Icon } from "@rezumi/ui/components/icon";
import { Input } from "@rezumi/ui/components/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@rezumi/ui/components/input-group";
import { Label } from "@rezumi/ui/components/label";
import { Popover, PopoverContent, PopoverTrigger } from "@rezumi/ui/components/popover";
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

type Props<TValue extends Website = Website> = Omit<React.ComponentProps<"input">, "value" | "onChange"> & {
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
		<InputGroup>
			<InputGroupAddon align="inline-start">
				<InputGroupText>{prefix}</InputGroupText>
			</InputGroupAddon>

			<InputGroupInput
				value={urlValue}
				className={cn(props.className, "ps-0!")}
				onChange={handleUrlChange}
				{...props}
			/>

			{!hideLabelButton && (
				<InputGroupAddon align="inline-end">
					<Popover>
						<PopoverTrigger
							render={
								<button
									type="button"
									className={buttonVariants({ variant: "ghost", size: "sm", isIconOnly: true })}
									aria-label={t({
										comment: "Tooltip for action button that opens URL label editor",
										message: "Add a label to the URL",
									})}
								>
									<Icon name="tag" size={16} />
								</button>
							}
						/>

						<PopoverContent className="pt-3">
							{/** oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- for stopPropagation */}
							<div role="presentation" className="grid gap-2" onMouseDown={(e) => e.stopPropagation()}>
								<Label htmlFor="url-label">
									<Trans comment="Short field label for custom display text associated with a URL">Label</Trans>
								</Label>
								<Input id="url-label" name="url-label" value={value.label} onChange={handleLabelChange} />
							</div>
						</PopoverContent>
					</Popover>
				</InputGroupAddon>
			)}
		</InputGroup>
	);
}
