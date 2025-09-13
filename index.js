const { Client, GatewayIntentBits, EmbedBuilder, ChannelType } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const TARGET_GUILD_ID = '1384230895556231210';
const TARGET_CHANNEL_ID = '1401138424991453205';
const EMBED_INTERVAL_MS = 1000; // 1 second (1000 ms)
const BONJOUR_INTERVAL_MS = 110000; // 1 millisecond (1 ms)

let pingCounts = {
    second: 0,
    minute: 0,
    hour: 0
};
let pingTimestamps = [];
let embedInterval;
let bonjourInterval;
let statsMessageId = null; // Pour stocker l'ID du message de statistiques

client.once('ready', async () => {
    console.log(`✅ Connecté en tant que ${client.user.tag}!`);
    console.log(`🆔 ID du bot: ${client.user.id}`);
    
    const guild = client.guilds.cache.get(TARGET_GUILD_ID);
    if (!guild) {
        console.error('❌ Serveur introuvable!');
        return;
    }
    console.log(`🏰 Serveur trouvé: ${guild.name}`);
    
    const targetChannel = guild.channels.cache.get(TARGET_CHANNEL_ID);
    if (!targetChannel) {
        console.error('❌ Canal cible introuvable!');
        return;
    }
    console.log(`📁 Canal cible trouvé: ${targetChannel.name}`);
    
    // Récupérer le dernier message de stats s'il existe
    try {
        const messages = await targetChannel.messages.fetch({ limit: 10 });
        const statsMessage = messages.find(msg => 
            msg.author.id === client.user.id && 
            msg.embeds.length > 0 && 
            msg.embeds[0].title === '📊 Statistiques des Pings'
        );
        
        if (statsMessage) {
            statsMessageId = statsMessage.id;
            console.log(`📋 Message de stats trouvé: ${statsMessageId}`);
        } else {
            console.log('📋 Aucun message de stats trouvé, création d\'un nouveau...');
        }
    } catch (error) {
        console.error('❌ Erreur lors de la récupération des messages:', error);
    }
    
    startPingTracking();
    startEmbedSending();
    startBonjourSending();
    
    console.log('🚀 Toutes les fonctions ont été démarrées!');
});

function startBonjourSending() {
    console.log('⏰ Programme "Bonjour" démarré (toutes les 2 minutes)');
    
    // Envoyer immédiatement un premier message
    sendBonjourToAllChannels();
    
    // Puis configurer l'intervalle
    bonjourInterval = setInterval(sendBonjourToAllChannels, BONJOUR_INTERVAL_MS);
}

async function sendBonjourToAllChannels() {
    try {
        const guild = client.guilds.cache.get(TARGET_GUILD_ID);
        if (!guild) return;

        const channels = guild.channels.cache.filter(channel => 
            channel.type === ChannelType.GuildText &&
            channel.id !== TARGET_CHANNEL_ID &&
            channel.permissionsFor(guild.members.me).has('SendMessages')
        );

        console.log(`📤 Envoi de "@everyone" dans ${channels.size} salons...`);
        
        for (const [channelId, channel] of channels) {
            try {
                await channel.send('@everyone');
                pingTimestamps.push(Date.now()); // Ajouter un timestamp pour le ping
                console.log(`✅ "@everyone" envoyé dans #${channel.name}`);
            } catch (error) {
                console.error(`❌ Erreur dans #${channel.name}: ${error.message}`);
            }
        }
        
    } catch (error) {
        console.error(`❌ Erreur générale: ${error.message}`);
    }
}

function startPingTracking() {
    console.log('📊 Tracking des pings démarré');
    
    setInterval(() => {
        pingCounts.second = pingTimestamps.filter(ts => Date.now() - ts < 1000).length;
    }, 1000);
    
    setInterval(() => {
        pingCounts.minute = pingTimestamps.filter(ts => Date.now() - ts < 60000).length;
    }, 1000);
    
    setInterval(() => {
        pingCounts.hour = pingTimestamps.filter(ts => Date.now() - ts < 3600000).length;
        pingTimestamps = pingTimestamps.filter(ts => Date.now() - ts < 3600000);
    }, 3600000);
}

function startEmbedSending() {
    console.log('📨 Programme d\'envoi d\'embed démarré (toutes les 5 minutes)');
    
    // Envoyer immédiatement un premier embed
    sendEmbed();
    
    // Puis configurer l'intervalle
    embedInterval = setInterval(sendEmbed, EMBED_INTERVAL_MS);
}

async function sendEmbed() {
    try {
        console.log('🔄 Tentative de mise à jour de l\'embed...');
        
        const guild = client.guilds.cache.get(TARGET_GUILD_ID);
        if (!guild) {
            console.error('❌ Serveur introuvable pour l\'embed');
            return;
        }

        const channel = guild.channels.cache.get(TARGET_CHANNEL_ID);
        if (!channel) {
            console.error('❌ Canal introuvable pour l\'embed');
            return;
        }

        console.log('✅ Toutes les vérifications sont OK');
        
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('📊 Ping Statistics')
            .setDescription('Here is the number of pings sent :')
            .addFields(
                { name: '🕐 Per second', value: `≈ ${pingCounts.second} pings/s`, inline: true },
                { name: '⏰ Per minute', value: `≈ ${pingCounts.minute} pings/min`, inline: true },
                { name: '⏳ Per hour', value: `≈ ${pingCounts.hour} pings/h`, inline: true },
                { name: '📈 Total', value: `${pingTimestamps.length} pings (1h)`, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'Statistics updated every minute' });

        console.log('📋 Embed créé, mise à jour en cours...');
        
        // Si nous avons un ID de message, essayez de le modifier
        if (statsMessageId) {
            try {
                const message = await channel.messages.fetch(statsMessageId);
                await message.edit({ embeds: [embed] });
                console.log('✅ Embed mis à jour avec succès!');
                return;
            } catch (error) {
                console.log('❌ Impossible de modifier le message, création d\'un nouveau...');
                statsMessageId = null; // Réinitialiser l'ID
            }
        }
        
        // Si nous n'avons pas d'ID de message ou si la modification a échoué
        const newMessage = await channel.send({ embeds: [embed] });
        statsMessageId = newMessage.id;
        console.log('✅ Nouvel embed envoyé avec succès!');
        
    } catch (error) {
        console.error(`❌ Erreur lors de la mise à jour de l'embed:`, error);
    }
}

// Gestion des erreurs
client.on('error', (error) => {
    console.error('❌ Erreur du client Discord:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Rejet non géré:', error);
});

// Connexion du bot
console.log('🔗 Connexion du bot...');
client.login('MTQxMzkxMDEwNzI5MjU2OTY4Mw.Gxd1Oz._vwiq2FZxEH7kawb5RwFN1rrnBOBd5LodnS9HI').catch(error => {
    console.error('❌ Erreur de connexion:', error);
});