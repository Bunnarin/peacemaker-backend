/// <reference path="../pb_data/types.d.ts" />

// encode the domain to save space
onRecordCreate(e => {
    if (!e.record?.get('targetTally'))
        e.record?.set('targetTally', 10);

    if (!e.record?.get('needs')) {
        // inject meaningful needs
        let needs = ['kh_kh', 'kh_th', 'th_th', 'th_kh'];
        $app.expandRecord(e.record, ['stance', 'source'], null)
        // filter by stance if it only contain the message
        if (e.record?.get('stance')) {
            const stance = e.record.expandedOne('stance');
            needs = needs.filter(need => !!stance[need]);
        }
        // filter by source's audience
        if (e.record?.get('source')) {
            const source = e.record.expandedOne('source');
            needs = needs.filter(need => {
                const recepient = need.split('_')[1];
                return source.get('audiences').includes(recepient);
            })
        }

        e.record?.set('needs', needs);
    }

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
            break;
        }
    e.next();
}, 'post', 'source')

// decode the domain when list request
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
    });
    e.next();
}, 'post', 'source')