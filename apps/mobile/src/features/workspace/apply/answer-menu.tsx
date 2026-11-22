import { useLingui } from "@lingui/react/macro";
import { Icon, IconButton, Menu } from "@/ui";

type AnswerMenuProps = { disabled: boolean; onEdit: () => void; onRemove: () => void };

/** Edit or remove one question; removing shows an Undo toast. */
export function AnswerMenu({ disabled, onEdit, onRemove }: AnswerMenuProps) {
	const { t } = useLingui();
	return (
		<Menu>
			<Menu.Trigger asChild>
				<IconButton icon="dots-three" size="sm" label={t`Question options`} isDisabled={disabled} />
			</Menu.Trigger>
			<Menu.Portal>
				<Menu.Overlay />
				<Menu.Content presentation="popover" width={220}>
					<Menu.Item onPress={onEdit}>
						<Icon name="pencil-simple" size={16} />
						<Menu.ItemTitle>{t`Edit question`}</Menu.ItemTitle>
					</Menu.Item>
					<Menu.Item variant="danger" onPress={onRemove}>
						<Icon name="trash" size={16} tone="danger" />
						<Menu.ItemTitle>{t`Remove question`}</Menu.ItemTitle>
					</Menu.Item>
				</Menu.Content>
			</Menu.Portal>
		</Menu>
	);
}
