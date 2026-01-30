/// <reference path="../pb_data/types.d.ts" />

// remove the query params and encode the domain to save space
onRecordCreate(e => {
    const url = e.record?.get('url').split('?')[0];
    const domainMap = {
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

routerAdd('POST', '/done/{id}', e => {
    $app.db().newQuery(`
        UPDATE post SET currentTally = currentTally + 1 WHERE id = {:id}
    `).bind({ id: e.request?.pathValue("id") }).execute();
    e.json(200);
})

routerAdd('POST', '/new_guest', e => {
    const { pushSubscription, khmer } = e.requestInfo().body;
    $app.db().newQuery(`
        INSERT INTO guest (pushSubscription, ip, khmer) 
        VALUES ({:pushSubscription}, '${e.realIP()}', {:khmer})
    `).bind({ khmer, pushSubscription: JSON.stringify(pushSubscription) }).execute();
    e.json(200);
})

routerAdd('GET', '/member_count', e => {
    const count = $app.countRecords("guest");
    e.json(200, { count });
})