export async function copyText(text: string): Promise<boolean> {
  const clipboard = navigator.clipboard;
  if (!clipboard) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
