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