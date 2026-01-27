/// <reference path="../pb_data/types.d.ts" />

// welcome email to fake aws verifier
// onRecordCreate(e => {
//     $app.newMailClient().send(new MailerMessage({
//         from: {
//             address: $app.settings().meta.senderAddress,
//             name: $app.settings().meta.senderName,
//         },
//         to: [{ address: e.record?.get('email') }],
//         subject: `Welcome to Peacekhth.uk`,
//         html: `Welcome to Peacekhth.uk. click here to unsubscribe <a href="https://peacekhth.uk/unsubscribe/${e.record?.get('id')}">unsubscribe</a>`,
//     }));
// }, 'users')

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

routerAdd('POST', '/new_member/{nationality}', e => {
    const nationality = e.request?.pathValue("nationality");
    if (nationality != 'khmer' && nationality != 'thai' && nationality != 'others')
        throw new ApiError(400, "invalid nationality");
    $app.db().newQuery(`
        UPDATE counter SET ${nationality} = ${nationality} + 1
    `).execute();
    e.json(200);
})