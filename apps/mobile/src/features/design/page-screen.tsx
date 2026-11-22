// Design → Page: the exact margins and spacing, in points.
import type { ResumeData } from "@rezumi/schema/resume/data";
import { useLingui } from "@lingui/react/macro";
import { DesignSubScreen } from "./sub-screen";
import { Card, NumberStepper } from "@/ui";

type NumberKey = keyof Pick<ResumeData["metadata"]["page"], "marginX" | "marginY" | "gapX" | "gapY">;

export function ExactPageScreen({ id }: { id: string }) {
	const { t } = useLingui();
	const rows: { key: NumberKey; label: string; decrease: string; increase: string; max?: number }[] = [
		{
			key: "marginX",
			label: t`Horizontal margin`,
			decrease: t`Decrease horizontal margin`,
			increase: t`Increase horizontal margin`,
			max: 100,
		},
		{
			key: "marginY",
			label: t`Vertical margin`,
			decrease: t`Decrease vertical margin`,
			increase: t`Increase vertical margin`,
			max: 100,
		},
		{
			key: "gapX",
			label: t`Horizontal spacing`,
			decrease: t`Decrease horizontal spacing`,
			increase: t`Increase horizontal spacing`,
		},
		{
			key: "gapY",
			label: t`Vertical spacing`,
			decrease: t`Decrease vertical spacing`,
			increase: t`Increase vertical spacing`,
		},
	];
	return (
		<DesignSubScreen id={id} title={t`Page`}>
			{({ data, write, disabled }) => (
				<Card>
					<Card.Body className="gap-1">
						{rows.map((row) => (
							<NumberStepper
								key={row.key}
								label={row.label}
								value={data.metadata.page[row.key]}
								unit="pt"
								min={0}
								max={row.max}
								step={1}
								isDisabled={disabled}
								decreaseLabel={row.decrease}
								increaseLabel={row.increase}
								onChange={(value) =>
									write(`page.${row.key}`, (draft) => void (draft.metadata.page[row.key] = value), true)
								}
							/>
						))}
					</Card.Body>
				</Card>
			)}
		</DesignSubScreen>
	);
}
