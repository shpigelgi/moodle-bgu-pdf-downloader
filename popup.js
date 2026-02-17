document.addEventListener("DOMContentLoaded", () => {
  // Auto-resize popup to fit content
  const resizePopup = () => {
    const height = document.body.scrollHeight;
    document.body.style.minHeight = `${height}px`;
  };

  // Call resize on load and when content changes
  window.addEventListener('load', resizePopup);
  new MutationObserver(resizePopup).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true
  });

  const statusEl = document.getElementById("status");
  const downloadBtn = document.getElementById("download");
  const sectionFilter = document.getElementById("section-filter");

  console.log("[Popup] Initializing...", { statusEl, downloadBtn, sectionFilter });

  // Store scanned data
  let scannedLinks = [];
  let scannedCourseTitle = "";
  let scannedSections = [];

  const setStatus = (message) => {
    console.log(`[Popup] Status: ${message}`);
    if (statusEl) statusEl.textContent = message;
  };

  const populateSections = (sections) => {
    if (!Array.isArray(sections) || sections.length === 0) {
      return;
    }

    // Clear existing options except "All"
    sectionFilter.innerHTML = '<option value="__all__" selected>All Sections</option>';

    sections.forEach(section => {
      if (!section || typeof section !== 'string') return;

      const option = document.createElement("option");
      option.value = section;
      option.textContent = section;
      sectionFilter.appendChild(option);
    });
  };

  const getSelectedSections = () => {
    const selected = Array.from(sectionFilter.selectedOptions).map(opt => opt.value);
    if (selected.includes("__all__")) {
      return null; // null means all sections
    }
    return selected;
  };

  const getSelectedFileTypes = () => {
    const checkboxes = document.querySelectorAll('input[name="filetype"]:checked');
    const types = Array.from(checkboxes).map(cb => cb.value);
    return types.length > 0 ? types : ["pdf"]; // Default to PDF if none selected
  };

  const getFileTypeDisplayText = (fileTypes) => {
    if (fileTypes.length === 0) return 'files';
    if (fileTypes.length === 1) return fileTypes[0].toUpperCase() + 's';
    return 'files';
  };

  // Handle "All" selection logic and update available file types
  sectionFilter.addEventListener("change", async () => {
    const selected = Array.from(sectionFilter.selectedOptions);
    const allOption = sectionFilter.querySelector('option[value="__all__"]');

    // If "All" is selected with others, deselect others
    if (selected.length > 1 && selected.some(opt => opt.value === "__all__")) {
      Array.from(sectionFilter.options).forEach(opt => {
        opt.selected = opt.value === "__all__";
      });
    }

    // If no selection, select "All"
    if (selected.length === 0) {
      allOption.selected = true;
    }

    // Update available file types based on selected sections
    try {
      const tab = await withActiveTab();
      const selectedSections = getSelectedSections();
      const sectionsToQuery = selectedSections || []; // Empty array means all sections

      console.log("[Popup] Section changed. Querying types for:", sectionsToQuery.length > 0 ? sectionsToQuery : "ALL");

      const availableTypes = await queryAvailableFileTypes(tab.id, sectionsToQuery);
      updateFileTypeCheckboxes(availableTypes);
    } catch (error) {
      console.error("[Popup] Could not update file types:", error);
      // Don't break functionality - just skip the update
    }
  });

  const injectContentScript = async (tabId) => {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
  };

  const collectSections = (tabId) =>
    new Promise((resolve, reject) => {
      console.log(`[Popup] Sending collect_sections message to tab ${tabId}`);
      chrome.tabs.sendMessage(
        tabId,
        { type: "collect_sections" },
        (response) => {
          console.log(`[Popup] Sections response:`, response);
          if (chrome.runtime.lastError) {
            console.error(`[Popup] Message error:`, chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
            return;
          }
          resolve(response);
        }
      );
    });

  const collectLinks = (tabId, fileTypes) =>
    new Promise((resolve, reject) => {
      console.log(`[Popup] Sending collect_links message to tab ${tabId}`);
      chrome.tabs.sendMessage(
        tabId,
        { type: "collect_links", fileTypes },
        (response) => {
          console.log(`[Popup] Response received:`, response);
          if (chrome.runtime.lastError) {
            console.error(`[Popup] Message error:`, chrome.runtime.lastError);
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
        {
          type: "download_links",
          links,
          courseTitle: courseTitle || "Moodle Course"
        },
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
    return tab;
  };

  const queryAvailableFileTypes = async (tabId, sections) => {
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(
          tabId,
          { type: "get_available_types", sections },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
              return;
            }
            resolve(response);
          }
        );
      });

      return response?.availableTypes || [];
    } catch (error) {
      console.error("[Popup] Error querying file types:", error);
      return []; // Return empty array on error, don't break functionality
    }
  };

  const generateFileTypeCheckboxes = () => {
    const container = document.querySelector('.file-types');
    if (!container || typeof FILE_TYPES === 'undefined') return;

    container.innerHTML = ''; // Clear existing

    Object.entries(FILE_TYPES).forEach(([type, config]) => {
      const label = document.createElement('label');
      label.className = 'checkbox-label';
      label.style.opacity = '0.5'; // Default to disabled/dimmed until scanned

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = 'filetype';
      input.value = type;
      // Default unchecked to encourage scanning, or check PDF by default
      if (type === 'pdf') input.checked = true;

      const span = document.createElement('span');
      span.className = 'checkbox-text';
      // Add icon if available (simple emoji mapping or from config)
      const emoji = type === 'pdf' ? '📄' : type === 'pptx' ? '📊' : type === 'docx' ? '📝' : type === 'xlsx' ? '📈' : '📁';
      span.textContent = `${emoji} ${config.label}`;

      label.appendChild(input);
      label.appendChild(span);
      container.appendChild(label);
    });
  };

  // Call generation on init
  generateFileTypeCheckboxes();

  const updateFileTypeCheckboxes = (availableTypes) => {
    console.log("[Popup] Updating checkboxes with available types:", availableTypes);

    const checkboxes = document.querySelectorAll('input[name="filetype"]');

    checkboxes.forEach(checkbox => {
      const fileType = checkbox.value;
      const isAvailable = availableTypes.includes(fileType);

      // Enable/disable checkbox
      checkbox.disabled = !isAvailable;

      // Uncheck if not available
      if (!isAvailable && checkbox.checked) {
        checkbox.checked = false;
      }

      // Update visual feedback on the label
      const label = checkbox.closest('.checkbox-label');
      if (label) {
        if (isAvailable) {
          label.style.opacity = '1';
          label.style.cursor = 'pointer';
          label.style.pointerEvents = 'auto';
        } else {
          label.style.opacity = '0.3';
          label.style.cursor = 'not-allowed';
          label.style.pointerEvents = 'none';
        }
      }
    });

    // Ensure at least one is checked if any are available
    if (availableTypes.length > 0) {
      const anyChecked = Array.from(checkboxes).some(cb => cb.checked && !cb.disabled);
      if (!anyChecked) {
        // Check the first available checkbox
        const firstAvailable = Array.from(checkboxes).find(cb => !cb.disabled);
        if (firstAvailable) {
          firstAvailable.checked = true;
        }
      }
    }
  };

  downloadBtn.addEventListener("click", async () => {
    console.log("[Popup] Download button clicked");
    downloadBtn.disabled = true;

    const fileTypes = getSelectedFileTypes();
    if (fileTypes.length === 0) {
      setStatus("Please select at least one file type.");
      downloadBtn.disabled = false;
      return;
    }

    const fileTypeText = getFileTypeDisplayText(fileTypes);
    setStatus(`Scanning for ${fileTypeText}...`);

    try {
      const tab = await withActiveTab();

      let response;
      try {
        response = await collectLinks(tab.id, fileTypes);
      } catch (error) {
        console.log("[Popup] Injecting content script after initial failure");
        await injectContentScript(tab.id);
        response = await collectLinks(tab.id, fileTypes);
      }

      scannedLinks = response?.links || [];

      if (!scannedLinks.length) {
        setStatus(`No ${fileTypeText} found on this page.`);
        downloadBtn.disabled = false;
        return;
      }

      // Filter links by selected sections
      const selectedSections = getSelectedSections();
      let filteredLinks = scannedLinks;
      if (selectedSections) {
        filteredLinks = scannedLinks.filter(link => selectedSections.includes(link.section));
      }

      if (!filteredLinks.length) {
        setStatus(`No ${fileTypeText} in selected sections.`);
        downloadBtn.disabled = false;
        return;
      }

      setStatus(`Downloading ${filteredLinks.length} ${fileTypeText}...`);
      await startDownload(filteredLinks, scannedCourseTitle);
      setStatus(`Successfully queued ${filteredLinks.length} download${filteredLinks.length === 1 ? '' : 's'}.`);
    } catch (error) {
      console.error("[Popup] Download error:", error);
      setStatus(error.message || "Download failed. Please try again.");
    } finally {
      downloadBtn.disabled = false;
    }
  });

  // Auto-scan sections on popup open
  (async () => {
    try {
      setStatus("Loading sections...");
      downloadBtn.disabled = true;

      const tab = await withActiveTab();

      let response;
      try {
        response = await collectSections(tab.id);
      } catch (error) {
        console.log("[Popup] Injecting content script after initial failure");
        await injectContentScript(tab.id);
        response = await collectSections(tab.id);
      }

      scannedCourseTitle = response?.courseTitle || "Moodle Course";
      scannedSections = response?.sections || [];

      // Populate section filter
      if (scannedSections.length > 0) {
        populateSections(scannedSections);

        // Query and update available file types for all sections
        try {
          const availableTypes = await queryAvailableFileTypes(tab.id, []);
          updateFileTypeCheckboxes(availableTypes);
        } catch (error) {
          console.log("[Popup] Could not query initial file types:", error.message);
          // Continue without file type filtering
        }

        setStatus("Select sections and click to download.");
        downloadBtn.disabled = false;
      } else {
        setStatus("No sections found. Make sure you're on a Moodle course page.");
        downloadBtn.disabled = true;
      }
    } catch (error) {
      console.error("[Popup] Scan error:", error);
      setStatus("Failed to scan page. Please refresh and try again.");
      downloadBtn.disabled = true;
    }
  })();
});
