"use strict";

// App language keys stay stable; DeepL requires explicit target variants.
const DEEPL_TARGET_LANGUAGES = Object.freeze({ en: "EN-US", zh: "ZH-HANS" });

// Explicit so an SDK upgrade cannot change how long a DeepL outage takes to
// surface. These are the deepl-node 1.28.1 defaults; 1.29.0 defaults to a
// 10 s attempt timeout and then gives up after about 60 s, which is the
// default timeout of a callable. test/deepl.sdk.test.cjs measures the result.
const DEEPL_CLIENT_OPTIONS = Object.freeze({ maxRetries: 5, minTimeout: 5000 });

module.exports = { DEEPL_TARGET_LANGUAGES, DEEPL_CLIENT_OPTIONS };
