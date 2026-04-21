// @doc-schema-version: 1.0.0
import type { StyleProfile } from "@black-bean-sprouts/doc-schema";

export const defaultStyleProfile: StyleProfile = {
  id: "__default__",
  name: "默认样式",
  docTypeCode: "thesis",
  version: "1.0.0",
  page: {
    size: "A4",
    orientation: "portrait",
    margin: { top: "2.54cm", bottom: "2.54cm", left: "3.17cm", right: "3.17cm" },
  },
  fonts: {
    body: { eastAsian: "宋体", latin: "Times New Roman" },
    heading: { eastAsian: "黑体", latin: "Arial" },
    caption: { eastAsian: "宋体", latin: "Times New Roman" },
    monospace: { eastAsian: "宋体", latin: "Courier New" },
    baseSize: 12,
  },
  numbering: {
    section: [{
      levels: [{ style: "arabic" }, { style: "arabic" }, { style: "arabic" }],
      resetOn: "none",
      format: "{n1}.{n2}",
    }],
    figure: { levels: [{ style: "arabic" }], resetOn: "section1", format: "图{n1}" },
    table: { levels: [{ style: "arabic" }], resetOn: "section1", format: "表{n1}" },
    formula: { levels: [{ style: "arabic" }], resetOn: "section1", format: "({n1})" },
    appendix: { levels: [{ style: "letter-upper" }], resetOn: "none", format: "附录{n1}" },
    reference: { levels: [{ style: "arabic" }], resetOn: "none", format: "[{n1}]" },
  },
  nodes: {
    section: {
      "1": { bold: true, size: 16, align: "center", spaceBefore: "24pt", spaceAfter: "12pt" },
      "2": { bold: true, size: 14, align: "left", spaceBefore: "18pt", spaceAfter: "6pt" },
      "3": { bold: true, size: 12, align: "left", spaceBefore: "12pt", spaceAfter: "6pt" },
    },
    paragraph: {
      normal: { size: 12, lineHeight: 1.5, firstLineIndent: "2em", align: "justify" },
      quote: { size: 12, lineHeight: 1.5, firstLineIndent: "0" },
      code: { font: "Courier New", size: 10 },
      note: { size: 10 },
      caption: { size: 10, align: "center" },
      "list-item": { size: 12, lineHeight: 1.5 },
    },
    figure: { captionPosition: "below", captionStyle: { size: 10, align: "center" } },
    table: { captionPosition: "above", captionStyle: { size: 10, align: "center" }, defaultBorder: "three-line" },
    abstract: {
      titleStyle: { bold: true, size: 16, align: "center" },
      bodyStyle: { size: 12, lineHeight: 1.5 },
      keywordsStyle: { size: 12 },
    },
    cover: { layout: "from-template" },
    formula: { numberingFormat: "({chapter}.{n})" },
    referenceList: { hangingIndent: "2em", fontSize: 10.5 },
  },
  citation: { cslStyleKey: "gb-t-7714-2015-numeric", locale: "zh-CN" },
  isActive: true,
};
