const https = require('https');
const fs = require('fs');
const path = require('path');

// Refresh CloudPlay token and update server.json
// Called by cron every 12 hours

const SERVER_JSON_PATH = path.join(__dirname, 'server.json');

function generateToken() {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            username: 'antnu3828',
            password: 'antnu@7388'
        });

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
    // Read current server.json
    const content = fs.readFileSync(SERVER_JSON_PATH, 'utf8');
    const config = JSON.parse(content);

    // Only update the token field - don't touch anything else
    config.token = newToken;

    // Write back with same formatting
    fs.writeFileSync(SERVER_JSON_PATH, JSON.stringify(config, null, 2) + '\n');
    console.log(`[${new Date().toISOString()}] Token refreshed successfully`);
    console.log(`New token: ${newToken.substring(0, 8)}...`);
}

async function main() {
    try {
        console.log(`[${new Date().toISOString()}] Starting token refresh...`);
        const token = await generateToken();
        updateServerJson(token);
        process.exit(0);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Token refresh failed:`, error.message);
        process.exit(1);
    }
}

main();
