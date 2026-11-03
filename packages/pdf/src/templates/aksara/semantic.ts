import type { TemplateSemanticManifest } from "../../semantic/template-manifest";
import { baseManifest, itemHeaderRowPart } from "../../semantic/shared-parts";

export const aksaraSemanticManifest = baseManifest("aksara", [itemHeaderRowPart]) satisfies TemplateSemanticManifest;
