// Generate VAPID Keys for Push Notifications
// Run this once: node generate-vapid-keys.js

const crypto = require('crypto');

function generateVAPIDKeys() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'prime256v1',
        publicKeyEncoding: {
            type: 'spki',
            format: 'der'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'der'
        }
    });

    // Extract the raw public key point (last 65 bytes of SPKI)
    // SPKI header for P-256 is 26 bytes: 30 59 30 13 06 07 2a 86 48 ce 3d 02 01 06 08 2a 86 48 ce 3d 03 01 07 03 42 00
    const rawPublicKey = publicKey.slice(-65);

    // Convert to base64url format
    const publicKeyBase64 = rawPublicKey.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

    // Private key is usually fine as PKCS8 or raw, but web-push often expects raw 32 bytes. 
    // However, many libraries handle PKCS8. For consistency with web-push CLI, let's keep PKCS8 for now 
    // as it works with the web-push library on the backend.
    const privateKeyBase64 = privateKey.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

    console.log('\n🔑 VAPID Keys Generated Successfully!\n');
    console.log('Add these to your .env.local file:\n');
    console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY=' + publicKeyBase64);
    console.log('VAPID_PRIVATE_KEY=' + privateKeyBase64);
    console.log('\n⚠️  Keep the private key secret! Never commit it to git.\n');
}

generateVAPIDKeys();
