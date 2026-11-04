import type { LayoutInfo } from '../index.js';
export interface RawLayoutResult {
    pdf: Uint8Array;
    layout: LayoutInfo;
    warnings?: string[];
}
export interface RenderWithLayoutResultShape {
    pdf: Uint8Array;
    layout: LayoutInfo;
    warnings: string[];
}
export declare function toRenderWithLayoutResult(raw: RawLayoutResult): RenderWithLayoutResultShape;
/**
 * Serialize the per-render engine options (`RenderOptions` on the Rust
 * side) for the WASM boundary. Returns `undefined` when every option is
 * off, so the default render takes the exact historical code path —
 * "costs nothing when off" is enforced by construction, not by hoping
 * the engine ignores an empty object cheaply.
 */
export declare function encodeRenderOptions(options?: {
    auditContent?: boolean;
}): string | undefined;
