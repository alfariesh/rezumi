import type { ReactNode } from "react";
import { Typography } from "@heroui/react";
import { renderAsH1 } from "@/libs/typography";

type PageHeaderProps = {
	title: ReactNode;
	/** Beside the title, outside the heading: a small status such as a save indicator. */
	titleAddon?: ReactNode;
	/** One line under the title. */
	description?: ReactNode;
	/** A small back link above the title. */
	back?: ReactNode;
	/** Buttons on the right of the title row. */
	actions?: ReactNode;
	/** The toolbar row under the title: navigation or view tabs first, then search, filters and sort. */
	children?: ReactNode;
};

/** The one header every dashboard page uses. Renders as siblings, so the page's own gap spaces the rows. */
export function PageHeader({ title, titleAddon, description, back, actions, children }: PageHeaderProps) {
	const heading = (
		<Typography type="h2" render={renderAsH1}>
			{title}
		</Typography>
	);

	return (
		<>
			<header className="flex flex-wrap items-center justify-between gap-3">
				<div className="grid min-w-0 gap-1">
					{back && <div className="mb-2">{back}</div>}
					{titleAddon ? (
						<div className="flex min-w-0 items-center gap-2">
							{heading}
							{titleAddon}
						</div>
					) : (
						heading
					)}
					{description && <p className="text-body-sm text-muted">{description}</p>}
				</div>
				{actions && <div className="flex items-center gap-2">{actions}</div>}
			</header>
			{children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
		</>
	);
}
