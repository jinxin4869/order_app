const assert = require("node:assert/strict");
const http = require("node:http");
const { once } = require("node:events");
const { createRequire } = require("node:module");
const functionsRequire = createRequire(
  require.resolve("../functions/package.json")
);
const { Translator } = functionsRequire("deepl-node");
const {
  DEEPL_TARGET_LANGUAGES,
  DEEPL_CLIENT_OPTIONS,
} = require("../functions/src/utils/translationLanguages");

// A callable without timeoutSeconds stops after 60 s. An unresponsive DeepL
// must fail well before that, or the function is cut off before it can
// return its own error. Uses the options the function really passes.
async function outage() {
  const server = http.createServer(() => {}); // accepts, never answers
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const started = Date.now();
  try {
    const translator = new Translator("synthetic-test-key-not-a-real-secret", {
      ...DEEPL_CLIENT_OPTIONS,
      serverUrl: `http://127.0.0.1:${server.address().port}`,
      sendPlatformInfo: false,
      proxy: false,
    });
    await assert.rejects(translator.translateText("テスト料理", "JA", "en-US"));
    const seconds = (Date.now() - started) / 1000;
    assert.ok(seconds < 50, `DeepL outage took ${seconds}s to surface`);
    console.log(
      `DeepL SDK: an unresponsive server surfaced as an error after ${seconds.toFixed(1)}s.`
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

async function main() {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    requests.push({
      method: request.method,
      path: request.url,
      body: new URLSearchParams(body),
    });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        translations: [
          { detected_source_language: "JA", text: "Synthetic translation" },
        ],
      })
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const translator = new Translator("synthetic-test-key-not-a-real-secret", {
      serverUrl: `http://127.0.0.1:${server.address().port}`,
      sendPlatformInfo: false,
      maxRetries: 0,
      proxy: false,
    });
    for (const [language, target] of [
      ["en", "EN-US"],
      ["zh", "ZH-HANS"],
    ]) {
      const result = await translator.translateText(
        "テスト料理",
        "JA",
        DEEPL_TARGET_LANGUAGES[language],
        { preserveFormatting: true }
      );
      assert.equal(result.text, "Synthetic translation");
      const request = requests.at(-1);
      assert.equal(request.method, "POST");
      assert.equal(request.path, "/v2/translate");
      assert.equal(request.body.get("text"), "テスト料理");
      assert.equal(request.body.get("source_lang"), "ja");
      assert.equal(request.body.get("target_lang").toUpperCase(), target);
      assert.equal(request.body.get("preserve_formatting"), "1");
    }
    assert.equal(requests.length, 2);
    console.log(
      "DeepL SDK: English/Chinese translation requests and response parsing passed against a loopback fixture."
    );
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

Promise.all([main(), outage()]).catch((error) => {
  console.error(error.message);
  console.error(
    "DeepL SDK compatibility check failed against the local fixture."
  );
  process.exitCode = 1;
});
