const INVITE_KEY = "wesaw.invite";
const INVITE_PARAM = "invite";

export function captureInviteCode(): string | null {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get(INVITE_PARAM);

  if (fromUrl) {
    const code = fromUrl.trim().toUpperCase();
    try {
      localStorage.setItem(INVITE_KEY, code);
    } catch {
      console.warn("Could not remember the invite code.");
    }
    params.delete(INVITE_PARAM);
    const query = params.toString();
    window.history.replaceState(
      {},
      document.title,
      `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
    );
    return code;
  }

  return readInviteCode();
}

export function readInviteCode(): string | null {
  try {
    return localStorage.getItem(INVITE_KEY);
  } catch {
    return null;
  }
}

export function clearInviteCode() {
  try {
    localStorage.removeItem(INVITE_KEY);
  } catch {
    console.warn("Could not clear the invite code.");
  }
}
