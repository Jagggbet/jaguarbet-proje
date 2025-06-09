import { ethers } from 'ethers';
import { sign } from '@tsndr/cloudflare-worker-jwt';

export async function onRequestPost(context) {
    try {
        const { message, signature, address } = await context.request.json();
        const { JWT_SECRET, DB } = context.env;

        if (!message || !signature || !address || !JWT_SECRET || !DB) {
            return new Response(JSON.stringify({ error: 'Eksik parametreler.' }), { status: 400 });
        }

        const recoveredAddress = ethers.utils.verifyMessage(message, signature);

        if (recoveredAddress.toLowerCase() === address.toLowerCase()) {
            await DB.prepare("INSERT INTO Users (id, wallet_address, provider) VALUES (?, ?, 'web3') ON CONFLICT(id) DO NOTHING")
              .bind(address, address)
              .run();

            const payload = { 
                sub: address, 
                address: address, 
                provider: 'web3', 
                exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7 gün geçerli
            };
            const token = await sign(payload, JWT_SECRET);

            return new Response(JSON.stringify({ success: true, token: token }), { 
                headers: { 'Content-Type': 'application/json' } 
            });
        } else {
            return new Response(JSON.stringify({ error: 'Geçersiz imza.' }), { status: 401 });
        }
    } catch (e) {
        console.error("Web3 Verify Error:", e);
        return new Response(JSON.stringify({ error: 'Doğrulama hatası.', details: e.message }), { status: 500 });
    }
}