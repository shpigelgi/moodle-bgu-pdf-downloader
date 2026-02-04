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
  return fileTypes.some((type) => lowerUrl.includes(`.${type}`));
};

const looksLikeMoodleResource = (url) => {
  if (!url) {
    return false;
  }

  return url.includes("/mod/resource/view.php");
};

const collectLinks = (fileTypes) => {
  // Only look for anchors in the main content area, not in the sidebar index
  const mainContent = document.querySelector("#page-content") || document.body;
  const anchors = Array.from(mainContent.querySelectorAll("a[href]"));
  const links = [];
  const seen = new Set();

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

    const isPdf = looksLikePdf(absoluteUrl, fileTypes);
    const isMoodleRes = looksLikeMoodleResource(absoluteUrl);

    if ((isPdf || isMoodleRes) && !seen.has(absoluteUrl)) {
      seen.add(absoluteUrl);
      const section = getSectionTitle(anchor);
      const title = getResourceTitle(anchor);
      links.push({ url: absoluteUrl, section, title });
    }
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

const resolveCollectedLinks = async (collectedLinks) => {
  const resolved = [];

  for (const item of collectedLinks) {
    const { url, section, title } = item;

    if (url.includes("/pluginfile.php/")) {
      resolved.push(item);
    } else if (url.includes("/mod/resource/view.php")) {
      const pluginUrls = await resolveResourceLink(url);
      for (const pluginUrl of pluginUrls) {
        resolved.push({
          url: pluginUrl,
          section,
          title
        });
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

const getAvailableFileTypesInSections = (selectedSections) => {
  // Map Moodle icon types to file extensions
  const MOODLE_ICON_MAP = {
    'pdf': 'pdf',
    'powerpoint': 'pptx',
    'document': 'docx',
    'spreadsheet': 'xlsx',
    'text': 'docx',  // Text files often become docx on download
    'archive': null  // Skip archives (zip, etc.) - not in our supported types
  };
  
  const availableTypes = new Set();
  
  // If no sections specified, check all
  const checkAllSections = !selectedSections || selectedSections.length === 0;
  
  const mainContent = document.querySelector("#page-content") || document.body;
  
  // Find all activity items (Moodle's resource wrapper elements)
  const activityItems = Array.from(mainContent.querySelectorAll(".activity-item"));
  
  console.log(`[Content] Found ${activityItems.length} activity items. All sections: ${checkAllSections}, Selected:`, selectedSections);
  
  activityItems.forEach(item => {
    // Check if this item is in a selected section
    if (!checkAllSections) {
      const sectionElement = item.closest("li.section.course-section");
      if (!sectionElement) return;
      
      const sectionTitle = sectionElement.querySelector("h3.sectionname")?.textContent?.trim() || "";
      if (!selectedSections.includes(sectionTitle)) {
        return;
      }
    }
    
    // Find the file type icon
    const iconImg = item.querySelector("img[src*='/f/']");
    if (!iconImg) return;
    
    // Extract file type from icon URL (e.g., /f/pdf-24 -> pdf)
    const iconSrc = iconImg.src;
    const match = iconSrc.match(/\/f\/([^-/]+)/);
    if (match) {
      const moodleType = match[1];
      const fileType = MOODLE_ICON_MAP[moodleType];
      
      if (fileType) {
        availableTypes.add(fileType);
        const itemName = item.getAttribute('data-activityname') || '';
        console.log(`[Content] Found ${fileType} (${moodleType}):`, itemName);
      }
    }
  });
  
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
    const availableTypes = getAvailableFileTypesInSections(sections);
    
    console.log(`[Content] Available types in sections:`, availableTypes);
    
    sendResponse({
      ok: true,
      availableTypes
    });
    return true;
  }

  if (message?.type === "collect_links") {
    const fileTypes = Array.isArray(message.fileTypes) && message.fileTypes.length
      ? message.fileTypes
      : ["pdf"];

    const collectedLinks = collectLinks(fileTypes);
    
    // Extract unique sections
    const sections = [...new Set(collectedLinks.map(item => item.section))].sort();
    
    resolveCollectedLinks(collectedLinks).then((links) => {
      console.log(`[Content] Resolved ${links.length} link${links.length === 1 ? '' : 's'}`);
      sendResponse({
        ok: true,
        links,
        courseTitle: getCourseTitle(),
        sections
      });
    }).catch((error) => {
      console.error("[Content] Error resolving links:", error.message);
      sendResponse({
        ok: false,
        error: error.message || "Failed to resolve file links"
      });
    });

    return true;
  }
});
