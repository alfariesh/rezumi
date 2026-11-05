import type { TemplateSemanticManifest } from "../../semantic/template-manifest";
import { baseManifest, itemHeaderRowPart } from "../../semantic/shared-parts";

export const ivorySemanticManifest = baseManifest("ivory", [itemHeaderRowPart]) satisfies TemplateSemanticManifest;
