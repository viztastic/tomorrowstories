// Organizer auth layer. Wraps the app in Clerk when a publishable key is
// configured; otherwise (demo / not-yet-configured) falls back to a mock that
// reports "signed in" so the app and e2e keep working with no backend or keys.
//
// Both paths populate one OrganizerAuthContext, so components use a single
// useOrganizer() hook regardless of which provider is active. The active token
// getter is registered with api.ts so requests carry a Bearer session token.

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ClerkProvider, SignIn, UserButton, useAuth } from "@clerk/react";
import { DEMO, getConfig } from "./config";
import { setTokenGetter } from "./api";
import { BRAND_GRAD, FONT_DISPLAY, INK, MUTED, PAGE_BG } from "./design";

interface OrganizerAuth {
  clerkActive: boolean; // true when real Clerk auth is running
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  signOut: () => void;
}

const OrganizerAuthContext = createContext<OrganizerAuth>({
  clerkActive: false,
  isLoaded: true,
  isSignedIn: true,
  userId: "demo-organizer",
  signOut: () => {},
});

export function useOrganizer(): OrganizerAuth {
  return useContext(OrganizerAuthContext);
}

// No Clerk key (demo or unconfigured): treat the visitor as a signed-in
// organizer and send no token. Keeps the open/legacy experience working.
function MockAuthProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    setTokenGetter(async () => null);
    return () => setTokenGetter(null);
  }, []);
  const value = useMemo<OrganizerAuth>(
    () => ({ clerkActive: false, isLoaded: true, isSignedIn: true, userId: "demo-organizer", signOut: () => {} }),
    []
  );
  return <OrganizerAuthContext.Provider value={value}>{children}</OrganizerAuthContext.Provider>;
}

// Runs inside ClerkProvider: mirrors Clerk's auth into our context and registers
// the Bearer-token getter used by api.ts.
function ClerkBridge({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId, getToken, signOut } = useAuth();
  useEffect(() => {
    setTokenGetter(async () => (isSignedIn ? await getToken() : null));
    return () => setTokenGetter(null);
  }, [isSignedIn, getToken]);
  const value = useMemo<OrganizerAuth>(
    () => ({
      clerkActive: true,
      isLoaded,
      isSignedIn: !!isSignedIn,
      userId: userId ?? null,
      signOut: () => void signOut(),
    }),
    [isLoaded, isSignedIn, userId, signOut]
  );
  return <OrganizerAuthContext.Provider value={value}>{children}</OrganizerAuthContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [cfg, setCfg] = useState<{ ready: boolean; pk?: string }>({ ready: DEMO });
  useEffect(() => {
    if (DEMO) return;
    getConfig().then((c) => setCfg({ ready: true, pk: c.clerkPublishableKey || undefined }));
  }, []);

  if (DEMO) return <MockAuthProvider>{children}</MockAuthProvider>;
  if (!cfg.ready) return null; // brief config fetch before we know the mode
  if (!cfg.pk) return <MockAuthProvider>{children}</MockAuthProvider>; // Clerk not configured yet
  return (
    <ClerkProvider publishableKey={cfg.pk} afterSignOutUrl="/" signInUrl="/sign-in" signUpUrl="/sign-in">
      <ClerkBridge>{children}</ClerkBridge>
    </ClerkProvider>
  );
}

/** Gate a route to signed-in organizers; bounce others to /sign-in. */
export function RequireOrganizer({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useOrganizer();
  const loc = useLocation();
  if (!isLoaded) return null;
  if (!isSignedIn) return <Navigate to="/sign-in" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

/** Clerk's account menu — only when real auth is active. */
export function OrganizerButton() {
  const { clerkActive } = useOrganizer();
  if (!clerkActive) return null;
  return <UserButton />;
}

/** The /sign-in page. Redirects home once signed in (incl. demo/mock). */
export function SignInScreen() {
  const { clerkActive, isLoaded, isSignedIn } = useOrganizer();
  if (isLoaded && isSignedIn) return <Navigate to="/admin" replace />;
  if (!clerkActive) return <Navigate to="/" replace />;
  return (
    <div style={signInPage}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <div style={{ width: 40, height: 40, borderRadius: 13, background: BRAND_GRAD }} />
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 22, color: INK }}>Tomorrow Stories</span>
          <span style={{ fontSize: 12, color: MUTED, fontWeight: 600, marginTop: 4 }}>Organizer sign-in</span>
        </div>
      </div>
      {/* Clerk renders email-code + social buttons per the dashboard config.
          After sign-in, land on the dashboard to create the first event. */}
      <SignIn signUpUrl="/sign-in" fallbackRedirectUrl="/admin" />
    </div>
  );
}

const signInPage: React.CSSProperties = {
  minHeight: "100vh",
  background: PAGE_BG,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 20,
  padding: "40px 20px",
};
