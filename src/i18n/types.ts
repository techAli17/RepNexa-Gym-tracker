/** A dictionary leaf is a string; `{name}` marks a parameter. Plurals are { one, other }. */
export type Leaf = string;
export interface Plural {
  one: string;
  other: string;
}

/** Same shape as the English dictionary, every leaf a string. */
export type Translation<T> = { [K in keyof T]: T[K] extends string ? string : Translation<T[K]> };

type Join<A extends string, B extends string> = `${A}.${B}`;

/** Every dotted path to a string leaf, e.g. "home.startWorkout". */
export type LeafPaths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : T[K] extends Plural ? never : Join<K, LeafPaths<T[K]>>;
}[keyof T & string];

/** Every dotted path to a plural object, e.g. "history.workoutCount". */
export type PluralPaths<T> = {
  [K in keyof T & string]: T[K] extends string ? never : T[K] extends Plural ? K : Join<K, PluralPaths<T[K]>>;
}[keyof T & string];
