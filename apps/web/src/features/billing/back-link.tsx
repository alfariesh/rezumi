import { Trans } from "@lingui/react/macro";
import { Link } from "@tanstack/react-router";
import { Icon } from "@rezumi/ui/components/icon";

/** Back to the Plan page, above a payment's own pages. */
export function BackToPlanLink() {
	return (
		<Link
			to="/dashboard/settings/billing"
			className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground print:hidden"
		>
			<Icon name="caret-left" size={16} />
			<Trans>Plan</Trans>
		</Link>
	);
}
