const hex=(process.argv[2]||'').replace(/[:\s]/g,'');
if(!/^[a-fA-F0-9]{40}$/.test(hex)){console.error('Dùng SHA-1 từ gradlew signingReport: node scripts/facebook-key-hash.mjs "AA:BB:..."');process.exitCode=1;}
else console.log(Buffer.from(hex,'hex').toString('base64'));
