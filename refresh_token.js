const https = require('https');
const fs = require('fs');
const path = require('path');

// Refresh CloudPlay token and update server.json
// Called by cron every 12 hours
// Reads username/password FROM server.json (supports plain text or base64)

const SERVER_JSON_PATH = path.join(__dirname, 'server.json');

function decodeCredential(value) {
    // Try base64 decode first (server.json stores credentials as base64)
    try {
        const decoded = Buffer.from(value, 'base64').toString('utf8');
        // Only use decoded value if it looks like valid text (not binary garbage)
        if (decoded && /^[\x20-\x7E]+$/.test(decoded)) {
            return decoded;
        }
    } catch (_) {}
    // Fall back to plain text
    return value;
}

function generateToken(username, password) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({ username, password });

        const req = https.request({
            hostname: 'n1.cloudplay.qzz.io',
            path: '/app-auth22/auth.php?action=login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'X-Package': 'com.cloudplay.app',
                'X-Client': 'cloudplay-android',
                'User-Agent': 'CloudPlay/1.0'
            }
        }, res => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    if (json.success && json.token) {
                        resolve(json.token);
                    } else {
                        reject(new Error('Login failed: ' + body));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

function updateServerJson(newToken) {
    const content = fs.readFileSync(SERVER_JSON_PATH, 'utf8');
    const config = JSON.parse(content);

    // Only update the token field - don't touch anything else
    config.token = newToken;

    fs.writeFileSync(SERVER_JSON_PATH, JSON.stringify(config, null, 2) + '\n');
    console.log(`[${new Date().toISOString()}] Token refreshed successfully`);
    console.log(`New token: ${newToken.substring(0, 8)}...`);
}

async function main() {
    try {
        console.log(`[${new Date().toISOString()}] Starting token refresh...`);

        // Read credentials from server.json
        const content = fs.readFileSync(SERVER_JSON_PATH, 'utf8');
        const config = JSON.parse(content);

        const rawUsername = config.username;
        const rawPassword = config.password;

        if (!rawUsername || !rawPassword) {
            throw new Error('username or password not found in server.json');
        }

        const username = decodeCredential(rawUsername);
        const password = decodeCredential(rawPassword);

        console.log(`Login as: ${username}`);

        const token = await generateToken(username, password);
        updateServerJson(token);
        process.exit(0);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Token refresh failed:`, error.message);
        process.exit(1);
    }
}

main();
