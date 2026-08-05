const {
  getThreadWatcherIds,
  setThreadWatcherIds,
  getHelpRequestTitle,
} = require("./watchHelpRequestThread");

describe("thread watchers", () => {
  test("gets every watcher from the request message", () => {
    expect(
      getThreadWatcherIds([
        {
          elements: [
            {
              action_id: "watch_help_request_thread",
              value: '["U123","U456"]',
            },
          ],
        },
      ]),
    ).toStrictEqual(["U123", "U456"]);
  });

  test("renders the watcher count on the button and removes the old status text", () => {
    const blocks = [
      { block_id: "thread_watchers", elements: [] },
      {
        elements: [
          { action_id: "watch_help_request_thread", value: "[]", text: {} },
        ],
      },
    ];

    setThreadWatcherIds(blocks, ["U123"]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].elements[0].text.text).toBe(":eyes: Watching: 1");
    expect(blocks[0].elements[0].value).toBe('["U123"]');

    setThreadWatcherIds(blocks, [], false);
    expect(blocks[0].elements[0].text.text).toBe(":eyes: Watching: 0");
  });

  test("does not count the same watcher twice", () => {
    const blocks = [
      {
        elements: [
          {
            action_id: "watch_help_request_thread",
            value: '["U123","U123"]',
          },
        ],
      },
    ];

    expect(getThreadWatcherIds(blocks)).toStrictEqual(["U123"]);
  });

  test("gets the help-request title for watcher notifications", () => {
    expect(
      getHelpRequestTitle({
        blocks: [
          {
            type: "section",
            text: { type: "mrkdwn", text: "*Unable to deploy to prod*" },
          },
        ],
      }),
    ).toBe("*Unable to deploy to prod*");
  });
});
