/// <reference path="../pb_data/types.d.ts" />

routerAdd('GET', '/grouped-posts', e => {
    const config = require(`${__hooks}/config.js`)
    const cache = require(`${__hooks}/groupedPostsCache.js`)

    // Try cache first
    const cachedGroups = cache.loadCache();

    if (cachedGroups) {
        // Resolve post IDs to full post records, dropping any that no longer exist
        const responseGroups = cachedGroups
            .map(group => {
                return group
                    .map(id => {
                        try {
                            const post = $app.findRecordById('post', id);
                            // skip if post has been approved or assigned a stance in the meantime
                            if (post.get('approved') || post.get('stance'))
                                return null;
                            const cleanPost = JSON.parse(JSON.stringify(post));
                            delete cleanPost.embedding;
                            return cleanPost;
                        } catch (e) {
                            return null; // post was deleted
                        }
                    })
                    .filter(Boolean);
            })
            .filter(group => group.length > 0);

        e.json(200, responseGroups);
        return;
    }

    // Cache miss — full recomputation
    const SIMILARITY_THRESHOLD = e.requestInfo().query["similarity_threshold"] || config.SIMILARITY_THRESHOLD;
    const posts = $app.findAllRecords("post", $dbx.hashExp({ approved: false, stance: "" }), $dbx.exp("embedding is not null"));

    const groups = cache.computeGroups(posts, SIMILARITY_THRESHOLD);

    // Save to cache for next time
    cache.saveCache(groups);

    // Build response (strip embeddings)
    const responseGroups = groups.map(group =>
        group.map(id => {
            try {
                const post = $app.findRecordById('post', id);
                const cleanPost = JSON.parse(JSON.stringify(post));
                delete cleanPost.embedding;
                return cleanPost;
            } catch (e) {
                return null;
            }
        }).filter(Boolean)
    ).filter(group => group.length > 0);

    e.json(200, responseGroups);
})