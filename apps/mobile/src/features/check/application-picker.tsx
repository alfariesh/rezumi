import { useLingui } from "@lingui/react/macro";
import { useApplications } from "@/features/applications/queries";
import { EmptyState, ListRow, ListSection, Sheet, Skeleton } from "@/ui";

type ApplicationPickerProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	value: string | null;
	onPick: (id: string) => void;
	/** "Unlink this application", when one is linked. */
	onUnlink?: (() => void) | undefined;
};

/** Picks the application whose posting Job match reads; closed ones are left out. */
export function ApplicationPicker({ isOpen, onOpenChange, value, onPick, onUnlink }: ApplicationPickerProps) {
	const { t } = useLingui();
	const applications = useApplications();
	const choices = (applications.data ?? []).filter((application) => application.status !== "closed");

	return (
		<Sheet isOpen={isOpen} onOpenChange={onOpenChange} title={t`Application`} closeLabel={t`Close`} padded={false}>
			{applications.isPending ? (
				<Skeleton variant="none" className="mx-4 h-32 rounded-2xl" />
			) : applications.isError ? (
				<EmptyState
					kind="inline"
					title={t`Couldn't load applications.`}
					action={{ label: t`Retry`, onPress: () => void applications.refetch() }}
				/>
			) : choices.length === 0 ? (
				<EmptyState kind="inline" title={t`No applications yet`} />
			) : (
				<ListSection>
					{choices.map((application) => (
						<ListRow
							key={application.id}
							title={`${application.role} · ${application.company}`}
							isSelected={application.id === value}
							chevron={false}
							onPress={() => {
								onOpenChange(false);
								onPick(application.id);
							}}
						/>
					))}
				</ListSection>
			)}
			{onUnlink ? (
				<ListSection>
					<ListRow
						title={t`Unlink this application`}
						tone="danger"
						onPress={() => {
							onOpenChange(false);
							onUnlink();
						}}
					/>
				</ListSection>
			) : null}
		</Sheet>
	);
}
