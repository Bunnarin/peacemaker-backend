import webpush from 'web-push';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
dotenv.config();

webpush.setVapidDetails(
    'mailto:khmerthaipeace@gmail.com',
    process.env.PUBLIC_VAPID_KEY,
    process.env.PRIVATE_VAPID_KEY
);

const db = new Database('pb_data/data.db');

/**
 * Helper to get value from KV table
 */
function getKV(id, defaultValue = new Date(0).toISOString()) {
    const row = db.prepare('SELECT value FROM KV WHERE id = ?').get(id);
    if (!row) {
        db.prepare('INSERT INTO KV (id, value) VALUES (?, ?)').run(id, defaultValue);
        return defaultValue;
    }
    return row.value;
}

/**
 * Sends a push notification to all users/guests in a table who have a subscription
 */
async function broadcast(tableName, payload) {
    const records = db.prepare(`SELECT id, pushSubscription FROM ${tableName} WHERE pushSubscription IS NOT NULL`).all();
    const payloadStr = JSON.stringify(payload);

    for (const record of records) {
        try {
            const subscription = JSON.parse(record.pushSubscription);
            await webpush.sendNotification(subscription, payloadStr);
        } catch (err) {
            if (err.statusCode === 404 || err.statusCode === 410)
                db.prepare(`UPDATE ${tableName} SET pushSubscription = NULL WHERE id = ?`).run(record.id);
        }
    }
}

async function notifyReviewers() {
    const lastNotified = getKV('reviewerLastNotified');
    const count = db.prepare('SELECT COUNT(*) as count FROM post WHERE approved = false AND updatedOn > ?').get(lastNotified).count;

    if (count === 0) return;

    await broadcast('users', {
        title: 'You have post to review',
        body: `There are ${count} posts waiting for your review`,
        url: '/'
    });

    db.prepare('UPDATE KV SET value = ? WHERE id = ?').run(new Date().toISOString(), 'reviewerLastNotified');
}

async function notifyGuests() {
    const lastNotified = getKV('guestLastNotified');

    // first check for number of urgent post
    const urgentCount = db.prepare('SELECT COUNT(*) as count FROM post WHERE approved = TRUE AND priority = TRUE AND updatedOn > ?').get(lastNotified).count;
    if (urgentCount > 0) {
        await broadcast('guest', {
            title: 'Urgent!',
            body: 'An urgent post needs your immediate attention',
            url: '/'
        });
        db.prepare('UPDATE KV SET value = ? WHERE id = ?').run(new Date().toISOString(), 'guestLastNotified');
        return;
    }

    const count = db.prepare('SELECT COUNT(*) as count FROM post WHERE approved = TRUE AND updatedOn > ?').get(lastNotified).count;
    if (count < 10) return;

    await broadcast('guest', {
        title: 'Daily Peacemaker Update',
        body: `You have ${count} new posts to rectify`,
        url: '/'
    });

    db.prepare('UPDATE KV SET value = ? WHERE id = ?').run(new Date().toISOString(), 'guestLastNotified');
}

notifyReviewers();
notifyGuests();