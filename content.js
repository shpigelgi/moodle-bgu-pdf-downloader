const getCourseTitle = () =>
  document.querySelector("h1")?.textContent?.trim() || document.title || "Moodle Course";

const getSectionTitle = (element) => {
  // The structure is: li.section.course-section > header + div.content > ul.section > li.activity > a
  // We need to go up from the anchor to the outermost li.section

  const section = element.closest("li.section.course-section");

  if (section) {
    const titleEl = section.querySelector("h3.sectionname");
    if (titleEl) {
      const title = titleEl.textContent.trim();
      if (title) {
        return title;
      }
    }
  }

  return "General";
};

const getResourceTitle = (anchor) => {
  let text = anchor.textContent?.trim();
  if (text && text.length > 0) {
    // Remove Moodle UI labels (Hebrew and English)
    text = text
      .replace(/קובץ\s*/g, '')  // Remove "קובץ" (file in Hebrew)
      .replace(/\s*File$/i, '')  // Remove trailing "File"
      .trim();

    if (text.length > 0) {
      return text;
    }
  }

  return anchor.getAttribute("href")?.split("/").pop() || "resource";
};

const looksLikePdf = (url, fileTypes) => {
  if (!url) {
    return false;
  }

  const lowerUrl = url.toLowerCase();

  // Get all valid extensions for the requested file types
  const validExtensions = [];
  if (typeof FILE_TYPES !== 'undefined') {
    fileTypes.forEach(type => {
      if (FILE_TYPES[type] && FILE_TYPES[type].extensions) {
        validExtensions.push(...FILE_TYPES[type].extensions);
      }
    });
  } else {
    // Fallback
    validExtensions.push(...fileTypes);
  }

  // Use regex to match exact file extensions (word boundary at end)
  const regex = new RegExp(`\\.(${validExtensions.join('|')})(\\?|$)`, 'i');
  return regex.test(lowerUrl);
};

const looksLikeMoodleResource = (url) => {
  if (!url) {
    return false;
  }

  return url.includes("/mod/resource/view.php");
};

const collectLinks = async (fileTypes) => {
  // Only look for anchors in the main content area, not in the sidebar index
  const mainContent = document.querySelector("#page-content") || document.body;
  const anchors = Array.from(mainContent.querySelectorAll("a[href]"));
  const links = [];
  const seen = new Set();

  // Helper to collect files from folder page
  const collectFromFolder = async (folderUrl, folderName, section) => {
    try {
      console.log(`[Content] Fetching folder:`, folderUrl);
      const response = await fetch(folderUrl);
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const folderLinks = [];
      const fileLinks = doc.querySelectorAll('a[href*="/pluginfile.php/"]');

      fileLinks.forEach(fileLink => {
        const fileUrl = fileLink.href;
        const fileName = fileLink.textContent.trim();

        // Check if file matches requested file types using exact extension matching
        const lowerUrl = fileUrl.toLowerCase();

        let matchesType = false;
        if (typeof FILE_TYPES !== 'undefined') {
          // Check against all extensions for requested types
          matchesType = fileTypes.some(type => {
            const config = FILE_TYPES[type];
            if (!config) return false;

            const regex = new RegExp(`\\.(${config.extensions.join('|')})(\\?|$)`, 'i');
            return regex.test(lowerUrl);
          });
        } else {
          matchesType = fileTypes.some(type => {
            const regex = new RegExp(`\.${type}(\\?|$)`, 'i');
            return regex.test(lowerUrl);
          });
        }

        // Skip if doesn't match requested types or if already seen
        if (!matchesType || seen.has(fileUrl)) {
          return;
        }

        seen.add(fileUrl);
        folderLinks.push({
          url: fileUrl,
          section: section,
          title: `${folderName} - ${fileName}`
        });
      });

      console.log(`[Content] Found ${folderLinks.length} files in folder: ${folderName}`);
      return folderLinks;
    } catch (error) {
      console.error(`[Content] Error scanning folder:`, error);
      return [];
    }
  };

  // First pass: collect regular resource links and identify folders
  const foldersToScan = [];

  for (const anchor of anchors) {
    // Skip course index sidebar links
    if (anchor.classList.contains("courseindex-link")) {
      continue;
    }

    const href = anchor.getAttribute("href");
    if (!href) {
      continue;
    }

    let absoluteUrl = href;
    try {
      absoluteUrl = new URL(href, window.location.href).toString();
    } catch (error) {
      // Ignore invalid URLs
      continue;
    }

    // Check if it's a folder
    if (absoluteUrl.includes("/mod/folder/view.php")) {
      const section = getSectionTitle(anchor);
      let folderName = getResourceTitle(anchor);

      // Remove Hebrew "folder view" labels and other common suffixes
      folderName = folderName
        .replace(/תצוגת תיקיית קבצים/g, '')
        .replace(/קובץ/g, '')
        .replace(/File/g, '')
        .trim();

      foldersToScan.push({ url: absoluteUrl, folderName, section });
      continue;
    }

    const isPdf = looksLikePdf(absoluteUrl, fileTypes);
    const isMoodleRes = looksLikeMoodleResource(absoluteUrl);

    if ((isPdf || isMoodleRes) && !seen.has(absoluteUrl)) {
      seen.add(absoluteUrl);
      const section = getSectionTitle(anchor);
      const title = getResourceTitle(anchor);
      links.push({ url: absoluteUrl, section, title });
    }
  }

  // Second pass: scan folders with throttling
  if (foldersToScan.length > 0) {
    console.log(`[Content] Scanning ${foldersToScan.length} folders for files...`);

    // Throttled execution
    const CONCURRENCY = 3;
    const results = [];
    let index = 0;

    const scanNext = async () => {
      while (index < foldersToScan.length) {
        const i = index++;
        const f = foldersToScan[i];
        try {
          const folderLinks = await collectFromFolder(f.url, f.folderName, f.section);
          results.push(...folderLinks);
        } catch (e) {
          console.error(`[Content] Error scanning folder ${f.folderName}:`, e);
        }
      }
    };

    const workers = Array(Math.min(foldersToScan.length, CONCURRENCY))
      .fill(null)
      .map(() => scanNext());

    await Promise.all(workers);

    links.push(...results);
  }

  console.log(`[Content] Collected ${links.length} resource link${links.length === 1 ? '' : 's'}`);
  return links;
};

const resolveResourceLink = async (url) => {
  try {
    // Fetch with redirect:follow to get final URL
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) {
      console.warn(`[Content] Failed to fetch ${url}: ${response.status}`);
      return [];
    }

    // The response.url will be the final URL after redirects
    const finalUrl = response.url;

    if (finalUrl.includes("/pluginfile.php/")) {
      return [finalUrl];
    }

    // Fallback: try regex on the HTML
    const htmlText = await response.text();
    const pluginfileRegex = /https?:\/\/[^"'\s]+\/pluginfile\.php\/[^"'\s]+/gi;
    const matches = htmlText.match(pluginfileRegex) || [];
    const results = [...new Set(matches)];

    return results.length > 0 ? results : [];
  } catch (error) {
    console.error(`[Content] Error resolving ${url}:`, error.message);
    return [];
  }
};

const resolveCollectedLinks = async (collectedLinks, fileTypes) => {
  const resolved = [];

  for (const item of collectedLinks) {
    const { url, section, title } = item;

    if (url.includes("/pluginfile.php/")) {
      // Check if this direct file URL matches requested types
      const lowerUrl = url.toLowerCase();
      const matchesType = fileTypes.some(type => {
        const regex = new RegExp(`\.${type}(\\?|$)`, 'i');
        return regex.test(lowerUrl);
      });

      if (matchesType) {
        resolved.push(item);
      }
    } else if (url.includes("/mod/resource/view.php")) {
      const pluginUrls = await resolveResourceLink(url);
      for (const pluginUrl of pluginUrls) {
        // Filter resolved URLs by requested file types
        const lowerUrl = pluginUrl.toLowerCase();
        const matchesType = fileTypes.some(type => {
          const regex = new RegExp(`\.${type}(\\?|$)`, 'i');
          return regex.test(lowerUrl);
        });

        if (matchesType) {
          resolved.push({
            url: pluginUrl,
            section,
            title
          });
        }
      }
    }
  }

  return resolved;
};

const collectSections = () => {
  const sections = new Set();
  const sectionElements = document.querySelectorAll("li.section.course-section");

  sectionElements.forEach(section => {
    const sectionName = section.querySelector("h3.sectionname");
    if (sectionName) {
      const title = sectionName.textContent.trim();
      if (title) {
        sections.add(title);
      }
    }
  });

  const sectionList = Array.from(sections).sort();
  console.log(`[Content] Found ${sectionList.length} section${sectionList.length === 1 ? '' : 's'}`);

  return sectionList;
};

const getAvailableFileTypesInSections = async (selectedSections) => {
  // Map Moodle icon types to file extensions
  // Use global map if available, otherwise fallback
  const iconMap = (typeof MOODLE_ICON_MAP !== 'undefined') ? MOODLE_ICON_MAP : {
    'pdf': 'pdf',
    'powerpoint': 'pptx',
    'document': 'docx',
    'spreadsheet': 'xlsx',
    'text': 'text',
    'archive': null
  };

  const availableTypes = new Set();

  // If no sections specified, check all
  const checkAllSections = !selectedSections || selectedSections.length === 0;

  const mainContent = document.querySelector("#page-content") || document.body;

  console.log(`[Content] Scanning for file types. All sections: ${checkAllSections}, Selected:`, selectedSections);

  // Helper function to scan folder contents
  const scanFolder = async (folderUrl) => {
    try {
      console.log(`[Content] Fetching folder:`, folderUrl);
      const response = await fetch(folderUrl);
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const folderTypes = new Set();
      const fileIcons = doc.querySelectorAll('img[src*="/f/"]');

      fileIcons.forEach(img => {
        const match = img.src.match(/\/f\/([^-/]+)/);
        if (match) {
          const moodleType = match[1];
          const fileType = iconMap[moodleType];
          if (fileType) {
            folderTypes.add(fileType);
          }
        }
      });

      console.log(`[Content] Folder contains types:`, Array.from(folderTypes));
      return folderTypes;
    } catch (error) {
      console.error(`[Content] Error scanning folder:`, error);
      return new Set();
    }
  };

  // Collect folders and regular files to scan
  const foldersToScan = [];

  // Find all activity items
  const activityItems = Array.from(mainContent.querySelectorAll(".activity-item"));
  console.log(`[Content] Found ${activityItems.length} activity items`);

  for (const item of activityItems) {
    // Check if this item is in a selected section
    if (!checkAllSections) {
      const sectionElement = item.closest("li.section.course-section");
      if (!sectionElement) continue;

      const sectionTitle = sectionElement.querySelector("h3.sectionname")?.textContent?.trim() || "";
      if (!selectedSections.includes(sectionTitle)) {
        continue;
      }
    }

    // Check for folder links
    const folderLink = item.querySelector("a[href*='/mod/folder/view.php']");
    if (folderLink) {
      foldersToScan.push(folderLink.href);
      console.log(`[Content] Found folder to scan:`, item.getAttribute('data-activityname'));
      continue;
    }

    // Check for regular file icon
    const iconImg = item.querySelector("img[src*='/f/']");
    if (iconImg) {
      const match = iconImg.src.match(/\/f\/([^-/]+)/);
      if (match) {
        const moodleType = match[1];
        const fileType = iconMap[moodleType];

        if (fileType) {
          availableTypes.add(fileType);
          const itemName = item.getAttribute('data-activityname') || '';
          console.log(`[Content] Found ${fileType} (${moodleType}):`, itemName);
        }
      }
    }
  }

  // Scan all folders in parallel
  if (foldersToScan.length > 0) {
    console.log(`[Content] Scanning ${foldersToScan.length} folders...`);
    const folderResults = await Promise.all(foldersToScan.map(scanFolder));
    folderResults.forEach(types => {
      types.forEach(type => availableTypes.add(type));
    });
  }

  const result = Array.from(availableTypes).sort();
  console.log(`[Content] Final detected file types:`, result);
  return result;
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "collect_sections") {
    const sections = collectSections();
    const courseTitle = document.querySelector("h1")?.textContent.trim() || "Moodle Course";

    sendResponse({
      ok: true,
      sections,
      courseTitle
    });
    return true;
  }

  if (message?.type === "get_available_types") {
    const sections = message.sections || [];

    getAvailableFileTypesInSections(sections).then(availableTypes => {
      console.log(`[Content] Available types in sections:`, availableTypes);

      sendResponse({
        ok: true,
        availableTypes
      });
    }).catch(error => {
      console.error("[Content] Error getting file types:", error);
      sendResponse({
        ok: false,
        availableTypes: []
      });
    });

    return true; // Keep channel open for async response
  }

  if (message?.type === "collect_links") {
    const fileTypes = Array.isArray(message.fileTypes) && message.fileTypes.length
      ? message.fileTypes
      : ["pdf"];

    collectLinks(fileTypes).then(collectedLinks => {
      // Extract unique sections
      const sections = [...new Set(collectedLinks.map(item => item.section))].sort();

      return resolveCollectedLinks(collectedLinks, fileTypes).then((links) => {
        console.log(`[Content] Resolved ${links.length} link${links.length === 1 ? '' : 's'}`);
        sendResponse({
          ok: true,
          links,
          courseTitle: getCourseTitle(),
          sections
        });
      });
    }).catch((error) => {
      console.error("[Content] Error collecting/resolving links:", error);
      sendResponse({
        ok: false,
        error: error.message || "Failed to resolve file links"
      });
    });

    return true;
  }
});
