// src/utils/searchGuests.js

/**
 * Applies a multi-word, case-insensitive guest name/alias search to a Supabase query.
 *
 * Splits the search string into tokens (on whitespace) and requires EVERY token to
 * match somewhere in first_name, last_name, or alias. This fixes the bug where typing
 * "John Smith" (first + last name, split by a space) returned no results — previously
 * the whole string "John Smith" was searched as one unit against each column, and no
 * single column contains both words.
 *
 * Example: "john smith" -> token "john" must match somewhere, AND token "smith" must
 * match somewhere (in any order, in any of the three fields).
 *
 * ilike is already case-insensitive in Postgres, so no extra lowercasing is needed there.
 */
export function applyGuestNameSearch(query, search) {
  const tokens = search.trim().split(/\s+/).filter(Boolean);

  let result = query;
  for (const token of tokens) {
    result = result.or(`first_name.ilike.%${token}%,last_name.ilike.%${token}%,alias.ilike.%${token}%`);
  }
  return result;
}

/**
 * Ranks already-fetched guest matches by relevance to the search string, most similar first.
 * Lower score = better match. Ties fall back to alphabetical order.
 *
 * Scoring (best to worst):
 *   0 - full name or alias is an exact match
 *   1 - full name or alias starts with the search string
 *   2 - any individual word in the name/alias starts with the search string
 *   3 - full name or alias merely contains the search string somewhere
 *   4 - matched only because it satisfied the per-token search (fallback)
 */
export function rankGuestsBySimilarity(guests, search) {
  const q = search.trim().toLowerCase();
  if (!q) return guests;

  const scoreGuest = (g) => {
    const fullName = [g.first_name, g.last_name].filter(Boolean).join(" ").toLowerCase();
    const alias = (g.alias || "").toLowerCase();

    if (fullName === q || alias === q) return 0;
    if (fullName.startsWith(q) || alias.startsWith(q)) return 1;

    const words = [...fullName.split(" "), alias].filter(Boolean);
    if (words.some((w) => w.startsWith(q))) return 2;

    if (fullName.includes(q) || alias.includes(q)) return 3;

    return 4;
  };

  return [...guests]
    .map((g) => ({ g, score: scoreGuest(g) }))
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      const nameA = [a.g.first_name, a.g.last_name].filter(Boolean).join(" ");
      const nameB = [b.g.first_name, b.g.last_name].filter(Boolean).join(" ");
      return nameA.localeCompare(nameB);
    })
    .map((entry) => entry.g);
}
