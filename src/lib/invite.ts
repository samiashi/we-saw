const INVITE_KEY = "wesaw.invite";
const INVITE_PARAM = "invite";

export function captureInviteCode(): string | null {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get(INVITE_PARAM);

  if (fromUrl) {
    const code = fromUrl.trim().toUpperCase();
    let stored = false;
    try {
      localStorage.setItem(INVITE_KEY, code);
      stored = true;
    } catch {
      console.warn("Could not remember the invite code.");
    }
    if (stored) {
      params.delete(INVITE_PARAM);
      const query = params.toString();
      window.history.replaceState(
        {},
        document.title,
        `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
      );
    }
    return code;
  }

  return readInviteCode();
}

export function readInviteCode(): string | null {
  try {
    const stored = localStorage.getItem(INVITE_KEY);
    if (stored) return stored;
  } catch {
    // fall back to the URL below
  }
  const fromUrl = new URLSearchParams(window.location.search).get(INVITE_PARAM);
  return fromUrl ? fromUrl.trim().toUpperCase() : null;
}

export function clearInviteCode() {
  try {
    localStorage.removeItem(INVITE_KEY);
  } catch {
    console.warn("Could not clear the invite code.");
  }
}
