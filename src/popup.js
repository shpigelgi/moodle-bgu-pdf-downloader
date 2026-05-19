document.addEventListener("DOMContentLoaded", () => {
  const resizePopup = () => {
    document.body.style.minHeight = `${document.body.scrollHeight}px`;
  };

  window.addEventListener("load", resizePopup);
  new MutationObserver(resizePopup).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true
  });

  const statusEl = document.getElementById("status");
  const downloadBtn = document.getElementById("download");
  const sectionDropdown = document.getElementById("section-dropdown");
  const sectionToggle = document.getElementById("section-toggle");
  const sectionMenu = document.getElementById("section-menu");
  const sectionBlock = sectionDropdown?.closest(".block--sections");
  const dropdownText = sectionToggle.querySelector(".dropdown-text");
  const courseTagline = document.getElementById("course-tagline");
  const ctaLabel = downloadBtn?.querySelector(".cta__label");

  const MOODLE_COURSE_URL = "moodle.bgu.ac.il/moodle/course/view.php";

  const setSectionDropdownOpen = (isOpen) => {
    sectionDropdown.classList.toggle("open", isOpen);
    sectionToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    sectionBlock?.classList.toggle("is-dropdown-open", isOpen);
  };

  let scannedLinks = [];
  let scannedCourseTitle = "";
  let scannedSections = [];

  const setStatus = (message, tone = "default") => {
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.dataset.tone = tone;
    }
  };

  const updateCourseHeader = (title) => {
    if (!courseTagline) return;
    const trimmed = (title || "").trim();
    const isCourse = Boolean(trimmed && trimmed !== "Moodle Course");
    courseTagline.textContent = isCourse ? trimmed : "Bulk download from BGU Moodle";
    courseTagline.title = trimmed;
    courseTagline.dataset.hasCourse = isCourse ? "true" : "false";
  };

  const isDownloadableFileType = (type) => {
    if (typeof MOODLE_ICON_MAP === "undefined") return type !== "text";
    return MOODLE_ICON_MAP[type] !== null && MOODLE_ICON_MAP[type] !== undefined;
  };

  const isMoodleCourseTab = (tab) => Boolean(tab?.url?.includes(MOODLE_COURSE_URL));

  const appendAllSectionsItem = () => {
    const item = document.createElement("div");
    item.className = "dropdown-item";

    const label = document.createElement("label");
    label.className = "dropdown-checkbox-label";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = "__all__";
    input.checked = true;
    input.setAttribute("data-section-checkbox", "");

    const span = document.createElement("span");
    span.textContent = "All Sections";

    label.appendChild(input);
    label.appendChild(span);
    item.appendChild(label);
    sectionMenu.appendChild(item);
  };

  const populateSections = (sections) => {
    if (!Array.isArray(sections) || sections.length === 0) return;

    sectionMenu.innerHTML = "";
    appendAllSectionsItem();

    sections.forEach((section) => {
      if (!section || typeof section !== "string") return;

      const item = document.createElement("div");
      item.className = "dropdown-item";

      const label = document.createElement("label");
      label.className = "dropdown-checkbox-label";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = section;
      input.setAttribute("data-section-checkbox", "");

      const span = document.createElement("span");
      span.textContent = section;

      label.appendChild(input);
      label.appendChild(span);
      item.appendChild(label);
      sectionMenu.appendChild(item);
    });

    updateDropdownText();
  };

  const getSelectedSections = () => {
    const selected = Array.from(
      sectionMenu.querySelectorAll("input[data-section-checkbox]:checked")
    ).map((cb) => cb.value);

    if (selected.includes("__all__")) return null;
    return selected;
  };

  const getSelectedFileTypes = () => {
    const types = Array.from(
      document.querySelectorAll('input[name="filetype"]:checked:not(:disabled)')
    ).map((cb) => cb.value);
    return types.length > 0 ? types : ["pdf"];
  };

  const getFileTypeDisplayText = (fileTypes) => {
    if (fileTypes.length === 0) return "files";
    if (fileTypes.length === 1) {
      const label =
        FILE_TYPES?.[fileTypes[0]]?.label || fileTypes[0].toUpperCase();
      return label + (label.endsWith("s") ? "" : " files");
    }
    return "files";
  };

  const updateCtaLabel = (fileTypes) => {
    if (!ctaLabel) return;
    if (fileTypes.length === 1) {
      const label = FILE_TYPES?.[fileTypes[0]]?.label || fileTypes[0];
      ctaLabel.textContent = `Download ${label}`;
    } else {
      ctaLabel.textContent = "Scan & download";
    }
  };

  const updateDropdownText = () => {
    const selected = Array.from(
      sectionMenu.querySelectorAll("input[data-section-checkbox]:checked")
    ).map((cb) => cb.value);

    if (selected.includes("__all__") || selected.length === 0) {
      dropdownText.textContent = "All Sections";
    } else if (selected.length === 1) {
      const checkbox = Array.from(
        sectionMenu.querySelectorAll("input[data-section-checkbox]")
      ).find((cb) => cb.value === selected[0]);
      const label = checkbox?.closest("label")?.querySelector("span")?.textContent;
      dropdownText.textContent = label || selected[0];
    } else {
      dropdownText.textContent = `${selected.length} sections selected`;
    }
  };

  sectionMenu.addEventListener("change", async (event) => {
    const checkbox = event.target;
    if (!checkbox.matches("input[data-section-checkbox]")) return;

    const allCheckbox = sectionMenu.querySelector('input[value="__all__"]');
    const otherCheckboxes = Array.from(
      sectionMenu.querySelectorAll('input[data-section-checkbox]')
    ).filter((cb) => cb.value !== "__all__");

    if (checkbox.value === "__all__") {
      if (checkbox.checked) {
        otherCheckboxes.forEach((cb) => {
          cb.checked = false;
        });
      }
    } else {
      if (checkbox.checked && allCheckbox) {
        allCheckbox.checked = false;
      }
      if (!otherCheckboxes.some((cb) => cb.checked) && allCheckbox) {
        allCheckbox.checked = true;
      }
    }

    updateDropdownText();

    const fileTypeContainer = document.querySelector(".file-types");
    fileTypeContainer?.classList.add("is-loading");

    try {
      const tab = await withActiveTab();
      const selectedSections = getSelectedSections();
      const sectionsToQuery = selectedSections || [];
      const availableTypes = await queryAvailableFileTypes(tab.id, sectionsToQuery);
      updateFileTypeCheckboxes(availableTypes);
    } catch (error) {
      console.warn("[Popup] Could not update file types:", error.message);
    } finally {
      fileTypeContainer?.classList.remove("is-loading");
    }
  });

  sectionToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    setSectionDropdownOpen(!sectionDropdown.classList.contains("open"));
  });

  document.addEventListener("click", (e) => {
    if (!sectionDropdown.contains(e.target)) {
      setSectionDropdownOpen(false);
    }
  });

  const injectContentScript = async (tabId) => {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["src/utils.js", "src/content.js"]
    });
  };

  const collectSections = (tabId) =>
    new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { type: "collect_sections" }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve(response);
      });
    });

  const collectLinks = (tabId, fileTypes, sections = null) =>
    new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tabId,
        { type: "collect_links", fileTypes, sections },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          resolve(response);
        }
      );
    });

  const startDownload = (links, courseTitle) => {
    if (!Array.isArray(links) || links.length === 0) {
      return Promise.reject(new Error("No files to download"));
    }

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: "download_links", links, courseTitle: courseTitle || "Moodle Course" },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          if (!response?.ok) {
            reject(new Error(response?.error || "Download failed"));
            return;
          }
          resolve(response);
        }
      );
    });
  };

  const withActiveTab = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error("No active tab found");
    }
    if (!isMoodleCourseTab(tab)) {
      throw new Error("Open a BGU Moodle course page (course/view.php) first.");
    }
    return tab;
  };

  const queryAvailableFileTypes = async (tabId, sections) => {
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(
          tabId,
          { type: "get_available_types", sections },
          (res) => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve(res);
          }
        );
      });
      return response?.availableTypes || [];
    } catch (error) {
      console.error("[Popup] Error querying file types:", error);
      return [];
    }
  };

  const generateFileTypeCheckboxes = () => {
    const container = document.querySelector(".file-types");
    if (!container || typeof FILE_TYPES === "undefined") return;

    container.innerHTML = "";

    Object.entries(FILE_TYPES).forEach(([type, config]) => {
      if (!isDownloadableFileType(type)) return;

      const label = document.createElement("label");
      label.className = "type-chip is-disabled";
      label.dataset.type = type;

      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "filetype";
      input.value = type;
      if (type === "pdf") input.checked = true;

      const mark = document.createElement("span");
      mark.className = "type-chip__mark";
      mark.setAttribute("aria-hidden", "true");

      const text = document.createElement("span");
      text.className = "type-chip__label";
      text.textContent = config.label;

      label.appendChild(input);
      label.appendChild(mark);
      label.appendChild(text);
      container.appendChild(label);
    });
  };

  generateFileTypeCheckboxes();

  const updateFileTypeCheckboxes = (availableTypes) => {
    const checkboxes = document.querySelectorAll('input[name="filetype"]');

    checkboxes.forEach((checkbox) => {
      const isAvailable = availableTypes.includes(checkbox.value);
      checkbox.disabled = !isAvailable;
      if (!isAvailable && checkbox.checked) checkbox.checked = false;

      checkbox.closest(".type-chip")?.classList.toggle("is-disabled", !isAvailable);
    });

    if (availableTypes.length > 0) {
      const anyChecked = Array.from(checkboxes).some((cb) => cb.checked && !cb.disabled);
      if (!anyChecked) {
        const first = Array.from(checkboxes).find((cb) => !cb.disabled);
        if (first) first.checked = true;
      }
    }

    updateCtaLabel(getSelectedFileTypes());
  };

  document.querySelector(".file-types")?.addEventListener("change", () => {
    updateCtaLabel(getSelectedFileTypes());
  });

  downloadBtn.addEventListener("click", async () => {
    downloadBtn.disabled = true;
    setSectionDropdownOpen(false);

    const fileTypes = getSelectedFileTypes();
    if (fileTypes.length === 0) {
      setStatus("Please select at least one file type.", "warn");
      downloadBtn.disabled = false;
      return;
    }

    const fileTypeText = getFileTypeDisplayText(fileTypes);
    setStatus(`Scanning for ${fileTypeText}…`);

    try {
      const tab = await withActiveTab();
      const selectedSections = getSelectedSections();

      let response;
      try {
        response = await collectLinks(tab.id, fileTypes, selectedSections);
      } catch (error) {
        await injectContentScript(tab.id);
        response = await collectLinks(tab.id, fileTypes, selectedSections);
      }

      scannedLinks = response?.links || [];
      scannedCourseTitle = response?.courseTitle || scannedCourseTitle || "Moodle Course";
      updateCourseHeader(scannedCourseTitle);

      if (!scannedLinks.length) {
        setStatus(`No ${fileTypeText} found in selected sections.`, "warn");
        return;
      }

      let filteredLinks = scannedLinks;
      if (selectedSections) {
        filteredLinks = scannedLinks.filter((link) =>
          selectedSections.includes(link.section)
        );
      }

      if (!filteredLinks.length) {
        setStatus(`No ${fileTypeText} in selected sections.`, "warn");
        return;
      }

      setStatus(`Downloading ${filteredLinks.length} ${fileTypeText}…`);
      await startDownload(filteredLinks, scannedCourseTitle);
      setStatus(
        `Queued ${filteredLinks.length} download${filteredLinks.length === 1 ? "" : "s"}.`,
        "success"
      );
    } catch (error) {
      console.error("[Popup] Download error:", error);
      setStatus(error.message || "Download failed. Please try again.", "error");
    } finally {
      downloadBtn.disabled = false;
    }
  });

  (async () => {
    try {
      setStatus("Loading course…");
      downloadBtn.disabled = true;

      const tab = await withActiveTab();

      let response;
      try {
        response = await collectSections(tab.id);
      } catch (error) {
        await injectContentScript(tab.id);
        response = await collectSections(tab.id);
      }

      scannedCourseTitle = response?.courseTitle || "Moodle Course";
      scannedSections = response?.sections || [];
      updateCourseHeader(scannedCourseTitle);

      if (scannedSections.length > 0) {
        populateSections(scannedSections);

        try {
          const availableTypes = await queryAvailableFileTypes(tab.id, []);
          updateFileTypeCheckboxes(availableTypes);
        } catch (error) {
          console.warn("[Popup] Could not query initial file types:", error.message);
        }

        setStatus("Select sections and click to download.");
        downloadBtn.disabled = false;
      } else {
        setStatus("No sections found on this course page.", "warn");
        downloadBtn.disabled = true;
      }
    } catch (error) {
      console.error("[Popup] Scan error:", error);
      updateCourseHeader("");
      setStatus(error.message || "Failed to scan page. Refresh and try again.", "error");
      downloadBtn.disabled = true;
    }
  })();
});
