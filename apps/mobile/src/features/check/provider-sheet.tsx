import { useLingui } from "@lingui/react/macro";
import { ListRow, ListSection, Sheet } from "@/ui";

type Provider = { id: string; label: string; model: string; managed?: boolean | undefined };

type ProviderSheetProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	providers: readonly Provider[];
	value: string | null;
	onPick: (id: string) => void;
};

/** Which AI provider reads the resume for the writing review. */
export function ProviderSheet({ isOpen, onOpenChange, providers, value, onPick }: ProviderSheetProps) {
	const { t } = useLingui();
	return (
		<Sheet isOpen={isOpen} onOpenChange={onOpenChange} title={t`AI provider`} closeLabel={t`Close`} padded={false}>
			<ListSection>
				{providers.map((provider) => (
					<ListRow
						key={provider.id}
						title={provider.label}
						description={provider.managed ? undefined : provider.model}
						isSelected={provider.id === value}
						chevron={false}
						onPress={() => {
							onPick(provider.id);
							onOpenChange(false);
						}}
					/>
				))}
			</ListSection>
		</Sheet>
	);
}
