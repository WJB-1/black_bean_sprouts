/// <reference types="vite/client" />
declare module "*.vue" { import type { DefineComponent } from "vue"; const c: DefineComponent<{}, {}, any>; export default c; }

// ProseMirror type declarations for Tiptap
declare module "@tiptap/pm/model" {
  export type { Node, Mark, Schema, NodeType, MarkType } from "prosemirror-model";
}
declare module "@tiptap/pm/state" {
  export type { EditorState, Selection, Transaction } from "prosemirror-state";
}
declare module "@tiptap/pm/view" {
  export type { EditorView } from "prosemirror-view";
}
