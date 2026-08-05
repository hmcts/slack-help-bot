const {
  getThreadWatcherIds,
  setThreadWatcherIds,
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
    expect(blocks[0].elements[0].text.text).toBe(":eyes: Watch 1");
    expect(blocks[0].elements[0].value).toBe('["U123"]');

    setThreadWatcherIds(blocks, []);
    expect(blocks[0].elements[0].text.text).toBe(":eyes: Watch 0");
  });
});
