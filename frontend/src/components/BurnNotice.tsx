export default function BurnNotice() {
  return (
    <div className="text-center py-16 animate-fadeInDeblur">
      <div className="inline-block mb-6">
        <svg
          className="w-16 h-16 text-text-tertiary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 6.51 6.51 0 009 11.5a3 3 0 104.532-3.088A8.24 8.24 0 0115.362 5.214z"
          />
        </svg>
      </div>

      <h1 className="text-2xl font-semibold text-text-primary mb-2">Gone</h1>

      <p className="text-text-secondary max-w-sm mx-auto">
        This file has been destroyed. It was either downloaded or expired.
      </p>

      <div className="w-20 h-px bg-border mx-auto my-8" />

      <a
        href="/"
        className="inline-block py-2.5 px-6 rounded-lg font-medium text-sm border border-border text-text-secondary hover:text-text-primary hover:border-border-hover transition-all duration-200"
      >
        Send your own file
      </a>
    </div>
  );
}
