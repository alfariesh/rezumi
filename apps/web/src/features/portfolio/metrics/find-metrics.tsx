import type { RouterOutput } from "@/libs/orpc/client";
import type { PortfolioMetric } from "@rezumi/schema/portfolio/metric";
import { Alert, Button, Checkbox, Modal, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import { create } from "zustand/react";
import { formatMetric } from "@rezumi/portfolio/metric";
import { Icon } from "@rezumi/ui/components/icon";
import { generateId } from "@rezumi/utils/string";
import { usePortfolioSource } from "../editor/context";
import { portfolioAiErrorMessage } from "../errors";
import { useRequestSignals } from "../images/use-request-signals";
import { aiSourceFields, useAiSource } from "@/features/billing/ai-source";
import { AiSourceMenu } from "@/features/billing/ai-source-menu";
import { client } from "@/libs/orpc/client";

type Candidate = RouterOutput["portfolio"]["ai"]["findMetrics"]["candidates"][number];

/** The last search, per source: opening this from another block doesn't pay for the same answer twice. */
const useFound = create<{ sourceKey: string | null; candidates: Candidate[] | null }>(() => ({
	sourceKey: null,
	candidates: null,
}));

const asMetric = (candidate: Candidate): PortfolioMetric => ({ ...candidate.metric, id: generateId() });

type FindMetricsButtonProps = {
	/** How many more this list can take. */
	room: number;
	locale: string;
	onAdd: (metrics: PortfolioMetric[]) => void;
};

/** "Find numbers": AI reads the resume's jobs and projects and suggests metrics, only from numbers written there. */
export function FindMetricsButton({ room, locale, onAdd }: FindMetricsButtonProps) {
	const [open, setOpen] = useState(false);
	const ai = useAiSource();
	const source = usePortfolioSource();
	if (!source.data || !ai.source || room <= 0) return null;
	return (
		<>
			<Button variant="secondary" className="w-fit" onPress={() => setOpen(true)}>
				<Icon name="sparkle" size={18} />
				<Trans>Find numbers</Trans>
			</Button>
			{open && (
				<FindMetricsDialog
					sourceKey={source.resume?.id ?? "profile"}
					fromProfile={source.from === "profile"}
					room={room}
					locale={locale}
					onAdd={onAdd}
					onClose={() => setOpen(false)}
				/>
			)}
		</>
	);
}

type FindMetricsDialogProps = FindMetricsButtonProps & {
	/** The source resume's id, or "profile". */
	sourceKey: string;
	fromProfile: boolean;
	onClose: () => void;
};

function FindMetricsDialog({ sourceKey, fromProfile, room, locale, onAdd, onClose }: FindMetricsDialogProps) {
	const id = useId();
	const ai = useAiSource();
	const found = useFound((state) => (state.sourceKey === sourceKey ? state.candidates : null));
	const [chosen, setChosen] = useState<number[]>([]);
	const signals = useRequestSignals();
	const search = useMutation({
		mutationFn: () => client.portfolio.ai.findMetrics(aiSourceFields(ai), { signal: signals.next() }),
		onSuccess: (result) => {
			setChosen([]);
			useFound.setState({ sourceKey, candidates: result.candidates });
		},
	});

	const add = () => {
		if (!found) return;
		onAdd(chosen.flatMap((index) => (found[index] ? [asMetric(found[index])] : [])));
		onClose();
	};

	const full = chosen.length >= room;

	return (
		<Modal.Backdrop isOpen onOpenChange={(next) => !next && onClose()}>
			<Modal.Container size="md" scroll="inside">
				<Modal.Dialog aria-labelledby={`${id}-title`}>
					<Modal.CloseTrigger aria-label={t`Close`} />
					<Modal.Header>
						<Modal.Heading id={`${id}-title`}>
							{fromProfile ? <Trans>Find numbers in your Profile</Trans> : <Trans>Find numbers in your resume</Trans>}
						</Modal.Heading>
						<p className="text-body-sm text-muted">
							<Trans>
								AI reads your jobs and projects and only suggests numbers written there. You pick which to use.
							</Trans>
						</p>
					</Modal.Header>
					<Modal.Body className="grid gap-3">
						{search.isPending ? (
							<div role="status" className="grid justify-items-center gap-3 py-8">
								<Spinner size="lg" color="current" />
								<p className="text-sm font-medium">
									{fromProfile ? <Trans>Reading your Profile…</Trans> : <Trans>Reading your resume…</Trans>}
								</p>
							</div>
						) : found === null ? null : found.length === 0 ? (
							<p className="text-body-sm">
								<Trans>
									No results with numbers in your jobs and projects yet. Add one to your resume, such as “cut load time
									by 40%”, then try again.
								</Trans>
							</p>
						) : (
							<div className="grid gap-2">
								{found.map((candidate, index) => {
									const selected = chosen.includes(index);
									return (
										<Checkbox
											// oxlint-disable-next-line react/no-array-index-key -- the list is replaced whole; a candidate has no id
											key={index}
											isSelected={selected}
											isDisabled={!selected && full}
											onChange={(checked) =>
												setChosen((list) => (checked ? [...list, index] : list.filter((entry) => entry !== index)))
											}
											className="rounded-2xl border border-separator p-3"
										>
											<Checkbox.Content className="items-start">
												<Checkbox.Control className="mt-0.5 border border-separator">
													<Checkbox.Indicator />
												</Checkbox.Control>
												<span className="grid min-w-0 gap-1">
													<span className="text-sm">
														<strong dir="ltr" className="font-semibold">
															{formatMetric(asMetric(candidate), locale)}
														</strong>{" "}
														{candidate.metric.label}
													</span>
													<q className="text-xs text-muted">{candidate.quote}</q>
													<span className="text-xs text-muted">{candidate.source}</span>
												</span>
											</Checkbox.Content>
										</Checkbox>
									);
								})}
							</div>
						)}
						{found && found.length > 0 && (
							<p className="text-body-xs text-muted">
								<Trans>Pick up to {room}. Use numbers you can explain in an interview.</Trans>
							</p>
						)}
						{search.error && (
							<Alert status="warning">
								<Alert.Indicator />
								<Alert.Content>
									<Alert.Description>
										{portfolioAiErrorMessage(search.error, t`Couldn't read your resume. Nothing changed. Try again.`)}
									</Alert.Description>
								</Alert.Content>
							</Alert>
						)}
					</Modal.Body>
					<Modal.Footer className="flex-wrap items-center">
						<AiSourceMenu action="portfolio-metrics" className="me-auto" />
						{found === null ? (
							<Button isPending={search.isPending} onPress={() => search.mutate()}>
								<Icon name="sparkle" size={18} />
								<Trans>Find numbers</Trans>
							</Button>
						) : (
							<>
								<Button variant="secondary" isPending={search.isPending} onPress={() => search.mutate()}>
									<Trans>Search again</Trans>
								</Button>
								<Button isDisabled={chosen.length === 0} onPress={add}>
									<Trans>Add selected</Trans>
								</Button>
							</>
						)}
					</Modal.Footer>
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}
