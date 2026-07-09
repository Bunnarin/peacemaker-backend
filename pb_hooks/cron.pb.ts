/// <reference path="../pb_data/types.d.ts" />

cronAdd('fetchRSS', '0 * * * *', () => {
    const config = require(`${__hooks}/config.js`);
    const { cosineSimilarity } = require(`${__hooks}/utils.groupedPostsCache.js`);
    const { embedPost, createPostRecord } = require(`${__hooks}/utils.cron.js`);

    let posts = [];

    const postLastReviewedRecord = $app.findRecordById('KV', 'postLastReviewed');
    let latestDate = postLastReviewedRecord.get('value');

    // ok lets aggregate
    const sources = $app.findAllRecords("source", $dbx.exp("rss != ''"), $dbx.exp("engagement_score > 0"), $dbx.hashExp({ approved: true }));
    sources.forEach(source => {
        let rss = source?.get('rss');
        if (!rss.startsWith('https')) // or else it's not from rss.app
            rss = `https://rss.app/feeds/v1.1/${rss}.json`;
        const { statusCode, json } = $http.send({ url: rss });
        if (statusCode !== 200)
            throw new ApiError(statusCode, `rss err (${rss}):` + JSON.stringify(json));
        // inject source
        posts.push(...json.items.map(item => {
            item.source = source;
            return item;
        }));
    });
    posts = posts.filter(post => new Date(post.date_published) > new Date(latestDate));
    if (posts.length === 0) return;

    posts.sort((a, b) => new Date(a.date_published) - new Date(b.date_published));
    latestDate = posts.at(-1).date_published;

    console.log(posts.length)

    // 1st filter: is it an anti-stance based on keyword?
    const antiStances = $app.findAllRecords("anti_stance", $dbx.hashExp({ approved: true }), $dbx.exp('keywords != ""'));
    antiStances.forEach(stance => {
        const keywords = stance?.get('keywords').split(', ');
        posts = posts.filter(post =>
            !keywords.some(keyword =>
                post.content_text.toLowerCase().includes(keyword)
            )
        );
    });
    console.log(posts.length)

    // 2nd filter: keywords
    const keywordStances = $app.findAllRecords("stance", $dbx.exp("keywords != ''"));
    keywordStances.forEach(stance => {
        const keywords = stance?.get('keywords').split(', ');
        const relatedPosts = posts.filter(post =>
            keywords.some(keyword =>
                post.content_text.toLowerCase().includes(keyword)
            )
        );
        relatedPosts.forEach(post => createPostRecord(post, stance?.get('id')));
        posts = posts.filter(post => !relatedPosts.some(e => post.url === e.url));
    });
    console.log(posts.length)

    // 3rd filter: automated matching via embeddings
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentClassifiedPosts = $app.findAllRecords("post",
        $dbx.exp("embedding is not null"),
        $dbx.exp(`"publishedOn" >= '${thirtyDaysAgo.toISOString()}'`),
        $dbx.exp(`(stance != '' OR anti_stance != '')`)
    );

    const newPostRecords = [];
    posts.forEach(post => {
        if (!post.content_text) return; // Skip empty content

        const embedding = embedPost(post);

        let bestStance = null;
        let bestAntiStance = null;
        let maxStanceSim = 0;
        let maxAntiStanceSim = 0;

        recentClassifiedPosts.forEach(recent => {
            const recentEmb = JSON.parse(recent.get('embedding'));

            const sim = cosineSimilarity(embedding, recentEmb);

            const stance = recent.get('stance');
            if (stance && sim > maxStanceSim) {
                maxStanceSim = sim;
                bestStance = stance;
            }

            const antiStance = recent.get('anti_stance');
            if (antiStance && sim > maxAntiStanceSim) {
                maxAntiStanceSim = sim;
                bestAntiStance = antiStance;
            }
        });

        let assignedStance = null;
        let assignedAntiStance = null;

        if (maxStanceSim >= config.AUTO_STANCE_THRESHOLD) {
            assignedStance = bestStance;
        } else if (maxAntiStanceSim >= config.AUTO_ANTI_STANCE_THRESHOLD) {
            assignedAntiStance = bestAntiStance;
        }

        const record = createPostRecord(post, assignedStance, assignedAntiStance, embedding);

        // Only collect it for groupedPostsCache if it didn't get any stance/anti_stance
        if (record && !assignedStance && !assignedAntiStance) {
            newPostRecords.push(record);
        }
    });

    // Incrementally update the grouped posts cache with new posts
    if (newPostRecords.length > 0) {
        const cache = require(`${__hooks}/utils.groupedPostsCache.js`);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentPosts = $app.findAllRecords("post",
            $dbx.hashExp({ approved: false, anti_stance: "" }),
            $dbx.exp("embedding is not null"),
            $dbx.exp(`"publishedOn" >= '${sevenDaysAgo.toISOString()}'`)
        );
        cache.mergeNewPostsIntoCache(newPostRecords, recentPosts, config.SIMILARITY_THRESHOLD);
    }

    // bump the time threshold
    postLastReviewedRecord.set('value', latestDate);
    $app.save(postLastReviewedRecord);

    // healthcheck
    $http.send({ url: config.HEALTH_CHECK_URL });
});

cronAdd('cleanupOldPosts', '@daily', () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    $app.db().newQuery(`
        DELETE FROM post 
        WHERE "publishedOn" < '${thirtyDaysAgo.toISOString()}' AND "currentTally" < "targetTally";
    `).execute();
});