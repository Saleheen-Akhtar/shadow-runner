// Leaderboard service - STUB (intentionally not implemented yet).
//
// Planned backend: Supabase (free tier).
//
// IMPORTANT - anti-cheat design (do NOT ship naive client-side inserts):
// Anyone can POST a fake score from the browser console if the client
// writes directly to the table. Scores must go through a Supabase Edge
// Function that performs server-side validation:
//   - plausibility check: score vs. reported run duration vs. max
//     possible speed curve
//   - rate limiting per client
//   - replay checksum / signed session token issued at run start
// The table itself should deny direct inserts via RLS.
const Leaderboard = {
  async submitScore(name, score, runDurationMs) {
    void name;
    void score;
    void runDurationMs;
    return { ok: false, reason: 'not-implemented' };
  },

  async getTopScores(limit = 10) {
    void limit;
    return [];
  },
};

export default Leaderboard;
