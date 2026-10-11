/** "full_body" → "Full body" for enum values shown in the UI. */
export const titleCase = (s: string): string => {
  const t = s.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
};
