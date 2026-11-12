import type { TypographyProps } from "@heroui/react";

type TypographyRender = NonNullable<TypographyProps["render"]>;

/*
 * HeroUI's Typography takes its look from `type` and its element from `render`. A title rarely wants the heading
 * element that matches its size: a page title looks like an `h2` and is the page's `h1`, a card title looks like an
 * `h6` and sits under an `h2`. Write `<Typography type="h2" render={renderAsH1}>` so the outline stays right and the
 * scale stays HeroUI's. These are the shared render functions, so no call site builds its own.
 */

export const renderAsH1: TypographyRender = ({ children, ...props }) => <h1 {...props}>{children}</h1>;
export const renderAsH2: TypographyRender = ({ children, ...props }) => <h2 {...props}>{children}</h2>;
export const renderAsH3: TypographyRender = ({ children, ...props }) => <h3 {...props}>{children}</h3>;
