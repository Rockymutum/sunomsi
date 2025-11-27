// Generate VAPID Keys for Push Notifications
// Run this once: node generate-vapid-keys.js

const crypto = require('crypto');

function generateVAPIDKeys() {
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.generateKeys();

    const publicKey = ecdh.getPublicKey(); // Uncompressed Buffer (65 bytes)
    const privateKey = ecdh.getPrivateKey(); // Raw 32-byte Buffer

    // Convert to base64url format
    const publicKeyBase64 = publicKey.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

    const privateKeyBase64 = privateKey.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

    console.log('\n🔑 VAPID Keys Generated Successfully! (Correct Format)\n');
    console.log('Add these to your .env.local file AND Vercel Environment Variables:\n');
    console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY=' + publicKeyBase64);
    console.log('VAPID_PRIVATE_KEY=' + privateKeyBase64);
    console.log('\n⚠️  Keep the private key secret! Never commit it to git.\n');
}

generateVAPIDKeys();
