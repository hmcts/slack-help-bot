const WATCHERS_BLOCK_ID = "thread_watchers";

function getThreadWatcherIds(blocks = []) {
  const watcherBlock = blocks.find(
    (block) => block.block_id === WATCHERS_BLOCK_ID,
  );
  const text = watcherBlock?.elements?.[0]?.text ?? "";
  return [...text.matchAll(/<@([A-Z0-9]+)>/g)].map((match) => match[1]);
}

function setThreadWatcherIds(blocks, watcherIds) {
  const watcherBlock = blocks.find(
    (block) => block.block_id === WATCHERS_BLOCK_ID,
  );
  if (!watcherBlock) {
    return blocks;
  }

  watcherBlock.elements = [
    {
      type: "mrkdwn",
      text:
        watcherIds.length > 0
          ? `:eyes: *Watching:* ${watcherIds.map((id) => `<@${id}>`).join(", ")}`
          : ":eyes: *Watching:* Nobody yet",
    },
  ];
  return blocks;
}

async function updateThreadWatchers(body, client, shouldWatch) {
  try {
    const blocks = structuredClone(body.message.blocks);
    const watcherIds = new Set(getThreadWatcherIds(blocks));

    if (shouldWatch) {
      watcherIds.add(body.user.id);
    } else {
      watcherIds.delete(body.user.id);
    }

    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: "New platform help request raised",
      blocks: setThreadWatcherIds(blocks, [...watcherIds]),
    });
  } catch (error) {
    console.error("Unable to update thread watchers", error);
  }
}

async function watchHelpRequestThread(body, client) {
  await updateThreadWatchers(body, client, true);
}

async function unwatchHelpRequestThread(body, client) {
  await updateThreadWatchers(body, client, false);
}

async function notifyThreadWatchers({ event, rootMessage, client }) {
  const watcherIds = getThreadWatcherIds(rootMessage.blocks).filter(
    (watcherId) => watcherId !== event.user,
  );

  if (watcherIds.length === 0) {
    return;
  }

  const threadPermalink = (
    await client.chat.getPermalink({
      channel: event.channel,
      message_ts: event.thread_ts,
    })
  ).permalink;

  await Promise.all(
    watcherIds.map(async (watcherId) => {
      try {
        const conversation = await client.conversations.open({
          users: watcherId,
        });
        await client.chat.postMessage({
          channel: conversation.channel.id,
          text: `New reply from <@${event.user}> in a help request you are watching: <#${event.channel}>`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `:eyes: <@${event.user}> replied in a help request you are watching.`,
              },
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "View thread",
                    emoji: true,
                  },
                  url: threadPermalink,
                },
              ],
            },
          ],
        });
      } catch (error) {
        console.error(`Unable to notify thread watcher ${watcherId}`, error);
      }
    }),
  );
}

module.exports = {
  getThreadWatcherIds,
  setThreadWatcherIds,
  watchHelpRequestThread,
  unwatchHelpRequestThread,
  notifyThreadWatchers,
};
