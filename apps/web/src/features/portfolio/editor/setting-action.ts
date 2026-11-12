import type { SettingOptions } from "./settings";
import type { PortfolioRecord } from "./store";
import { t } from "@lingui/core/macro";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "@rezumi/ui/components/toast";
import { portfolioErrorMessage } from "../errors";
import { invalidatePortfolioQueries } from "../status";
import { changeSetting } from "./settings";

/** Changes a setting that lives beside the data (`changeSetting`), saying what went wrong when it couldn't. */
export function useSettingAction() {
	const queryClient = useQueryClient();
	const [pending, setPending] = useState(false);

	const run = async (action: () => Promise<PortfolioRecord>, fallback: string, options: SettingOptions = {}) => {
		setPending(true);
		try {
			if ((await changeSetting(action, options)) === "unsaved") {
				toast.add({
					type: "error",
					description: t`Your latest changes aren't saved, so nothing was changed. Check the save status at the top, then try again.`,
				});
				return false;
			}
			void invalidatePortfolioQueries(queryClient);
			return true;
		} catch (error) {
			toast.add({ type: "error", description: portfolioErrorMessage(error, { fallback }) });
			return false;
		} finally {
			setPending(false);
		}
	};

	return { run, pending };
}
