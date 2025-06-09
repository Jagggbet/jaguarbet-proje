// functions/api/auth/web3-verify.js 

import { ethers } from 'ethers'; // Ã–nce ana kÃ¼tÃ¼phaneyi import ediyoruz
import { sign } from '@tsndr/cloudflare-worker-jwt';

export async function onRequestPost(context) {
    try {
        const { message, signature, address } = await context.request.json();
        const { JWT_SECRET, DB } = context.env;

        if (!message || !signature || !address || !JWT_SECRET || !DB) {
            return new Response(JSON.stringify({ error: 'Eksik parametreler.' }), { status: 400 });
        }

        // Fonksiyonu ethers.utils Ã¼zerinden Ã§aÄŸÄ±rÄ±yoruz
        const recoveredAddress = ethers.utils.verifyMessage(message, signature);

        if (recoveredAddress.toLowerCase() === address.toLowerCase()) {
            // KullanÄ±cÄ±yÄ± veritabanÄ±na ekle/gÃ¼ncelle
            await DB.prepare("INSERT INTO Users (id, wallet_address, provider) VALUES (?, ?, 'web3') ON CONFLICT(id) DO NOTHING")
              .bind(address, address)
              .run();

            // JWT oluÅŸtur
            const payload = { 
                sub: address, 
                address: address, 
                provider: 'web3', 
                exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7 gÃ¼n geÃ§erli
            };
            const token = await sign(payload, JWT_SECRET);

            return new Response(JSON.stringify({ success: true, token: token }), { 
                headers: { 'Content-Type': 'application/json' } 
            });
        } else {
            return new Response(JSON.stringify({ error: 'GeÃ§ersiz imza.' }), { status: 401 });
        }
    } catch (e) {
        console.error("Web3 Verify Error:", e);
        return new Response(JSON.stringify({ error: 'DoÄŸrulama hatasÄ±.', details: e.message }), { status: 500 });
    }
}
