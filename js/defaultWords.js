/**
 * Default Fiverr Word List
 * The words themselves live in data/defaultWords.json (grouped by category so
 * the interface can explain *why* a term is risky). Edit that file to change
 * the list, and bump its "version" so existing users receive the new words.
 *
 * Call DefaultWords.load() once (and wait for it) before using anything else.
 */

(function() {
  const DATA_URL = 'data/defaultWords.json';

  let VERSION = 0;
  let GROUPS = {};
  let CATEGORY_META = {};
  let WORDS = [];
  let WORD_CATEGORY = {};

  const apply = (data) => {
    VERSION = Number(data.version) || 1;
    GROUPS = data.groups || {};
    CATEGORY_META = data.categories || {};
    WORDS = [];
    WORD_CATEGORY = {};

    // Keep one entry per word even if a phrase appears in more than one group.
    Object.keys(GROUPS).forEach((category) => {
      GROUPS[category].forEach((word) => {
        const key = word.toLowerCase();
        if (WORD_CATEGORY[key]) return;
        WORD_CATEGORY[key] = category;
        WORDS.push(word);
      });
    });

    api.VERSION = VERSION;
    api.WORDS = WORDS;
    api.GROUPS = GROUPS;
    api.CATEGORY_META = CATEGORY_META;
  };

  const api = {
    VERSION,
    WORDS,
    GROUPS,
    CATEGORY_META,

    /** Fetches the JSON word list. Must finish before the app initialises. */
    async load() {
      try {
        const response = await fetch(DATA_URL, { cache: 'no-cache' });
        if (!response.ok) throw new Error(`Could not load ${DATA_URL} (${response.status})`);
        apply(await response.json());
      } catch (error) {
        // file:// pages cannot fetch JSON; use the generated copy of the same data.
        if (!window.__DEFAULT_WORDS_DATA__) throw error;
        apply(window.__DEFAULT_WORDS_DATA__);
      }
    },

    getCategory(word) {
      if (!word || typeof word !== 'string') return 'sensitive';
      return WORD_CATEGORY[word.trim().toLowerCase()] || 'sensitive';
    },

    /** Builds fresh word objects ready for storage. */
    build() {
      const createdAt = new Date().toISOString();
      return WORDS.map((word, i) => ({
        id: `def-${i + 1}`,
        word,
        category: WORD_CATEGORY[word.toLowerCase()] || 'sensitive',
        active: true,
        createdAt
      }));
    }
  };

  window.DefaultWords = api;
})();
