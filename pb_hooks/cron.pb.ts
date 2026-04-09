/// <reference path="../pb_data/types.d.ts" />

// since this cron is UTC and we want PP time 7-21, so we - 7
// cron remove cuz on prod there's no cron job for some reason
cronAdd('fetchRSS', '0 0-14 * * *', () => {
    const config = require(`${__hooks}/config.js`);

    let posts = [];

    const classifyPosts = (prompt) => {
        const { json, statusCode } = $http.send({
            url: "https://integrate.api.nvidia.com/v1/chat/completions",
            method: 'POST',
            headers: {
                "Authorization": "Bearer " + config.LLM_API_KEY,
                "Accept": "application/json"
            },
            body: JSON.stringify({
                model: config.MODEL,
                messages: [{ role: "user", content: prompt }],
                response_format: {
                    type: "json_object",
                    properties: {
                        url: { "type": "STRING" },
                        is_related: { "type": "BOOLEAN" },
                    },
                    required: ["url", "is_related"]
                }
            }),
        });
        if (statusCode !== 200)
            throw new ApiError(statusCode, 'LLM API error: ' + JSON.stringify(json));
        // had to do this object.values cuz the llm might return different key
        return Object.values(JSON.parse(json.choices[0].message.content))[0].filter(e => e.is_related);
    }

    const getStancePrompt = (problemDesc) => `
        You are a strict classifier for the Cambodia-Thailand conflict.

        Your ONLY job is to identify posts that are COMPLETELY UNRELATED to this specific stance:

        "${problemDesc}"

        Posts to classify (JSON array):
        ${JSON.stringify(posts.map(p => ({ url: p.url, text: p.title })))}

        Rules (follow strictly):
        - Evaluate EACH post independently.
        - Default answer is false (is_related: false).
        - Return the url and is_related: true ONLY if the post is 100% clearly and explicitly about the exact stance described above. 
        - If there is even the slightest ambiguity, indirect reference, or it could be about something else, return false.
        - We strongly prefer false negatives. It is better to miss a post than to incorrectly mark one as related.
        - Ignore any broader connection to the Cambodia-Thailand conflict. Focus only on whether it matches this exact stance.
        `;

    const getGeneralPrompt = () => `You are a classifier for social media posts. Your job is to determine if each post relates to the Cambodia-Thailand hatred and rivalry.
        This hatred includes not just border conflicts, but also culture wars, historical claims, toxic nationalism, rivalry, or rude remarks over each other's tragedies and differences.
        Posts to classify (JSON array):
        ${JSON.stringify(posts.map(p => ({ url: p.url, text: p.title })))}

        Rules:
        - Evaluate EACH post in the list.
        - We strongly prefer FALSE POSITIVES over false negatives. If there is even a subtle hint, a mild reference, or an indirect connection to the Cambodia-Thailand rivalry, historical claims, or culture war, return true.
        - Return false ONLY if the post is completely unrelated to anything between Cambodia and Thailand (e.g., general Southeast Asia politics, clearly unrelated news).
        `;
    try {
        const postLastReviewedRecord = $app.findRecordById('KV', 'postLastReviewed');
        let latestDate = new Date(postLastReviewedRecord.get('value') || 0);

        // ok lets aggregate
        const sources = $app.findAllRecords("source", $dbx.exp("rss != ''"), $dbx.hashExp({ approved: true }));
        sources.forEach(source => {
            let rss = source?.get('rss');
            if (!rss.startsWith('https')) // or else it's from rss.app
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
        const obviousStances = $app.findAllRecords("stance", $dbx.hashExp({ obvious: true }), $dbx.exp("description != ''"));
        obviousStances.forEach(stance => {
            if (posts.length == 0) return;
            const llmResult = classifyPosts(getStancePrompt(stance?.get('description')));
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
        const llmResult = classifyPosts(getGeneralPrompt());

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