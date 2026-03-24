import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router";
import ErrorBoundary from "./components/ErrorBoundary";
import UploadPage from "./components/UploadPage";

const DownloadPage = lazy(() => import("./components/DownloadPage"));

function LoadingFallback() {
  return (
    <div className="rounded-xl border border-border bg-surface p-8 text-center animate-fadeInUp">
      <p className="text-text-secondary">Loading...</p>
    </div>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-bg text-text-primary font-sans">
      <div className="max-w-[600px] mx-auto px-4 py-8 sm:px-8">
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<UploadPage />} />
              <Route path="/d/:id" element={<DownloadPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
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
