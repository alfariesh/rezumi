import type { InputProps } from "@heroui/react";
import { InputGroup } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useToggle } from "usehooks-ts";
import { IconButton } from "@rezumi/ui/components/icon-button";

type PasswordInputProps = Omit<InputProps, "type">;

export function PasswordInput(props: PasswordInputProps) {
	const [visible, toggleVisible] = useToggle(false);

	return (
		<InputGroup fullWidth>
			<InputGroup.Input {...props} type={visible ? "text" : "password"} />

			<InputGroup.Suffix>
				<IconButton
					size="sm"
					icon={visible ? "eye" : "eye-slash"}
					iconSize={16}
					onPress={() => toggleVisible()}
					aria-pressed={visible}
					label={
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
				/>
			</InputGroup.Suffix>
		</InputGroup>
	);
}
