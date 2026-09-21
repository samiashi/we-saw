import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const siteUrl = import.meta.env.VITE_SITE_URL?.trim();

function getAppBaseUrl() {
  return (siteUrl || window.location.origin).replace(/\/+$/, "");
}

function readAuthError(): string {
  if (!isSupabaseConfigured) return "";

  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(
    window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash,
  );
  const errorDescription =
    searchParams.get("error_description") || hashParams.get("error_description");
  if (!errorDescription) return "";

  window.history.replaceState({}, document.title, window.location.pathname);
  return errorDescription.replace(/\+/g, " ");
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [authMessage, setAuthMessage] = useState(readAuthError);
  const [isAuthLoading, setIsAuthLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setIsAuthLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setAuthMessage("We Saw sign-in could not be checked. Try again.");
        setIsAuthLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsAuthLoading(false);
      if (nextSession) setAuthMessage("");
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signInWithGoogle() {
    if (!supabase) return;

    setAuthMessage("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getAppBaseUrl(),
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error) setAuthMessage("Google sign-in could not start.");
  }

  async function signOut() {
    if (!supabase) return;

    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthMessage("Could not sign out. Try again.");
      throw error;
    }

    setSession(null);
  }

  return { session, authMessage, setAuthMessage, signInWithGoogle, signOut, isAuthLoading };
}
