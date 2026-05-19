document.addEventListener('DOMContentLoaded', () => {
  const MOODLE_COURSE_URL = 'moodle.bgu.ac.il/moodle/course/view.php';
  const GITHUB_REPO = 'shpigelgi/moodle-bgu-pdf-downloader';
  const GITHUB_ISSUE_SUMMARY_MAX = 2000;
  const SECTION_SEARCH_MIN = 6;
  const TAB_MESSAGE_TIMEOUT_MS = 20000;

  const $ = (id) => document.getElementById(id);

  const shell = $('shell');
  const panel = $('panel');
  const emptyState = $('empty-state');
  const statusEl = $('status');
  const failureList = $('failure-list');
  const scanBtn = $('scan');
  const downloadBtn = $('download');
  const cancelBtn = $('cancel-download');
  const sectionDropdown = $('section-dropdown');
  const sectionToggle = $('section-toggle');
  const sectionMenu = $('section-menu');
  const sectionSearch = $('section-search');
  const sectionBlock = sectionDropdown?.closest('.block--sections');
  const dropdownText = sectionToggle?.querySelector('.dropdown-text');
  const courseTagline = $('course-tagline');
  const openCourseBtn = $('open-course');
  const scanResults = $('scan-results');
  const scanSummary = $('scan-summary');
  const pathPreview = $('path-preview');
  const pathNote = $('path-note');
  const fileList = $('file-list');
  const fileListDetails = $('file-list-details');
  const fileListToggle = $('file-list-toggle');
  const lastScanEl = $('last-scan');
  const progressWrap = $('progress-wrap');
  const progressFill = $('progress-fill');
  const progressText = $('progress-text');
  const prefixInput = $('filename-prefix');
  const openDownloadsBtn = $('open-downloads');
  const reportIssueBtn = $('report-issue');
  const localeToggle = $('locale-toggle');
  const localeToggleEmpty = $('locale-toggle-empty');
  const foot = $('foot');

  let locale = 'en';
  let hasScannedOnce = false;
  let scanGeneration = 0;
  let scanInFlight = false;
  let fullScanComplete = false;
  let suppressSectionEvents = false;
  let suppressFilterEvents = false;
  let activeTabId = null;
  let activeTabUrl = null;
  let courseId = null;

  let allScannedLinks = [];
  let scannedLinks = [];
  let scannedCourseTitle = '';
  let scannedSections = [];
  let selectedLinkKeys = new Set();
  let preScanTypeCounts = {};

  const t = (key, vars = {}) => {
    const str = POPUP_STRINGS[locale]?.[key] || POPUP_STRINGS.en[key] || key;
    return formatString(str, vars);
  };

  const applyLocale = () => {
    document.documentElement.lang = locale === 'he' ? 'he' : 'en';
    shell?.classList.toggle('shell--rtl', locale === 'he');

    $('types-label') && ($('types-label').textContent = t('formats'));
    $('formats-hint') && ($('formats-hint').textContent = t('formatsHint'));
    $('sections-label') && ($('sections-label').textContent = t('sections'));
    $('section-select-all') && ($('section-select-all').textContent = t('selectAll'));
    $('section-clear') && ($('section-clear').textContent = t('clearAll'));
    $('section-current') && ($('section-current').textContent = t('currentSection'));
    $('prefix-label') && ($('prefix-label').textContent = t('prefixLabel'));
    if (prefixInput) prefixInput.placeholder = t('prefixPlaceholder');
    if (scanBtn) scanBtn.textContent = t('rescan');
    $('download-label') && ($('download-label').textContent = t('download'));
    if (cancelBtn) cancelBtn.textContent = t('cancel');
    if (openCourseBtn) openCourseBtn.textContent = t('openCourse');
    if (openDownloadsBtn) openDownloadsBtn.textContent = t('openDownloads');
    if (reportIssueBtn) reportIssueBtn.textContent = t('reportIssue');
    if (pathNote) pathNote.textContent = t('pathNote');
    $('empty-state-title') && ($('empty-state-title').textContent = t('wrongPageTitle'));
    $('empty-state-body') && ($('empty-state-body').textContent = t('wrongPageBody'));
    $('open-moodle') && ($('open-moodle').textContent = t('openMoodle'));
    const localeLabel = t('localeToggle');
    if (localeToggle) localeToggle.textContent = localeLabel;
    if (localeToggleEmpty) localeToggleEmpty.textContent = localeLabel;
    if (scanBtn) scanBtn.hidden = !hasScannedOnce;
    if (sectionSearch) sectionSearch.placeholder = t('sectionSearch');

    if (scannedSections.length === 0) {
      setDropdownAllLabel();
    }
    generateFileTypeCheckboxes();
    if (Object.keys(preScanTypeCounts).length) {
      updateFileTypeCheckboxes(lastKnownAvailableTypes, preScanTypeCounts);
    }
  };

  let lastKnownAvailableTypes = [];

  const setDropdownAllLabel = () => {
    const allSpan = sectionMenu?.querySelector('input[value="__all__"] + span');
    if (allSpan) allSpan.textContent = t('allSections');
  };

  const setSectionDropdownOpen = (isOpen) => {
    sectionDropdown.classList.toggle('open', isOpen);
    sectionToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    sectionBlock?.classList.toggle('is-dropdown-open', isOpen);
  };

  const setStatus = (message, tone = 'default') => {
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.dataset.tone = tone;
    }
    failureList.hidden = true;
    failureList.innerHTML = '';
  };

  const showFailures = (failures) => {
    if (!failures?.length) return;
    failureList.hidden = false;
    failureList.innerHTML = '';
    failures.forEach((f) => {
      const li = document.createElement('li');
      li.textContent = `${f.title}: ${f.error}`;
      failureList.appendChild(li);
    });
  };

  const setProgress = (visible, percent = null, text = '') => {
    const wasHidden = progressWrap.hidden;
    progressWrap.hidden = !visible;
    if (wasHidden !== !visible) scheduleResize();
    if (percent == null) {
      progressFill.style.width = '';
      progressFill.classList.add('progress-bar__fill--indeterminate');
    } else {
      progressFill.classList.remove('progress-bar__fill--indeterminate');
      progressFill.style.width = `${Math.min(100, percent)}%`;
    }
    progressText.textContent = text;
  };

  const updateCourseHeader = (title) => {
    if (!courseTagline) return;
    const trimmed = (title || '').trim();
    const isCourse = Boolean(trimmed && trimmed !== 'Moodle Course');
    courseTagline.textContent = isCourse ? trimmed : t('ready');
    courseTagline.title = trimmed;
    courseTagline.dataset.hasCourse = isCourse ? 'true' : 'false';
    openCourseBtn.hidden = !activeTabId;
  };

  const isMoodleCourseTab = (tab) => Boolean(tab?.url?.includes(MOODLE_COURSE_URL));

  const showWrongPage = () => {
    panel.hidden = true;
    emptyState.hidden = false;
    if (foot) foot.hidden = false;
    updateCourseHeader('');
    setStatus(t('wrongPageBody'), 'warn');
    if (scanBtn) scanBtn.disabled = true;
    scheduleResize();
  };

  const showPanel = () => {
    panel.hidden = false;
    emptyState.hidden = true;
    if (foot) foot.hidden = true;
    scheduleResize();
  };

  const appendAllSectionsItem = () => {
    const item = document.createElement('div');
    item.className = 'dropdown-item dropdown-item--all';

    const label = document.createElement('label');
    label.className = 'dropdown-checkbox-label';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = '__all__';
    input.checked = true;
    input.setAttribute('data-section-checkbox', '');

    const span = document.createElement('span');
    span.textContent = t('allSections');

    label.appendChild(input);
    label.appendChild(span);
    item.appendChild(label);
    sectionMenu.appendChild(item);
  };

  const populateSections = (sections) => {
    if (!Array.isArray(sections) || sections.length === 0) return;

    sectionMenu.innerHTML = '';
    appendAllSectionsItem();

    sections.forEach((section) => {
      if (!section || typeof section !== 'string') return;

      const item = document.createElement('div');
      item.className = 'dropdown-item';
      item.dataset.sectionName = section;

      const label = document.createElement('label');
      label.className = 'dropdown-checkbox-label';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = section;
      input.setAttribute('data-section-checkbox', '');

      const span = document.createElement('span');
      span.textContent = section;

      label.appendChild(input);
      label.appendChild(span);
      item.appendChild(label);
      sectionMenu.appendChild(item);
    });

    sectionSearch.hidden = sections.length < SECTION_SEARCH_MIN;
    updateDropdownText();
  };

  const filterSectionItems = (query) => {
    const q = query.trim().toLowerCase();
    sectionMenu.querySelectorAll('.dropdown-item:not(.dropdown-item--all)').forEach((item) => {
      const name = item.dataset.sectionName || '';
      item.hidden = q && !name.toLowerCase().includes(q);
    });
  };

  const getSelectedSections = () => {
    const selected = Array.from(
      sectionMenu.querySelectorAll('input[data-section-checkbox]:checked')
    ).map((cb) => cb.value);

    // Empty selection shows "All sections" in the UI; treat as no filter (same as __all__).
    if (selected.length === 0 || selected.includes('__all__')) return null;
    return selected;
  };

  const getSelectedFileTypes = () => {
    const types = Array.from(
      document.querySelectorAll('input[name="filetype"]:checked:not(:disabled)')
    ).map((cb) => cb.value);
    return types.length > 0 ? types : ['pdf'];
  };

  const getAllOfferedFileTypes = () =>
    Object.keys(FILE_TYPES).filter((type) =>
      typeof isOfferedFileType === 'function' ? isOfferedFileType(type) : type !== 'text'
    );

  const filterLinksByFileTypes = (links, fileTypes) => {
    if (!fileTypes?.length) return [];
    return links.filter((link) => matchesFileTypes(link.url, fileTypes));
  };

  const getTypesAndCountsFromLinks = (links) => {
    const types = new Set();
    links.forEach((link) => {
      const type = getTypeForUrl(link.url);
      if (type) types.add(type);
    });
    return {
      types: Array.from(types).sort(),
      counts: countByType(links)
    };
  };

  const getTypesAndCountsForSections = (sections) => {
    const sectionLinks = filterLinksBySections(allScannedLinks, sections);
    return getTypesAndCountsFromLinks(sectionLinks);
  };

  const formatSummary = (links) => {
    const counts = countByType(links);
    const total = links.length;
    const parts = Object.entries(counts).map(([type, n]) => {
      const label = FILE_TYPES[type]?.label || type;
      return `${n} ${label}`;
    });
    return parts.length ? `${total} files · ${parts.join(' · ')}` : `${total} files`;
  };

  const updateDropdownText = () => {
    const selected = Array.from(
      sectionMenu.querySelectorAll('input[data-section-checkbox]:checked')
    ).map((cb) => cb.value);

    if (selected.includes('__all__') || selected.length === 0) {
      dropdownText.textContent = t('allSections');
    } else if (selected.length === 1) {
      const checkbox = Array.from(
        sectionMenu.querySelectorAll('input[data-section-checkbox]')
      ).find((cb) => cb.value === selected[0]);
      dropdownText.textContent =
        checkbox?.closest('label')?.querySelector('span')?.textContent || selected[0];
    } else {
      dropdownText.textContent = t('sectionsSelected', { n: selected.length });
    }
  };

  const applySectionSelection = (sections) => {
    suppressSectionEvents = true;
    try {
      if (!sections) {
        const all = sectionMenu.querySelector('input[value="__all__"]');
        if (all) all.checked = true;
        sectionMenu.querySelectorAll('input[data-section-checkbox]:not([value="__all__"])').forEach((cb) => {
          cb.checked = false;
        });
      } else {
        const all = sectionMenu.querySelector('input[value="__all__"]');
        if (all) all.checked = false;
        sectionMenu.querySelectorAll('input[data-section-checkbox]').forEach((cb) => {
          if (cb.value === '__all__') return;
          cb.checked = sections.includes(cb.value);
        });
      }
      updateDropdownText();
    } finally {
      suppressSectionEvents = false;
    }
  };

  const savePrefs = () => {
    if (!courseId) return;
    const prefs = {
      fileTypes: getSelectedFileTypes(),
      sections: getSelectedSections(),
      prefix: prefixInput?.value || '',
      locale
    };
    chrome.storage.local.set({ [`prefs:${courseId}`]: prefs });
  };

  const loadPrefs = async () => {
    if (!courseId) return;
    const data = await chrome.storage.local.get([`prefs:${courseId}`, 'locale']);
    if (data.locale) locale = data.locale;
    const prefs = data[`prefs:${courseId}`];
    if (prefs?.prefix != null) prefixInput.value = prefs.prefix;
    if (prefs?.fileTypes?.length) {
      suppressFilterEvents = true;
      try {
        document.querySelectorAll('input[name="filetype"]').forEach((cb) => {
          cb.checked = prefs.fileTypes.includes(cb.value);
        });
      } finally {
        suppressFilterEvents = false;
      }
    }
    if (prefs?.sections !== undefined) {
      const sections =
        Array.isArray(prefs.sections) && prefs.sections.length === 0 ? null : prefs.sections;
      applySectionSelection(sections);
    }
  };

  const saveLastScan = (count) => {
    if (!courseId) return;
    chrome.storage.local.set({
      [`lastScan:${courseId}`]: {
        count,
        timestamp: Date.now(),
        courseTitle: scannedCourseTitle
      }
    });
  };

  const loadLastScan = async () => {
    if (!courseId || !lastScanEl) return;
    const data = await chrome.storage.local.get(`lastScan:${courseId}`);
    const last = data[`lastScan:${courseId}`];
    if (!last) {
      lastScanEl.hidden = true;
      return;
    }
    const mins = Math.round((Date.now() - last.timestamp) / 60000);
    const time =
      mins < 1 ? (locale === 'he' ? 'עכשיו' : 'just now') : locale === 'he' ? `לפני ${mins} דק׳` : `${mins}m ago`;
    lastScanEl.textContent = t('lastScan', { count: last.count, time });
    lastScanEl.hidden = false;
  };

  const renderFileList = (links) => {
    fileList.innerHTML = '';
    const sectionOrder = [];
    links.forEach((link) => {
      if (!sectionOrder.includes(link.section)) sectionOrder.push(link.section);
    });

    sectionOrder.forEach((section) => {
      const header = document.createElement('div');
      header.className = 'file-list__section';
      header.textContent = section;
      fileList.appendChild(header);

      links
        .filter((l) => l.section === section)
        .forEach((link) => {
          const key = linkKey(link);
          const row = document.createElement('label');
          row.className = 'file-list__row';

          const input = document.createElement('input');
          input.type = 'checkbox';
          input.checked = selectedLinkKeys.has(key);
          input.dataset.linkKey = key;

          const span = document.createElement('span');
          span.textContent = link.title;
          span.dir = 'auto';

          input.addEventListener('change', () => {
            if (input.checked) selectedLinkKeys.add(key);
            else selectedLinkKeys.delete(key);
            updateDownloadEnabled();
          });

          row.appendChild(input);
          row.appendChild(span);
          fileList.appendChild(row);
        });
    });

    fileListToggle.textContent = fileListDetails.open ? t('hideFiles') : t('showFiles');
  };

  const getCheckedLinks = () => {
    return scannedLinks.filter((link) => selectedLinkKeys.has(linkKey(link)));
  };

  const updateDownloadEnabled = () => {
    const checked = getCheckedLinks();
    downloadBtn.disabled = checked.length === 0;
  };

  const showScanResults = (links) => {
    scanResults.hidden = false;
    scanSummary.textContent = formatSummary(links);
    scheduleResize();

    if (links.length > 0) {
      const first = links[0];
      const ext = getFileExtension(first.url, first.title);
      let name = first.title;
      if (!/\.[a-z0-9]+$/i.test(name)) name += `.${ext}`;
      const prefix = prefixInput?.value?.trim() || '';
      if (prefix) name = `${prefix}${name}`;
      pathPreview.textContent = `${t('pathPreview')}: Downloads/${buildDownloadPath(scannedCourseTitle, first.section, name)}`;
    }

    selectedLinkKeys = new Set(links.map(linkKey));
    renderFileList(links);
    updateDownloadEnabled();
    downloadBtn.disabled = links.length === 0;
  };

  const hideScanResults = () => {
    scanResults.hidden = true;
    downloadBtn.disabled = true;
  };

  sectionMenu.addEventListener('change', async (event) => {
    if (suppressSectionEvents) return;
    const checkbox = event.target;
    if (!checkbox.matches('input[data-section-checkbox]')) return;

    const allCheckbox = sectionMenu.querySelector('input[value="__all__"]');
    const otherCheckboxes = Array.from(
      sectionMenu.querySelectorAll('input[data-section-checkbox]')
    ).filter((cb) => cb.value !== '__all__');

    if (checkbox.value === '__all__') {
      if (checkbox.checked) otherCheckboxes.forEach((cb) => { cb.checked = false; });
    } else {
      if (checkbox.checked && allCheckbox) allCheckbox.checked = false;
      if (!otherCheckboxes.some((cb) => cb.checked) && allCheckbox) allCheckbox.checked = true;
    }

    updateDropdownText();
    updateFiltersFromCache();
  });

  sectionSearch?.addEventListener('input', () => filterSectionItems(sectionSearch.value));

  $('section-select-all')?.addEventListener('click', () => {
    applySectionSelection(null);
    updateFiltersFromCache();
  });

  $('section-clear')?.addEventListener('click', () => {
    applySectionSelection(null);
    updateFiltersFromCache();
  });

  $('section-current')?.addEventListener('click', async () => {
    try {
      const res = await sendTabMessage(activeTabId, { type: 'get_visible_section' });
      if (res?.section) {
        applySectionSelection([res.section]);
        updateFiltersFromCache();
      }
    } catch (e) {
      console.warn('[Popup] visible section:', e);
    }
  });

  panel?.addEventListener('change', (e) => {
    if (suppressFilterEvents) return;
    if (e.target.matches('input[name="filetype"]')) {
      updateFiltersFromCache();
    }
  });

  sectionToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    setSectionDropdownOpen(!sectionDropdown.classList.contains('open'));
  });

  document.addEventListener('click', (e) => {
    if (!sectionDropdown.contains(e.target)) setSectionDropdownOpen(false);
  });

  fileListDetails?.addEventListener('toggle', () => {
    fileListToggle.textContent = fileListDetails.open ? t('hideFiles') : t('showFiles');
    scheduleResize();
  });

  const injectContentScript = async (tabId) => {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/utils.js', 'src/content.js']
    });
  };

  const isConnectionError = (error) =>
    /receiving end does not exist|could not establish connection/i.test(error?.message || '');

  const sendTabMessageOnce = (tabId, message, timeoutMs = TAB_MESSAGE_TIMEOUT_MS) =>
    new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(
          new Error(
            'The course page did not respond in time. Refresh the Moodle tab and open the popup again.'
          )
        );
      }, timeoutMs);

      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });

  const sendTabMessage = async (tabId, message, timeoutMs = TAB_MESSAGE_TIMEOUT_MS) => {
    try {
      return await sendTabMessageOnce(tabId, message, timeoutMs);
    } catch (error) {
      if (!isConnectionError(error)) throw error;
      await injectContentScript(tabId);
      await new Promise((resolve) => setTimeout(resolve, 150));
      return sendTabMessageOnce(tabId, message, timeoutMs);
    }
  };

  const collectSections = (tabId) => sendTabMessage(tabId, { type: 'collect_sections' });

  const collectLinks = (tabId, fileTypes, sections = null) =>
    sendTabMessage(tabId, { type: 'collect_links', fileTypes, sections });

  const queryAvailableFileTypes = async (tabId, sections) => {
    try {
      const response = await sendTabMessage(tabId, { type: 'get_available_types', sections });
      if (response?.ok === false) {
        throw new Error(response?.error || 'Could not read file types');
      }
      const types = response?.availableTypes || (Array.isArray(response) ? response : []);
      const counts = response?.typeCounts || {};
      return { types, counts };
    } catch (error) {
      console.warn('[Popup] queryAvailableFileTypes:', error.message);
      return { types: [], counts: {} };
    }
  };

  const startDownload = (links, courseTitle, filenamePrefix) =>
    new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'download_links',
          links,
          courseTitle: courseTitle || 'Moodle Course',
          filenamePrefix: filenamePrefix || ''
        },
        (response) => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else if (!response?.ok) reject(new Error(response?.error || 'Download failed'));
          else resolve(response);
        }
      );
    });

  const getFileExtension = (url, title) => {
    if (typeof FILE_TYPES === 'undefined') return 'pdf';
    const allExtensions = [];
    Object.values(FILE_TYPES).forEach((type) => {
      if (type.extensions) allExtensions.push(...type.extensions);
    });
    const extRegex = new RegExp(`\\.(${allExtensions.join('|')})$`, 'i');
    try {
      const m = new URL(url).pathname.match(extRegex);
      if (m) return m[1].toLowerCase();
    } catch (e) {
      // ignore
    }
    const tm = title.match(extRegex);
    return tm ? tm[1].toLowerCase() : 'pdf';
  };

  const generateFileTypeCheckboxes = () => {
    const container = document.querySelector('.file-types');
    if (!container || typeof FILE_TYPES === 'undefined') return;

    const checked = new Set(getSelectedFileTypes());
    container.innerHTML = '';

    Object.entries(FILE_TYPES).forEach(([type, config]) => {
      if (typeof isOfferedFileType === 'function' && !isOfferedFileType(type)) return;

      const label = document.createElement('label');
      label.className = 'type-chip is-disabled';
      label.dataset.type = type;

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = 'filetype';
      input.value = type;
      input.checked = checked.has(type) || (checked.size === 0 && type === 'pdf');

      const mark = document.createElement('span');
      mark.className = 'type-chip__mark';
      mark.setAttribute('aria-hidden', 'true');

      const text = document.createElement('span');
      text.className = 'type-chip__label';
      const count = preScanTypeCounts[type];
      const typeLabel = locale === 'he' && config.labelHe ? config.labelHe : config.label;
      text.textContent = count ? `${typeLabel} (${count})` : typeLabel;

      label.appendChild(input);
      label.appendChild(mark);
      label.appendChild(text);
      container.appendChild(label);
    });
  };

  const updateFileTypeCheckboxes = (availableTypes, typeCounts = {}) => {
    lastKnownAvailableTypes = availableTypes;
    if (typeCounts && Object.keys(typeCounts).length) {
      preScanTypeCounts = typeCounts;
    }

    suppressFilterEvents = true;
    document.querySelectorAll('input[name="filetype"]').forEach((checkbox) => {
      const isAvailable = availableTypes.includes(checkbox.value);
      checkbox.disabled = !isAvailable;
      if (!isAvailable && checkbox.checked) checkbox.checked = false;

      const label = checkbox.closest('.type-chip');
      label?.classList.toggle('is-disabled', !isAvailable);

      const text = label?.querySelector('.type-chip__label');
      if (text) {
        const config = FILE_TYPES[checkbox.value];
        const typeLabel = locale === 'he' && config?.labelHe ? config.labelHe : config?.label || checkbox.value;
        const n = typeCounts[checkbox.value] || preScanTypeCounts[checkbox.value];
        text.textContent = n ? `${typeLabel} (${n})` : typeLabel;
      }
    });

    if (availableTypes.length > 0) {
      const anyChecked = Array.from(document.querySelectorAll('input[name="filetype"]')).some(
        (cb) => cb.checked && !cb.disabled
      );
      if (!anyChecked) {
        const first = Array.from(document.querySelectorAll('input[name="filetype"]')).find((cb) => !cb.disabled);
        if (first) first.checked = true;
      }
    }
    suppressFilterEvents = false;
  };

  const filterLinksBySections = (links, selectedSections) => {
    if (!selectedSections || selectedSections.length === 0) return links;
    return links.filter((link) => selectedSections.includes(link.section));
  };

  const applyCurrentFilters = () => {
    if (!fullScanComplete || !allScannedLinks.length) {
      if (scanInFlight) {
        setStatus(t('scanning'));
      }
      return;
    }

    const sections = getSelectedSections();
    const fileTypes = getSelectedFileTypes();

    let filtered = filterLinksBySections(allScannedLinks, sections);
    filtered = filterLinksByFileTypes(filtered, fileTypes);

    scannedLinks = filtered;

    if (!filtered.length) {
      setStatus(t('noFiles'), 'warn');
      hideScanResults();
      downloadBtn.disabled = true;
      scheduleResize();
      return;
    }

    showScanResults(filtered);
    setStatus(t('scanDone', { summary: formatSummary(filtered) }), 'success');
    downloadBtn.disabled = false;
    scheduleResize();
  };

  const updateFiltersFromCache = () => {
    if (fullScanComplete && allScannedLinks.length) {
      const { types, counts } = getTypesAndCountsForSections(getSelectedSections());
      if (types.length) lastKnownAvailableTypes = types;
      preScanTypeCounts = counts;
      updateFileTypeCheckboxes(lastKnownAvailableTypes, counts);
    }
    applyCurrentFilters();
    savePrefs();
  };

  const runFullScan = async ({ reason = 'manual' } = {}) => {
    if (scanInFlight) {
      scanGeneration += 1;
      return;
    }

    const gen = ++scanGeneration;
    scanInFlight = true;
    fullScanComplete = false;

    if (scanBtn) scanBtn.disabled = true;
    downloadBtn.disabled = true;
    hideScanResults();
    openDownloadsBtn.hidden = true;
    setSectionDropdownOpen(false);

    setStatus(t('scanning'));
    setProgress(true, null, t('scanning'));

    const progressListener = (msg) => {
      if (msg.type === 'scan_progress' && msg.total > 0) {
        const pct = Math.round((msg.current / msg.total) * 100);
        setProgress(true, pct, `${msg.current} / ${msg.total}`);
      }
    };
    chrome.runtime.onMessage.addListener(progressListener);

    try {
      const allTypes = getAllOfferedFileTypes();
      const response = await collectLinks(activeTabId, allTypes, null);

      if (gen !== scanGeneration) return;

      if (response?.authRequired) {
        setStatus(t('authRequired'), 'error');
        return;
      }

      allScannedLinks = response?.links || [];
      scannedCourseTitle = response?.courseTitle || scannedCourseTitle || 'Moodle Course';
      updateCourseHeader(scannedCourseTitle);
      fullScanComplete = true;

      const { types, counts } = getTypesAndCountsForSections(getSelectedSections());
      if (types.length) lastKnownAvailableTypes = types;
      preScanTypeCounts = counts;
      updateFileTypeCheckboxes(lastKnownAvailableTypes, counts);

      applyCurrentFilters();
      saveLastScan(scannedLinks.length);
      hasScannedOnce = true;
      if (scanBtn) scanBtn.hidden = false;
    } catch (error) {
      if (gen !== scanGeneration) return;
      console.error('[Popup] Scan error:', error);
      if (error.authRequired) setStatus(t('authRequired'), 'error');
      else setStatus(error.message || 'Scan failed', 'error');
    } finally {
      if (gen !== scanGeneration) return;
      chrome.runtime.onMessage.removeListener(progressListener);
      setProgress(false);
      if (scanBtn) scanBtn.disabled = false;
      scanInFlight = false;
      scheduleResize();
    }
  };

  const runDownload = async () => {
    const links = getCheckedLinks();
    if (!links.length) return;

    downloadBtn.disabled = true;
    if (scanBtn) scanBtn.disabled = true;
    cancelBtn.hidden = false;
    setStatus(t('downloading'));
    setProgress(true, null, t('downloading'));

    const progressListener = (msg) => {
      if (msg.type === 'download_progress' && msg.total > 0) {
        const pct = Math.round((msg.completed / msg.total) * 100);
        setProgress(true, pct, `${msg.completed} / ${msg.total}`);
      }
    };
    chrome.runtime.onMessage.addListener(progressListener);

    try {
      const result = await startDownload(links, scannedCourseTitle, prefixInput?.value?.trim() || '');
      const failedPart = result.failed ? `, ${result.failed} failed` : '';
      setStatus(
        t('downloadDone', { ok: result.succeeded, failed: failedPart }),
        result.failed ? 'warn' : 'success'
      );
      if (result.failures?.length) showFailures(result.failures);
      openDownloadsBtn.hidden = false;
      savePrefs();
    } catch (error) {
      setStatus(error.message || 'Download failed', 'error');
    } finally {
      chrome.runtime.onMessage.removeListener(progressListener);
      setProgress(false);
      cancelBtn.hidden = true;
      if (scanBtn) scanBtn.disabled = false;
      updateDownloadEnabled();
    }
  };

  scanBtn?.addEventListener('click', () => runFullScan({ reason: 'manual' }));
  downloadBtn.addEventListener('click', runDownload);

  cancelBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'cancel_downloads' });
    setStatus(t('cancel'), 'warn');
    cancelBtn.hidden = true;
  });

  openCourseBtn.addEventListener('click', () => {
    if (activeTabId) chrome.tabs.update(activeTabId, { active: true });
  });

  openDownloadsBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'show_downloads_folder' });
  });

  const formatSectionInventory = (inventory) => {
    if (!inventory?.length) return '(no sections parsed)';
    return inventory
      .map((section) => {
        const lines = section.activities.map(
          (a) => `  - [${a.type}] ${a.name}${a.href ? ` → ${a.href}` : ''}`
        );
        return `### ${section.title}\n${lines.length ? lines.join('\n') : '  (no activities)'}`;
      })
      .join('\n\n');
  };

  const formatLinkSample = (links, limit = 50) => {
    if (!links?.length) return '(none)';
    return links
      .slice(0, limit)
      .map((link) => {
        let path = link.url;
        try {
          path = new URL(link.url).pathname;
        } catch (e) {
          // keep original
        }
        return `- [${link.section}] ${link.title} → ${path}`;
      })
      .join('\n');
  };

  const buildBugReportText = (pageContext) => {
    const manifest = chrome.runtime.getManifest();
    const sectionsFilter = getSelectedSections();
    const failures = Array.from(failureList?.querySelectorAll('li') || []).map((li) => li.textContent);

    const parts = [
      '## Course Grabber bug report',
      '',
      '### Extension state',
      `- Version: ${manifest.version}`,
      `- Browser: ${navigator.userAgent}`,
      `- UI locale: ${locale}`,
      `- Course URL: ${activeTabUrl || 'n/a'}`,
      `- Course ID: ${courseId || 'n/a'}`,
      `- Course title (popup): ${scannedCourseTitle || 'n/a'}`,
      `- Sections in dropdown: ${scannedSections.length}`,
      `- Full scan complete: ${fullScanComplete}`,
      `- Files in cache (all types/sections): ${allScannedLinks.length}`,
      `- Files after current filters: ${scannedLinks.length}`,
      `- Selected formats: ${getSelectedFileTypes().join(', ') || 'none'}`,
      `- Section filter: ${sectionsFilter?.length ? sectionsFilter.join(' | ') : 'all'}`,
      `- Last status: ${statusEl?.textContent?.trim() || 'n/a'}`,
      failures.length
        ? `- Download failures:\n${failures.map((f) => `  - ${f}`).join('\n')}`
        : null,
      '',
      '### Files found by extension (sample)',
      formatLinkSample(scannedLinks),
      allScannedLinks.length > 50 ? `\n(… ${allScannedLinks.length - 50} more in cache)` : null
    ];

    if (pageContext?.ok) {
      parts.push(
        '',
        '### Live Moodle page (from course tab)',
        `- Page URL: ${pageContext.url}`,
        `- Document title: ${pageContext.documentTitle}`,
        `- Course title (DOM): ${pageContext.courseTitle}`,
        `- Visible section: ${pageContext.visibleSection || 'n/a'}`,
        `- Section count: ${pageContext.sectionNames?.length ?? 0}`,
        `- DOM stats: ${JSON.stringify(pageContext.domStats)}`,
        '',
        '### Activities on page (by section)',
        formatSectionInventory(pageContext.sectionInventory),
        '',
        '### Course page HTML (sanitized, for layout debugging)',
        `Root: ${pageContext.pageHtmlMeta?.root}, length: ${pageContext.pageHtmlMeta?.originalLength}${
          pageContext.pageHtmlMeta?.truncated ? ' (truncated in report)' : ''
        }`,
        '',
        '```html',
        pageContext.pageHtml || '(empty)',
        '```'
      );
    } else if (pageContext?.error) {
      parts.push('', '### Live Moodle page', `Could not read page: ${pageContext.error}`);
    } else {
      parts.push('', '### Live Moodle page', '(not on a course tab — open the course page and try again)');
    }

    parts.push(
      '',
      '---',
      'Reporter: describe what you expected above. Do not include passwords.'
    );

    return parts.filter((p) => p != null).join('\n');
  };

  const buildGitHubIssueSummary = (pageContext) => {
    const manifest = chrome.runtime.getManifest();
    const sectionsFilter = getSelectedSections();

    const lines = [
      '## Course Grabber bug report',
      '',
      '**The full report (activity list + sanitized page HTML) is on your clipboard.**',
      '**Paste it below this line with Ctrl+V / Cmd+V before submitting.**',
      '',
      '### Quick summary',
      `- Extension: ${manifest.version}`,
      `- Course: ${scannedCourseTitle || 'n/a'}`,
      `- Course URL: ${activeTabUrl || 'n/a'}`,
      `- Files after filters: ${scannedLinks.length} (cache: ${allScannedLinks.length})`,
      `- Formats: ${getSelectedFileTypes().join(', ') || 'none'}`,
      `- Sections: ${sectionsFilter?.length ? sectionsFilter.join(' | ') : 'all'}`,
      `- Last status: ${statusEl?.textContent?.trim() || 'n/a'}`
    ];

    if (pageContext?.ok) {
      lines.push(
        `- Page activities: ${pageContext.domStats?.activityItems ?? '?'}`,
        `- Moodle sections: ${pageContext.sectionNames?.length ?? 0}`,
        `- HTML snapshot length: ${pageContext.pageHtmlMeta?.originalLength ?? 0} chars`
      );
    }

    lines.push(
      '',
      '### What went wrong',
      '(describe what you expected vs what happened)',
      '',
      '---',
      '### Full report (paste from clipboard)',
      ''
    );

    let summary = lines.join('\n');
    if (summary.length > GITHUB_ISSUE_SUMMARY_MAX) {
      summary = `${summary.slice(0, GITHUB_ISSUE_SUMMARY_MAX)}\n\n…`;
    }
    return summary;
  };

  const buildGitHubIssueUrl = (summaryBody, titleText) => {
    const params = new URLSearchParams({
      title: titleText,
      body: summaryBody,
      labels: 'bug'
    });
    return `https://github.com/${GITHUB_REPO}/issues/new?${params.toString()}`;
  };

  const openBugReport = async () => {
    if (reportIssueBtn) reportIssueBtn.disabled = true;
    setStatus(t('reportPreparing'));

    let pageContext = null;
    if (activeTabId && isMoodleCourseTab({ url: activeTabUrl })) {
      try {
        pageContext = await sendTabMessage(activeTabId, { type: 'collect_bug_report' });
      } catch (error) {
        pageContext = { ok: false, error: error.message };
      }
    }

    const diagnostics = buildBugReportText(pageContext);
    const titleText = `[Bug] ${
      scannedCourseTitle && scannedCourseTitle !== 'Moodle Course' ? scannedCourseTitle : 'Moodle course'
    }`;
    const issueUrl = buildGitHubIssueUrl(buildGitHubIssueSummary(pageContext), titleText);

    let copied = false;
    try {
      await navigator.clipboard.writeText(diagnostics);
      copied = true;
    } catch (e) {
      console.warn('[Popup] clipboard:', e);
    }

    chrome.tabs.create({ url: issueUrl });
    const statusMsg = copied ? t('reportCopied') : t('reportFailed');
    setStatus(statusMsg, copied ? 'success' : 'warn');
    if (reportIssueBtn) reportIssueBtn.disabled = false;
    scheduleResize();
  };

  reportIssueBtn?.addEventListener('click', openBugReport);

  prefixInput?.addEventListener('change', savePrefs);

  const toggleLocale = async () => {
    locale = locale === 'he' ? 'en' : 'he';
    await chrome.storage.local.set({ locale });
    applyLocale();
    generateFileTypeCheckboxes();
    updateFileTypeCheckboxes(lastKnownAvailableTypes, preScanTypeCounts);
    scheduleResize();
  };

  localeToggle?.addEventListener('click', toggleLocale);
  localeToggleEmpty?.addEventListener('click', toggleLocale);

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea')) return;
    if (e.key === 'Escape') setSectionDropdownOpen(false);
    if (e.key === 'Enter') {
      if (!downloadBtn.disabled && scanResults && !scanResults.hidden) runDownload();
      else if (scanBtn && !scanBtn.hidden && !scanBtn.disabled) runFullScan({ reason: 'manual' });
    }
  });

  // Chromium caps extension popups at 600px tall.
  const POPUP_MAX_HEIGHT = 600;

  let resizeDebounceTimer = null;

  const resizePopup = () => {
    const root = document.documentElement;
    const body = document.body;

    root.style.height = 'auto';
    body.style.height = 'auto';
    root.style.overflow = 'visible';
    body.style.overflow = 'visible';

    void body.offsetHeight;

    let height = Math.min(POPUP_MAX_HEIGHT, Math.ceil(root.scrollHeight));

    const applyHeight = (h) => {
      root.style.height = `${h}px`;
      body.style.height = `${h}px`;
      root.style.maxHeight = `${POPUP_MAX_HEIGHT}px`;
      body.style.maxHeight = `${POPUP_MAX_HEIGHT}px`;
      root.style.overflowX = 'hidden';
      body.style.overflowX = 'hidden';
      root.style.overflowY = 'auto';
      body.style.overflowY = 'auto';
    };

    applyHeight(height);

    // First measure can be too small (fonts, async UI). Grow or enable scroll at max height.
    if (root.scrollHeight > height + 2) {
      height = Math.min(POPUP_MAX_HEIGHT, Math.ceil(root.scrollHeight));
      applyHeight(height);
    }
  };

  const scheduleResize = () => {
    clearTimeout(resizeDebounceTimer);
    resizeDebounceTimer = setTimeout(resizePopup, 50);
    setTimeout(resizePopup, 350);
  };

  window.addEventListener('load', scheduleResize);
  if (document.fonts?.ready) {
    document.fonts.ready.then(scheduleResize);
  }

  (async () => {
    try {
      const stored = await chrome.storage.local.get('locale');
      if (stored.locale) locale = stored.locale;
      applyLocale();

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        showWrongPage();
        return;
      }

      activeTabId = tab.id;
      activeTabUrl = tab.url;
      courseId = getCourseIdFromUrl(tab.url);

      if (!isMoodleCourseTab(tab)) {
        showWrongPage();
        return;
      }

      showPanel();
      setStatus(t('loading'));
      setProgress(true, null, t('loading'));

      const response = await collectSections(activeTabId);

      scannedCourseTitle = response?.courseTitle || 'Moodle Course';
      scannedSections = response?.sections || [];
      updateCourseHeader(scannedCourseTitle);

      if (scannedSections.length > 0) {
        suppressSectionEvents = true;
        suppressFilterEvents = true;
        try {
          populateSections(scannedSections);
          await loadPrefs();
          applyLocale();

          const { types, counts } = await queryAvailableFileTypes(activeTabId, getSelectedSections() || []);
          preScanTypeCounts = counts;
          updateFileTypeCheckboxes(types, counts);

          await loadLastScan();
        } finally {
          suppressSectionEvents = false;
          suppressFilterEvents = false;
        }

        runFullScan({ reason: 'initial' });
      } else {
        setStatus(t('noFiles'), 'warn');
      }
    } catch (error) {
      console.error('[Popup] Init error:', error);
      setStatus(error.message || 'Failed to load. Refresh the course page and try again.', 'error');
    } finally {
      scheduleResize();
    }
  })();
});
