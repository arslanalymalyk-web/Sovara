/** A refused command. `code` matches the prototype's error codes so the screens keep their messages. */
export class CommandError extends Error {
  constructor(public readonly code: string, public readonly detail?: unknown) { super(code); this.name = 'CommandError'; }
}
export function need(condition: unknown, code: string, detail?: unknown): asserts condition {
  if (!condition) throw new CommandError(code, detail);
}
