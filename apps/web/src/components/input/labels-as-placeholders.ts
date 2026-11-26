import { createContext, use } from "react";

/**
 * True inside a list's white card (a resume entry, a portfolio service): fields there go without a visible label, their
 * name shown as the placeholder and kept as the accessible name, so an open item reads as a short form inside its row.
 */
export const LabelsAsPlaceholders = createContext(false);

/** The class for a label that names its field for screen readers only, inside such a card. */
export function useFieldLabelClass() {
	return use(LabelsAsPlaceholders) ? "sr-only" : undefined;
}
