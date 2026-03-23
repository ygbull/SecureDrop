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
        <footer className="mt-12 pb-4 text-center text-xs text-text-tertiary">
          <a
            href="https://github.com/ygbull/SecureDrop"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-text-secondary transition-colors"
          >
            GitHub
          </a>
          <span className="mx-1.5">·</span>
          <span>React + TypeScript + Cloudflare</span>
        </footer>
      </div>
    </div>
  );
}
