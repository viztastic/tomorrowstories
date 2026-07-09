import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { Home } from "./components/Home";
import { Landing } from "./components/Landing";
import { Admin } from "./components/Admin";
import { Attendee } from "./components/attendee/Attendee";
import { BigScreen } from "./components/big/BigScreen";
import { RequireOrganizer, SignInScreen } from "./auth";

function AttendeeRoute() {
  const { eventId } = useParams();
  return eventId ? <Attendee eventId={eventId} /> : <Navigate to="/" replace />;
}

function BigScreenRoute() {
  const { eventId } = useParams();
  return eventId ? <BigScreen eventId={eventId} /> : <Navigate to="/" replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/join" element={<Landing mode="join" />} />
      <Route path="/sign-in/*" element={<SignInScreen />} />
      {/* Organizer surfaces require sign-in (open in demo/unconfigured mode). */}
      <Route path="/create" element={<RequireOrganizer><Landing mode="create" /></RequireOrganizer>} />
      <Route path="/admin" element={<RequireOrganizer><Admin /></RequireOrganizer>} />
      <Route path="/e/:eventId" element={<AttendeeRoute />} />
      <Route path="/e/:eventId/big" element={<BigScreenRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
