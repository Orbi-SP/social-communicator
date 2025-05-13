import whatsapp from 'whatsapp-web.js';
const { Client, LocalAuth } = whatsapp;

import qrcode from 'qrcode-terminal';
import { MongoClient, ObjectId } from 'mongodb';

// === WHATSAPP ===
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

client.on('qr', (qr) => {
    console.log('Escaneie o QR code com seu WhatsApp:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Cliente WhatsApp está pronto!');
    startMongoPolling();
});

client.initialize();

// === MONGODB ===
const uri = 'mongodb://3.212.209.122:27017';
const dbName = 'savit';
const collectionName = 'users';

let lastCheckedId = null;

async function startMongoPolling() {
    const mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    const db = mongoClient.db(dbName);
    const collection = db.collection(collectionName);

    console.log(`Iniciando verificação de novos usuários a cada 5 segundos...`);

    setInterval(async () => {
        try {
            const query = lastCheckedId
                ? { _id: { $gt: new ObjectId(lastCheckedId) } }
                : {};

            const newUsers = await collection
                .find(query)
                .sort({ _id: 1 })
                .toArray();

            for (const user of newUsers) {
                const phone = user.phone;
                if (!phone) {
                    console.log('Usuário sem telefone. Ignorando...');
                    continue;
                }

                const numeroComDDD = phone.replace(/\D/g, '');
                const whatsappId = `${numeroComDDD}@c.us`;

                const mensagem = `Olá, ${user.name || 'usuário'}! Bem-vindo à nossa plataforma. Qualquer dúvida, estamos por aqui!`;

                try {
                    await client.sendMessage(whatsappId, mensagem);
                    console.log(`Mensagem enviada para ${phone}`);
                } catch (err) {
                    console.error(`Erro ao enviar mensagem para ${phone}:`, err);
                }

                lastCheckedId = user._id;
            }

        } catch (err) {
            console.error('Erro ao consultar novos usuários:', err);
        }
    }, 5000);
}
