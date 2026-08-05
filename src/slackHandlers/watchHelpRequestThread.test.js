const {
  getThreadWatcherIds,
  setThreadWatcherIds,
} = require("./watchHelpRequestThread");

describe("thread watchers", () => {
  test("gets every watcher from the request message", () => {
    expect(
      getThreadWatcherIds([
        {
          block_id: "thread_watchers",
          elements: [{ text: ":eyes: *Watching:* <@U123>, <@U456>" }],
        },
      ]),
    ).toStrictEqual(["U123", "U456"]);
  });

  test("renders watcher mentions and the empty state", () => {
    const blocks = [{ block_id: "thread_watchers", elements: [] }];

    setThreadWatcherIds(blocks, ["U123"]);
    expect(blocks[0].elements[0].text).toBe(":eyes: *Watching:* <@U123>");

    setThreadWatcherIds(blocks, []);
    expect(blocks[0].elements[0].text).toBe(":eyes: *Watching:* Nobody yet");
  });
});
