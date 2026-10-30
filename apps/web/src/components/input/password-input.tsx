import { Button } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useToggle } from "usehooks-ts";
import { Icon } from "@rezumi/ui/components/icon";
import { Input } from "@rezumi/ui/components/input";

type PasswordInputProps = Omit<React.ComponentProps<"input">, "type">;

export function PasswordInput(props: PasswordInputProps) {
	const [visible, toggleVisible] = useToggle(false);

	return (
		<div className="flex items-center gap-x-1.5">
			<Input {...props} type={visible ? "text" : "password"} />

			<Button
				isIconOnly
				variant="ghost"
				onPress={() => toggleVisible()}
				aria-pressed={visible}
				aria-label={
					visible
						? t({
								comment: "Accessible label for button that hides a visible password",
								message: "Hide password",
							})
						: t({
								comment: "Accessible label for button that reveals a masked password",
								message: "Show password",
							})
				}
			>
				<Icon name={visible ? "eye" : "eye-slash"} size={16} />
			</Button>
		</div>
	);
}
