const { Telegraf, Markup } = require("telegraf");
//const https = require('https');
const fs = require("fs");
const axios = require("axios");
const imgConvert = require("image-convert");

const base_url = "https://api.telegram.org/bot";
const file_base_url = "https://api.telegram.org/file/bot";
var Bot = { token: "" };

var bot_file = fs.readFileSync("./bot.json");
Bot = JSON.parse(bot_file);
console.log(Bot);
const token = Bot.token;
const bot = new Telegraf(token, {
  polling: true,
  request: {
    //proxy: "http://{host}:{port}",
  },
});

//bot.use(Telegraf.log())

var dict = {};
var users = {
  id: {
    last_button: "",
    channels: [],
  },
};

whait_for_message = false;
whait_for_channel = false;
whait_for_caption = false;
message_list = [];
//sub_channels = ["@migrupoprueba"];

function MainKeyboard(ctx) {
  console.log(users);
  if (users[ctx.chat.id] == undefined) {
    users[ctx.chat.id] = {
      last_button: "start",
      channels: [],
    };
  } else users[ctx.chat.id].last_button = "start";
  SaveConfig();
  whait_for_message = false;
  whait_for_channel = false;
  whait_for_caption = false;
  const buttons = {
    reply_markup: {
      keyboard: [
        ["📝 Make New Post to Subscribers"],
        ["⚙ Settings"],
        ["⭐️ Rate us", "⁉ About"],
      ],
      resize_keyboard: true,
      selective: true,
      one_time_keyboard: true,
    },
  };
  return buttons;
}

function SettingsKeyboard(ctx) {
  users[ctx.chat.id].last_button = "⚙ Settings";
  SaveConfig();
  return {
    reply_markup: {
      keyboard: [["Channels"], ["🔙 Go Back"]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  };
}

function ChannelsKeyboard(ctx) {
  users[ctx.chat.id].last_button = "Channels";
  SaveConfig();
  return {
    reply_markup: {
      keyboard: [["Add Channel"], ["🔙 Go Back"]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  };
}

function SaveConfig() {
  var data = JSON.stringify(users);
  fs.writeFile("./config.json", data, function (error) {
    if (error) {
      console.log("There has been an error saving your configuration data.");
      console.log(err.message);
      return;
    }
    console.log("Configuration saved successfully.");
  });
}

bot.start((ctx) => {
  console.log("---------start---------");
  message_list = [];
  dict = {};
  ctx.telegram.sendMessage(ctx.chat.id, "Main Menu", MainKeyboard(ctx));
});

bot.hears("📝 Make New Post to Subscribers", async (ctx) => {
  console.log("---------📝 Make New Post to Subscribers---------");
  if (users[ctx.chat.id].last_button != "start") return;
  users[ctx.chat.id].last_button = ctx.match.input;
  SaveConfig();
  message_list = [];
  dict = {};
  whait_for_message = true;
  return await ctx.telegram.sendMessage(
    ctx.chat.id,
    `Let's start!


You can send one or more messages to your users including text, pictures, videos or any other file type.
    
Send everything that you want to attach to this post. After that you can test how your post looks like and send it out to your users.`,
    {
      parse_mode: "Markdown",
      disable_web_page_preview: true,
      ...Markup.keyboard([["End Post"], ["Cancel Post"]])
        .oneTime()
        .resize(),
    }
  );
});

bot.hears("Cancel Post", async (ctx) => {
  console.log("---------Cancel post---------");
  if (users[ctx.chat.id] == undefined || users[ctx.chat.id] == "start") {
    return ctx.reply("Main Menu", MainKeyboard(ctx));
  }
  if (users[ctx.chat.id].last_button != "📝 Make New Post to Subscribers")
    return;

  return await ctx.telegram.sendMessage(
    ctx.chat.id,
    "Canceled Post",
    MainKeyboard(ctx)
  );
});

bot.hears("End Post", async (ctx) => {
  console.log("---------End post---------");
  if (users[ctx.chat.id].last_button != "📝 Make New Post to Subscribers")
    return;

  if (!whait_for_message) return;
  whait_for_message = false;

  //console.log(message_list);
  if (message_list.length == 0) {
    return await ctx.reply("Post is empty", MainKeyboard(ctx));
  }
  console.log(users[ctx.chat.id]);

  var keyboard = [];
  for (var i = 0; i < users[ctx.chat.id].channels.length; i++) {
    keyboard.push([
      { text: users[ctx.chat.id].channels[i], callback_data: i + 1 },
    ]);
  }
  var buttons = {
    reply_markup: JSON.stringify({
      inline_keyboard: keyboard,
    }),
  };

  //console.log(keyboard);
  await ctx.reply(
    `Ended post

Select the group where you are going to post`,
    buttons
  );

  return await ctx.telegram.sendMessage(
    ctx.chat.id,
    "Your Menu:",
    MainKeyboard(ctx)
  );
});

bot.hears("⭐️ Rate us", async (ctx) => {
  console.log("---------⭐️ Rate us---------");
});

bot.hears("⁉ About", async (ctx) => {
  console.log("---------⁉ About---------");
  if (users[ctx.chat.id] == undefined || users[ctx.chat.id] == "start") {
    return ctx.reply("Main Menu", MainKeyboard(ctx));
  }
  return await ctx.replyWithHTML(
    `<b>What can this bot do?</b>

✅ Extract the media file in the forwarded message.

✅ Forward a post with a different caption.

✅ Send message to your subscribers.

Reload the Menu by pressing /start`,
    MainKeyboard(ctx)
  );
});

bot.hears("⚙ Settings", async (ctx) => {
  console.log("---------⚙ Settings---------");
  if (users[ctx.chat.id].last_button != "start" && users[ctx.chat.id].last_button != "📝 Make New Post to Subscribers")
    return;
  return await ctx.reply("🔧 Bot Settings", SettingsKeyboard(ctx));
});

bot.hears("Channels", async (ctx) => {
  console.log("---------Channels---------");
  channels = users[ctx.chat.id].channels;
  last_button = users[ctx.chat.id].last_button;
  let keyboard = [];
  if (last_button != "⚙ Settings") return;

  await ctx.telegram.sendMessage(
    ctx.chat.id,
    `You can automate posting from your bot to a Telegram channel.

Press Add Channel to do that.`,
    ChannelsKeyboard(ctx)
  );

  if (channels.length == 0) return;
  for (var i = 0; i < channels.length; i++) {
    var channel = channels[i];
    await ctx.telegram.getChat(channel).then((response) => {
      //console.log(response);
      title = response.title;
      console.log(response.title);
      keyboard.push([
        {
          text: title,
          callback_data: `rm_${channel}`,
        },
      ]);
    });
  }

  var buttons = {
    reply_markup: JSON.stringify({
      inline_keyboard: keyboard,
    }),
  };

  ctx.reply(
    `Your channels.

Select channel for remove subscription.`,
    buttons
  );
});

bot.hears("Add Channel", async (ctx) => {
  console.log("---------Add Channel---------");
  channels = users[ctx.chat.id].channels;
  last_button = users[ctx.chat.id].last_button;
  if (last_button != "Channels") return;
  users[ctx.chat.id].last_button = "Add Channel";
  SaveConfig();
  whait_for_channel = true;
  return await ctx.telegram.sendMessage(
    ctx.chat.id,
    `Send your channel name or a link to it.

Example: @channelname or http://telegram.org/channelname
    
Note: You must add your bot as an administrator of the channel to be able to post to that channel.
    
You can add bot as an administrator in the channel settings.`,
    {
      parse_mode: "Markdown",
      disable_web_page_preview: true,
      ...Markup.keyboard([["Cancel"]])
        .oneTime()
        .resize(),
    }
  );
});

bot.hears("Cancel", async (ctx) => {
  console.log("---------Cancel---------");
  console.log(users[ctx.chat.id]);
  if (users[ctx.chat.id] == undefined || users[ctx.chat.id] == "start") {
    return ctx.reply("Main Menu", MainKeyboard(ctx));
  }
  last_button = users[ctx.from.id].last_button;
  if (last_button != "Add Channel") return;
  await ctx.reply("Your Menu:", ChannelsKeyboard(ctx));
});

bot.hears("🔙 Go Back", async (ctx) => {
  console.log("---------🔙 Go Back---------");
  if (users[ctx.chat.id] == undefined)
    return ctx.reply("Main Menu", MainKeyboard(ctx));
  if (users[ctx.chat.id].last_button == "Channels")
    return await ctx.reply("Your Menu", SettingsKeyboard(ctx));

  if (users[ctx.chat.id].last_button != "⚙ Settings") return;
  await ctx.reply("Main Menu", MainKeyboard(ctx));
});

bot.action("plain", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageCaption(
    "Plain",
    Markup.inlineKeyboard([Markup.button.callback("Plain", "plain")])
  );
});

bot.action(/.+/, (ctx) => {
  console.log("---------.+---------");
  if (
    users[ctx.chat.id].last_button == "Channels" &&
    ctx.match[0].match(/^crs_/)
  ) {
    let channel = ctx.match[0].substring(4);
    //console.log(channel);
    index = users[ctx.chat.id].channels.indexOf(channel);
    users[ctx.chat.id].channels.splice(index, 1);
    SaveConfig();
    return ctx.editMessageText(
      `${channel} has been removed from subscription.`
    );
  }

  if (
    users[ctx.chat.id].last_button == "Channels" &&
    ctx.match[0].match(/^rm_/)
  ) {
    let channel = ctx.match[0].substring(3);
    console.log(channel);
    if (users[ctx.chat.id].channels.indexOf(channel) == -1) return;
    return ctx.reply(`Confirm to remove subscription?`, {
      ...Markup.inlineKeyboard([
        Markup.button.callback("Yes", `crs_${channel}`),
      ])
        .oneTime()
        .resize(),
    });
  }

  if (ctx.match[0][0] == "r") {
    return ctx.deleteMessage(ctx.match[0].substring(1)).then(() => {
      whait_for_caption = false;
      last_message_id = ctx.match[0].substring(1);
      message_list.forEach((element) => {
        if (element.id == last_message_id) {
          message_list.splice(message_list.indexOf(element), 1);
          return;
        }
      });
    });
  }

  if (ctx.match[0][0] == "c") {
    ctx.reply("Ok, Send me the new caption for this message.").then(() => {
      whait_for_caption = true;
      last_message_id = ctx.match[0].substring(1);
      change_caption_id = last_message_id;
    });
    return;
  }

  if (ctx.match[0][0] == "e") {
    ctx.reply("Ok, the caption for this message is empty.").then(() => {
      whait_for_caption = false;
      last_message_id = ctx.match[0].substring(1);
      message_list.forEach((element) => {
        if (element.id == last_message_id) {
          element.caption = "";
          return;
        }
      });
    });
    return;
  }

  if (isNaN(ctx.match[0])) return;
  index = parseInt(ctx.match[0]) - 1;
  if (index >= users[ctx.chat.id].channels.length) return;

  console.log(message_list);
  message_list.forEach((element) => {
    if (!isNaN(element)) {
      inputMedia = dict[element];
      return ctx.telegram
        .sendMediaGroup(users[ctx.chat.id].channels[index], inputMedia)
        .catch((error) => {
          ctx.reply(error.description);
          //assert.isNotOk(error, "Promise error");
          done();
        });
    } else {
      if (element.type == "photo")
        return ctx.telegram
          .sendPhoto(users[ctx.chat.id].channels[index], element.media, {
            caption: element.caption,
            media_group_id: element.group_id,
          })
          .catch((error) => {
            ctx.reply(error.description);
            //assert.isNotOk(error, "Promise error");
            done();
          });
      if (element.type == "video")
        return ctx.telegram
          .sendVideo(users[ctx.chat.id].channels[index], element.media, {
            caption: element.caption,
            media_group_id: element.group_id,
          })
          .catch((error) => {
            ctx.reply(error.description);
            //assert.isNotOk(error, "Promise error");
            done();
          });
      if (element.type == "audio")
        return ctx.telegram
          .sendAudio(users[ctx.chat.id].channels[index], element.media, {
            caption: element.caption,
            media_group_id: element.group_id,
          })
          .catch((error) => {
            ctx.reply(error.description);
            //assert.isNotOk(error, "Promise error");
            done();
          });
      if (element.type == "document")
        return ctx.telegram
          .sendDocument(users[ctx.chat.id].channels[index], element.media, {
            caption: element.caption,
            media_group_id: element.group_id,
          })
          .catch((error) => {
            ctx.reply(error.description);
            //assert.isNotOk(error, "Promise error");
            done();
          });
      if (element.type == "text")
        return ctx.telegram
          .sendMessage(users[ctx.chat.id].channels[index], element.text)
          .catch((error) => {
            ctx.reply(error.description);
            //assert.isNotOk(error, "Promise error");
            done();
          });
      //ctx.reply(element)
    }
  });
  message_list = [];
  dict = {};
  return ctx.answerCbQuery(`Ok, Your Post is done!`);
});

bot.hears(/^(@[^\s]+|https?:\/\/(telegram.org|t.me)\/[^\s]+)/, (ctx) => {
  console.log("---------whait for channel---------");
  if (whait_for_channel) {
    channel = ctx.match[0];
    if (users[ctx.chat.id].channels == undefined)
      users[ctx.chat.id].channels = [];
    var match1 = /^https?.+org\//;
    var match2 = /^https?.+me\//;
    if (ctx.match[0].match(match1)) {
      channel =
        "@" + ctx.match[0].substring(ctx.match[0].match(match1)[0].length);
    } else if (ctx.match[0].match(match2)) {
      channel = "@" + ctx.match[0].substring(ctx.match[0].match(match2)[0].length);
    }

    ctx.telegram.getChat(channel).then((response) => {
      console.log(response);
      channel_id = response.id;

      if (users[ctx.chat.id].channels.indexOf(channel_id) >= 0) {
        return ctx.reply("The channel already exists.", ChannelsKeyboard(ctx));
      }
      ctx.telegram
        .sendMessage(
          channel_id,
          bot.botInfo.first_name + " has subscribe this channel for post."
        )
        .then(() => {
          users[ctx.chat.id].channels.push(channel_id);
          SaveConfig();
          ctx.reply("Channel added successfull", ChannelsKeyboard(ctx));
          whait_for_channel = false;
        })
        .catch((error) => {
          ctx.reply(error.description, ChannelsKeyboard(ctx));
        });
    });
  }
});

bot.hears(/(^\/ouo[ ]+https?:\/\/[^\s]+)/, async (ctx) => {
  console.log("---------ouo.io---------");
  //console.log(ctx.message.text);
  url = ctx.message.text.substring(4).trim();
  //ctx.reply(url)
  console.time("axios");
  try {
    const response = await axios.get(`http://ouo.io/api/zZ5cofjT?s=${url}`);

    //console.log(response.data);
    await ctx.reply(response.data);
    console.timeEnd("axios");
  } catch (error) {
    console.log(error);
  }

  // const options = {
  //   hostname: "ouo.io",
  //   port: 443,
  //   path: `/api/zZ5cofjT?s=${ctx.message.text}`,
  //   method: "GET",
  // };

  // console.time("https");
  // const req = https.request(options, (res) => {
  //   //console.log(`statusCode: ${res.statusCode}`)
  //   var dataQueue = "";
  //   res.on("data", function (d) {
  //     dataQueue += d;
  //   });
  //   res.on("end", function () {
  //     console.log(dataQueue);
  //     ctx.reply(dataQueue);
  //     console.timeEnd("https");
  //   });
  //   req.on("error", (error) => {
  //     console.error(error);
  //   });
  // });
  // req.end();
});

bot.on("text", async (ctx) => {
  console.log("---------text---------");
  //console.log(ctx.message.text);
  if (whait_for_caption) {
    whait_for_caption = false;
    message_list.forEach((element) => {
      if (!isNaN(element)) {
        console.log(dict[element]);
        dict[element].forEach((i) => {
          i.caption = i.caption != undefined ? ctx.message.text : undefined;
        });
      } else if (element.id == change_caption_id) {
        element.caption = ctx.message.text;
      }
      return ctx.reply("The caption has been changed");
    });
    return;
  }
  if (whait_for_message) {
    message_list.push({ type: "text", text: ctx.message.text });
  }
  console.log(message_list);
});

bot.on("message", async (ctx) => {
  console.log("---------message---------");
  console.log(ctx.message);
  if (users[ctx.chat.id].last_button == "start") {
    users[ctx.chat.id].last_button = "📝 Make New Post to Subscribers";
    SaveConfig();
    message_list = [];
    dict = {};
    whait_for_message = true;
    await ctx.telegram.sendMessage(ctx.chat.id, `Your Menu:`, {
      ...Markup.keyboard([["End Post"], ["Cancel Post"]])
        .oneTime()
        .resize(),
    });
  } else if (
    users[ctx.chat.id].last_button == "Add Channel" &&
    whait_for_channel
  ) {
    if (ctx.message.forward_from_chat != undefined)
      ctx.telegram
        .getChat(ctx.message.forward_from_chat.id)
        .then((response) => {
          console.log(response);
          channel_id = response.id;

          if (users[ctx.chat.id].channels.indexOf(channel_id) >= 0) {
            return ctx.reply(
              "The channel already exists.",
              ChannelsKeyboard(ctx)
            );
          }
          return ctx.telegram
            .sendMessage(
              channel_id,
              bot.botInfo.first_name + " has subscribe this channel for post."
            )
            .then(() => {
              users[ctx.chat.id].channels.push(channel_id);
              SaveConfig();
              ctx.reply("Channel added successfull", ChannelsKeyboard(ctx));
              whait_for_channel = false;
            })
            .catch((error) => {
              ctx.reply(error.description, ChannelsKeyboard(ctx));
            });
        });
  }
  if (users[ctx.chat.id].last_button != "start" && !whait_for_message) return;
  //console.log(ctx.message);
  message_id = ctx.message.message_id;
  message = ctx.message;
  message_type =
    typeof message.photo == "object"
      ? "photo"
      : typeof message.video == "object"
        ? "video"
        : typeof message.audio == "object"
          ? "audio"
          : typeof message.document == "object"
            ? "document"
            : "text";
  file_id =
    message_type == "photo"
      ? message.photo[1].file_id
      : message_type == "video"
        ? message.video.file_id
        : message_type == "audio"
          ? message.audio.file_id
          : message_type == "document"
            ? message.document.file_id
            : undefined;
  caption = message.caption;
  caption_entities = message.caption_entities;
  media_group_id = ctx.message.media_group_id;

  var msg = {
    id: message_id,
    media_group_id: media_group_id,
    type: message_type,
    media: file_id,
    caption: caption,
    caption_entities: caption_entities,
  };

  console.log(msg);
  if (msg.media != undefined)
    bot.telegram.getFile(msg.media).then((response) => {
      console.log(response);
      console.log(`${file_base_url}${token}/${response.file_path}`);
    });
  if (media_group_id != undefined) {
    if (dict[media_group_id] == undefined) {
      dict[media_group_id] = [];
    }
    dict[media_group_id].push(msg);
    if (
      message_list.length == 0 ||
      (message_list.length > 0 &&
        message_list[message_list.length - 1] != media_group_id)
    ) {
      message_list.push(media_group_id);
      if (msg.type != "text") {
        return await ctx.reply(
          "Recived",
          Markup.inlineKeyboard([
            [
              Markup.button.callback("Change Caption", `c${message_id}`),
              Markup.button.callback("Remove Caption", `e${message_id}`),
            ],
            [Markup.button.callback("Remove from post", `r${message_id}`)],
          ])
        );
      }
    }
  } else {
    message_list.push(msg);
    console.log(message_list);
    if (msg.type != "text") {
      return await ctx.reply(
        "Recived",
        Markup.inlineKeyboard([
          [
            Markup.button.callback("Change Caption", `c${message_id}`),
            Markup.button.callback("Remove Caption", `e${message_id}`),
          ],
          [Markup.button.callback("Remove from post", `r${message_id}`)],
        ])
      );
    }
  }

  console.log(message_list);
});

bot.launch().then((response) => {
  var config = fs.readFileSync("./config.json");
  try {
    users = JSON.parse(config);
    console.dir(users);
  } catch (error) {
    console.log("There has been an error parsing your JSON.");
    console.log(error);
  }
  //console.log(users);
});

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
