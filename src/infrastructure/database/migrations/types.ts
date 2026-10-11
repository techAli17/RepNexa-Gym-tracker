export interface Migration {
  /** Becomes PRAGMA user_version once applied. Strictly increasing, never reused. */
  version: number;
  name: string;
  statements: readonly string[];
}
