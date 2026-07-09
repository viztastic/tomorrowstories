// The marketing home page ("/"). It sells the narrative — the room records
// itself, sixty seconds at a time — while still couching BOTH first-run actions:
//   • an attendee JOINS straight into an event (code/link → the wall), and
//   • an organizer is led to SIGN UP to create their own wall.
//
// It is deliberately a separate component from Landing: Landing still serves the
// utility surfaces /join (mode="join") and /create (mode="create") byte-for-byte,
// so its tests keep passing. Only App's "/" route points here.
//
// Everything visual is built from the existing design system: the default dark
// "Aurora" look, the sunrise BRAND_GRAD (rationed to the logo mark, primary
// buttons, and the 3-beat numerals), Bricolage/Hanken type, the six theme colors,
// and the signature "video still" gradient (stillBg + Grain + PlayBadge). The
// drifting walls are pure CSS gradient tiles — never a <video> — so even six
// columns stay cheap on a cold phone. prefers-reduced-motion freezes the drift.

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../api";
import { DEMO } from "../config";
import {
  ACCENT,
  BODY_BG,
  BRAND_GRAD,
  DANGER,
  DANGER_INK,
  FONT_DISPLAY,
  INK,
  MUTED,
  MUTED2,
  THEMES,
  pairFor,
  stillBg,
  themeById,
} from "../design";
import { PALETTE_LIST } from "../palettes";
import type { Palette } from "../palettes";
import type { Theme, VideoDTO } from "../types";
import { Grain, PlayBadge, Qr, Spinner } from "./common";
import { VideoCard } from "./attendee/VideoCard";
import { useMediaQuery } from "../useMediaQuery";
import { useOrganizer } from "../auth";

// Per-column drift speeds — the offbeat lengths the projector uses, so the
// columns move out of phase. The wallUp/wallDown/blink keyframes are already
// injected app-wide by GlobalStyle, so no new global CSS is needed here.
const DURS = [46, 58, 50, 62, 48, 56];
// Fades the drifting columns' cropped edges so tiles dissolve top and bottom —
// lifted verbatim from the BigScreen wall.
const WALL_MASK = "linear-gradient(180deg,transparent,#000 6%,#000 94%,transparent)";

// Real seeded stories (same names/titles as demo.ts) so every wall reads as
// populated by actual people in the room, not lorem placeholders.
type Story = { title: string; author: string; theme: string };
const STORIES: Story[] = [
  { title: "Teaching my grandma to talk to AI", author: "Maya Chen", theme: "human" },
  { title: "The office that grows its own food", author: "Diego Alvarez", theme: "green" },
  { title: "Why I fired my calendar", author: "Priya Nair", theme: "work" },
  { title: "Painting with sound waves", author: "Sam Okoro", theme: "create" },
  { title: "My 90-year-old climbing coach", author: "Lena Fischer", theme: "health" },
  { title: "The bench that started a neighborhood", author: "Tomas Rivera", theme: "city" },
  { title: "When the robot said no", author: "Aisha Bello", theme: "human" },
  { title: "Concrete that eats carbon", author: "Erik Sund", theme: "green" },
  { title: "We work 4 hours. Here’s how.", author: "Jordan Lee", theme: "work" },
  { title: "A font made from my heartbeat", author: "Nina Volkova", theme: "create" },
  { title: "Prescribing forests, not pills", author: "Omar Haddad", theme: "health" },
  { title: "Turning a highway into a river", author: "Grace Kim", theme: "city" },
  { title: "My AI co-founder quit", author: "Ben Carter", theme: "human" },
  { title: "Dancing with a drone", author: "Yuki Tanaka", theme: "create" },
  { title: "The meeting that became a walk", author: "Sofia Marin", theme: "work" },
];

const themeOf = (id: string): Theme => themeById(THEMES, id);

/* ------------------------------------------------------------------ styles */

const card: CSSProperties = {
  background: "rgba(var(--ts-neutral-rgb),.05)",
  border: "1px solid rgba(var(--ts-neutral-rgb),.1)",
  borderRadius: 22,
  padding: 22,
  backdropFilter: "blur(12px)",
};

const input: CSSProperties = {
  width: "100%",
  background: "rgba(var(--ts-neutral-rgb),.07)",
  border: "1px solid rgba(var(--ts-neutral-rgb),.12)",
  borderRadius: 14,
  padding: "15px 16px",
  color: INK,
  fontSize: 15,
  fontFamily: "inherit",
  outline: "none",
};

const primaryBtn: CSSProperties = {
  padding: "15px 20px",
  borderRadius: 14,
  border: "none",
  cursor: "pointer",
  fontFamily: "inherit",
  fontWeight: 800,
  fontSize: 15.5,
  color: "#fff",
  background: BRAND_GRAD,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 9,
};

const outlineBtn: CSSProperties = {
  padding: "14px 20px",
  borderRadius: 14,
  border: "1px solid rgba(var(--ts-neutral-rgb),.22)",
  cursor: "pointer",
  fontFamily: "inherit",
  fontWeight: 700,
  fontSize: 15,
  color: INK,
  background: "transparent",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 9,
};

const eyebrow: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 800,
  letterSpacing: ".14em",
  color: MUTED2,
  textTransform: "uppercase",
};

const sectionTitle: CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontWeight: 800,
  fontSize: "clamp(26px, 4vw, 40px)",
  letterSpacing: "-.02em",
  lineHeight: 1.06,
  margin: "12px 0 0",
};

const logoMark: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 13,
  background: BRAND_GRAD,
  boxShadow: `0 6px 20px -6px ${ACCENT}`,
  flex: "none",
};

/* --------------------------------------------------------------- top-level */

export function Home() {
  const { clerkActive, isSignedIn } = useOrganizer();
  // A signed-in organizer has no use for the marketing page — send them to their
  // dashboard, exactly as Landing's "full" mode does. (Only real Clerk auth
  // redirects; in demo/mock the visitor stays and gets the full page.)
  if (clerkActive && isSignedIn) return <Navigate to="/admin" replace />;
  return <HomeContent needsSignIn={clerkActive && !isSignedIn} />;
}

function HomeContent({ needsSignIn }: { needsSignIn: boolean }) {
  const nav = useNavigate();
  const isDesktop = useMediaQuery("(min-width: 860px)");
  const reduce = useMediaQuery("(prefers-reduced-motion: reduce)");

  // The sticky "Join a live wall" bar drops in once the hero's join card scrolls
  // out of view, keeping join one tap from anywhere on the page.
  const heroJoinRef = useRef<HTMLDivElement>(null);
  const [showSticky, setShowSticky] = useState(false);
  useEffect(() => {
    const el = heroJoinRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setShowSticky(!e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Route an organizer toward creating a wall: signed-out → the sign-UP page
  // (these CTAs court NEW organizers; returning ones use the "Sign in" link),
  // remembering they wanted /create; demo/mock → straight to the create surface.
  function goCreate() {
    if (needsSignIn) nav("/sign-up", { state: { from: "/create" } });
    else nav("/create");
  }

  const scrollToClose = () =>
    document.getElementById("get-on-the-wall")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });

  return (
    <div style={{ background: BODY_BG, color: INK, width: "100%", maxWidth: "100vw", overflowX: "hidden" }}>
      <StickyJoinBar show={showSticky} isDesktop={isDesktop} reduce={reduce} />

      {/* ---------------------------------------------------------- HERO */}
      <section
        style={{
          position: "relative",
          minHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          padding: "calc(18px + env(safe-area-inset-top)) 20px 40px",
        }}
      >
        <DriftWall cols={isDesktop ? 6 : 3} tilesPerCol={isDesktop ? 6 : 4} freeze={reduce} opacity={0.82} caption />
        {/* Scrim: a soft spotlight keeps the wall dark behind the copy while the
            far edges stay colourful, then it dissolves into the page at the
            bottom so the wall reads as one continuous stage. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(135% 115% at 22% 24%, rgba(9,12,28,.90), rgba(9,12,28,.62) 42%, rgba(9,12,28,.34) 72%), linear-gradient(180deg, rgba(9,12,28,0) 42%, ${BODY_BG} 98%)`,
          }}
        />

        {/* Header: wordmark left, bright host CTA right — this is the organizer
            conversion path (paying customers), so it's a glowing gradient pill,
            not a quiet grey link. */}
        <header style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 1180, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div style={logoMark} />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 18, letterSpacing: "-.01em" }}>Tomorrow Stories</span>
              <span style={{ fontSize: 9.5, color: MUTED, fontWeight: 700, letterSpacing: ".12em", marginTop: 4 }}>CONFERENCE STORY WALL</span>
            </div>
          </div>
          <button
            onClick={goCreate}
            style={{
              background: BRAND_GRAD,
              border: "none",
              color: "#fff",
              fontWeight: 800,
              fontSize: 13.5,
              cursor: "pointer",
              fontFamily: "inherit",
              padding: "9px 15px",
              borderRadius: 999,
              boxShadow: `0 6px 20px -6px ${ACCENT}`,
              whiteSpace: "nowrap",
              flex: "none",
            }}
          >
            Hosting an event? →
          </button>
        </header>

        {/* Hero copy + join card. */}
        <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 1180, margin: "0 auto", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingTop: 44 }}>
          <div style={{ maxWidth: 720 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "6px 12px", borderRadius: 999, background: "rgba(var(--ts-neutral-rgb),.06)", border: "1px solid rgba(var(--ts-neutral-rgb),.1)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: DANGER, animation: reduce ? undefined : "blink 1.2s infinite", flex: "none" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: DANGER_INK, letterSpacing: ".02em" }}>LIVE · 128 stories from the room · updating live</span>
            </div>

            <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: "clamp(38px, 7vw, 64px)", letterSpacing: "-.03em", lineHeight: 1.02, margin: "20px 0 0", textShadow: "0 2px 30px rgba(9,12,28,.6)" }}>
              The best idea in the room walks out the door at 5pm.
            </h1>
            <p style={{ fontSize: "clamp(15px, 2.2vw, 18px)", color: MUTED, lineHeight: 1.5, margin: "18px 0 0", maxWidth: 620, textShadow: "0 1px 16px rgba(9,12,28,.7)" }}>
              Unless the room records itself. Tomorrow Stories turns every phone in the audience into a camera — and the big screen into the room’s living memory, sixty seconds at a time. Got a code? You’re seconds from the wall.
            </p>
          </div>

          {/* The first interactive element on the page — full-width and thumb-high
              on phone, so a mid-event attendee gets in without reading a word. */}
          <div ref={heroJoinRef} data-testid="hero-join" style={{ ...card, marginTop: 26, maxWidth: 440, width: "100%" }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 20, letterSpacing: "-.01em" }}>Jump on the wall</div>
            <div style={{ fontSize: 13.5, color: MUTED, marginTop: 6, lineHeight: 1.5 }}>Scan the QR on the big screen, or type the event code shown beneath it.</div>
            <JoinForm />
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- MANIFESTO */}
      <Band>
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: isDesktop ? "minmax(0,720px) 1fr" : "1fr", gap: 40, alignItems: "center" }}>
          <div style={{ maxWidth: 720 }}>
            <div style={eyebrow}>Why the wall exists</div>
            <h2 style={sectionTitle}>The best thing said today won’t make the recap.</h2>
            <p style={{ fontSize: 16.5, color: MUTED, lineHeight: 1.6, marginTop: 18 }}>
              Think about the last great event you were in. The hallway insight. The question that changed the room. The founder who finally said the quiet part out loud. None of it made the slides. None of it made the recap email. It was <B>said once</B>, to whoever happened to be standing there — and then it <B>left the building</B>. Tomorrow Stories exists to stop that: to <B>turn the whole room into the record</B>. Every voice, sixty seconds at a time, live on the screen at the front.
            </p>
          </div>
          {isDesktop && (
            <div style={{ display: "flex", gap: 14, opacity: 0.16, height: 300, justifyContent: "flex-end", pointerEvents: "none" }}>
              <div style={{ width: 120, height: "100%" }}><StillTile story={{ title: "", author: "", theme: "human" }} caption={false} /></div>
              <div style={{ width: 120, height: "82%", alignSelf: "flex-end" }}><StillTile story={{ title: "", author: "", theme: "city" }} caption={false} /></div>
            </div>
          )}
        </div>
      </Band>

      {/* --------------------------------------------------- HOW IT WORKS */}
      <Band>
        <div style={{ textAlign: "center" }}>
          <div style={eyebrow}>How it works</div>
          <h2 style={{ ...sectionTitle, marginLeft: "auto", marginRight: "auto", maxWidth: 720 }}>Three moves. Sixty seconds. You’re on the wall.</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(3, 1fr)" : "1fr", gap: isDesktop ? 22 : 18, marginTop: 36 }}>
          <Beat n={1} theme="create" title="Scan" body="Point your phone at the QR on the big screen. No app, no login, no download." />
          <Beat n={2} theme="work" title="Shoot" body="Record a vertical story up to 60 seconds, give it a title, tag the theme it belongs to." />
          <Beat n={3} theme="human" title="It hits the wall" body="Seconds later it’s playing on the screen at the front, drifting in the live grid alongside everyone else’s." live reduce={reduce} />
        </div>
      </Band>

      {/* ------------------------------------------------------ LIVE WALL */}
      <Band>
        <div style={{ maxWidth: 760 }}>
          <div style={eyebrow}>The live wall</div>
          <h2 style={sectionTitle}>This is the room, talking to itself.</h2>
          <p style={{ fontSize: 16, color: MUTED, lineHeight: 1.6, marginTop: 16 }}>
            The wall is alive. Columns of stories drift and play, the count climbs as fast as people post, and the themes catching fire rise to the top. Organizers watch it fill in real time on the big screen. Everyone else browses it from their phone — watch, like, comment, follow the themes they care about. It’s the collective memory of the day, on screen while it still matters.
          </p>
        </div>
        <LiveStage isDesktop={isDesktop} reduce={reduce} />
      </Band>

      {/* ------------------------------------------------------ BELONGING */}
      <Band>
        <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "230px 1fr" : "1fr", gap: isDesktop ? 44 : 26, alignItems: "center", justifyItems: isDesktop ? "start" : "center" }}>
          {/* A decorative example of a real product tile; the heading + copy
              beside it carry the message, so it's hidden from assistive tech
              (the tile itself isn't keyboard-operable). */}
          <div aria-hidden style={{ width: 230, maxWidth: "100%" }}>
            <VideoCard
              video={mine}
              theme={themeOf(mine.theme)}
              mine
              onOpen={scrollToClose}
            />
          </div>
          <div style={{ maxWidth: 560 }}>
            <div style={eyebrow}>On your phone</div>
            <h2 style={sectionTitle}>It doesn’t stop when it’s on the wall.</h2>
            <p style={{ fontSize: 16, color: MUTED, lineHeight: 1.6, marginTop: 16 }}>
              On your phone the whole wall is yours to scrub through. Watch anyone’s story, tap the heart, drop a comment, follow the themes you love. And when yours is up there, it wears a little <span style={{ color: INK, fontWeight: 700 }}>YOURS</span> badge — so you can nudge the person next to you and say, that one’s mine.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 20 }}>
              {["Watch", "♥ Like", "Comment", "Follow a theme"].map((c) => (
                <span key={c} style={{ fontSize: 13, fontWeight: 700, color: INK, padding: "8px 13px", borderRadius: 999, background: "rgba(var(--ts-neutral-rgb),.06)", border: "1px solid rgba(var(--ts-neutral-rgb),.1)" }}>{c}</span>
              ))}
            </div>
          </div>
        </div>
      </Band>

      {/* -------------------------------------------------- THEMES + SKINS */}
      <Band>
        <div style={{ maxWidth: 760 }}>
          <div style={eyebrow}>Themes &amp; palettes</div>
          <h2 style={sectionTitle}>Six currents. And they’re yours to recolor.</h2>
          <p style={{ fontSize: 16, color: MUTED, lineHeight: 1.6, marginTop: 16 }}>
            Every story joins a current, each with its own color on the wall. Follow the ones that are yours and your phone fills with just those. Running your own event? Rename them, recolor them, and reskin the whole wall — cinematic Aurora, bold civic Rally, or deep Marine — in a single tap. The big screen and every phone in the room recolor together.
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 24 }}>
          {THEMES.map((t) => (
            <span key={t.id} style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "9px 15px", borderRadius: 999, background: "rgba(var(--ts-neutral-rgb),.05)", border: "1px solid rgba(var(--ts-neutral-rgb),.1)", fontSize: 14, fontWeight: 700 }}>
              <Dot color={t.color} />
              {t.name}
            </span>
          ))}
        </div>
        {/* Palette proof — three static mini-stages built from LITERAL palette
            values, so the viewer sees identical content skinned three ways.
            No nested PaletteProvider: those write CSS vars to :root globally and
            would recolor the entire page instead of a subsection. */}
        <div style={{ display: "flex", gap: 16, marginTop: 26, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
          {PALETTE_LIST.map((p) => (
            <PaletteStage key={p.id} p={p} />
          ))}
        </div>
      </Band>

      {/* -------------------------------------------------- FOR ORGANIZERS */}
      <Band>
        <div style={{ ...card, padding: isDesktop ? 34 : 24, background: "rgba(var(--ts-neutral-rgb),.04)", backdropFilter: undefined }}>
          <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 320px" : "1fr", gap: isDesktop ? 40 : 26, alignItems: "center" }}>
            <div>
              <div style={eyebrow}>For organizers</div>
              <h2 style={sectionTitle}>Bring the wall to your event.</h2>
              <p style={{ fontSize: 16, color: MUTED, lineHeight: 1.6, marginTop: 16 }}>
                Host a conference, a summit, a class, a town hall? Spin up a private wall in about a minute — you get a QR code for the big screen and a live grid that fills itself. It’s <A>a wall, not a board</A>: video-first, big-screen-first, and branded to you — your name and your colors on the projector, not ours.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 20 }}>
                <Proof icon="lock" label="Private to its code" />
                <Proof icon="eye" label="You decide what goes live" />
                <Proof icon="down" label="Download the event as a zip" />
              </div>
            </div>

            {/* The create CTAs + a mini projector that brands itself to the EVENT
                (echoing the real projector, which never brands itself). */}
            <div>
              <HostProjector />
              <button onClick={goCreate} style={{ ...primaryBtn, width: "100%", marginTop: 16 }}>Start a wall — it’s free</button>
              {needsSignIn ? (
                <button onClick={() => nav("/sign-in", { state: { from: "/create" } })} style={{ ...outlineBtn, width: "100%", marginTop: 10 }}>Sign in</button>
              ) : null}
              <div style={{ fontSize: 12.5, color: MUTED2, fontWeight: 600, textAlign: "center", marginTop: 12 }}>Free to start. No card.</div>
            </div>
          </div>
        </div>
      </Band>

      {/* ------------------------------------------------- CLOSING: 2 DOORS */}
      <Band id="get-on-the-wall">
        <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto" }}>
          <div style={eyebrow}>Two ways in</div>
          <h2 style={sectionTitle}>The room is already talking. Get on the wall.</h2>
          <p style={{ fontSize: 16, color: MUTED, lineHeight: 1.6, marginTop: 14 }}>
            If you’re in the room right now, jump straight onto the wall. If you want to run one, start your own. Either way — don’t let today walk out the door unrecorded.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr auto 1fr" : "1fr", gap: isDesktop ? 22 : 18, alignItems: "stretch", marginTop: 34 }}>
          {/* LEFT — in the room now (join). Cyan crowd accent. */}
          <div style={{ ...card, display: "flex", flexDirection: "column", borderTop: "3px solid #22D3EE" }}>
            <div style={eyebrow}>In the room now</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 22, letterSpacing: "-.01em", marginTop: 8 }}>Jump on the wall</div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, marginBottom: 16 }}>
              {["health", "create", "city"].map((t, i) => (
                <div key={i} style={{ flex: 1, aspectRatio: "9 / 12", minWidth: 0 }}>
                  <StillTile story={STORIES.find((s) => s.theme === t)!} caption={false} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: "auto" }}>
              <JoinForm />
            </div>
          </div>

          {/* Center hinge. */}
          {isDesktop && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "0 4px" }}>
              <div style={logoMark} />
              <span style={{ ...eyebrow, writingMode: "vertical-rl", transform: "rotate(180deg)", letterSpacing: ".18em" }}>one wall, two ways in</span>
            </div>
          )}

          {/* RIGHT — hosting (create). Sunrise stage accent. */}
          <div style={{ ...card, display: "flex", flexDirection: "column", borderTop: `3px solid ${ACCENT}` }}>
            <div style={eyebrow}>Hosting?</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 22, letterSpacing: "-.01em", marginTop: 8 }}>Start your own wall</div>
            <div style={{ marginTop: 14, marginBottom: 16, flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <HostProjector />
            </div>
            <button onClick={goCreate} style={{ ...primaryBtn, width: "100%" }}>Start a wall — it’s free</button>
            <div style={{ fontSize: 12.5, color: MUTED2, fontWeight: 600, textAlign: "center", marginTop: 12 }}>Free to start. No card.</div>
          </div>
        </div>
      </Band>

      {/* --------------------------------------------------------- FOOTER */}
      <footer style={{ borderTop: "1px solid rgba(var(--ts-neutral-rgb),.08)", padding: "34px 20px calc(40px + env(safe-area-inset-bottom))" }}>
        <div style={{ width: "100%", maxWidth: 1180, margin: "0 auto", display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div style={logoMark} />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 17 }}>Tomorrow Stories</span>
              <span style={{ fontSize: 10, color: MUTED2, fontWeight: 700, letterSpacing: ".12em", marginTop: 4 }}>CONFERENCE STORY WALL</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {DEMO && <span style={{ color: MUTED2, fontSize: 12 }}>Demo mode — seeded, in-memory data.</span>}
            <Link to="/admin" style={{ color: MUTED2, fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>Organizer console →</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ----------------------------------------------------------- join surface */

// The join resolver — copied verbatim from Landing.tsx's join() so the two
// surfaces behave identically (Landing itself stays untouched). Self-contained
// state means this can be dropped in as many times as the page needs (hero,
// sticky bar, closing door) without any shared wiring.
function JoinForm({ compact = false }: { compact?: boolean }) {
  const nav = useNavigate();
  const [raw, setRaw] = useState("");
  const [joining, setJoining] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function join() {
    const v = raw.trim();
    if (!v) {
      setErr("Enter the event code, or paste the event link.");
      return;
    }
    setErr(null);
    const link = /\/e\/([a-z0-9]+)/i.exec(v);
    if (link) return nav(`/e/${link[1]}`);
    if (/^[a-z0-9]{12,}$/i.test(v)) return nav(`/e/${v.toLowerCase()}`);
    setJoining(true);
    try {
      const id = await api.resolveCode(v);
      nav(`/e/${id}`);
    } catch {
      setErr("We couldn’t find that event. Double-check the code and try again.");
      setJoining(false);
    }
  }

  if (compact) {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center", width: "100%" }}>
        <input
          style={{ ...input, padding: "11px 13px", fontSize: 14, flex: 1, minWidth: 0 }}
          placeholder="Event code (or link)"
          value={raw}
          onChange={(e) => { setRaw(e.target.value); if (err) setErr(null); }}
          onKeyDown={(e) => e.key === "Enter" && join()}
          autoCapitalize="characters"
          autoCorrect="off"
          aria-invalid={!!err}
          aria-label="Event code or link"
        />
        <button style={{ ...primaryBtn, padding: "11px 18px", fontSize: 14.5, flex: "none" }} onClick={join} disabled={joining}>
          {joining ? <Spinner size={16} /> : "Join"}
        </button>
      </div>
    );
  }

  return (
    <>
      {err && <ErrLine msg={err} />}
      <input
        style={{ ...input, marginTop: err ? 10 : 16 }}
        placeholder="Event code (or link)"
        value={raw}
        onChange={(e) => { setRaw(e.target.value); if (err) setErr(null); }}
        onKeyDown={(e) => e.key === "Enter" && join()}
        autoCapitalize="characters"
        autoCorrect="off"
        aria-invalid={!!err}
        aria-label="Event code or link"
      />
      <button style={{ ...primaryBtn, width: "100%", marginTop: 12 }} onClick={join} disabled={joining}>
        {joining ? <Spinner size={18} /> : null}
        {joining ? "Joining…" : "Join event"}
      </button>
    </>
  );
}

function StickyJoinBar({ show, isDesktop, reduce }: { show: boolean; isDesktop: boolean; reduce: boolean }) {
  return (
    <div
      aria-hidden={!show}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        background: "var(--ts-header-bg)",
        borderBottom: "1px solid rgba(var(--ts-neutral-rgb),.1)",
        backdropFilter: "blur(14px)",
        // Collapsed = fully out of the tab order + a11y tree (visibility:hidden),
        // not merely off-screen, so the off-canvas input can't steal first focus.
        visibility: show ? "visible" : "hidden",
        transform: show ? "translateY(0)" : "translateY(-110%)",
        transition: "transform .28s ease, visibility .28s ease",
        padding: "10px max(12px, env(safe-area-inset-right)) 10px max(12px, env(safe-area-inset-left))",
      }}
    >
      <div style={{ width: "100%", maxWidth: 1180, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flex: "none" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: DANGER, animation: reduce ? undefined : "blink 1.2s infinite" }} />
          {/* On phones the label yields all width to the input. */}
          {isDesktop && <span style={{ fontSize: 13, fontWeight: 800, color: INK, whiteSpace: "nowrap" }}>On the wall now — jump in</span>}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <JoinForm compact />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- primitives */

function Band({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <section id={id} style={{ padding: "clamp(48px, 8vw, 88px) 20px" }}>
      <div style={{ width: "100%", maxWidth: 1180, margin: "0 auto" }}>{children}</div>
    </section>
  );
}

function B({ children }: { children: React.ReactNode }) {
  return <span style={{ color: INK, fontWeight: 600 }}>{children}</span>;
}

// A confident category line with a single sunrise underline stroke.
function A({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ color: INK, fontWeight: 700, backgroundImage: BRAND_GRAD, backgroundRepeat: "no-repeat", backgroundPosition: "0 100%", backgroundSize: "100% 3px", paddingBottom: 1 }}>
      {children}
    </span>
  );
}

function Dot({ color, size = 10 }: { color: string; size?: number }) {
  return <span style={{ width: size, height: size, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}`, flex: "none" }} />;
}

// A decorative "video still" tile — the product's signature look (stillBg
// gradient + film grain + glassy play badge), never a real <video>. Purely
// decorative in every usage, so it's aria-hidden: screen readers skip the
// dozens of fabricated titles that would otherwise crowd out the real copy.
function StillTile({ story, caption = true }: { story: Story; caption?: boolean }) {
  const theme = themeOf(story.theme);
  return (
    <div aria-hidden style={{ position: "relative", height: "100%", width: "100%", borderRadius: 14, overflow: "hidden", background: stillBg(pairFor(theme, story.title || story.theme)), boxShadow: "0 12px 26px -14px rgba(0,0,0,.7)" }}>
      <Grain />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(0,0,0,.02) 45%,rgba(0,0,0,.66))" }} />
      <PlayBadge size={32} />
      {caption && story.title && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "9px 10px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Dot color={theme.color} size={7} />
            <span style={{ color: "#F7F4EF", fontWeight: 700, fontSize: 12, lineHeight: 1.2, textShadow: "0 1px 8px rgba(0,0,0,.5)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{story.title}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// The drifting wall — N columns of gradient tiles sliding out of phase on the
// projector's own wallUp/wallDown alternate keyframes. `freeze` (reduced motion)
// holds them still; `opacity` fades them back behind hero copy.
function DriftWall({ cols, tilesPerCol = 4, freeze = false, opacity = 1, caption = true }: { cols: number; tilesPerCol?: number; freeze?: boolean; opacity?: number; caption?: boolean }) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", gap: 12, overflow: "hidden", opacity, WebkitMaskImage: WALL_MASK, maskImage: WALL_MASK }}>
      {Array.from({ length: cols }, (_, ci) => (
        <div key={ci} style={{ flex: 1, minWidth: 0, position: "relative", overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "200%",
              display: "flex",
              flexDirection: "column",
              willChange: "transform",
              animation: freeze ? undefined : `wall${ci % 2 ? "Down" : "Up"} ${DURS[ci % DURS.length]}s linear infinite alternate`,
            }}
          >
            {Array.from({ length: tilesPerCol }, (_, ri) => {
              const story = STORIES[(ci * tilesPerCol + ri * 3 + ci) % STORIES.length];
              return (
                <div key={ri} style={{ flex: 1, minHeight: 0, padding: "6px 0" }}>
                  <StillTile story={story} caption={caption} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// The mid-page stage: the real BigScreen `stage` frame with a decorative
// drifting wall inside, plus its live-count + trending chrome. On phone the
// chrome stacks above a shorter 3-column wall.
function LiveStage({ isDesktop, reduce }: { isDesktop: boolean; reduce: boolean }) {
  const trending: { theme: Theme; count: number }[] = [
    { theme: themeOf("human"), count: 34 },
    { theme: themeOf("create"), count: 28 },
    { theme: themeOf("health"), count: 21 },
    { theme: themeOf("green"), count: 17 },
  ];
  const chrome = (
    <>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: DANGER, animation: reduce ? undefined : "blink 1.2s infinite" }} />
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".14em", color: DANGER_INK }}>LIVE NOW</span>
      </div>
      <div style={{ fontSize: 13.5, color: MUTED, fontWeight: 600, marginTop: 8 }}>128 stories from the room · updating live</div>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", color: MUTED2, margin: "22px 0 12px" }}>TRENDING THEMES</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {trending.map(({ theme, count }) => (
          <div key={theme.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Dot color={theme.color} />
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>{theme.name}</span>
            <span style={{ fontSize: 13, color: MUTED, fontWeight: 700 }}>{count}</span>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div
      style={{
        marginTop: 32,
        width: "100%",
        borderRadius: 24,
        overflow: "hidden",
        position: "relative",
        background: "var(--ts-stage-bg)",
        border: "1px solid rgba(var(--ts-neutral-rgb),.08)",
        boxShadow: "0 40px 100px -40px #000",
        display: "flex",
        flexDirection: isDesktop ? "row" : "column",
      }}
    >
      {/* wall */}
      <div style={{ position: "relative", flex: 1, minWidth: 0, height: isDesktop ? undefined : 320, aspectRatio: isDesktop ? "16 / 9" : undefined, overflow: "hidden" }}>
        <DriftWall cols={isDesktop ? 6 : 3} tilesPerCol={4} freeze={reduce} caption />
      </div>
      {/* chrome rail */}
      <aside style={{ width: isDesktop ? 300 : "auto", flex: "none", background: "rgba(var(--ts-neutral-rgb),.03)", borderLeft: isDesktop ? "1px solid rgba(var(--ts-neutral-rgb),.07)" : "none", borderTop: isDesktop ? "none" : "1px solid rgba(var(--ts-neutral-rgb),.07)", padding: 22 }}>
        {chrome}
      </aside>
    </div>
  );
}

function Beat({ n, theme, title, body, live = false, reduce = false }: { n: number; theme: string; title: string; body: string; live?: boolean; reduce?: boolean }) {
  const story = STORIES.find((s) => s.theme === theme)!;
  return (
    <div style={{ ...card, background: "rgba(var(--ts-neutral-rgb),.04)", backdropFilter: undefined }}>
      <div style={{ position: "relative", aspectRatio: live ? "16 / 10" : "9 / 12", borderRadius: 14, overflow: "hidden", marginBottom: 16 }}>
        <StillTile story={story} caption={false} />
        {live && (
          <div style={{ position: "absolute", top: 10, left: 10, display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 9px", borderRadius: 999, background: "rgba(0,0,0,.4)", backdropFilter: "blur(4px)" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: DANGER, animation: reduce ? undefined : "blink 1.2s infinite" }} />
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".1em", color: "#fff" }}>LIVE NOW</span>
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 30, height: 30, borderRadius: "50%", background: BRAND_GRAD, color: "#fff", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{n}</span>
        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 19, letterSpacing: "-.01em" }}>{title}</span>
      </div>
      <p style={{ fontSize: 14.5, color: MUTED, lineHeight: 1.55, marginTop: 12 }}>{body}</p>
    </div>
  );
}

// A mini stage skinned to a LITERAL palette — same content, three looks. Never
// touches :root, so it can sit next to the dark page without recoloring it.
function PaletteStage({ p }: { p: Palette }) {
  const tiles: Story[] = [STORIES[0], STORIES[4]];
  return (
    <div style={{ flex: "none", width: 224, borderRadius: 18, overflow: "hidden", border: `1px solid ${p.hairline}`, background: p.pageBg, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 20, height: 20, borderRadius: 7, background: p.brandGrad }} />
        <span style={{ fontSize: 12, fontWeight: 800, color: p.ink }}>{p.name}</span>
        <span style={{ marginLeft: "auto", width: 9, height: 9, borderRadius: "50%", background: p.accent, boxShadow: `0 0 8px ${p.accent}` }} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12, borderRadius: 12, overflow: "hidden", background: p.stageBg, padding: 8 }}>
        {tiles.map((s, i) => (
          <div key={i} style={{ flex: 1, aspectRatio: "9 / 12" }}>
            <StillTile story={s} caption={false} />
          </div>
        ))}
      </div>
      <div style={{ height: 6, borderRadius: 99, background: p.brandGrad, width: 62, marginTop: 12 }} />
    </div>
  );
}

// A tiny projector mockup that brands itself to the EVENT (not to us) — proving
// "your name on the screen" the way the real big screen does.
function HostProjector() {
  return (
    <div style={{ width: "100%", aspectRatio: "16 / 10", borderRadius: 16, overflow: "hidden", position: "relative", background: "var(--ts-stage-bg)", border: "1px solid rgba(var(--ts-neutral-rgb),.1)", padding: 14, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 16, height: 16, borderRadius: 5, background: BRAND_GRAD }} />
        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 13, color: INK }}>Your Event 2026</span>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10, flex: 1 }}>
        {["create", "human", "health"].map((t, i) => (
          <div key={i} style={{ flex: 1, minWidth: 0, borderRadius: 8, overflow: "hidden" }}>
            <StillTile story={STORIES.find((s) => s.theme === t)!} caption={false} />
          </div>
        ))}
        <div style={{ width: 46, flex: "none", background: "#F4F1EC", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", padding: 4 }}>
          <Qr value="https://tomorrowstories.net" size={38} />
        </div>
      </div>
    </div>
  );
}

function Proof({ icon, label }: { icon: "lock" | "eye" | "down"; label: string }) {
  const path =
    icon === "lock"
      ? "M7 10V7a5 5 0 0110 0v3M6 10h12v10H6z"
      : icon === "eye"
      ? "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z M12 15a3 3 0 100-6 3 3 0 000 6z"
      : "M12 4v11m0 0l-4-4m4 4l4-4M5 20h14";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 13px", borderRadius: 999, background: "rgba(var(--ts-neutral-rgb),.06)", border: "1px solid rgba(var(--ts-neutral-rgb),.1)", fontSize: 13, fontWeight: 700, color: INK }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
      {label}
    </span>
  );
}

function ErrLine({ msg }: { msg: string }) {
  return (
    <div
      style={{
        marginTop: 14,
        padding: "10px 13px",
        borderRadius: 12,
        background: "rgba(255,61,87,.12)",
        border: "1px solid rgba(255,61,87,.35)",
        color: "#FF9DB0",
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1.4,
      }}
    >
      {msg}
    </div>
  );
}

// A constructed VideoDTO for the "YOURS" payoff. mediaUrl:null makes the real
// VideoCard/Thumb fall back to the stillBg gradient — pixel-identical to a
// product tile, with zero network.
const mine: VideoDTO = {
  id: "home-yours",
  title: "My 90-year-old climbing coach",
  theme: "health",
  author: "Lena Fischer",
  status: "live",
  durationSec: 44,
  likes: 3010,
  mediaUrl: null,
  posterUrl: null,
  createdAt: "2026-07-01T13:48:00Z",
};
