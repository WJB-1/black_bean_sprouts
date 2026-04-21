// @doc-schema-version: 1.0.0
import type { BlockBase } from "../base";

export interface FigureAsset {
  assetId: string;
  width?: "full" | "half" | number;
  altText?: string;
}

export interface SubFigure {
  label: string;
  caption?: string;
  asset: FigureAsset;
}

export interface Figure extends BlockBase {
  type: "figure";
  attrs: {
    caption: string;
    label?: string;
    layout: "single" | "grid" | "horizontal" | "vertical";
    columns?: number;
    asset?: FigureAsset;
    subfigures?: SubFigure[];
    styleOverrides?: {
      captionAlign?: "left" | "center";
      widthOverride?: string;
    };
  };
}
