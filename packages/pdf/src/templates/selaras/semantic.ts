import type { TemplateSemanticManifest } from "../../semantic/template-manifest";
import { baseManifest, itemHeaderRowPart } from "../../semantic/shared-parts";

export const selarasSemanticManifest = baseManifest("selaras", [itemHeaderRowPart]) satisfies TemplateSemanticManifest;
