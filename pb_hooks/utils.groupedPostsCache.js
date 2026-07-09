/// <reference path="../pb_data/types.d.ts" />

const CACHE_KEY = 'groupedPostsCache';

/**
 * Cosine similarity between two embedding vectors.
 */
function cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length)
        throw new Error(`Embedding dimension mismatch: ${vecA.length} vs ${vecB.length}`);

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Load the cached groups from KV.
 * @returns {string[][] | null} array of groups (each group = array of post IDs), or null if not found.
 */
function loadCache() {
    try {
        const record = $app.findRecordById('KV', CACHE_KEY);
        const value = record.get('value');
        if (!value) return null;
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Save groups to the KV cache. Creates the record if it doesn't exist.
 * @param {string[][]} groups
 */
function saveCache(groups) {
    let record;
    try {
        record = $app.findRecordById('KV', CACHE_KEY);
    } catch (e) {
        // record doesn't exist yet, create it
        const collection = $app.findCollectionByNameOrId('KV');
        record = new Record(collection);
        record.set('id', CACHE_KEY);
    }
    record.set('value', JSON.stringify(groups));
    $app.save(record);
}

/**
 * Remove a post ID from all cached groups. Drops empty groups.
 * @param {string} postId
 */
function removePostFromCache(postId) {
    const groups = loadCache();
    if (!groups) return;

    const updated = groups
        .map(group => group.filter(id => id !== postId))
        .filter(group => group.length > 0);

    saveCache(updated);
}

/**
 * Full recomputation: given post records, build groups via cosine similarity graph.
 * @param {Record[]} posts - PocketBase post records with 'embedding' field
 * @param {number} threshold
 * @returns {string[][]} groups of post IDs
 */
function computeGroups(posts, threshold) {
    // Build adjacency graph
    const adjacency = new Map();
    for (let i = 0; i < posts.length; i++)
        adjacency.set(i, []);

    for (let i = 0; i < posts.length; i++) {
        const embA = JSON.parse(posts[i].get('embedding'));

        for (let j = i + 1; j < posts.length; j++) {
            const embB = JSON.parse(posts[j].get('embedding'));

            const sim = cosineSimilarity(embA, embB);
            if (sim >= threshold) {
                adjacency.get(i).push(j);
                adjacency.get(j).push(i);
            }
        }
    }

    // BFS/DFS connected components
    const visited = new Set();
    const groups = [];

    for (let i = 0; i < posts.length; i++) {
        if (visited.has(i)) continue;

        const stack = [i];
        const group = [];

        while (stack.length > 0) {
            const current = stack.pop();
            if (visited.has(current)) continue;
            visited.add(current);
            group.push(posts[current].get('id'));

            for (const neighbor of adjacency.get(current)) {
                if (!visited.has(neighbor))
                    stack.push(neighbor);
            }
        }

        groups.push(group);
    }

    // Sort by group size descending
    groups.sort((a, b) => b.length - a.length);
    return groups;
}

/**
 * Incrementally merge new posts into the existing cached groups.
 * Compares each new post against all recent posts (already in the cache) to find similarity edges,
 * then merges connected groups.
 *
 * @param {Record[]} newPosts - newly created post records (with embeddings)
 * @param {Record[]} recentPosts - all recent unapproved stanceless posts (with embeddings)
 * @param {number} threshold
 */
function mergeNewPostsIntoCache(newPosts, recentPosts, threshold) {
    const existingGroups = loadCache() || [];

    // Build a map from postId -> group index for quick lookup
    const postToGroup = new Map();
    existingGroups.forEach((group, idx) => {
        group.forEach(id => postToGroup.set(id, idx));
    });

    // Build a map from postId -> embedding for recent posts
    const embeddingMap = new Map();
    recentPosts.forEach(p => {
        const emb = JSON.parse(p.get('embedding'))
        if (Array.isArray(emb)) embeddingMap.set(p.get('id'), emb);
    });

    for (const newPost of newPosts) {
        const newId = newPost.get('id');
        const newEmb = JSON.parse(newPost.get('embedding'));
        if (!Array.isArray(newEmb)) {
            existingGroups.push([newId]);
            continue;
        }

        embeddingMap.set(newId, newEmb);

        const connectedGroups = new Set();

        // Compare against all posts that are already in a group
        for (const [existingId, existingEmb] of embeddingMap.entries()) {
            if (existingId === newId) continue;
            if (!postToGroup.has(existingId)) continue;

            const sim = cosineSimilarity(newEmb, existingEmb);
            if (sim >= threshold) {
                connectedGroups.add(postToGroup.get(existingId));
            }
        }

        if (connectedGroups.size === 0) {
            // New singleton group
            const newIdx = existingGroups.length;
            existingGroups.push([newId]);
            postToGroup.set(newId, newIdx);
        } else {
            // Merge all connected groups + the new post into one
            const indices = Array.from(connectedGroups).sort((a, b) => a - b);
            const targetIdx = indices[0];
            existingGroups[targetIdx].push(newId);
            postToGroup.set(newId, targetIdx);

            // Merge other groups into the first one
            for (let k = 1; k < indices.length; k++) {
                const srcIdx = indices[k];
                for (const id of existingGroups[srcIdx]) {
                    existingGroups[targetIdx].push(id);
                    postToGroup.set(id, targetIdx);
                }
                existingGroups[srcIdx] = []; // mark for removal
            }
        }
    }

    // Remove empty groups and sort
    const finalGroups = existingGroups
        .filter(g => g.length > 0)
        .sort((a, b) => b.length - a.length);

    saveCache(finalGroups);
}

module.exports = {
    cosineSimilarity,
    loadCache,
    saveCache,
    removePostFromCache,
    computeGroups,
    mergeNewPostsIntoCache,
};
