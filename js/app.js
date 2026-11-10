/**
 * Main Application Module (app.js)
 * Connects storage, theme, notifications, sanitizer engine, word manager,
 * settings, statistics, and import/export with the UI.
 */

(function() {
  class App {
    constructor() {
      this.editingWordId = null;
      this.deletingWordId = null;
      this.searchHasRun = true; // always highlight risky content as the user types
      this.translationEngine = null;
      this.translationSourceText = '';
      this.showingTranslation = false;
      this.translationInProgress = false;
      this.dom = {};
      this.documents = [];
      this.activeDocumentId = null;
    }

    init() {
      // 1. Initialize Modules
      window.Theme.init();
      window.Toast.init();
      window.WordManager.init();
      window.Settings.init();

      // 2. Cache DOM Elements
      this.cacheDomElements();
      this.loadDocuments();
      this.moveActionsToHeader();

      // 3. Render Initial State
      this.renderSettingsUI();
      this.renderWordList();
      this.renderDocumentTabs();
      this.dom.inputText.value = this.getActiveDocument().text;
      this.handleSanitize();
      this.searchRestrictedWords(false);
      this.updateInputCounters();
      this.updateOutputCounters();

      // 4. Bind Event Listeners
      this.bindEvents();

      // 5. Setup Drag and Drop
      this.setupDragAndDrop();

      console.log('Text Sanitizer Application initialized successfully.');
    }

    cacheDomElements() {
      this.dom = {
        // Header
        themeToggleBtn: document.getElementById('themeToggleBtn'),
        openWordsBtn: document.getElementById('openWordsBtn'),
        openSettingsBtn: document.getElementById('openSettingsBtn'),
        fullscreenBtn: document.getElementById('fullscreenBtn'),
        headerActions: document.querySelector('.header-actions'),
        documentTabs: document.getElementById('documentTabs'),
        newDocumentBtn: document.getElementById('newDocumentBtn'),

        // Word Management & Settings Modals
        wordsModal: document.getElementById('wordsModal'),
        closeWordsModalBtn: document.getElementById('closeWordsModalBtn'),
        settingsModal: document.getElementById('settingsModal'),
        closeSettingsModalBtn: document.getElementById('closeSettingsModalBtn'),
        doneSettingsBtn: document.getElementById('doneSettingsBtn'),

        // Input & Output
        inputText: document.getElementById('inputText'),
        inputCharCount: document.getElementById('inputCharCount'),
        inputWordCount: document.getElementById('inputWordCount'),
        inputNoSpaceCount: document.getElementById('inputNoSpaceCount'),
        inputParagraphCount: document.getElementById('inputParagraphCount'),
        outputText: document.getElementById('outputText'),
        translatedOutputText: document.getElementById('translatedOutputText'),
        translateOutputBtn: document.getElementById('translateOutputBtn'),
        outputCharCount: document.getElementById('outputCharCount'),
        outputWordCount: document.getElementById('outputWordCount'),

        // Action Buttons
        shareOutputBtn: document.getElementById('shareOutputBtn'),
        shareOutputMenu: document.getElementById('shareOutputMenu'),
        copyResultBtn: document.getElementById('copyResultBtn'),
        downloadResultBtn: document.getElementById('downloadResultBtn'),
        clearInputBtn: document.getElementById('clearInputBtn'),
        clearResultBtn: document.getElementById('clearResultBtn'),
        clearAllBtn: document.getElementById('clearAllBtn'),
        findRestrictedBtn: document.getElementById('findRestrictedBtn'),
        searchResultCount: document.getElementById('searchResultCount'),
        inputHighlightLayer: document.getElementById('inputHighlightLayer'),
        outputHighlightLayer: document.getElementById('outputHighlightLayer'),

        // Risk summary
        riskMeter: document.getElementById('riskMeter'),
        riskLabel: document.getElementById('riskLabel'),
        riskDetail: document.getElementById('riskDetail'),
        riskScore: document.getElementById('riskScore'),

        // Sanitization Statistics Display
        statTotalChars: document.getElementById('statTotalChars'),
        statTotalWords: document.getElementById('statTotalWords'),
        statDetectedWords: document.getElementById('statDetectedWords'),
        statReplacedWords: document.getElementById('statReplacedWords'),
        statUniqueMatches: document.getElementById('statUniqueMatches'),
        statMatchedTags: document.getElementById('statMatchedTags'),

        // Word Management
        newWordInput: document.getElementById('newWordInput'),
        addWordBtn: document.getElementById('addWordBtn'),
        addWordForm: document.getElementById('addWordForm'),
        searchWordInput: document.getElementById('searchWordInput'),
        totalWordsBadge: document.getElementById('totalWordsBadge'),
        activeWordsBadge: document.getElementById('activeWordsBadge'),
        wordListContainer: document.getElementById('wordListContainer'),
        clearWordsBtn: document.getElementById('clearWordsBtn'),
        restoreDefaultsBtn: document.getElementById('restoreDefaultsBtn'),

        // Settings
        replacementStyleSelect: document.getElementById('replacementStyleSelect'),
        sanitizerSymbolInput: document.getElementById('sanitizerSymbolInput'),
        saveSanitizerSymbolBtn: document.getElementById('saveSanitizerSymbolBtn'),
        customReplacementGroup: document.getElementById('customReplacementGroup'),
        customReplacementInput: document.getElementById('customReplacementInput'),
        caseSensitiveToggle: document.getElementById('caseSensitiveToggle'),
        wholeWordToggle: document.getElementById('wholeWordToggle'),
        preserveLengthToggle: document.getElementById('preserveLengthToggle'),
        detectEmailsToggle: document.getElementById('detectEmailsToggle'),
        detectPhonesToggle: document.getElementById('detectPhonesToggle'),
        detectLinksToggle: document.getElementById('detectLinksToggle'),
        detectHandlesToggle: document.getElementById('detectHandlesToggle'),
        smartLabelsToggle: document.getElementById('smartLabelsToggle'),
        resetSettingsBtn: document.getElementById('resetSettingsBtn'),

        // Import / Export
        importTxtInput: document.getElementById('importTxtInput'),
        importTxtBtn: document.getElementById('importTxtBtn'),
        exportTxtBtn: document.getElementById('exportTxtBtn'),
        importJsonInput: document.getElementById('importJsonInput'),
        importJsonBtn: document.getElementById('importJsonBtn'),
        exportJsonBtn: document.getElementById('exportJsonBtn'),
        dropZone: document.getElementById('dropZone'),

        // Modals
        editWordModal: document.getElementById('editWordModal'),
        editWordInput: document.getElementById('editWordInput'),
        saveEditBtn: document.getElementById('saveEditBtn'),
        cancelEditBtn: document.getElementById('cancelEditBtn'),
        closeEditModalBtn: document.getElementById('closeEditModalBtn'),

        deleteWordModal: document.getElementById('deleteWordModal'),
        deleteWordMessage: document.getElementById('deleteWordMessage'),
        confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
        cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
        closeDeleteModalBtn: document.getElementById('closeDeleteModalBtn'),

        clearAllWordsModal: document.getElementById('clearAllWordsModal'),
        confirmClearAllWordsBtn: document.getElementById('confirmClearAllWordsBtn'),
        cancelClearAllWordsBtn: document.getElementById('cancelClearAllWordsBtn'),
        closeClearAllWordsModalBtn: document.getElementById('closeClearAllWordsModalBtn')
      };
    }

    moveActionsToHeader() {
      if (!this.dom.headerActions) return;

      [this.dom.openWordsBtn, this.dom.themeToggleBtn, this.dom.openSettingsBtn].forEach((button) => {
        if (!button) return;
        button.classList.remove('btn-theme-toggle');
        button.classList.remove('sr-only');
        button.classList.add('header-tool-button');
      });
    }

    loadDocuments() {
      try {
        const saved = localStorage.getItem('saniText_documents');
        const parsed = saved ? JSON.parse(saved) : [];
        if (Array.isArray(parsed)) {
          this.documents = parsed
            .filter(document => document && typeof document.id === 'string' && typeof document.text === 'string')
            .map(document => ({
              id: document.id,
              title: typeof document.title === 'string' ? document.title : 'New document',
              text: document.text
            }));
        }

        const savedActiveId = localStorage.getItem('saniText_activeDocument');
        this.activeDocumentId = this.documents.some(document => document.id === savedActiveId)
          ? savedActiveId
          : null;
      } catch (error) {
        console.error('Error loading open documents:', error);
        this.documents = [];
        this.activeDocumentId = null;
      }

      if (this.documents.length === 0) {
        const firstDocument = this.createDocumentState();
        this.documents = [firstDocument];
        this.activeDocumentId = firstDocument.id;
        this.saveDocuments();
      } else if (!this.activeDocumentId) {
        this.activeDocumentId = this.documents[0].id;
      }
    }

    createDocumentState() {
      return {
        id: `document-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: 'New document',
        text: ''
      };
    }

    getActiveDocument() {
      return this.documents.find(document => document.id === this.activeDocumentId) || this.documents[0];
    }

    saveDocuments() {
      try {
        localStorage.setItem('saniText_documents', JSON.stringify(this.documents));
        localStorage.setItem('saniText_activeDocument', this.activeDocumentId);
      } catch (error) {
        console.error('Error saving open documents:', error);
        window.Toast.error('Unable to save open documents in this browser.');
      }
    }

    updateActiveDocument() {
      const activeDocument = this.getActiveDocument();
      if (!activeDocument || !this.dom.inputText) return;

      const previousTitle = activeDocument.title;
      activeDocument.text = this.dom.inputText.value;
      const firstLine = activeDocument.text.trim().split(/\r?\n/, 1)[0].trim();
      activeDocument.title = firstLine ? firstLine.slice(0, 24) : 'New document';
      if (activeDocument.title !== previousTitle) this.renderDocumentTabs();
      this.saveDocuments();
    }

    renderDocumentTabs() {
      if (!this.dom.documentTabs) return;
      this.dom.documentTabs.replaceChildren();

      this.documents.forEach((record, index) => {
        const item = document.createElement('div');
        item.className = 'document-tab-item';
        item.setAttribute('aria-selected', String(record.id === this.activeDocumentId));

        const tabNumber = index + 1;
        const tab = document.createElement('button');
        tab.className = 'document-tab';
        tab.type = 'button';
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', String(record.id === this.activeDocumentId));
        tab.dataset.documentTab = record.id;
        tab.title = `Tab ${tabNumber}: ${record.title}`;

        const number = document.createElement('span');
        number.className = 'document-tab-number';
        number.textContent = String(tabNumber);
        number.setAttribute('aria-hidden', 'true');
        tab.appendChild(number);

        const title = document.createElement('span');
        title.className = 'document-tab-title';
        title.textContent = record.title;
        tab.appendChild(title);

        const closeButton = document.createElement('button');
        closeButton.className = 'close-document-button';
        closeButton.type = 'button';
        closeButton.dataset.closeDocument = record.id;
        closeButton.setAttribute('aria-label', `Close ${record.title}`);
        closeButton.textContent = '×';
        closeButton.disabled = this.documents.length === 1;

        item.append(tab, closeButton);
        this.dom.documentTabs.appendChild(item);
      });

      const activeTab = this.dom.documentTabs.querySelector('[data-document-tab][aria-selected="true"]');
      if (activeTab) {
        const tabLeft = activeTab.offsetLeft;
        const tabRight = tabLeft + activeTab.offsetWidth;
        const visibleLeft = this.dom.documentTabs.scrollLeft;
        const visibleRight = visibleLeft + this.dom.documentTabs.clientWidth;

        if (tabLeft < visibleLeft) {
          this.dom.documentTabs.scrollLeft = tabLeft;
        } else if (tabRight > visibleRight) {
          this.dom.documentTabs.scrollLeft = tabRight - this.dom.documentTabs.clientWidth;
        }
      }
    }

    createDocument() {
      this.updateActiveDocument();
      const document = this.createDocumentState();
      this.documents.push(document);
      this.activeDocumentId = document.id;
      this.saveDocuments();
      this.renderDocumentTabs();
      this.dom.inputText.value = '';
      this.handleSanitize();
      this.updateInputCounters();
      if (this.searchHasRun) this.searchRestrictedWords(false);
      else this.clearSearchHighlights();
      this.dom.inputText.focus();
    }

    switchDocument(documentId) {
      if (documentId === this.activeDocumentId) return;
      const document = this.documents.find(item => item.id === documentId);
      if (!document) return;

      this.updateActiveDocument();
      this.activeDocumentId = document.id;
      this.saveDocuments();
      this.renderDocumentTabs();
      this.dom.inputText.value = document.text;
      this.handleSanitize();
      this.updateInputCounters();
      if (this.searchHasRun) this.searchRestrictedWords(false);
      else this.clearSearchHighlights();
    }

    closeDocument(documentId) {
      if (this.documents.length < 2) return;
      const index = this.documents.findIndex(document => document.id === documentId);
      if (index === -1) return;

      if (documentId === this.activeDocumentId) this.updateActiveDocument();
      this.documents.splice(index, 1);
      if (documentId === this.activeDocumentId) {
        this.activeDocumentId = this.documents[Math.min(index, this.documents.length - 1)].id;
      }

      this.saveDocuments();
      this.renderDocumentTabs();
      const activeDocument = this.getActiveDocument();
      this.dom.inputText.value = activeDocument.text;
      this.handleSanitize();
      this.updateInputCounters();
      if (this.searchHasRun) this.searchRestrictedWords(false);
      else this.clearSearchHighlights();
    }

    bindEvents() {
      if (this.dom.newDocumentBtn) {
        this.dom.newDocumentBtn.addEventListener('click', () => this.createDocument());
      }

      if (this.dom.documentTabs) {
        this.dom.documentTabs.addEventListener('click', (event) => {
          const closeButton = event.target.closest('[data-close-document]');
          if (closeButton) {
            this.closeDocument(closeButton.dataset.closeDocument);
            return;
          }

          const tab = event.target.closest('[data-document-tab]');
          if (tab) this.switchDocument(tab.dataset.documentTab);
        });
      }

      if (this.dom.themeToggleBtn) {
        this.dom.themeToggleBtn.addEventListener('click', () => window.Theme.toggleTheme());
      }
      if (this.dom.fullscreenBtn) {
        this.dom.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
      }

      if (this.dom.openWordsBtn) {
        this.dom.openWordsBtn.addEventListener('click', () => this.openModal(this.dom.wordsModal));
      }
      if (this.dom.openSettingsBtn) {
        this.dom.openSettingsBtn.addEventListener('click', () => this.openModal(this.dom.settingsModal));
      }
      if (this.dom.closeWordsModalBtn) {
        this.dom.closeWordsModalBtn.addEventListener('click', () => this.closeModal(this.dom.wordsModal));
      }
      if (this.dom.closeSettingsModalBtn) {
        this.dom.closeSettingsModalBtn.addEventListener('click', () => this.closeModal(this.dom.settingsModal));
      }
      if (this.dom.doneSettingsBtn) {
        this.dom.doneSettingsBtn.addEventListener('click', () => this.closeModal(this.dom.settingsModal));
      }

      // Click on the dimmed backdrop closes that modal
      [this.dom.wordsModal, this.dom.settingsModal].forEach((modal) => {
        if (!modal) return;
        modal.addEventListener('mousedown', (e) => {
          if (e.target === modal) this.closeModal(modal);
        });
      });

      if (this.dom.inputText) {
        this.dom.inputText.addEventListener('input', () => {
          this.updateActiveDocument();
          this.updateInputCounters();
          this.handleSanitize();
          if (this.searchHasRun) this.searchRestrictedWords(false);
        });
        this.dom.inputText.addEventListener('scroll', () => this.syncHighlightScroll());
      }
      if (this.dom.outputText) {
        this.dom.outputText.addEventListener('scroll', () => this.syncOutputHighlightScroll());
      }

      if (this.dom.outputText) {
        this.dom.outputText.addEventListener('input', () => {
          this.clearOutputHighlights(); // manual edit makes the replacement positions stale
          this.updateOutputCounters();
        });
      }

      if (this.dom.findRestrictedBtn) {
        this.dom.findRestrictedBtn.addEventListener('click', () => this.searchRestrictedWords());
      }

      if (this.dom.copyResultBtn) {
        this.dom.copyResultBtn.addEventListener('click', () => this.handleCopyResult());
      }

      if (this.dom.translateOutputBtn) {
        this.dom.translateOutputBtn.addEventListener('click', () => this.handleTranslateOutput());
      }

      if (this.dom.shareOutputBtn && this.dom.shareOutputMenu) {
        this.dom.shareOutputBtn.addEventListener('click', () => {
          const isOpen = !this.dom.shareOutputMenu.hidden;
          this.dom.shareOutputMenu.hidden = isOpen;
          this.dom.shareOutputBtn.setAttribute('aria-expanded', String(!isOpen));
        });

        this.dom.shareOutputMenu.addEventListener('click', (event) => {
          const menuItem = event.target.closest('[data-share-platform]');
          if (!menuItem) return;
          this.dom.shareOutputMenu.hidden = true;
          this.dom.shareOutputBtn.setAttribute('aria-expanded', 'false');
          this.handleShareOutput(menuItem.dataset.sharePlatform);
        });

        document.addEventListener('click', (event) => {
          if (this.dom.shareOutputMenu.hidden || event.target.closest('.share-menu-container')) return;
          this.dom.shareOutputMenu.hidden = true;
          this.dom.shareOutputBtn.setAttribute('aria-expanded', 'false');
        });

        document.addEventListener('keydown', (event) => {
          if (event.key !== 'Escape' || this.dom.shareOutputMenu.hidden) return;
          this.dom.shareOutputMenu.hidden = true;
          this.dom.shareOutputBtn.setAttribute('aria-expanded', 'false');
          this.dom.shareOutputBtn.focus();
        });
      }

      if (this.dom.downloadResultBtn) {
        this.dom.downloadResultBtn.addEventListener('click', () => this.handleDownloadResult());
      }

      if (this.dom.clearInputBtn) {
        this.dom.clearInputBtn.addEventListener('click', () => this.handleClearInput());
      }

      if (this.dom.clearResultBtn) {
        this.dom.clearResultBtn.addEventListener('click', () => this.handleClearResult());
      }

      if (this.dom.clearAllBtn) {
        this.dom.clearAllBtn.addEventListener('click', () => this.handleClearAll());
      }

      if (this.dom.addWordForm) {
        this.dom.addWordForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleAddWord();
        });
      }

      if (this.dom.searchWordInput) {
        this.dom.searchWordInput.addEventListener('input', (e) => {
          window.WordManager.setSearchQuery(e.target.value);
          this.renderWordList();
        });
      }

      if (this.dom.clearWordsBtn) {
        this.dom.clearWordsBtn.addEventListener('click', () => {
          if (window.WordManager.getTotalCount() === 0) {
            window.Toast.info('Word list is already empty.');
            return;
          }
          this.openModal(this.dom.clearAllWordsModal);
        });
      }

      if (this.dom.confirmClearAllWordsBtn) {
        this.dom.confirmClearAllWordsBtn.addEventListener('click', () => {
          window.WordManager.clearAllWords();
          this.renderWordList();
          this.refreshSanitization();
          this.closeModal(this.dom.clearAllWordsModal);
        });
      }

      if (this.dom.cancelClearAllWordsBtn) {
        this.dom.cancelClearAllWordsBtn.addEventListener('click', () => {
          this.closeModal(this.dom.clearAllWordsModal);
        });
      }

      if (this.dom.closeClearAllWordsModalBtn) {
        this.dom.closeClearAllWordsModalBtn.addEventListener('click', () => {
          this.closeModal(this.dom.clearAllWordsModal);
        });
      }

      if (this.dom.restoreDefaultsBtn) {
        this.dom.restoreDefaultsBtn.addEventListener('click', () => {
          window.WordManager.restoreDefaultWords();
          this.renderWordList();
          this.refreshSanitization();
        });
      }

      if (this.dom.replacementStyleSelect) {
        this.dom.replacementStyleSelect.addEventListener('change', (e) => {
          const val = e.target.value;
          window.Settings.set('replacementStyle', val);
          this.toggleCustomReplacementVisibility(val);
          this.refreshSanitization();
        });
      }

      if (this.dom.saveSanitizerSymbolBtn) {
        this.dom.saveSanitizerSymbolBtn.addEventListener('click', () => {
          const symbol = this.dom.sanitizerSymbolInput ? this.dom.sanitizerSymbolInput.value.trim() : '';
          if (!symbol) {
            window.Toast.error('Sanitizer symbol cannot be empty.');
            return;
          }

          window.Settings.set('sanitizerSymbol', symbol);
          this.dom.sanitizerSymbolInput.value = symbol;
          this.refreshSanitization();
          window.Toast.success('Sanitizer symbol saved.');
        });
      }

      if (this.dom.customReplacementInput) {
        this.dom.customReplacementInput.addEventListener('input', (e) => {
          window.Settings.set('customReplacement', e.target.value);
          this.handleSanitize();
        });
      }

      if (this.dom.caseSensitiveToggle) {
        this.dom.caseSensitiveToggle.addEventListener('change', (e) => {
          window.Settings.set('caseSensitive', e.target.checked);
          this.refreshSanitization();
        });
      }

      if (this.dom.wholeWordToggle) {
        this.dom.wholeWordToggle.addEventListener('change', (e) => {
          window.Settings.set('wholeWord', e.target.checked);
          this.refreshSanitization();
        });
      }

      if (this.dom.preserveLengthToggle) {
        this.dom.preserveLengthToggle.addEventListener('change', (e) => {
          window.Settings.set('preserveLength', e.target.checked);
          this.handleSanitize();
        });
      }

      [
        ['detectEmailsToggle', 'detectEmails'],
        ['detectPhonesToggle', 'detectPhones'],
        ['detectLinksToggle', 'detectLinks'],
        ['detectHandlesToggle', 'detectHandles'],
        ['smartLabelsToggle', 'smartLabels']
      ].forEach(([elementKey, settingKey]) => {
        const toggle = this.dom[elementKey];
        if (!toggle) return;
        toggle.addEventListener('change', (e) => {
          window.Settings.set(settingKey, e.target.checked);
          this.refreshSanitization();
        });
      });

      if (this.dom.resetSettingsBtn) {
        this.dom.resetSettingsBtn.addEventListener('click', () => {
          window.Settings.resetToDefaults();
          this.renderSettingsUI();
          this.refreshSanitization();
        });
      }

      if (this.dom.exportTxtBtn) {
        this.dom.exportTxtBtn.addEventListener('click', () => window.ImportExport.exportTXT());
      }

      if (this.dom.importTxtBtn && this.dom.importTxtInput) {
        this.dom.importTxtBtn.addEventListener('click', () => this.dom.importTxtInput.click());
        this.dom.importTxtInput.addEventListener('change', (e) => {
          if (e.target.files.length > 0) {
            window.ImportExport.importTXT(e.target.files[0], () => {
              this.renderWordList();
              this.refreshSanitization();
            });
            e.target.value = '';
          }
        });
      }

      if (this.dom.exportJsonBtn) {
        this.dom.exportJsonBtn.addEventListener('click', () => window.ImportExport.exportJSON());
      }

      if (this.dom.importJsonBtn && this.dom.importJsonInput) {
        this.dom.importJsonBtn.addEventListener('click', () => this.dom.importJsonInput.click());
        this.dom.importJsonInput.addEventListener('change', (e) => {
          if (e.target.files.length > 0) {
            window.ImportExport.importJSON(e.target.files[0], () => {
              this.renderWordList();
              this.renderSettingsUI();
              this.refreshSanitization();
            });
            e.target.value = '';
          }
        });
      }

      if (this.dom.saveEditBtn) {
        this.dom.saveEditBtn.addEventListener('click', () => this.handleSaveEdit());
      }

      if (this.dom.cancelEditBtn) {
        this.dom.cancelEditBtn.addEventListener('click', () => this.closeModal(this.dom.editWordModal));
      }

      if (this.dom.closeEditModalBtn) {
        this.dom.closeEditModalBtn.addEventListener('click', () => this.closeModal(this.dom.editWordModal));
      }

      if (this.dom.confirmDeleteBtn) {
        this.dom.confirmDeleteBtn.addEventListener('click', () => this.handleConfirmDelete());
      }

      if (this.dom.cancelDeleteBtn) {
        this.dom.cancelDeleteBtn.addEventListener('click', () => this.closeModal(this.dom.deleteWordModal));
      }

      if (this.dom.closeDeleteModalBtn) {
        this.dom.closeDeleteModalBtn.addEventListener('click', () => this.closeModal(this.dom.deleteWordModal));
      }

      document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
          e.preventDefault();
          this.searchRestrictedWords();
        }

        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
          e.preventDefault();
          this.handleCopyResult();
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          this.openModal(this.dom.wordsModal);
          if (this.dom.searchWordInput) {
            this.dom.searchWordInput.focus();
            this.dom.searchWordInput.select();
          }
        }

        if (e.key === 'Tab') {
          const activeModal = document.querySelector('.modal-backdrop.active');
          if (!activeModal) return;

          const focusable = [...activeModal.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )].filter(element => element.offsetParent !== null);

          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];

          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }

        if (e.key === 'Escape') {
          // Close the top-most open modal first (confirmations sit above the main modals)
          const order = [
            this.dom.editWordModal, this.dom.deleteWordModal, this.dom.clearAllWordsModal,
            this.dom.settingsModal, this.dom.wordsModal
          ];
          const open = order.find(m => m && m.classList.contains('active'));
          if (open) this.closeModal(open);
        }
      });
    }

    async toggleFullscreen() {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else {
          throw new Error('Fullscreen mode is not supported by this browser.');
        }
      } catch (error) {
        console.error('Fullscreen toggle failed:', error);
        window.Toast.error('Unable to toggle full screen.');
      }
    }

    searchRestrictedWords(showNotification = true) {
      const text = this.dom.inputText ? this.dom.inputText.value : '';
      this.searchHasRun = true;

      if (!text) {
        this.clearSearchHighlights();
        if (showNotification) window.Toast.info('Enter a message to scan.');
        return;
      }

      const settings = window.Settings.get();
      const words = window.WordManager.getAllWords();

      let matches = [];
      try {
        matches = window.Sanitizer.findMatches(text, words, settings);
      } catch (error) {
        console.error('Unable to scan text:', error);
        window.Toast.error('Could not scan this message.');
        this.clearSearchHighlights();
        return;
      }

      this.renderSearchHighlights(text, matches);
      if (this.dom.searchResultCount) {
        this.dom.searchResultCount.textContent = matches.length ? `${matches.length} found` : 'No matches';
      }

      if (showNotification) {
        if (matches.length) {
          window.Toast.success(`Found ${matches.length} risky item(s) in this message.`);
        } else {
          window.Toast.success('No risky content found in this message.');
        }
      }
    }

    renderSearchHighlights(text, matches) {
      const layer = this.dom.inputHighlightLayer;
      if (!layer) return;

      const group = layer.parentElement;
      group.classList.toggle('search-highlight-active', matches.length > 0);
      layer.replaceChildren();

      if (matches.length === 0) return;

      const fragment = document.createDocumentFragment();
      let cursor = 0;
      matches.forEach(({ start, end, type }) => {
        if (start < cursor) return;
        fragment.appendChild(document.createTextNode(text.slice(cursor, start)));
        const mark = document.createElement('mark');
        mark.className = `risk-highlight risk-${type || 'word'}`;
        mark.title = type && type !== 'word' ? `Detected ${type}` : 'Restricted word';
        mark.textContent = text.slice(start, end);
        fragment.appendChild(mark);
        cursor = end;
      });
      fragment.appendChild(document.createTextNode(text.slice(cursor)));
      layer.appendChild(fragment);
      this.syncHighlightScroll();
    }

    clearSearchHighlights() {
      if (this.dom.inputHighlightLayer) {
        this.dom.inputHighlightLayer.replaceChildren();
        this.dom.inputHighlightLayer.parentElement.classList.remove('search-highlight-active');
      }
      if (this.dom.searchResultCount) this.dom.searchResultCount.textContent = '';
    }

    syncHighlightScroll() {
      if (!this.dom.inputText || !this.dom.inputHighlightLayer) return;
      this.dom.inputHighlightLayer.scrollTop = this.dom.inputText.scrollTop;
      this.dom.inputHighlightLayer.scrollLeft = this.dom.inputText.scrollLeft;
    }

    renderOutputHighlights(segments) {
      const layer = this.dom.outputHighlightLayer;
      if (!layer) return;
      layer.replaceChildren();

      const hasReplacements = Array.isArray(segments) && segments.some(segment => segment.replaced);
      layer.parentElement.classList.toggle('output-highlight-active', hasReplacements);
      if (!hasReplacements) return;

      const fragment = document.createDocumentFragment();
      segments.forEach(({ text, replaced }) => {
        if (!replaced) {
          fragment.appendChild(document.createTextNode(text));
          return;
        }
        const mark = document.createElement('mark');
        mark.className = 'output-replaced';
        mark.title = 'Replaced by sanitizer';
        mark.textContent = text;
        fragment.appendChild(mark);
      });
      layer.appendChild(fragment);
      this.syncOutputHighlightScroll();
    }

    clearOutputHighlights() {
      this.renderOutputHighlights([]);
    }

    syncOutputHighlightScroll() {
      if (!this.dom.outputText || !this.dom.outputHighlightLayer) return;
      this.dom.outputHighlightLayer.scrollTop = this.dom.outputText.scrollTop;
      this.dom.outputHighlightLayer.scrollLeft = this.dom.outputText.scrollLeft;
    }

    handleSanitize() {
      const rawText = this.dom.inputText ? this.dom.inputText.value : '';

      if (!rawText.trim()) {
        if (this.dom.outputText) this.dom.outputText.value = '';
        this.clearOutputHighlights();
        this.updateTranslationSource('');
        this.updateOutputCounters();
        this.updateSanitizationStats('', '', {});
        return;
      }

      const words = window.WordManager.getAllWords();
      const settings = window.Settings.get();

      const { sanitizedText, stats, segments } = window.Sanitizer.sanitize(rawText, words, settings);

      if (this.dom.outputText) {
        this.dom.outputText.value = sanitizedText;
      }
      this.renderOutputHighlights(segments);

      this.updateTranslationSource(sanitizedText);
      this.updateOutputCounters();
      this.updateSanitizationStats(rawText, sanitizedText, stats);
    }

    updateTranslationSource(text) {
      if (text === this.translationSourceText) return;

      this.translationSourceText = text;
      this.showingTranslation = false;
      if (this.dom.translatedOutputText) {
        this.dom.translatedOutputText.value = '';
        this.dom.translatedOutputText.hidden = true;
      }
      if (this.dom.outputText) this.dom.outputText.hidden = false;
      if (this.dom.translateOutputBtn) {
        this.dom.translateOutputBtn.disabled = !text.trim() || this.translationInProgress;
        this.dom.translateOutputBtn.textContent = 'EN';
        this.dom.translateOutputBtn.setAttribute('aria-label', 'বাংলা অনুবাদ দেখুন');
        this.dom.translateOutputBtn.setAttribute('aria-pressed', 'false');
        this.dom.translateOutputBtn.title = 'Sanitized output বাংলায় দেখুন';
      }
    }

    async handleTranslateOutput() {
      const button = this.dom.translateOutputBtn;
      const output = this.dom.outputText;
      const translatedOutput = this.dom.translatedOutputText;
      if (!button || !output || !translatedOutput) return;

      if (this.showingTranslation) {
        this.showingTranslation = false;
        translatedOutput.hidden = true;
        output.hidden = false;
        button.textContent = 'EN';
        button.setAttribute('aria-label', 'বাংলা অনুবাদ দেখুন');
        button.setAttribute('aria-pressed', 'false');
        button.title = 'Sanitized output বাংলায় দেখুন';
        return;
      }

      const sourceText = output.value;
      const text = sourceText.trim();
      if (!text) {
        window.Toast.warning('বাংলায় অনুবাদ করার মতো sanitized text নেই।');
        return;
      }

      if (translatedOutput.value && this.translationSourceText === output.value) {
        translatedOutput.hidden = false;
        output.hidden = true;
        this.showingTranslation = true;
        button.textContent = 'BN';
        button.setAttribute('aria-label', 'English sanitized output দেখুন');
        button.setAttribute('aria-pressed', 'true');
        button.title = 'English sanitized output-এ ফিরুন';
        return;
      }

      if (typeof window.Translator === 'undefined' || typeof window.Translator.create !== 'function') {
        window.Toast.error('এই browser-এ offline বাংলা অনুবাদ সমর্থিত নয়। Chrome 138 বা নতুন সংস্করণ ব্যবহার করুন।');
        return;
      }

      this.translationInProgress = true;
      button.disabled = true;
      button.textContent = 'অনুবাদ হচ্ছে...';

      try {
        if (!this.translationEngine) {
          this.translationEngine = await this.waitForTranslation(window.Translator.create({
            sourceLanguage: 'en',
            targetLanguage: 'bn',
            monitor: (monitor) => {
              monitor.addEventListener('downloadprogress', (event) => {
                if (this.translationInProgress && Number.isFinite(event.loaded)) {
                  button.textContent = `ডাউনলোড ${Math.round(event.loaded * 100)}%`;
                }
              });
            }
          }));
        }

        const translatedText = await this.waitForTranslation(this.translationEngine.translate(sourceText));
        if (typeof translatedText !== 'string' || !translatedText.trim()) {
          throw new Error('The translation engine returned no Bengali text.');
        }
        if (output.value !== sourceText) return;

        translatedOutput.value = translatedText;
        translatedOutput.hidden = false;
        output.hidden = true;
        this.showingTranslation = true;
        button.textContent = 'BN';
        button.setAttribute('aria-label', 'English sanitized output দেখুন');
        button.setAttribute('aria-pressed', 'true');
        button.title = 'English sanitized output-এ ফিরুন';
      } catch (error) {
        if (output.value === sourceText) {
          console.error('Bengali translation failed:', error);
          window.Toast.error('বাংলা অনুবাদ করা যায়নি। এই browser-এ অনুবাদ সুবিধা বা English–Bengali model পাওয়া যাচ্ছে না।');
        }
      } finally {
        this.translationInProgress = false;
        button.disabled = !this.translationSourceText.trim();
        if (!this.showingTranslation) {
          button.textContent = 'EN';
          button.setAttribute('aria-label', 'বাংলা অনুবাদ দেখুন');
          button.setAttribute('aria-pressed', 'false');
          button.title = 'Sanitized output বাংলায় দেখুন';
        }
      }
    }

    waitForTranslation(promise) {
      let timeoutId;
      const timeout = new Promise((resolve, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Bengali translation timed out.')), 60000);
      });

      return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
    }

    updateInputCounters() {
      const text = this.dom.inputText ? this.dom.inputText.value : '';
      const charCount = window.Statistics.countCharacters(text);
      const wordCount = window.Statistics.countWords(text);

      if (this.dom.inputCharCount) this.dom.inputCharCount.textContent = charCount.toLocaleString();
      if (this.dom.inputWordCount) this.dom.inputWordCount.textContent = wordCount.toLocaleString();
      if (this.dom.inputNoSpaceCount) {
        this.dom.inputNoSpaceCount.textContent = text.replace(/\s/g, '').length.toLocaleString();
      }
      if (this.dom.inputParagraphCount) {
        const paragraphCount = text.trim() ? text.trim().split(/\n\s*\n/).filter(Boolean).length : 0;
        this.dom.inputParagraphCount.textContent = paragraphCount.toLocaleString();
      }
    }

    updateOutputCounters() {
      const text = this.dom.outputText ? this.dom.outputText.value : '';
      const charCount = window.Statistics.countCharacters(text);
      const wordCount = window.Statistics.countWords(text);

      if (this.dom.outputCharCount) this.dom.outputCharCount.textContent = charCount.toLocaleString();
      if (this.dom.outputWordCount) this.dom.outputWordCount.textContent = wordCount.toLocaleString();
      if (this.dom.shareOutputBtn) this.dom.shareOutputBtn.disabled = !text.trim();
      if (!text.trim() && this.dom.shareOutputMenu && this.dom.shareOutputBtn) {
        this.dom.shareOutputMenu.hidden = true;
        this.dom.shareOutputBtn.setAttribute('aria-expanded', 'false');
      }
    }

    updateSanitizationStats(rawText, sanitizedText, stats) {
      const summary = window.Statistics.getSummaryStats(rawText, sanitizedText, stats);

      if (this.dom.statTotalChars) this.dom.statTotalChars.textContent = summary.totalChars.toLocaleString();
      if (this.dom.statTotalWords) this.dom.statTotalWords.textContent = summary.totalWords.toLocaleString();
      if (this.dom.statDetectedWords) this.dom.statDetectedWords.textContent = summary.detectedWords.toLocaleString();
      if (this.dom.statReplacedWords) this.dom.statReplacedWords.textContent = summary.replacedWords.toLocaleString();
      if (this.dom.statUniqueMatches) this.dom.statUniqueMatches.textContent = summary.uniqueMatches.toLocaleString();

      this.updateRiskUI(stats);

      if (this.dom.statMatchedTags) {
        this.dom.statMatchedTags.innerHTML = '';
        if (summary.matchedList && summary.matchedList.length > 0) {
          summary.matchedList.forEach(word => {
            const tag = document.createElement('span');
            tag.className = 'matched-tag';
            tag.textContent = word;
            this.dom.statMatchedTags.appendChild(tag);
          });
        } else {
          const emptyMsg = document.createElement('span');
          emptyMsg.className = 'text-muted-sm';
          emptyMsg.textContent = 'None detected';
          this.dom.statMatchedTags.appendChild(emptyMsg);
        }
      }
    }

    refreshSanitization() {
      this.handleSanitize();
      if (this.searchHasRun) this.searchRestrictedWords(false);
    }

    updateRiskUI(stats = {}) {
      if (!this.dom.riskMeter || !window.Risk) return;

      const risk = window.Risk.evaluate(stats);
      this.dom.riskMeter.dataset.level = risk.level;
      this.dom.riskMeter.title = risk.reasons.length
        ? risk.reasons.join(' • ')
        : 'No risky content detected';

      if (this.dom.riskLabel) this.dom.riskLabel.textContent = risk.label;
      if (this.dom.riskDetail) this.dom.riskDetail.textContent = risk.detail;
      if (this.dom.riskScore) this.dom.riskScore.textContent = String(risk.score);
    }

    handleDownloadResult() {
      const outputText = this.dom.outputText ? this.dom.outputText.value : '';
      if (!outputText.trim()) {
        window.Toast.warning('There is no sanitized text to download.');
        return;
      }

      window.ImportExport.downloadFile(
        outputText,
        'sanitized-message.txt',
        'text/plain;charset=utf-8'
      );
      window.Toast.success('Sanitized message downloaded.');
    }

    handleCopyResult() {
      const outputText = this.dom.outputText ? this.dom.outputText.value : '';
      if (!outputText) {
        window.Toast.warning('There is no sanitized text to copy.');
        return;
      }

      navigator.clipboard.writeText(outputText)
        .then(() => {
          window.Toast.success('Copied sanitized text to clipboard!');
          if (this.dom.copyResultBtn) {
            this.dom.copyResultBtn.classList.add('btn-copied');
            this.dom.copyResultBtn.setAttribute('title', 'Copied');
            setTimeout(() => {
              this.dom.copyResultBtn.classList.remove('btn-copied');
              this.dom.copyResultBtn.setAttribute('title', 'Copy sanitized output');
            }, 2000);
          }
        })
        .catch((err) => {
          console.error('Clipboard copy failed:', err);
          try {
            this.dom.outputText.select();
            document.execCommand('copy');
            window.Toast.success('Copied to clipboard!');
          } catch (e) {
            window.Toast.error('Failed to copy to clipboard.');
          }
        });
    }

    handleShareOutput(platform) {
      const outputText = this.dom.outputText ? this.dom.outputText.value.trim() : '';
      if (!outputText) {
        window.Toast.warning('There is no sanitized text to share.');
        return;
      }

      const shareUrls = {
        whatsapp: `https://wa.me/?text=${encodeURIComponent(outputText)}`,
        telegram: `https://t.me/share/url?url=&text=${encodeURIComponent(outputText)}`,
        facebook: 'https://www.facebook.com/',
        linkedin: 'https://www.linkedin.com/feed/'
      };
      const shareUrl = shareUrls[platform];
      if (!shareUrl) {
        window.Toast.error('This sharing option is not available.');
        return;
      }

      const shareWindow = window.open(shareUrl, '_blank');
      if (shareWindow) shareWindow.opener = null;
      if (platform === 'facebook' || platform === 'linkedin') {
        if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
          window.Toast.warning(`Open ${platform}; copy the sanitized text before sharing.`);
          return;
        }

        navigator.clipboard.writeText(outputText)
          .then(() => window.Toast.info(`Sanitized text copied. Paste it into your ${platform} post.`))
          .catch((error) => {
            console.error('Clipboard copy for sharing failed:', error);
            window.Toast.warning(`Facebook/LinkedIn opened, but the text could not be copied. Copy it here before sharing.`);
          });
        return;
      }

      if (!shareWindow) {
        window.Toast.warning('Your browser blocked the share window. Allow pop-ups and try again.');
      }
    }

    handleClearInput(showNotification = true) {
      if (this.dom.inputText) {
        this.dom.inputText.value = '';
        this.updateActiveDocument();
        this.updateInputCounters();
        this.handleSanitize();
        if (this.searchHasRun) this.searchRestrictedWords(false);
        else this.clearSearchHighlights();
        if (showNotification) window.Toast.info('Input text cleared.');
      }
    }

    handleClearResult(showNotification = true) {
      if (this.dom.outputText) {
        this.dom.outputText.value = '';
        this.clearOutputHighlights();
        this.updateTranslationSource('');
        this.updateOutputCounters();
        this.updateSanitizationStats('', '', {});
        if (showNotification) window.Toast.info('Sanitized result cleared.');
      }
    }

    handleClearAll() {
      this.handleClearInput(false);
      this.handleClearResult(false);
      this.updateSanitizationStats('', '', { detectedCount: 0, replacementCount: 0, uniqueMatchesCount: 0, matchedList: [] });
      window.Toast.info('All input and statistics cleared.');
    }

    handleAddWord() {
      const inputVal = this.dom.newWordInput ? this.dom.newWordInput.value : '';
      const result = window.WordManager.addWord(inputVal);
      if (result) {
        this.dom.newWordInput.value = '';
        this.renderWordList();
        this.refreshSanitization();
      }
    }

    renderWordList() {
      const words = window.WordManager.getWords();
      const totalCount = window.WordManager.getTotalCount();
      const activeCount = window.WordManager.getActiveCount();

      if (this.dom.totalWordsBadge) this.dom.totalWordsBadge.textContent = totalCount;
      if (this.dom.activeWordsBadge) this.dom.activeWordsBadge.textContent = activeCount;

      if (!this.dom.wordListContainer) return;

      this.dom.wordListContainer.innerHTML = '';

      if (words.length === 0) {
        const isSearching = !!window.WordManager.searchQuery;
        this.dom.wordListContainer.innerHTML = `
          <div class="empty-state">
            <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <p class="empty-title">${isSearching ? 'No matching words found' : 'No restricted words added yet'}</p>
            <p class="empty-desc">${isSearching ? 'Try clearing your search query.' : 'Add your first blocked word using the form above.'}</p>
          </div>
        `;
        return;
      }

      const table = document.createElement('table');
      table.className = 'word-table';
      table.innerHTML = `
        <thead>
          <tr>
            <th>Word</th>
            <th>Category</th>
            <th>Status</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;

      const tbody = table.querySelector('tbody');

      words.forEach((item) => {
        const tr = document.createElement('tr');
        tr.dataset.id = item.id;

        const tdWord = document.createElement('td');
        tdWord.className = 'word-cell';
        const wordSpan = document.createElement('span');
        wordSpan.className = 'word-text';
        wordSpan.textContent = item.word;
        tdWord.appendChild(wordSpan);

        const tdCategory = document.createElement('td');
        tdCategory.className = 'category-cell';
        const category = item.category || window.DefaultWords.getCategory(item.word);
        const categoryMeta = window.DefaultWords.CATEGORY_META[category] || { label: 'Sensitive' };
        const categoryBadge = document.createElement('span');
        categoryBadge.className = `category-badge category-${category}`;
        categoryBadge.textContent = categoryMeta.label;
        tdCategory.appendChild(categoryBadge);

        const tdStatus = document.createElement('td');
        const statusBadge = document.createElement('button');
        statusBadge.className = `status-badge ${item.active !== false ? 'active' : 'inactive'}`;
        statusBadge.setAttribute('title', 'Click to toggle active status');
        statusBadge.textContent = item.active !== false ? 'Active' : 'Disabled';
        statusBadge.addEventListener('click', () => {
          window.WordManager.toggleStatus(item.id);
          this.renderWordList();
          this.refreshSanitization();
        });
        tdStatus.appendChild(statusBadge);

        const tdActions = document.createElement('td');
        tdActions.className = 'actions-cell';

        const editBtn = document.createElement('button');
        editBtn.className = 'btn-action btn-edit';
        editBtn.setAttribute('aria-label', `Edit ${item.word}`);
        editBtn.innerHTML = `<svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
        editBtn.addEventListener('click', () => this.openEditModal(item));

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-action btn-delete';
        deleteBtn.setAttribute('aria-label', `Delete ${item.word}`);
        deleteBtn.innerHTML = `<svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
        deleteBtn.addEventListener('click', () => this.openDeleteModal(item));

        tdActions.appendChild(editBtn);
        tdActions.appendChild(deleteBtn);

        tr.appendChild(tdWord);
        tr.appendChild(tdCategory);
        tr.appendChild(tdStatus);
        tr.appendChild(tdActions);

        tbody.appendChild(tr);
      });

      this.dom.wordListContainer.appendChild(table);
    }

    openEditModal(item) {
      this.editingWordId = item.id;
      if (this.dom.editWordInput) {
        this.dom.editWordInput.value = item.word;
      }
      this.openModal(this.dom.editWordModal);
      setTimeout(() => {
        if (this.dom.editWordInput) {
          this.dom.editWordInput.focus();
          this.dom.editWordInput.select();
        }
      }, 100);
    }

    handleSaveEdit() {
      if (!this.editingWordId) return;
      const newWord = this.dom.editWordInput ? this.dom.editWordInput.value : '';
      const success = window.WordManager.updateWord(this.editingWordId, newWord);
      if (success) {
        this.closeModal(this.dom.editWordModal);
        this.editingWordId = null;
        this.renderWordList();
        this.refreshSanitization();
      }
    }

    openDeleteModal(item) {
      this.deletingWordId = item.id;
      if (this.dom.deleteWordMessage) {
        this.dom.deleteWordMessage.textContent = `Are you sure you want to remove "${item.word}" from your restricted word list?`;
      }
      this.openModal(this.dom.deleteWordModal);
    }

    handleConfirmDelete() {
      if (!this.deletingWordId) return;
      const success = window.WordManager.deleteWord(this.deletingWordId);
      if (success) {
        this.closeModal(this.dom.deleteWordModal);
        this.deletingWordId = null;
        this.renderWordList();
        this.refreshSanitization();
      }
    }

    openModal(modal) {
      if (!modal) return;
      if (!modal.classList.contains('active')) {
        modal._returnFocus = document.activeElement;
      }
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';

      setTimeout(() => {
        if (!modal.classList.contains('active')) return;
        const target = modal.querySelector('[data-autofocus]') ||
          modal.querySelector('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])');
        if (target) target.focus();
      }, 60);
    }

    closeModal(modal) {
      if (!modal) return;
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      if (!document.querySelector('.modal-backdrop.active')) {
        document.body.style.overflow = '';
        const returnFocus = modal._returnFocus;
        if (returnFocus && typeof returnFocus.focus === 'function' && document.contains(returnFocus)) {
          returnFocus.focus();
        }
      }
    }

    renderSettingsUI() {
      const opts = window.Settings.get();

      if (this.dom.replacementStyleSelect) {
        this.dom.replacementStyleSelect.value = opts.replacementStyle || 'hyphenated-all';
      }

      if (this.dom.sanitizerSymbolInput) {
        this.dom.sanitizerSymbolInput.value = opts.sanitizerSymbol || '-';
      }

      if (this.dom.customReplacementInput) {
        this.dom.customReplacementInput.value = opts.customReplacement || '[FILTERED]';
      }

      this.toggleCustomReplacementVisibility(opts.replacementStyle);

      if (this.dom.caseSensitiveToggle) {
        this.dom.caseSensitiveToggle.checked = !!opts.caseSensitive;
      }

      if (this.dom.wholeWordToggle) {
        this.dom.wholeWordToggle.checked = !!opts.wholeWord;
      }

      if (this.dom.preserveLengthToggle) {
        this.dom.preserveLengthToggle.checked = !!opts.preserveLength;
      }

      if (this.dom.detectEmailsToggle) this.dom.detectEmailsToggle.checked = opts.detectEmails !== false;
      if (this.dom.detectPhonesToggle) this.dom.detectPhonesToggle.checked = opts.detectPhones !== false;
      if (this.dom.detectLinksToggle) this.dom.detectLinksToggle.checked = opts.detectLinks !== false;
      if (this.dom.detectHandlesToggle) this.dom.detectHandlesToggle.checked = opts.detectHandles !== false;
      if (this.dom.smartLabelsToggle) this.dom.smartLabelsToggle.checked = opts.smartLabels !== false;
    }

    toggleCustomReplacementVisibility(style) {
      if (!this.dom.customReplacementGroup) return;
      if (style === 'custom') {
        this.dom.customReplacementGroup.style.display = 'block';
      } else {
        this.dom.customReplacementGroup.style.display = 'none';
      }
    }

    setupDragAndDrop() {
      const dropZone = this.dom.dropZone;
      if (!dropZone) return;

      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.body.addEventListener(eventName, (e) => e.preventDefault(), false);
      });

      ['dragenter', 'dragover'].forEach(eventName => {
        document.body.addEventListener(eventName, () => {
          dropZone.classList.add('drag-active');
        }, false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
          if (e.target === dropZone || !dropZone.contains(e.relatedTarget)) {
            dropZone.classList.remove('drag-active');
          }
        }, false);
      });

      document.body.addEventListener('drop', (e) => {
        dropZone.classList.remove('drag-active');
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
          const file = files[0];
          if (file.name.endsWith('.txt')) {
            window.ImportExport.importTXT(file, () => {
              this.renderWordList();
              this.refreshSanitization();
            });
          } else if (file.name.endsWith('.json')) {
            window.ImportExport.importJSON(file, () => {
              this.renderWordList();
              this.renderSettingsUI();
              this.refreshSanitization();
            });
          } else {
            window.Toast.error('Please drag and drop a valid .txt or .json file.');
          }
        }
      }, false);
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      await window.DefaultWords.load();
    } catch (error) {
      console.error('Default word list failed to load:', error);
      alert('Could not load the default word list (data/defaultWords.json).');
      return;
    }
    const app = new App();
    app.init();
  });
})();
