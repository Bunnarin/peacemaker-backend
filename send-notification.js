import webpush from 'web-push';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import https from 'https';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

dotenv.config();

puppeteer.use(StealthPlugin());

webpush.setVapidDetails(
    'mailto:khmerthaipeace@gmail.com',
    process.env.PUBLIC_VAPID_KEY,
    process.env.PRIVATE_VAPID_KEY
);

const db = new Database('pb_data/data.db');

notifyReviewers();
notifyGuests();
notifyProgress();
https.get('https://hc-ping.com/f1d7d228-b6da-4602-a1a7-d6c5492bf0c3');

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
    const records = db.prepare(`SELECT id, "pushSubscription" FROM ${tableName} WHERE "pushSubscription" IS NOT NULL`).all();

    for (const record of records) {
        try {
            const subscription = JSON.parse(record.pushSubscription);
            await webpush.sendNotification(subscription, JSON.stringify(payload), { urgency: 'high' });
        } catch (err) {
            if (err.statusCode === 404 || err.statusCode === 410)
                db.prepare(`UPDATE ${tableName} SET "pushSubscription" = NULL WHERE id = ?`).run(record.id);
        }
    }
}

async function notifyReviewers() {
    const lastNotified = getKV('reviewerLastNotified');
    const count = db.prepare('SELECT COUNT(*) as count FROM post WHERE approved = false AND "updatedOn" > ?').get(lastNotified).count;

    if (count == 0) return;

    await broadcast('users', {
        title: 'You have post to review',
        body: `There are ${count} posts waiting for your review`,
        url: '/reviews?priority=true'
    });

    db.prepare('UPDATE KV SET value = ? WHERE id = ?').run(new Date().toISOString(), 'reviewerLastNotified');
}

async function notifyGuests() {
    const lastNotified = getKV('guestLastNotified');

    // first check for number of urgent post
    const urgentCount = db.prepare('SELECT COUNT(*) as count FROM post WHERE approved = TRUE AND priority = TRUE AND "updatedOn" > ?').get(lastNotified).count;
    if (urgentCount > 0) {
        await broadcast('guest', {
            title: 'Urgent!',
            body: 'An urgent post needs your immediate attention',
            url: '/?priority=true'
        });
        db.prepare('UPDATE KV SET value = ? WHERE id = ?').run(new Date().toISOString(), 'guestLastNotified');
        return;
    }

    const count = db.prepare('SELECT COUNT(*) as count FROM post WHERE approved = TRUE AND "updatedOn" > ?').get(lastNotified).count;
    if (count < 10) return;

    await broadcast('guest', {
        title: 'New posts',
        body: `You have ${count} new posts to rectify`,
        url: '/?priority=true'
    });

    db.prepare('UPDATE KV SET value = ? WHERE id = ?').run(new Date().toISOString(), 'guestLastNotified');
}

async function notifyProgress() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // This will bypass Cloudflare using stealth and give us the raw Next.js page data
    await page.goto('https://socialblade.com/youtube/channel/UCYBI0brJdDpbYbcnQtKkPOQ', {
        waitUntil: 'domcontentloaded'
    });

    const nextData = await page.evaluate(() => {
        const el = document.getElementById('__NEXT_DATA__');
        return el ? JSON.parse(el.textContent) : null;
    });

    await browser.close();

    const queries = nextData.props.pageProps.trpcState.json.queries;
    // Find the query that holds the "facebook user" data
    const fbQuery = queries.find(q =>
        q.queryKey && q.queryKey[0] &&
        q.queryKey[0][0] === 'facebook' &&
        q.queryKey[0][1] === 'user'
    );

    const count = fbQuery.state.data.likes;
    const lastCount = getKV('lastFBFollowerCount');
    if (count <= lastCount) return;
    db.prepare("UPDATE KV SET value = ? WHERE id = 'lastFBFollowerCount'").run(count);
    const exponent = Math.floor(Math.log10(count)) + 1;
    const target = Math.pow(10, exponent);
    const progress = Math.round((count / target) * 100);

    await broadcast('users', {
        title: 'you gained ' + (count - lastCount) + ' followers',
        body: `We're at ${progress}% of our goal! Keep it up!`,
        url: `/?last_fb_count=${lastCount}&current_fb_count=${count}`
    });
}