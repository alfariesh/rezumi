import type { TemplateSemanticManifest } from "../../semantic/template-manifest";
import { baseManifest, itemHeaderRowPart } from "../../semantic/shared-parts";

export const wibawaSemanticManifest = baseManifest("wibawa", [itemHeaderRowPart]) satisfies TemplateSemanticManifest;
