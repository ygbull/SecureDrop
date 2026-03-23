import { Routes, Route } from "react-router";
import UploadPage from "./components/UploadPage";
import DownloadPage from "./components/DownloadPage";

export default function App() {
  return (
    <div className="min-h-screen bg-bg text-text-primary font-sans">
      <div className="max-w-[600px] mx-auto px-4 py-8 sm:px-8">
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/d/:id" element={<DownloadPage />} />
        </Routes>
      </div>
    </div>
  );
}
