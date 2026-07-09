/// <reference path="../pb_data/types.d.ts" />

routerAdd('GET', '/grouped-posts', e => {
    const config = require(`${__hooks}/config.js`)
    const cache = require(`${__hooks}/utils.groupedPostsCache.js`)

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
                            // skip if post has been approved, marked as anti_stance, or assigned a stance (it will be shown as a suggested stance card instead)
                            if (post.get('approved') || post.get('anti_stance') || post.get('stance'))
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

        // Fetch unapproved posts that already have a stance (suggested stances)
        const suggestedPosts = $app.findAllRecords("post", $dbx.hashExp({ approved: false, anti_stance: "" }), $dbx.exp("stance != ''"));
        const suggestedGroups = suggestedPosts.map(post => {
            const cleanPost = JSON.parse(JSON.stringify(post));
            delete cleanPost.embedding;
            return [cleanPost];
        });

        e.json(200, [...suggestedGroups, ...responseGroups]);
        return;
    }

    // Cache miss — full recomputation
    const SIMILARITY_THRESHOLD = e.requestInfo().query["similarity_threshold"] || config.SIMILARITY_THRESHOLD;
    const posts = $app.findAllRecords("post", $dbx.hashExp({ approved: false, stance: "", anti_stance: "" }), $dbx.exp("embedding is not null"));

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

    // Fetch unapproved posts that already have a stance (suggested stances)
    const suggestedPosts = $app.findAllRecords("post", $dbx.hashExp({ approved: false, anti_stance: "" }), $dbx.exp("stance != ''"));
    const suggestedGroups = suggestedPosts.map(post => {
        const cleanPost = JSON.parse(JSON.stringify(post));
        delete cleanPost.embedding;
        return [cleanPost];
    });

    e.json(200, [...suggestedGroups, ...responseGroups]);
})