import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import GuestProfile from "./pages/GuestProfile";
import DoorCheck from "./pages/DoorCheck";
import ProtectedRoute from "./components/ProtectedRoute";
import CreateGuest from "./pages/CreateGuest";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />
        <Route path="/guest/:id" element={
          <ProtectedRoute><GuestProfile /></ProtectedRoute>
        } />
        <Route path="/door-check" element={
          <ProtectedRoute><DoorCheck /></ProtectedRoute>
        } />
        <Route path="/guest/new" element={
          <ProtectedRoute><CreateGuest /></ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute><Settings /></ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}