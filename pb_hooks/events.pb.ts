/// <reference path="../pb_data/types.d.ts" />

// remove the query params and encode the domain to save space
onRecordCreate(e => {
    if (!e.record?.get('targetTally'))
        e.record?.set('targetTally', 10);

    const url = e.record?.get('url');
    const domainMap = {
        'https://web.facebook.com': 'fb',
        'https://www.facebook.com': 'fb',
        'https://x.com': 'x',
        'https://www.instagram.com': 'ig',
        'https://www.tiktok.com': 'tt',
        'https://youtu.be': 'yt',
        'https://www.youtube.com': 'ytt',
    }
    // encode the url
    for (const [prefix, encoded] of Object.entries(domainMap))
        if (url.startsWith(prefix)) {
            e.record?.set('url', url.replace(prefix, encoded));
            return e.next();
        }
    throw new ApiError(400, "invalid url");
}, 'post', 'source')

onRecordsListRequest(e => {
    const domainMap = {
        'fb': 'https://www.facebook.com',
        'x': 'https://x.com',
        'ig': 'https://www.instagram.com',
        'tt': 'https://www.tiktok.com',
        'yt': 'https://youtu.be',
        'ytt': 'https://www.youtube.com',
    }
    e.records.forEach(record => {
        const url = record.get('url');
        for (const [prefix, encoded] of Object.entries(domainMap))
            if (url.startsWith(prefix))
                return record.set('url', url.replace(prefix, encoded));
    })
    e.next();
}, 'post', 'source')