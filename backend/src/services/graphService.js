import { getClausesBySession } from "./vectorService.js";

/**
 * Graph Traversal: 1-hop adjacency scan along connectedClauses
 * Combines primary vector matches with their explicitly linked dependency nodes
 */
export async function traverseAdjacency(sessionId, primaryMatches, maxHops = 1) {
  if (!primaryMatches || primaryMatches.length === 0) return { expandedClauses: [], graphPath: [] };

  const allSessionClauses = await getClausesBySession(sessionId);
  const clauseMap = new Map();

  allSessionClauses.forEach((c) => {
    clauseMap.set(c.clauseId, c);
  });

  const resultClausesMap = new Map();
  const graphPath = [];

  // Add primary matches
  primaryMatches.forEach((c) => {
    resultClausesMap.set(c.clauseId, c);
    graphPath.push(c.clauseId);
  });

  // 1-hop adjacency scan
  primaryMatches.forEach((primary) => {
    const connected = primary.metadata?.connectedClauses || primary.connectedClauses || [];
    connected.forEach((connectedId) => {
      const neighbor = clauseMap.get(connectedId);
      if (neighbor && !resultClausesMap.has(connectedId)) {
        resultClausesMap.set(connectedId, neighbor);
        graphPath.push(connectedId);
      }
    });
  });

  return {
    expandedClauses: Array.from(resultClausesMap.values()),
    graphPath,
  };
}

export default { traverseAdjacency };
