// Simple SVG trophy icon for leaderboard
export default function TrophyIcon({ className = "w-5 h-5 text-yellow-500 inline ml-1" }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path d="M6 2a1 1 0 00-1 1v2a1 1 0 001 1h8a1 1 0 001-1V3a1 1 0 00-1-1H6zm8 4H6v1a6 6 0 005 5.92V15H9a1 1 0 000 2h2a1 1 0 000-2h-2v-2.08A6 6 0 0014 7V6z" />
    </svg>
  );
}
