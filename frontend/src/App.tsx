import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { Landing } from "./components/Landing";
import { Admin } from "./components/Admin";
import { Attendee } from "./components/attendee/Attendee";
import { BigScreen } from "./components/big/BigScreen";

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
      <Route path="/" element={<Landing />} />
      <Route path="/join" element={<Landing mode="join" />} />
      <Route path="/create" element={<Landing mode="create" />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/e/:eventId" element={<AttendeeRoute />} />
      <Route path="/e/:eventId/big" element={<BigScreenRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
