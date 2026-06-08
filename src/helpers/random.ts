export function generateOtp(min = 100000, max = 999999): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
