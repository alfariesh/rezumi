export type { Color, EdgeValues, CornerValues, ElementStyleInfo, ElementInfo, PageInfo, LayoutInfo, RenderWithLayoutResult, RenderDocumentOptions, RedactionRegion, RedactionPattern, } from './index.js';
import type { RenderWithLayoutResult, RenderDocumentOptions, RedactionRegion, RedactionPattern } from './index.js';
/**
 * Initialize the WASM engine. Pass a `WebAssembly.Module` (the default
 * shape Wrangler/esbuild give you when you `import wasm from '…/forme_bg.wasm'`)
 * or any other value `__wbg_init` accepts: a `URL`, a `Response`, a
 * `Promise<Response>`, raw bytes (`BufferSource`), or `undefined` to
 * fall back to fetching `forme_bg.wasm` next to `pkg-web/forme.js`.
 *
 * Idempotent: subsequent calls reuse the first invocation's promise.
 * Must complete before any render/redact/merge call.
 */
export declare function init(module?: unknown): Promise<void>;
export declare function renderPdf(json: string): Promise<Uint8Array>;
export declare function renderPdfWithLayout(json: string, options?: RenderDocumentOptions): Promise<RenderWithLayoutResult>;
export declare function renderDocument(element: import('react').ReactElement, options?: RenderDocumentOptions): Promise<Uint8Array>;
export declare function renderDocumentWithLayout(element: import('react').ReactElement, options?: RenderDocumentOptions): Promise<RenderWithLayoutResult>;
export declare function renderSerializedDoc(doc: Record<string, unknown>, options?: RenderDocumentOptions): Promise<Uint8Array>;
export declare function renderSerializedDocWithLayout(doc: Record<string, unknown>, options?: RenderDocumentOptions): Promise<RenderWithLayoutResult>;
export declare function renderTemplate(templateJson: string, dataJson: string): Promise<Uint8Array>;
export declare function renderTemplateWithLayout(templateJson: string, dataJson: string): Promise<RenderWithLayoutResult>;
export declare function certifyPdf(pdfBytes: Uint8Array, config: {
    certificatePem: string;
    privateKeyPem: string;
    reason?: string;
    location?: string;
    contact?: string;
    visible?: boolean;
    page?: number;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
}): Promise<Uint8Array>;
/** @deprecated Use certifyPdf */
export declare const signPdf: typeof certifyPdf;
export declare function redactPdf(pdfBytes: Uint8Array, regions: RedactionRegion[]): Promise<Uint8Array>;
export declare function findTextRegions(pdfBytes: Uint8Array, patterns: RedactionPattern[]): Promise<RedactionRegion[]>;
export declare function redactText(pdfBytes: Uint8Array, patterns: RedactionPattern[]): Promise<Uint8Array>;
export declare function mergePdfs(pdfs: Uint8Array[]): Promise<Uint8Array>;
/** Extract embedded JSON data from a Forme-generated PDF. */
export declare function extractData(pdfBytes: Uint8Array): Promise<unknown | null>;
export type { AttachmentOptions, FacturXOptions, AfRelationship, FacturXProfile } from './attachments.js';
