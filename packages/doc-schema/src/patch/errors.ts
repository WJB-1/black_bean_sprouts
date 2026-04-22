// @doc-schema-version: 1.0.0
export class DocumentPatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentPatchError";
  }
}
