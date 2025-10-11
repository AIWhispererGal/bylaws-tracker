/**
 * SMART SEMANTIC PARSER FOR BYLAWS
 *
 * This parser intelligently detects the hierarchical structure of bylaws documents
 * and creates properly formatted legal citations.
 *
 * Detected Structure:
 * ARTICLE [Roman] - Title
 *   Section [Number]: Title
 *     A., B., C. (Lettered subsections)
 *       1., 2., 3. (Numbered items)
 *         a., b., c. (Lettered sub-items)
 *           i., ii., iii. (Roman numeral clauses)
 *
 * Chunking Options:
 * - COARSE: Article level only (10-15 chunks)
 * - MEDIUM: Section level (30-50 chunks) - RECOMMENDED
 * - FINE: Lettered subsection level (100-150 chunks)
 * - ULTRA-FINE: All numbered/lettered items (200-300 chunks)
 */

// 🔴 UPDATE THIS WITH YOUR NGROK URL 🔴
const APP_URL = 'https://3eed1324c595.ngrok-free.app';

// Menu setup
function onOpen() {
  DocumentApp.getUi()
    .createMenu('🔧 Bylaws Sync - Smart Parser')
    .addItem('📤 Parse: Section Level (RECOMMENDED)', 'parseSectionLevel')
    .addItem('📤 Parse: Subsection Level (Granular)', 'parseSubsectionLevel')
    .addItem('📤 Parse: All Items (Ultra-Granular)', 'parseAllItems')
    .addSeparator()
    .addItem('🔍 Preview Parsing Results', 'previewParsing')
    .addItem('🔗 Test Connection', 'testConnection')
    .addItem('🔄 Check Lock Status', 'checkLockStatus')
    .addItem('🧹 Clear Formatting', 'clearFormatting')
    .addToUi();
}

/**
 * RECOMMENDED: Parse at Section level
 * Creates one amendable section per "Section X: Title"
 */
function parseSectionLevel() {
  const doc = DocumentApp.getActiveDocument();
  const docId = doc.getId();
  const body = doc.getBody();

  const sections = parseWithGranularity(body, 'SECTION');

  if (!confirmAndSend(sections, 'Section Level')) {
    return;
  }

  sendToServer(docId, sections);
}

/**
 * GRANULAR: Parse at Subsection level
 * Creates sections for "A.", "B.", "C." items
 */
function parseSubsectionLevel() {
  const doc = DocumentApp.getActiveDocument();
  const docId = doc.getId();
  const body = doc.getBody();

  const sections = parseWithGranularity(body, 'SUBSECTION');

  if (!confirmAndSend(sections, 'Subsection Level (Lettered Items)')) {
    return;
  }

  sendToServer(docId, sections);
}

/**
 * ULTRA-GRANULAR: Parse every numbered/lettered item
 * Creates maximum number of amendable sections
 */
function parseAllItems() {
  const doc = DocumentApp.getActiveDocument();
  const docId = doc.getId();
  const body = doc.getBody();

  const sections = parseWithGranularity(body, 'ALL_ITEMS');

  if (!confirmAndSend(sections, 'All Items (Ultra-Granular)')) {
    return;
  }

  sendToServer(docId, sections);
}

/**
 * CORE PARSING ENGINE
 * Intelligently parses document based on granularity setting
 */
function parseWithGranularity(body, granularity) {
  const sections = [];
  const paragraphs = body.getParagraphs();

  let currentArticle = '';
  let currentArticleRoman = '';
  let currentSection = '';
  let currentSectionNum = '';
  let currentLetterItem = '';
  let currentNumberItem = '';
  let currentSubLetterItem = '';

  let sectionText = '';

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const text = para.getText().trim();

    if (!text) continue; // Skip empty lines

    // Match: ARTICLE V	NAME
    const articleMatch = text.match(/^ARTICLE\s+([IVX]+)(?:\s+(.+))?$/i);
    if (articleMatch) {
      // Save previous section if exists
      if (sectionText && currentArticle) {
        sections.push(createSection(currentArticle, currentSection, currentLetterItem, currentNumberItem, currentSubLetterItem, sectionText));
        sectionText = '';
      }

      currentArticleRoman = articleMatch[1];
      currentArticle = `Article ${articleMatch[1]}`;
      currentSection = '';
      currentLetterItem = '';
      currentNumberItem = '';
      currentSubLetterItem = '';
      continue;
    }

    // Match: Section 1: Boundary Description
    const sectionMatch = text.match(/^Section\s+(\d+)(?::\s*(.+))?$/i);
    if (sectionMatch) {
      // Save previous section if exists
      if (sectionText && currentArticle) {
        sections.push(createSection(currentArticle, currentSection, currentLetterItem, currentNumberItem, currentSubLetterItem, sectionText));
        sectionText = '';
      }

      currentSectionNum = sectionMatch[1];
      currentSection = `Section ${sectionMatch[1]}`;
      currentLetterItem = '';
      currentNumberItem = '';
      currentSubLetterItem = '';

      // If SECTION granularity, we'll collect text under this section
      if (granularity === 'SECTION') {
        sectionText = sectionMatch[2] || ''; // Start with section title as text
      }
      continue;
    }

    // Match: A. Lettered item OR (a) Parenthetical letter
    const letterMatch = text.match(/^([A-Z])\.\s+(.+)$/);
    const letterParenMatch = text.match(/^\(([a-z])\)\s+(.+)$/i);

    if (letterMatch || letterParenMatch) {
      const letter = letterMatch ? letterMatch[1] : letterParenMatch[1].toUpperCase();
      const content = letterMatch ? letterMatch[2] : letterParenMatch[2];

      // Save previous section if exists
      if (granularity === 'SUBSECTION' || granularity === 'ALL_ITEMS') {
        if (sectionText && currentArticle) {
          sections.push(createSection(currentArticle, currentSection, currentLetterItem, currentNumberItem, currentSubLetterItem, sectionText));
        }
        sectionText = content;
      } else {
        sectionText += '\n' + text;
      }

      currentLetterItem = letter;
      currentNumberItem = '';
      currentSubLetterItem = '';
      continue;
    }

    // Match: 1. Numbered item
    const numberMatch = text.match(/^(\d+)\.\s+(.+)$/);
    if (numberMatch && currentArticle) {
      const num = numberMatch[1];
      const content = numberMatch[2];

      // Save previous section if exists
      if (granularity === 'ALL_ITEMS') {
        if (sectionText && currentArticle) {
          sections.push(createSection(currentArticle, currentSection, currentLetterItem, currentNumberItem, currentSubLetterItem, sectionText));
        }
        sectionText = content;
      } else {
        sectionText += '\n' + text;
      }

      currentNumberItem = num;
      currentSubLetterItem = '';
      continue;
    }

    // Match: a. Sub-lettered item (only if we're under a numbered item)
    const subLetterMatch = text.match(/^([a-z])\.\s+(.+)$/);
    if (subLetterMatch && currentNumberItem) {
      const letter = subLetterMatch[1];
      const content = subLetterMatch[2];

      // Save previous section if exists
      if (granularity === 'ALL_ITEMS') {
        if (sectionText && currentArticle) {
          sections.push(createSection(currentArticle, currentSection, currentLetterItem, currentNumberItem, currentSubLetterItem, sectionText));
        }
        sectionText = content;
      } else {
        sectionText += '\n' + text;
      }

      currentSubLetterItem = letter;
      continue;
    }

    // Regular text - add to current section
    sectionText += '\n' + text;
  }

  // Don't forget the last section!
  if (sectionText && currentArticle) {
    sections.push(createSection(currentArticle, currentSection, currentLetterItem, currentNumberItem, currentSubLetterItem, sectionText));
  }

  return sections;
}

/**
 * Create a section object with proper citation
 */
function createSection(article, section, letterItem, numberItem, subLetterItem, text) {
  let citation = article;
  let title = article;

  if (section) {
    citation += ', ' + section;
    title += ', ' + section;
  }

  if (letterItem) {
    citation += '(' + letterItem + ')';
    title += ' - Item ' + letterItem;
  }

  if (numberItem) {
    citation += '(' + numberItem + ')';
    title += ' - Subitem ' + numberItem;
  }

  if (subLetterItem) {
    citation += '(' + subLetterItem + ')';
    title += ' - Clause ' + subLetterItem;
  }

  return {
    citation: citation,
    title: title,
    text: text.trim()
  };
}

/**
 * Show confirmation dialog and get user approval
 */
function confirmAndSend(sections, granularityName) {
  const ui = DocumentApp.getUi();

  const response = ui.alert(
    'Parse Confirmation',
    `Found ${sections.length} sections using ${granularityName} parsing.\n\n` +
    `This will create ${sections.length} individually amendable sections.\n\n` +
    `Continue?`,
    ui.ButtonSet.YES_NO
  );

  return response === ui.Button.YES;
}

/**
 * Send parsed sections to server
 */
function sendToServer(docId, sections) {
  try {
    const response = UrlFetchApp.fetch(APP_URL + '/bylaws/api/initialize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      payload: JSON.stringify({
        docId: docId,
        sections: sections
      }),
      muteHttpExceptions: true
    });

    const result = JSON.parse(response.getContentText());

    if (result.success) {
      DocumentApp.getUi().alert(
        '✅ Success!\n\n' +
        `Created ${sections.length} amendable sections.\n\n` +
        `Open the web app to review and manage amendments.`
      );
    } else {
      DocumentApp.getUi().alert('❌ Error: ' + result.error);
    }
  } catch (error) {
    DocumentApp.getUi().alert('❌ Connection Error:\n\n' + error.toString());
  }
}

/**
 * Preview what will be parsed (shows first 15 sections)
 */
function previewParsing() {
  const body = DocumentApp.getActiveDocument().getBody();

  // Default to SECTION level for preview
  const sections = parseWithGranularity(body, 'SECTION');

  let message = `Preview: SECTION LEVEL PARSING\n`;
  message += `Total sections found: ${sections.length}\n\n`;
  message += `First 15 sections:\n\n`;

  for (let i = 0; i < Math.min(15, sections.length); i++) {
    message += `${i + 1}. ${sections[i].citation}\n`;
    message += `   "${sections[i].text.substring(0, 60)}..."\n\n`;
  }

  if (sections.length > 15) {
    message += `... and ${sections.length - 15} more sections`;
  }

  DocumentApp.getUi().alert(message);
}

/**
 * Test connection to the server
 */
function testConnection() {
  try {
    const response = UrlFetchApp.fetch(APP_URL + '/api/config', {
      headers: {
        'ngrok-skip-browser-warning': 'true'
      },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      const config = JSON.parse(response.getContentText());
      DocumentApp.getUi().alert('✅ Connected successfully!\n\nServer URL: ' + config.APP_URL);
    } else {
      DocumentApp.getUi().alert('⚠️ Server returned status: ' + response.getResponseCode());
    }
  } catch (error) {
    DocumentApp.getUi().alert('❌ Connection failed:\n\n' + error.toString());
  }
}

/**
 * Check which sections are locked
 */
function checkLockStatus() {
  const doc = DocumentApp.getActiveDocument();
  const docId = doc.getId();

  try {
    const response = UrlFetchApp.fetch(APP_URL + '/bylaws/api/sections/' + docId, {
      headers: {
        'ngrok-skip-browser-warning': 'true'
      },
      muteHttpExceptions: true
    });
    const result = JSON.parse(response.getContentText());

    if (result.success && result.sections) {
      const lockedCount = result.sections.filter(s => s.locked_by_committee).length;
      DocumentApp.getUi().alert(
        `📊 Lock Status\n\n` +
        `Total sections: ${result.sections.length}\n` +
        `Locked: ${lockedCount}\n` +
        `Unlocked: ${result.sections.length - lockedCount}`
      );
    }
  } catch (error) {
    DocumentApp.getUi().alert('❌ Error: ' + error.toString());
  }
}

/**
 * Clear all background formatting
 */
function clearFormatting() {
  const body = DocumentApp.getActiveDocument().getBody();
  const paragraphs = body.getParagraphs();

  paragraphs.forEach(para => {
    para.setBackgroundColor(null);
  });

  DocumentApp.getUi().alert('✅ Formatting cleared');
}
