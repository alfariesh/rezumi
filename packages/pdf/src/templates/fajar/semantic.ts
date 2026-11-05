import type { TemplateSemanticManifest } from "../../semantic/template-manifest";
import { baseManifest, itemHeaderRowPart } from "../../semantic/shared-parts";

export const fajarSemanticManifest = baseManifest("fajar", [itemHeaderRowPart]) satisfies TemplateSemanticManifest;
