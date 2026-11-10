/**
 * Sanitizer Engine Module
 * Handles text sanitization, regular expression generation, case sensitivity,
 * whole word boundary matching (supporting Unicode/Bangla), preserve length,
 * hyphenation, smart PII detection, and match statistics tracking.
 */

(function() {
  const root = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : global);

  const SMART_LABELS = {
    email: '[EMAIL]',
    url: '[LINK]',
    phone: '[PHONE]',
    handle: '[HANDLE]'
  };

  const SMART_PATTERNS = {
    // Standard emails and lightly obfuscated forms such as "name at gmail dot com".
    email: [
      '[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}',
      '[A-Z0-9._%+-]+\\s*(?:\\(at\\)|\\[at\\]|\\s+at\\s+)\\s*[A-Z0-9.-]+\\s*(?:\\(dot\\)|\\[dot\\]|\\s+dot\\s+)\\s*[A-Z]{2,}'
    ].join('|'),

    // Full URLs and bare domains with a common TLD.
    url: [
      '(?:https?:\\/\\/|www\\.)[^\\s<>"\']*[^\\s<>"\'.,;:!?)]',
      '\\b[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.(?:com|net|org|io|co|me|info|biz|dev|app|xyz|online|site|store|shop|ly|gg|tv|ai)\\b(?:\\/[^\\s<>"\']*)?'
    ].join('|'),

    // International numbers, US-style numbers, and long digit strings.
    phone: [
      '\\+\\d[\\d \\t().-]{7,}\\d',
      '\\(?\\d{3}\\)?[ \\t.-]\\d{3}[ \\t.-]\\d{4}\\b',
      '\\b\\d{10,15}\\b'
    ].join('|'),

    // Social handles such as @username.
    handle: '(?<![\\w.])@[A-Za-z0-9_](?:[A-Za-z0-9._]{1,30}[A-Za-z0-9_])?'
  };

  root.Sanitizer = {
    escapeRegExp(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },

    getReplacementText(settings) {
      const { replacementStyle, customReplacement } = settings;
      switch (replacementStyle) {
        case 'redacted':
          return '[REDACTED]';
        case 'removed':
          return '[REMOVED]';
        case 'custom':
          return customReplacement && customReplacement.trim() ? customReplacement.trim() : '[FILTERED]';
        case 'asterisks':
        default:
          return '***';
      }
    },

    /**
     * Builds one combined matcher for restricted words plus enabled smart
     * detectors. Smart patterns come first so an email is redacted as a whole
     * instead of only its domain being caught by the word list.
     */
    buildMatcher(wordList = [], settings = {}) {
      const activeWords = wordList
        .filter(item => {
          if (typeof item === 'string') return item.trim().length > 0;
          return item && item.active !== false && item.word && item.word.trim().length > 0;
        })
        .map(item => (typeof item === 'string' ? item.trim() : item.word.trim()));

      const {
        caseSensitive = false,
        wholeWord = true,
        detectEmails = true,
        detectPhones = true,
        detectLinks = true,
        detectHandles = true
      } = settings;

      if (activeWords.length === 0 && !detectEmails && !detectPhones && !detectLinks && !detectHandles) {
        return null;
      }

      const sortedWords = [...activeWords].sort((a, b) => b.length - a.length);
      const parts = [];
      const smartKeys = [];

      const smartSettings = [
        ['email', detectEmails],
        ['url', detectLinks],
        ['phone', detectPhones],
        ['handle', detectHandles]
      ];

      smartSettings.forEach(([key, enabled]) => {
        if (!enabled) return;
        parts.push(`(?<${key}>${SMART_PATTERNS[key]})`);
        smartKeys.push(key);
      });

      if (sortedWords.length > 0) {
        const wordPatterns = sortedWords.map(word => {
          const escaped = this.escapeRegExp(word);
          return wholeWord
            ? `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`
            : escaped;
        });
        parts.push(`(?<word>(?:${wordPatterns.join('|')}))`);
      }

      const flags = `g${caseSensitive ? '' : 'i'}u`;

      try {
        return {
          regex: new RegExp(parts.join('|'), flags),
          smartKeys
        };
      } catch (error) {
        console.error('Error creating sanitization regex pattern:', error);

        // Extremely old engines may not support Unicode property escapes.
        const fallbackPatterns = sortedWords.map(word => {
          const escaped = this.escapeRegExp(word);
          return wholeWord ? `\\b${escaped}\\b` : escaped;
        });
        if (fallbackPatterns.length === 0) return null;

        return {
          regex: new RegExp(`(?<word>(?:${fallbackPatterns.join('|')}))`, `g${caseSensitive ? '' : 'i'}`),
          smartKeys: []
        };
      }
    },

    /** Returns every match with its start/end offsets and detector type. */
    findMatches(text, wordList = [], settings = {}) {
      if (!text) return [];
      const matcher = this.buildMatcher(wordList, settings);
      if (!matcher) return [];

      const matches = [];
      let match;

      while ((match = matcher.regex.exec(text)) !== null) {
        let type = 'word';
        if (match.groups) {
          const smartType = matcher.smartKeys.find(key => match.groups[key]);
          if (smartType) type = smartType;
        }

        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          text: match[0],
          type
        });

        if (match[0].length === 0) matcher.regex.lastIndex++;
      }

      return matches;
    },

    sanitize(text, wordList = [], settings = {}) {
      const emptyStats = {
        detectedCount: 0,
        replacementCount: 0,
        uniqueMatchesCount: 0,
        matchedList: [],
        smartMatchCount: 0,
        smartCounts: { email: 0, url: 0, phone: 0, handle: 0 }
      };

      if (!text) {
        return { sanitizedText: '', stats: emptyStats };
      }

      const matcher = this.buildMatcher(wordList, settings);
      if (!matcher) {
        return { sanitizedText: text, stats: emptyStats };
      }

      const {
        caseSensitive = false,
        preserveLength = false,
        replacementStyle = 'asterisks',
        sanitizerSymbol = '-',
        smartLabels = true
      } = settings;

      const separator = typeof sanitizerSymbol === 'string' && sanitizerSymbol.length > 0
        ? sanitizerSymbol
        : '-';

      const baseReplacement = this.getReplacementText(settings);
      let detectedCount = 0;
      let replacementCount = 0;
      let smartMatchCount = 0;
      const smartCounts = { email: 0, url: 0, phone: 0, handle: 0 };
      const uniqueMatchesSet = new Set();
      const matchedList = [];

      // Output split into plain / replaced pieces so the UI can show replacements in red.
      const segments = [];
      let segmentCursor = 0;

      const sanitizedText = text.replace(matcher.regex, (...args) => {
        const match = args[0];
        const groups = args[args.length - 1];
        const offset = args[args.length - 3];
        const replacement = replaceMatch(match, groups);
        if (offset > segmentCursor) {
          segments.push({ text: text.slice(segmentCursor, offset), replaced: false });
        }
        segments.push({ text: replacement, replaced: true });
        segmentCursor = offset + match.length;
        return replacement;
      });
      if (segmentCursor < text.length) {
        segments.push({ text: text.slice(segmentCursor), replaced: false });
      }

      function replaceMatch(match, groups) {
        let type = 'word';

        if (groups && typeof groups === 'object') {
          const smartType = matcher.smartKeys.find(key => groups[key]);
          if (smartType) type = smartType;
        }

        detectedCount++;
        replacementCount++;

        if (type !== 'word') {
          smartMatchCount++;
          smartCounts[type] = (smartCounts[type] || 0) + 1;
        }

        const normalizedMatch = caseSensitive ? match : match.toLowerCase();
        if (!uniqueMatchesSet.has(normalizedMatch)) {
          uniqueMatchesSet.add(normalizedMatch);
          matchedList.push(match);
        }

        // Give personal information a clear, readable label.
        if (type !== 'word' && smartLabels) {
          return SMART_LABELS[type] || baseReplacement;
        }

        // Hyphenate First Letter option (e.g. pay -> p-ay, badword -> b-adword)
        if (replacementStyle === 'hyphenated') {
          const characters = Array.from(match);
          if (characters.length <= 1) return match;
          return characters[0] + separator + characters.slice(1).join('');
        }

        // Hyphenate All Letters option (e.g. pay -> p-a-y)
        if (replacementStyle === 'hyphenated-all') {
          return Array.from(match).join(separator);
        }

        if (preserveLength) {
          return '*'.repeat(Array.from(match).length);
        }

        return baseReplacement;
      }

      return {
        sanitizedText,
        segments,
        stats: {
          detectedCount,
          replacementCount,
          uniqueMatchesCount: uniqueMatchesSet.size,
          matchedList,
          smartMatchCount,
          smartCounts
        }
      };
    }
  };
})();
