interface ScoreRingHeroProps {
  score: number;
  headline: string;
  summary: string;
  /** e.g. "Top 75th percentile in Restaurants" */
  benchmarkBadge?: string | null;
  /** Optional subtitle below the summary (e.g. date/time, industry) */
  subtitle?: string | null;
}

export function ScoreRingHero({
  score,
  headline,
  summary,
  benchmarkBadge,
  subtitle,
}: ScoreRingHeroProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-10 mb-8 flex flex-col sm:flex-row items-center gap-10">
      {/* Score Ring */}
      <div
        className="w-40 h-40 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          background: `conic-gradient(
            #4F46E5 0deg,
            #06B6D4 ${(score / 100) * 240}deg,
            #F59E0B ${(score / 100) * 360}deg,
            #E2E8F0 ${(score / 100) * 360}deg
          )`,
        }}
      >
        <div className="w-32 h-32 rounded-full bg-white flex flex-col items-center justify-center">
          <span className="text-5xl font-black tracking-tighter leading-none text-slate-900">
            {score}
          </span>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Overall
          </span>
        </div>
      </div>

      {/* Summary */}
      <div className="flex-1 text-center sm:text-left">
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-2">
          {headline}
        </h2>
        <p className="text-sm text-slate-500 leading-relaxed mb-4">
          {summary}
        </p>
        {subtitle && (
          <p className="text-xs text-slate-400 mb-3">{subtitle}</p>
        )}
        {benchmarkBadge && (
          <span className="inline-block bg-indigo-50 text-indigo-700 rounded-lg px-3 py-1.5 text-sm font-semibold">
            {benchmarkBadge}
          </span>
        )}
      </div>
    </div>
  );
}
