const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    delay, 
    fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const http = require('http');
const fs = require('fs');

// Petit serveur pour Render
http.createServer((req, res) => {
    res.write("Plasma Bot est en ligne !");
    res.end();
}).listen(process.env.PORT || 3000);

const contactsRepondus = new Set();

async function startBot() {
    const authFolder = 'auth_info_baileys';
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        syncFullHistory: false
    });

    // --- MODIFICATION ICI : NUMÉRO DIRECT ---
    if (!sock.authState.creds.registered) {
        console.log("=== CONNEXION AUTOMATIQUE SUR RENDER ===");
        const phoneNumber = "237689438139"; // Votre numéro avec l'indicatif
        
        // Petit délai pour laisser le temps au socket de s'initialiser
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phoneNumber);
                console.log(`\n\n👉 VOTRE CODE DE COUPLAGE : ${code}\n\n`);
            } catch (err) {
                console.error("Erreur lors de la demande du code :", err);
            }
        }, 5000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error instanceof Boom)?.output?.statusCode;
            if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                console.log("❌ Session invalide. Nettoyage...");
                if (fs.existsSync(authFolder)) {
                    fs.rmSync(authFolder, { recursive: true, force: true });
                }
                startBot();
            } else {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('✅ BOT CONNECTÉ ET PRÊT !');
        }
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe || msg.key.remoteJid.includes('@g.us')) return;

        const sender = msg.key.remoteJid;
        const messageTimestamp = msg.messageTimestamp;
        const now = Math.floor(Date.now() / 1000);
        if (now - messageTimestamp > 30) return;

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const input = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        console.log(`📩 Message de ${sender} : ${text}`);

        await delay(1000 + Math.random() * 1000);
        await sock.sendPresenceUpdate('composing', sender);
        await delay(2000 + Math.random() * 2000);

        let reponse = "";

        if (input.includes("bonjour") || input.includes("salut")) {
            reponse = "Bonjour 👩‍💻 ! Je suis Plasma, un bot creer par Christ. \n \n Comment puis-je vous aider ? 😊";
        } 
        else if (input.includes("prix") || input.includes("tarif") || input.includes("html") || input.includes("css") || input.includes("maquette")) {
            reponse = "Nos tarifs varient selon vos besoins 💸. Décrivez votre besoin📄, Christ vous répondra bientôt !";
        }
        else if (input.includes("competence") || input.includes("etude") || input.includes("programme") || input.includes("hacker")) {
            reponse = "Actuellement étudiant a l'IUT de Douala. Mon createur Christ (😆)est un passionné de tech et Developpeur Front-End junior. \n D'ailleurs il a recement travailler sur un projet de site de messagerie instantannée.";
        }
        else if (input.includes("site") || input.includes("messagerie")) {
            reponse = "Voici le lien du projet : https://chatapp-vlay.onrender.com/ . Laissez-lui vos avis ! 😊";
        }
        else {
            reponse = "Merci pour votre message ! \nChrist est actuellement occupé 👩‍💻, mais votre message a été pris en compte il vous répondra dès que possible. ";
        }

        await sock.sendMessage(sender, { text: reponse });
        await sock.sendPresenceUpdate('paused', sender);
    });
}

startBot().catch(err => console.error("Erreur critique:", err));

setInterval(() => {
    contactsRepondus.clear();
}, 24 * 60 * 60 * 1000);
