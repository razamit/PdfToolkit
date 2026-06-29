/** Thrown when a file cannot be loaded; `message` is safe to show the user. */
export class SourceLoadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SourceLoadError'
  }
}
