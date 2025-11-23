/**
 * FULL Discord Bot - GUARD + TICKET + AUTOROLE + VOICE + WHITELIST
 * Discord.js v14
 */

const { Client, GatewayIntentBits, Partials, Routes, REST, Events, ChannelType, PermissionsBitField, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice'); // ses için
require("dotenv").config();
const config = require("./config.json");

//-------------------------------------------------------------
// CLIENT
//-------------------------------------------------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildIntegrations
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

//-------------------------------------------------------------
// SENDLOG
//-------------------------------------------------------------
async function sendLog(guild, logName, embed) {
  try {
    const fetchedChannels = await guild.channels.fetch();
    let category = fetchedChannels.find(c => c.type === ChannelType.GuildCategory && c.name === config.logsCategoryName);
    if(!category) category = await guild.channels.create({ name: config.logsCategoryName, type: ChannelType.GuildCategory });

    let channel = fetchedChannels.find(c => c.parentId === category.id && c.name === logName);
    if(!channel) channel = await guild.channels.create({ name: logName, type: ChannelType.GuildText, parent: category.id });

    if(channel) await channel.send({ embeds: [embed] });
  } catch(err){
    console.error(`Log gönderilemedi: ${logName}`, err);
  }
}

//-------------------------------------------------------------
// WHITELIST
//-------------------------------------------------------------
if(!config.whitelist) config.whitelist = [];

//-------------------------------------------------------------
// REGISTER SLASH COMMANDS
//-------------------------------------------------------------
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder().setName("ticket").setDescription("Ticket menüsü oluşturur"),
    new SlashCommandBuilder()
      .setName("ticket-kur")
      .setDescription("Ticket paneli kurar")
      .addChannelOption(o =>
        o.setName("kanal")
         .setDescription("Ticket panelinin gönderileceği kanal")
         .setRequired(true)
      )
      .addStringOption(o =>
        o.setName("mesaj")
         .setDescription("Ticket panelindeki mesaj")
         .setRequired(true)
      )
      .addStringOption(o =>
        o.setName("resim")
         .setDescription("Ticket embed fotoğraf URL (opsiyonel)")
         .setRequired(false)
      ),
    new SlashCommandBuilder().setName("log-kur").setDescription("Log kanallarını kurar"),
    new SlashCommandBuilder().setName("guvenli-liste-ekle").setDescription("Güvenli listeye ekle").addUserOption(o => o.setName("kullanici").setDescription("Kullanıcı").setRequired(true)),
    new SlashCommandBuilder().setName("guvenli-liste-kaldir").setDescription("Güvenli listeden çıkar").addUserOption(o => o.setName("kullanici").setDescription("Kullanıcı").setRequired(true)),
    new SlashCommandBuilder().setName("guvenli-liste-goruntule").setDescription("Güvenli listeyi göster"),
    new SlashCommandBuilder().setName("etkinlik").setDescription("Etkinlik oluştur")
      .addStringOption(o => o.setName("isim").setDescription("Etkinlik ismi").setRequired(true))
      .addIntegerOption(o => o.setName("max").setDescription("Maksimum kişi").setRequired(false)),
    new SlashCommandBuilder().setName("set-presence").setDescription("Bot presence ayarla").addStringOption(o => o.setName("text").setDescription("Presence yazısı").setRequired(true))
  ].map(c => c.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, config.GUILD_ID), { body: commands });
  console.log("✅ Slash komutları yüklendi");
}

//-------------------------------------------------------------
// INTERACTIONS
//-------------------------------------------------------------
client.on(Events.InteractionCreate, async interaction => {
  try {
    if(interaction.isChatInputCommand()){
      await interaction.deferReply({ ephemeral:true });
      const member = interaction.member;
      const canUse = config.commandRoleId ? member.roles.cache.has(config.commandRoleId) || member.permissions.has(PermissionsBitField.Flags.Administrator) : member.permissions.has(PermissionsBitField.Flags.Administrator);
      if(!canUse) return interaction.editReply({ content:"Bu komutu kullanmaya yetkin yok." });

      const cmd = interaction.commandName;

      // ------------------ TICKET-KUR ------------------
      if(cmd === "ticket-kur"){
        const kanal = interaction.options.getChannel("kanal");
        const mesaj = interaction.options.getString("mesaj");
        const resim = interaction.options.getString("resim");

        const embed = new EmbedBuilder()
          .setTitle("🎫 Ticket Paneli")
          .setDescription(mesaj)
          .setColor("Blue")
          .setImage(resim || null)
          .setTimestamp();

        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId("ticket-olustur")
              .setLabel("🎟️ Ticket Aç")
              .setStyle(ButtonStyle.Primary)
          );

        await kanal.send({ embeds: [embed], components: [row] });
        await interaction.editReply({ content: `✅ Ticket paneli başarıyla <#${kanal.id}> kanalına kuruldu.` });

        // Log gönder
        await sendLog(interaction.guild, "ticket-log", new EmbedBuilder()
          .setTitle("Ticket Panel Kuruldu")
          .setDescription(`Ticket paneli <#${kanal.id}> kanalına kuruldu`)
          .setColor("Green")
          .setTimestamp()
        );
      }

      // ------------------ LOG-KUR ------------------
      if(cmd === "log-kur"){
        const guild = interaction.guild;
        let category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === config.logsCategoryName);
        if(!category) category = await guild.channels.create({ name:config.logsCategoryName, type:ChannelType.GuildCategory });

        const logs = ["welcome-log","byby-log","ban-log","unban-log","perm-verme-log","perm-alma-log","rol-acma-log","rol-update-log","rol-silme-log","kanal-acma-log","kanal-update-log","kanal-silme-log","ticket-log","ticket-islem-log"];
        for(const name of logs){
          if(!guild.channels.cache.find(c=>c.name===name && c.parentId===category.id)){
            await guild.channels.create({ name, type:ChannelType.GuildText, parent:category.id });
          }
        }
        return interaction.editReply({ content:"📁 Log sistemi kuruldu" });
      }

      // ------------------ WHITELIST ------------------
      if(cmd === "guvenli-liste-ekle"){
        const user = interaction.options.getUser("kullanici");
        if(!config.whitelist.includes(user.id)) config.whitelist.push(user.id);
        return interaction.editReply({ content:`${user.tag} güvenli listeye eklendi.` });
      }
      if(cmd === "guvenli-liste-kaldir"){
        const user = interaction.options.getUser("kullanici");
        config.whitelist = config.whitelist.filter(id=>id!==user.id);
        return interaction.editReply({ content:`${user.tag} güvenli listeden çıkarıldı.` });
      }
      if(cmd === "guvenli-liste-goruntule"){
        if(config.whitelist.length===0) return interaction.editReply({ content:`Whitelist boş.` });
        const list = config.whitelist.map(id=>`<@${id}> (${id})`).join(`\n`);
        return interaction.editReply({ content:`Whitelist:\n${list}` });
      }

      // ------------------ ETKİNLİK ------------------
      if(cmd === "etkinlik"){
        const isim = interaction.options.getString("isim");
        const max = interaction.options.getInteger("max")||0;
        const embed = new EmbedBuilder().setTitle(`🎉 Etkinlik: ${isim}`).setDescription(`Maksimum: ${max} kişi`).setColor("Blue").setTimestamp();
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`etkinlik-join`).setLabel(`✅ Katıl`).setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`etkinlik-leave`).setLabel(`❌ Çık`).setStyle(ButtonStyle.Danger)
        );
        await interaction.editReply({ embeds:[embed], components:[row] });
      }
    }

    // ------------------ BUTTONS ------------------
    if(interaction.isButton()){
      // Ticket Oluştur
      if(interaction.customId === "ticket-olustur"){
        try {
          const guild = interaction.guild;
          const kanalAdi = `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, "");
          const mevcut = guild.channels.cache.find(c => c.name === kanalAdi);
          if(mevcut) return interaction.reply({ content: "❌ Zaten açık bir ticket'in var!", ephemeral: true });

          let ticketCategory = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === "Tickets");
          if(!ticketCategory) ticketCategory = await guild.channels.create({ name: "Tickets", type: ChannelType.GuildCategory });

          const ticketChannel = await guild.channels.create({
            name: kanalAdi,
            type: ChannelType.GuildText,
            parent: ticketCategory.id,
            permissionOverwrites: [
              { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
              { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ]
          });

          const embed = new EmbedBuilder()
            .setTitle("🎫 Ticket")
            .setDescription(`${interaction.user} ticket açtı! Yetkililer en kısa sürede ilgilenecektir.`)
            .setColor("Blue")
            .setTimestamp();

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("ticket-kapat").setLabel("❌ Kapat").setStyle(ButtonStyle.Danger)
          );

          await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [row] });
          await interaction.reply({ content: `✅ Ticket oluşturuldu: <#${ticketChannel.id}>`, ephemeral: true });

          await sendLog(guild, "ticket-islem-log", new EmbedBuilder()
            .setTitle("Ticket Açıldı")
            .setDescription(`${interaction.user.tag} tarafından ticket açıldı: <#${ticketChannel.id}>`)
            .setColor("Green")
            .setTimestamp()
          );

        } catch(err){
          console.error("Ticket oluşturma hatası:", err);
          if(interaction.deferred || interaction.replied){
            await interaction.editReply({ content: "❌ Ticket oluşturulurken hata oluştu." });
          } else {
            await interaction.reply({ content: "❌ Ticket oluşturulurken hata oluştu.", ephemeral: true });
          }
        }
      }

      // Ticket Kapat
      if(interaction.customId === "ticket-kapat"){
        try {
          const channel = interaction.channel;
          await interaction.reply({ content: "✅ Ticket 5 saniye içinde kapatılacak.", ephemeral: true });
          setTimeout(async () => {
            await channel.delete().catch(console.error);
          }, 5000);
        } catch(err){
          console.error("Ticket kapatma hatası:", err);
        }
      }

      // Etkinlik join/leave
      if(interaction.message.embeds.length && interaction.message.embeds[0].title.startsWith('🎉 Etkinlik')){
        let desc = interaction.message.embeds[0].description;
        let users = desc.match(/<@\d+>/g)||[];
        if(interaction.customId==='etkinlik-join'){
          if(!users.includes(`<@${interaction.user.id}>`)) users.push(`<@${interaction.user.id}>`);
        } else if(interaction.customId==='etkinlik-leave'){
          users = users.filter(u=>u!==`<@${interaction.user.id}>`);
        }
        const newEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setDescription(`Maksimum: ${desc.split('\n')[0].replace('Maksimum: ','')} kişi\nKatılanlar:\n${users.join('\n')}`);
        await interaction.update({ embeds:[newEmbed] });
      }
    }

  } catch(err){
    console.error(err);
    if(interaction.deferred || interaction.replied){
      await interaction.editReply({ content:"Komut sırasında hata oluştu." });
    } else {
      await interaction.reply({ content:"Komut sırasında hata oluştu.", ephemeral:true });
    }
  }
});

//-------------------------------------------------------------
// SUNUCU KATILIM / AYRILMA + OTOROL
//-------------------------------------------------------------
client.on(Events.GuildMemberAdd, async member => {
  try {
    if(config.autorole){
      const role = member.guild.roles.cache.get(config.autorole);
      if(role) await member.roles.add(role);
    }
    const embed = new EmbedBuilder()
      .setTitle("🎉 Yeni Katılım")
      .setDescription(`${member} sunucuya katıldı${config.autorole ? ` ve rol verildi` : ""}`)
      .setColor("Green")
      .setTimestamp();
    await sendLog(member.guild, "welcome-log", embed);
  } catch(err){ console.error("Otorol hatası:", err); }
});

client.on(Events.GuildMemberRemove, async member => {
  const embed = new EmbedBuilder()
    .setTitle("🚪 Sunucudan Ayrıldı")
    .setDescription(`${member.user.tag} sunucudan ayrıldı`)
    .setColor("Red")
    .setTimestamp();
  await sendLog(member.guild, "byby-log", embed);
});

//-------------------------------------------------------------
// BOT READY + SES KANALI BAĞLANMA
//-------------------------------------------------------------
client.once(Events.ClientReady, async () => {
  console.log(`Bot aktif: ${client.user.tag}`);
  await registerCommands();

  try {
    const guild = await client.guilds.fetch(config.GUILD_ID);
    const channel = await guild.channels.fetch("1441569870645956708"); // SES KANALI ID

    if(channel && channel.type === ChannelType.GuildVoice){
      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true,
        selfMute: true
      });

      await entersState(connection, VoiceConnectionStatus.Ready, 20000);
      console.log("✅ Bot ses kanalına bağlandı ve kendini sessize aldı.");
      connection.on('error', console.error);
    } else {
      console.log("❌ Ses kanalı bulunamadı veya geçerli değil.");
    }
  } catch(err){
    console.error("❌ Ses kanalına bağlanırken hata:", err);
  }
});

client.login(process.env.DISCORD_TOKEN);


client.login(process.env.DISCORD_TOKEN);
