/// <reference path="../pb_data/types.d.ts" />

// since this cron is UTC and we want PP time 7-21, so we - 7
// we don't need AI, no?
cronAdd('fetchRSS', '*/15 0-14 * * *', () => {
    const config = require(`${__hooks}/config.js`);

    // helpers
    const classifyPosts = (problemDesc = null, exclusiveOrigin = null) => {
        const systemPrompt = problemDesc ?
            `Your job is to identify posts that are COMPLETELY RELATED to this "${problemDesc}".
            Rules:
            - Evaluate EACH post in the list.
            - We strongly prefer FALSE NEGATIVES over false positives.`
            :
            `Your job is to determine if each post relates to the Cambodia-Thailand hatred and rivalry.
            This hatred includes not just border conflicts, but also culture wars, historical claims, toxic nationalism, rivalry, or rude remarks over each other's tragedies and differences.
            Rules:
            - Evaluate EACH post in the list.
            - We strongly prefer FALSE POSITIVES over false negatives.`

        let relevantPosts = posts.slice(0, config.MAX_POST_PER_PROMPT);
        if (exclusiveOrigin)
            relevantPosts = relevantPosts.filter(p =>
                p.source.khmer == (exclusiveOrigin == 'kh')
            );

        while (modelIndex < models.length) {
            const { json, statusCode } = $http.send({
                // 2mn may be too short
                timeout: 500,
                url: "https://integrate.api.nvidia.com/v1/chat/completions",
                method: 'POST',
                headers: {
                    "Authorization": "Bearer " + config.LLM_API_KEY,
                    "Accept": "application/json"
                },
                body: JSON.stringify({
                    model: models[modelIndex],
                    messages: [
                        {
                            role: "system",
                            content: systemPrompt
                        },
                        {
                            role: "user",
                            content: JSON.stringify(relevantPosts.map(p => ({ url: p.url, title: p.title })))
                        },
                    ],
                    response_format: {
                        type: "json_schema",
                        json_schema: {
                            name: "classification_result",
                            strict: true,
                            schema: {
                                type: "object",
                                properties: {
                                    items: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                url: { type: "string" },
                                                is_related: { type: "boolean" }
                                            },
                                            required: ["url", "is_related"],
                                            additionalProperties: false
                                        }
                                    }
                                },
                                required: ["items"],
                                additionalProperties: false
                            }
                        }
                    }
                }),
            });

            if (statusCode === 200 && json && json.choices)
                return JSON.parse(json.choices[0].message.content).items.filter(e => e.is_related);

            modelIndex++;
        }

        throw new ApiError(400, 'All LLM models exhausted or failed.');
    }

    const postCollection = $app.findCollectionByNameOrId("post");
    const createPostRecord = (post, stanceId = null, approved = false) => {
        const postRecord = new Record(postCollection);
        postRecord.set('publishedOn', post.date_published);
        postRecord.set('url', post.url);
        postRecord.set('content', post.content_text);
        postRecord.set('thumbnail', post.image);
        postRecord.set('source', post.source.id);
        postRecord.set('AI_approved', approved);
        if (stanceId) postRecord.set('stance', stanceId);
        try {
            $app.save(postRecord);
        } catch {
            // could be that the post already exists
        }
    }

    const models = [
        'google/gemma-3n-e4b-it',
        'google/gemma-3n-e2b-it',
        'google/gemma-3-27b-it',
        'google/gemma-2-2b-it',
        'google/gemma-2-2b-it',
        'google/gemma-2-2b-it'
    ];
    // we try the next model if the other one don't work
    let modelIndex = 0;

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

    // 1st filter: is it an anti-stance?
    const antiStances = $app.findAllRecords("anti_stance", $dbx.hashExp({ approved: true }));
    antiStances.forEach(stance => {
        const keywords = stance?.get('keywords').split(', ');
        posts = posts.filter(post =>
            !keywords.some(keyword =>
                post.content_text.toLowerCase().includes(keyword)
            )
        );
    });

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

    // don't waste LLM if post count too low
    // if (posts.length < config.MAX_POST_PER_PROMPT / 2) return;

    // 3rd filter: is it even related the slightest bit to the hatred
    // const relatedPosts = classifyPosts();
    // posts = posts.filter(p => relatedPosts.some(e => p.url === e.url));

    // 4th: filter away all the obvious stance
    // let obviousStances = $app.findAllRecords("stance", $dbx.exp("obvious = true"));
    // // sort by frequency
    // let stanceFrequencies = $app.findAllRecords("stance_frequency");
    // let stanceFrequenciesMap = stanceFrequencies.reduce((acc, stanceFrequency) => {
    //     acc[stanceFrequency.id] = stanceFrequency.get('count');
    //     return acc;
    // }, {});
    // obviousStances.sort((a, b) => stanceFrequenciesMap[b.id] - stanceFrequenciesMap[a.id]);
    // obviousStances.forEach(stance => {
    //     if (posts.length == 0) return;
    //     const relatedPosts = classifyPosts(stance?.get('description'), stance?.get('exclusiveOrigin'));
    //     relatedPosts.forEach(e => {
    //         const post = posts.find(p => p.url === e.url);
    //         if (!post) return;
    //         posts = posts.filter(p => p.url !== post.url);
    //         createPostRecord(post, stance?.id, true);
    //     });
    // });

    // the remaining post that didn't get any stance, we create empty stuff for review
    posts.forEach(post => createPostRecord(post));

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