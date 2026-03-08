/// <reference path="../pb_data/types.d.ts" />

// since this cron is UTC and we want PP time 6-21, we +7
cronAdd('fetchPosts', '0 4-13 * * *', () => {
    const config = require(`${__hooks}/config.js`);
    const getPrompt = (posts) => `You are a classifier for social media posts. Your job is to determine if each post relates to the Cambodia-Thailand hatred and rivalry.
    This hatred includes not just border conflicts, but also culture wars, historical claims, toxic nationalism, rivalry, or rude remarks over each other's tragedies and differences.
    Posts to classify (JSON array):
    ${posts}

    Rules:
    - Evaluate EACH post in the list.
    - We strongly prefer FALSE POSITIVES over false negatives. If there is even a subtle hint, a mild reference, or an indirect connection to the Cambodia-Thailand rivalry, historical claims, or culture war, return true.
    - Return false ONLY if the post is completely unrelated to anything between Cambodia and Thailand (e.g., general Southeast Asia politics, clearly unrelated news).`;
    const sources = $app.findAllRecords("source", $dbx.exp("rss != ''"));

    const postCollection = $app.findCollectionByNameOrId("post");
    const postLastReviewedRecord = $app.findRecordById('KV', 'postLastReviewed');
    const postLastReviewed = new Date(postLastReviewedRecord.get('value') || 0);
    let latestPostDate = postLastReviewed;

    sources.forEach(source => {
        const { json: { items } } = $http.send({ url: source.get('rss') });
        const posts = items.filter(item => new Date(item.date_published) > postLastReviewed);
        if (posts.length === 0) return;

        posts.forEach((p: any) => {
            const d = new Date(p.date_published);
            if (d > latestPostDate)
                latestPostDate = d;
        });

        // Strip posts down to just the text to save tokens, but keep URL to map back
        const postsPayload = JSON.stringify(posts.map(p => ({ url: p.url, text: p.content_text })));

        const { json: geminiResp, statusCode } = $http.send({
            url: `https://generativelanguage.googleapis.com/v1beta/models/${config.MODEL}:generateContent?key=${config.LLM_API_KEY}`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: getPrompt(postsPayload)
                    }]
                }],
                generationConfig: {
                    response_mime_type: 'application/json',
                    response_schema: {
                        type: 'ARRAY',
                        items: {
                            type: 'OBJECT',
                            properties: {
                                post_url: { type: 'STRING' },
                                is_related: { type: 'BOOLEAN' },
                            },
                            required: ['post_url', 'is_related'],
                        }
                    },
                },
            }),
        });
        if (statusCode !== 200) throw new ApiError(statusCode, 'LLM API error: ' + JSON.stringify(geminiResp));
        const llmResult = JSON.parse(geminiResp.candidates[0].content.parts[0].text).filter(e => e.is_related);

        // Loop through the results and save to db
        llmResult.forEach(e => {
            // make sure that the url is real
            const post = posts.find(p => p.url === e.post_url);
            if (!post) return;
            const postRecord = new Record(postCollection);
            postRecord.set('url', post.url);
            postRecord.set('content', post.content_text);
            try {
                $app.save(postRecord);
            } catch {
                // could be that the post already exists
            }
        });
    });

    if (latestPostDate > postLastReviewed) {
        postLastReviewedRecord.set('value', latestPostDate.toISOString());
        $app.save(postLastReviewedRecord);
    }

    // healthcheck
    $http.send({ url: 'https://hc-ping.com/5bc42c3a-c6da-4e0c-8f1a-a5b9cdf072b7' });
});