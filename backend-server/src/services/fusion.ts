const RRF_K = 60;

export function fuseByReciprocalRank<T extends { chunkId: string }>(rankedLists: T[][]): T[] {
  const byId = new Map<string, { hit: T; score: number }>();

  for (const list of rankedLists) {
    list.forEach((hit, index) => {
      const contribution = 1 / (RRF_K + index + 1);
      const existing = byId.get(hit.chunkId);
      if (existing) {
        existing.score += contribution;
      } else {
        byId.set(hit.chunkId, { hit, score: contribution });
      }
    });
  }

  return [...byId.values()]
    .sort((left, right) => right.score - left.score || left.hit.chunkId.localeCompare(right.hit.chunkId))
    .map(({ hit, score }) => ({ ...hit, score }));
}
