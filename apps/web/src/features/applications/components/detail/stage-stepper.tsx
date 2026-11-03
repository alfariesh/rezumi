import type { Application } from "../../types";
import type { ApplicationStatus } from "@rezumi/schema/applications/data";
import type { CSSProperties } from "react";
import { Stepper } from "@heroui-pro/react";
import { t } from "@lingui/core/macro";
import { getStageColor, getStageLabel, PIPELINE } from "../../stages";

type StageStepperProps = {
	application: Pick<Application, "status">;
	/** A stage was picked; the current stage is not reported again. */
	onSelect: (stage: ApplicationStatus) => void;
};

/**
 * Where the application is in the pipeline: Saved to Offer, each stage in its own color, reached stages checked. Any
 * stage can be picked to move there. A closed application has no current stage, so every step reads as not reached.
 */
export function StageStepper({ application, onSelect }: StageStepperProps) {
	const current = PIPELINE.indexOf(application.status);

	return (
		<Stepper
			size="sm"
			aria-label={t`Stages`}
			currentStep={current}
			onStepChange={(index) => {
				const stage = PIPELINE[index];
				if (stage && stage !== application.status) onSelect(stage);
			}}
		>
			{PIPELINE.map((stage) => {
				const color = getStageColor(stage);
				return (
					<Stepper.Step
						key={stage}
						style={{ "--stepper-active-color": color, "--stepper-complete-color": color } as CSSProperties}
					>
						<Stepper.Indicator />
						<Stepper.Content>
							<Stepper.Title>{getStageLabel(stage)}</Stepper.Title>
						</Stepper.Content>
						<Stepper.Separator />
					</Stepper.Step>
				);
			})}
		</Stepper>
	);
}
