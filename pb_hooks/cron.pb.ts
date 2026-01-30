/// <reference path="../pb_data/types.d.ts" />

cronAdd("sendEmails", "@daily", () => {
    // find out when we last notified
    let counter = $app.findRecordById("counter", "1");
    // now find how many post since last notified
    let postCount = $app.countRecords(
        "post",
        $dbx.exp(`updatedOn > '${counter.get('memberLastNotified')}'`),
        $dbx.hashExp({ "approved": true })
    );
    let users;
    if (postCount > 0) {
        counter.set('memberLastNotified', new Date().toISOString());
        $app.save(counter);
        // broadcast to all
        users = $app.findAllRecords("users").slice(0, 100); // cuz free gmail smtp is only 100
        $app.newMailClient().send(new MailerMessage({
            from: {
                address: $app.settings().meta.senderAddress,
                name: $app.settings().meta.senderName,
            },
            to: users.map(user => ({ address: user?.get('email') })),
            subject: `You have ${postCount} new posts to correct`,
            html: `You have ${postCount} new posts to correct. Go to https://peacekhth.uk`,
        }));
    }

    // notify reviewer
    // let reviewCount = $app.countRecords(
    //     "post",
    //     $dbx.exp(`updatedOn > '${counter.get('reviewerLastNotified')}'`),
    //     $dbx.hashExp({ "approved": false })
    // );
    // if (reviewCount > 10) {
    //     counter.set('reviewerLastNotified', new Date().toISOString());
    //     $app.save(counter);
    //     // broadcast to all
    //     if (!users)
    //         users = $app.findAllRecords("users");

    //     let reviewers = users.filter(user => user?.get('reviewer'));

    //     $app.newMailClient().send(new MailerMessage({
    //         from: {
    //             address: $app.settings().meta.senderAddress,
    //             name: $app.settings().meta.senderName,
    //         },
    //         to: reviewers.map(user => ({ address: user?.get('email') })),
    //         subject: `You have ${reviewCount} new posts to review`,
    //         html: `You have ${reviewCount} new posts to review. Go to https://peacekhth.uk`,
    //     }));
    // }
})