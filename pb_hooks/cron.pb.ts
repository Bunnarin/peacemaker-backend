/// <reference path="../pb_data/types.d.ts" />

// since this cron is UTC and we want PP time 7-21, so we - 7
// cron remove cuz on prod there's no cron job for some reason
cronAdd('fetchRSS', '0 0-14 * * *', () => {
    const config = require(`${__hooks}/config.js`);

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

    const classifyPosts = (problemDesc = null) => {
        const systemPrompt = problemDesc ?
            `Your job is to identify posts that are COMPLETELY RELATED to this "${problemDesc}".
            Respond ONLY with valid JSON matching the required schema. No explanation, no markdown.
            Rules:
            - Evaluate EACH post in the list.
            - We strongly prefer FALSE POSITIVES over false negatives. If there is even a subtle hint, a mild reference, or an indirect connection to the Cambodia-Thailand rivalry, historical claims, or culture war, return true.
            - Return false ONLY if the post is completely unrelated to anything between Cambodia and Thailand (e.g., general Southeast Asia politics, clearly unrelated news).`
            :
            `Your job is to determine if each post relates to the Cambodia-Thailand hatred and rivalry.
            This hatred includes not just border conflicts, but also culture wars, historical claims, toxic nationalism, rivalry, or rude remarks over each other's tragedies and differences.
            Rules:
            - Evaluate EACH post in the list.
            - We strongly prefer FALSE POSITIVES over false negatives. If there is even a subtle hint, a mild reference, or an indirect connection to the Cambodia-Thailand rivalry, historical claims, or culture war, return true.
            - Return false ONLY if the post is completely unrelated to anything between Cambodia and Thailand (e.g., general Southeast Asia politics, clearly unrelated news).
            `
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
                            content: JSON.stringify(posts.map(p => ({ url: p.url, title: p.title })))
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
    try {
        const postLastReviewedRecord = $app.findRecordById('KV', 'postLastReviewed');
        let latestDate = new Date(postLastReviewedRecord.get('value') || 0);

        // ok lets aggregate
        const sources = $app.findAllRecords("source", $dbx.exp("rss != ''"), $dbx.hashExp({ approved: true }));
        sources.forEach(source => {
            let rss = source?.get('rss');
            if (!rss.startsWith('https')) // or else it's not from rss.app
                rss = 'https://rss.app/feeds/v1.1/' + rss + '.json';
            const { statusCode, json } = $http.send({ url: rss });
            if (statusCode !== 200)
                throw new ApiError(statusCode, `rss err (${rss}):` + JSON.stringify(json));
            posts.push(...json.items.map(item => {
                item.sourceId = source?.id;
                return item;
            }));
        });
        posts = posts.filter(post => new Date(post.date_published) > latestDate);
        // dont want to waste tokens
        if (posts.length === 0) return;

        // earliest first
        posts.sort((a, b) => new Date(a.date_published) - new Date(b.date_published));
        posts = posts.slice(0, config.MAX_POST_PER_PROMPT);
        // don't waste LLM if post count too low
        if (posts.length < config.MAX_POST_PER_PROMPT / 2) return;
        latestDate = posts.reduce((maxDate, currentPost) => {
            const currentDate = new Date(currentPost.date_published);
            return currentDate > maxDate ? currentDate : maxDate;
        }, new Date(posts[0].date_published)); // Initialize with the first post's date

        // filter away all the obvious stance
        const postCollection = $app.findCollectionByNameOrId("post");
        const stances = $app.findAllRecords("stance", $dbx.hashExp({ obvious: true }), $dbx.exp("description != ''"));
        stances.forEach(stance => {
            if (posts.length == 0) return;
            const llmResult = classifyPosts(stance?.get('description'));
            llmResult.forEach(e => {
                // make sure that the url is real
                const post = posts.find(p => p.url === e.url);
                if (!post) return;
                // rm it for the next filter
                posts = posts.filter(p => p.url !== post.url);

                const postRecord = new Record(postCollection);
                postRecord.set('publishedOn', post.date_published);
                postRecord.set('url', post.url);
                postRecord.set('content', post.content_text);
                postRecord.set('thumbnail', post.image);
                postRecord.set('source', post.sourceId);
                postRecord.set('stance', stance?.id);
                postRecord.set('approved', true);
                try {
                    $app.save(postRecord);
                } catch {
                    // could be that the post already exists
                }
            });
        });

        // final filter: is it even related the slightest bit to the hatred
        const llmResult = classifyPosts();

        // Loop through the results and save to db
        llmResult.forEach(e => {
            // make sure that the url is real
            const post = posts.find(p => p.url === e.url);
            if (!post) return;
            const postRecord = new Record(postCollection);
            postRecord.set('publishedOn', post.date_published);
            postRecord.set('url', post.url);
            postRecord.set('content', post.content_text);
            postRecord.set('thumbnail', post.image);
            postRecord.set('source', post.sourceId);
            try {
                $app.save(postRecord);
            } catch {
                // could be that the post already exists
            }
        });

        postLastReviewedRecord.set('value', latestDate.toISOString());
        $app.save(postLastReviewedRecord);

        // healthcheck
        $http.send({ url: config.HEALTH_CHECK_URL });
    } catch (e) {
        // signal a fail
        $http.send({ url: config.HEALTH_CHECK_URL + '/fail' });
        throw new ApiError(400, e.message);
    }
});

cronAdd('cleanupOldPosts', '@daily', () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    $app.db().newQuery(`
        DELETE FROM post 
        WHERE "publishedOn" < '${thirtyDaysAgo.toISOString()}' AND "currentTally" < "targetTally";
    `).execute();
});