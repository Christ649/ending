const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const http = require('http');
const fs = require('fs');

// Serveur pour Render
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
        syncFullHistory: false,            // Ne pas charger tout l'historique
        shouldSyncHistoryMessage: () => false, // BLOQUE l'historique pour éviter les bugs
        linkPreviewImageThumbnailWidth: 192,
        markOnlineOnConnect: true
    });

    if (!sock.authState.creds.registered) {
        console.log("=== CONNEXION REQUISE ===");
        const phoneNumber = "237689438139";
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phoneNumber);
                console.log(`\n\n👉 VOTRE CODE DE COUPLAGE : ${code}\n\n`);
            } catch (err) {
                console.error("Erreur pairing code:", err);
            }
        }, 5000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connexion perdue, reconnexion...', shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('✅ BOT CONNECTÉ ET PRÊT (HISTORIQUE IGNORÉ) !');
        }
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe || msg.key.remoteJid.includes('@g.us')) return;

        const sender = msg.key.remoteJid;
        if (sender.includes('lid') || sender.includes('broadcast') || contactsRepondus.has(sender)) return;

        // Augmentation de la marge à 120 secondes (2 minutes) pour Render
        const messageTimestamp = msg.messageTimestamp;
        const now = Math.floor(Date.now() / 1000);
        if (now - messageTimestamp > 120) return; 

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const input = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        console.log(`📩 Nouveau message de ${sender}`);

        let reponse = "";
        if (input.includes("bonjour") || input.includes("salut")) {
            reponse = "Bonjour 👩‍💻 ! Je suis Plasma, un bot créé par Christ. \n \n Comment puis-je vous aider ? 😊";
        } else if (input.includes("prix") || input.includes("tarif") || input.includes("html") || input.includes("css") || input.includes("maquette")) {
            reponse = "Nos tarifs varient selon vos besoins 💸. Décrivez votre besoin📄, Christ vous répondra bientôt !";
        } else if (input.includes("competence") || input.includes("etude") || input.includes("programme") || input.includes("hacker")) {
            reponse = "Actuellement étudiant à l'IUT de Douala. Mon créateur Christ est un passionné de tech et Développeur Front-End junior.";
        } else if (input.includes("site") || input.includes("messagerie")) {
            reponse = "Voici le lien du projet : https://onrender.com . Laissez-lui vos avis ! 😊";
        } else {
            reponse = "Merci pour votre message ! \nChrist est actuellement occupé 👩‍💻, il vous répondra dès que possible.";
        }

        contactsRepondus.add(sender);
        await sock.sendPresenceUpdate('composing', sender);
        await delay(3000);
        await sock.sendMessage(sender, { text: reponse });
    });
}

startBot().catch(err => console.error("Erreur critique:", err));

// Nettoyage de la mémoire toutes les 24h
setInterval(() => contactsRepondus.clear(), 24 * 60 * 60 * 1000);
