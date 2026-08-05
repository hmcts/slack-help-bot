const WATCHERS_BLOCK_ID = "thread_watchers";
const WATCH_BUTTON_ACTION_IDS = [
  "manage_help_request_thread_watch",
  "watch_help_request_thread",
];

function getWatchButton(blocks = []) {
  return blocks
    .flatMap((block) => block.elements ?? [])
    .find((element) => WATCH_BUTTON_ACTION_IDS.includes(element.action_id));
}

function getThreadWatcherIds(blocks = []) {
  const watchButton = getWatchButton(blocks);

  try {
    const watcherIds = JSON.parse(watchButton?.value ?? "");
    if (
      Array.isArray(watcherIds) &&
      watcherIds.every((id) => typeof id === "string" && /^[A-Z0-9]+$/.test(id))
    ) {
      return [...new Set(watcherIds)];
    }
  } catch (_) {
    // Requests created before the counter used the visible watcher list below.
  }

  const watcherBlock = blocks.find(
    (block) => block.block_id === WATCHERS_BLOCK_ID,
  );
  const text = watcherBlock?.elements?.[0]?.text ?? "";
  return [...text.matchAll(/<@([A-Z0-9]+)>/g)].map((match) => match[1]);
}

function setThreadWatcherIds(blocks, watcherIds) {
  const watchButton = getWatchButton(blocks);
  if (!watchButton) {
    return blocks;
  }

  watchButton.value = JSON.stringify(watcherIds);
  watchButton.text = {
    type: "plain_text",
    text: `:eyes: Watching: ${watcherIds.length}`,
    emoji: true,
  };

  const existingWatcherBlockIndex = blocks.findIndex(
    (block) => block.block_id === WATCHERS_BLOCK_ID,
  );
  if (existingWatcherBlockIndex !== -1) {
    blocks.splice(existingWatcherBlockIndex, 1);
  }

  blocks.forEach((block) => {
    if (block.type === "actions") {
      block.elements = block.elements.filter(
        (element) => element.action_id !== "unwatch_help_request_thread",
      );
    }
  });
  return blocks;
}

function getHelpRequestTitle(rootMessage) {
  return (
    rootMessage.blocks?.find(
      (block) => block.type === "section" && block.text?.type === "mrkdwn",
    )?.text?.text ?? "a help request"
  );
}

async function updateThreadWatchers(body, client) {
  try {
    const blocks = structuredClone(body.message.blocks);
    const watcherIds = new Set(getThreadWatcherIds(blocks));
    const isWatching = !watcherIds.has(body.user.id);

    if (isWatching) {
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
    return { isWatching, watcherCount: watcherIds.size };
  } catch (error) {
    console.error("Unable to update thread watchers", error);
    return null;
  }
}

async function watchHelpRequestThread(body, client) {
  return updateThreadWatchers(body, client);
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
  const helpRequestTitle = getHelpRequestTitle(rootMessage);

  await Promise.all(
    watcherIds.map(async (watcherId) => {
      try {
        const conversation = await client.conversations.open({
          users: watcherId,
        });
        await client.chat.postMessage({
          channel: conversation.channel.id,
          text: `New reply from <@${event.user}> in help request: ${helpRequestTitle}`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `:eyes: <@${event.user}> replied in ${helpRequestTitle}.`,
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
  getHelpRequestTitle,
  watchHelpRequestThread,
  notifyThreadWatchers,
};
