document.addEventListener('DOMContentLoaded', () => {
  const MOODLE_COURSE_URL = 'moodle.bgu.ac.il/moodle/course/view.php';
  const SECTION_SEARCH_MIN = 6;

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
  const localeToggle = $('locale-toggle');

  let locale = 'en';
  let activeTabId = null;
  let activeTabUrl = null;
  let courseId = null;

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

    $('types-label').textContent = t('formats');
    $('formats-hint').textContent = t('formatsHint');
    $('sections-label').textContent = t('sections');
    $('section-select-all').textContent = t('selectAll');
    $('section-clear').textContent = t('clearAll');
    $('section-current').textContent = t('currentSection');
    $('prefix-label').textContent = t('prefixLabel');
    prefixInput.placeholder = t('prefixPlaceholder');
    $('scan-label').textContent = t('scan');
    $('download-label').textContent = t('download');
    cancelBtn.textContent = t('cancel');
    openCourseBtn.textContent = t('openCourse');
    openDownloadsBtn.textContent = t('openDownloads');
    pathNote.textContent = t('pathNote');
    $('empty-state-title').textContent = t('wrongPageTitle');
    $('empty-state-body').textContent = t('wrongPageBody');
    $('open-moodle').textContent = t('openMoodle');
    localeToggle.textContent = t('localeToggle');
    sectionSearch.placeholder = t('sectionSearch');

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
    progressWrap.hidden = !visible;
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
    updateCourseHeader('');
  };

  const showPanel = () => {
    panel.hidden = false;
    emptyState.hidden = true;
  };

  const appendAllSectionsItem = () => {
    const item = document.createElement('motion');
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

      const item = document.createElement('motion');
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

    if (selected.includes('__all__')) return null;
    return selected;
  };

  const getSelectedFileTypes = () => {
    const types = Array.from(
      document.querySelectorAll('input[name="filetype"]:checked:not(:disabled)')
    ).map((cb) => cb.value);
    return types.length > 0 ? types : ['pdf'];
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
      document.querySelectorAll('input[name="filetype"]').forEach((cb) => {
        cb.checked = prefs.fileTypes.includes(cb.value);
      });
    }
    if (prefs?.sections !== undefined) {
      applySectionSelection(prefs.sections);
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
    savePrefs();
    hideScanResults();

    const fileTypeContainer = document.querySelector('.file-types');
    fileTypeContainer?.classList.add('is-loading');

    try {
      const selectedSections = getSelectedSections();
      const { types, counts } = await queryAvailableFileTypes(activeTabId, selectedSections || []);
      updateFileTypeCheckboxes(types, counts);
    } catch (error) {
      console.warn('[Popup] Could not update file types:', error.message);
    } finally {
      fileTypeContainer?.classList.remove('is-loading');
    }
  });

  sectionSearch?.addEventListener('input', () => filterSectionItems(sectionSearch.value));

  $('section-select-all')?.addEventListener('click', () => {
    applySectionSelection(null);
    savePrefs();
    hideScanResults();
  });

  $('section-clear')?.addEventListener('click', () => {
    applySectionSelection([]);
    const all = sectionMenu.querySelector('input[value="__all__"]');
    if (all) all.checked = false;
    savePrefs();
    hideScanResults();
  });

  $('section-current')?.addEventListener('click', async () => {
    try {
      const res = await chrome.tabs.sendMessage(activeTabId, { type: 'get_visible_section' });
      if (res?.section) {
        applySectionSelection([res.section]);
        savePrefs();
        hideScanResults();
        const fileTypeContainer = document.querySelector('.file-types');
        fileTypeContainer?.classList.add('is-loading');
        try {
          const { types, counts } = await queryAvailableFileTypes(activeTabId, [res.section]);
          updateFileTypeCheckboxes(types, counts);
        } finally {
          fileTypeContainer?.classList.remove('is-loading');
        }
      }
    } catch (e) {
      console.warn('[Popup] visible section:', e);
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
  });

  const injectContentScript = async (tabId) => {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/utils.js', 'src/content.js']
    });
  };

  const collectSections = (tabId) =>
    new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { type: 'collect_sections' }, (response) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(response);
      });
    });

  const collectLinks = (tabId, fileTypes, sections = null) =>
    new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { type: 'collect_links', fileTypes, sections }, (response) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(response);
      });
    });

  const queryAvailableFileTypes = async (tabId, sections) => {
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, { type: 'get_available_types', sections }, (res) => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve(res);
        });
      });
      return {
        types: response?.availableTypes || [],
        counts: response?.typeCounts || {}
      };
    } catch (error) {
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
  };

  const filterLinksBySections = (links, selectedSections) => {
    if (!selectedSections) return links;
    return links.filter((link) => selectedSections.includes(link.section));
  };

  const runScan = async () => {
    scanBtn.disabled = true;
    downloadBtn.disabled = true;
    setSectionDropdownOpen(false);
    hideScanResults();
    openDownloadsBtn.hidden = true;

    const fileTypes = getSelectedFileTypes();
    if (fileTypes.length === 0) {
      setStatus(t('noFiles'), 'warn');
      scanBtn.disabled = false;
      return;
    }

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
      const selectedSections = getSelectedSections();

      let response;
      try {
        response = await collectLinks(activeTabId, fileTypes, selectedSections);
      } catch (error) {
        await injectContentScript(activeTabId);
        response = await collectLinks(activeTabId, fileTypes, selectedSections);
      }

      if (response?.authRequired) {
        setStatus(t('authRequired'), 'error');
        return;
      }

      scannedLinks = response?.links || [];
      scannedCourseTitle = response?.courseTitle || scannedCourseTitle || 'Moodle Course';
      updateCourseHeader(scannedCourseTitle);

      const filtered = filterLinksBySections(scannedLinks, selectedSections);

      if (!filtered.length) {
        setStatus(t('noFiles'), 'warn');
        return;
      }

      const counts = countByType(filtered);
      preScanTypeCounts = { ...preScanTypeCounts, ...counts };
      updateFileTypeCheckboxes(lastKnownAvailableTypes, counts);

      showScanResults(filtered);
      setStatus(t('scanDone', { summary: formatSummary(filtered) }), 'success');
      saveLastScan(filtered.length);
      savePrefs();
    } catch (error) {
      console.error('[Popup] Scan error:', error);
      if (error.authRequired) setStatus(t('authRequired'), 'error');
      else setStatus(error.message || 'Scan failed', 'error');
    } finally {
      chrome.runtime.onMessage.removeListener(progressListener);
      setProgress(false);
      scanBtn.disabled = false;
    }
  };

  const runDownload = async () => {
    const links = getCheckedLinks();
    if (!links.length) return;

    downloadBtn.disabled = true;
    scanBtn.disabled = true;
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
      scanBtn.disabled = false;
      updateDownloadEnabled();
    }
  };

  scanBtn.addEventListener('click', runScan);
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

  prefixInput?.addEventListener('change', savePrefs);

  localeToggle.addEventListener('click', async () => {
    locale = locale === 'he' ? 'en' : 'he';
    await chrome.storage.local.set({ locale });
    applyLocale();
    generateFileTypeCheckboxes();
    updateFileTypeCheckboxes(lastKnownAvailableTypes, preScanTypeCounts);
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea')) return;
    if (e.key === 'Escape') setSectionDropdownOpen(false);
    if (e.key === 'Enter') {
      if (!downloadBtn.disabled && scanResults && !scanResults.hidden) runDownload();
      else if (!scanBtn.disabled) runScan();
    }
  });

  const resizePopup = () => {
    document.body.style.minHeight = `${document.body.scrollHeight}px`;
  };
  window.addEventListener('load', resizePopup);
  new MutationObserver(resizePopup).observe(document.body, { childList: true, subtree: true, attributes: true });

  (async () => {
    const stored = await chrome.storage.local.get('locale');
    if (stored.locale) locale = stored.locale;
    applyLocale();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      showWrongPage();
      setStatus(t('wrongPageTitle'), 'error');
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
    scanBtn.disabled = true;

    try {
      let response;
      try {
        response = await collectSections(activeTabId);
      } catch (error) {
        await injectContentScript(activeTabId);
        response = await collectSections(activeTabId);
      }

      scannedCourseTitle = response?.courseTitle || 'Moodle Course';
      scannedSections = response?.sections || [];
      updateCourseHeader(scannedCourseTitle);

      if (scannedSections.length > 0) {
        populateSections(scannedSections);
        await loadPrefs();
        applyLocale();

        const { types, counts } = await queryAvailableFileTypes(activeTabId, getSelectedSections() || []);
        preScanTypeCounts = counts;
        updateFileTypeCheckboxes(types, counts);

        await loadLastScan();
        setStatus(t('ready'));
        scanBtn.disabled = false;
      } else {
        setStatus(t('noFiles'), 'warn');
      }
    } catch (error) {
      setStatus(error.message || 'Failed to scan page', 'error');
    }
  })();
});
