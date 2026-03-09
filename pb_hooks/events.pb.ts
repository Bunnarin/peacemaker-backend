/// <reference path="../pb_data/types.d.ts" />

// remove the query params and encode the domain to save space
onRecordCreate(e => {
    if (!e.record?.get('targetTally'))
        e.record?.set('targetTally', 10);

    const domainMap = {
        'https://web.facebook.com/': 'fb',
        'https://www.facebook.com/': 'fb',
        'https://x.com/': 'x',
        'https://www.instagram.com/': 'ig',
        'https://www.tiktok.com/': 'tt',
        'https://youtu.be/': 'yt',
        'https://www.youtube.com/': 'ytt',
    }
    // encode the url
    const url = e.record?.get('url');
    for (const [prefix, encoded] of Object.entries(domainMap))
        if (url.startsWith(prefix)) {
            e.record?.set('domain', encoded);
            e.record?.set('url', url.replace(prefix, ''))
            return e.next();
        }
    throw new ApiError(400, "invalid url");
}, 'post', 'source')

onRecordsListRequest(e => {
    const domainMap = {
        'fb': 'https://www.facebook.com/',
        'x': 'https://x.com/',
        'ig': 'https://www.instagram.com/',
        'tt': 'https://www.tiktok.com/',
        'yt': 'https://youtu.be/',
        'ytt': 'https://www.youtube.com/',
    }
    e.records.forEach(record => {
        const domain = domainMap[record?.get('domain')];
        const url = record?.get('url');
        record?.set('url', domain + url);
    })
    e.next();
}, 'post', 'source')