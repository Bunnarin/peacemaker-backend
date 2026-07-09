const embedPost = (post) => {
    console.log('embeding')
    const { json, statusCode } = $http.send({
        url: "http://localhost:8080/embed",
        method: 'POST',
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            inputs: post.content_text,
        })
    })
    if (statusCode === 200)
        return json[0];
    throw new ApiError(statusCode, 'LLM failed: ' + JSON.stringify(json));
}

const createPostRecord = (post, stanceId = null, antiStanceId = null, embedding = null) => {
    console.log('creating')
    const postCollection = $app.findCollectionByNameOrId("post");
    const postRecord = new Record(postCollection);
    postRecord.set('publishedOn', post.date_published);
    postRecord.set('url', post.url);
    postRecord.set('content', post.content_text);
    postRecord.set('thumbnail', post.image);
    postRecord.set('source', post.source.id);
    if (stanceId) postRecord.set('stance', stanceId);
    if (antiStanceId) postRecord.set('anti_stance', antiStanceId);

    // We only set embedding if it's explicitly passed OR if it's not a known stance/anti_stance
    if (embedding) {
        postRecord.set('embedding', embedding);
    } else if (!stanceId && !antiStanceId && post.content_text) {
        const emb = embedPost(post);
        postRecord.set('embedding', emb);
    }

    try {
        $app.save(postRecord);
        return postRecord;
    } catch (e) {
        console.log(e);
        return null;
    }
}

module.exports = {
    embedPost,
    createPostRecord
}