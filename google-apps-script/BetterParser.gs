/**
 * Better Parser for Google Docs - Creates smaller, manageable sections
 *
 * This creates a section for each paragraph or numbered/lettered item
 * making it much easier to suggest specific amendments
 */

// 🔴 UPDATE THIS WITH YOUR NGROK URL 🔴
const APP_URL = 'https://3eed1324c595.ngrok-free.app';

// Menu setup
function onOpen() {
  DocumentApp.getUi()
    .createMenu('🔧 Bylaws Sync')
    .addItem('📤 Parse into Small Sections', 'parseIntoSmallSections')
    .addItem('📤 Parse into Paragraphs', 'parseIntoParagraphs')
    .addItem('🔄 Check Lock Status', 'checkLockStatus')
    .addItem('🧹 Clear Formatting', 'clearFormatting')
    .addItem('🔗 Test Connection', 'testConnection')
    .addSeparator()
    .addItem('🔍 Preview Parsing', 'previewParsing')
    .addToUi();
}

/**
 * Parse document into small, amendable sections
 * Each numbered/lettered item or paragraph becomes its own section
 */
function parseIntoSmallSections() {
  const doc = DocumentApp.getActiveDocument();
  const docId = doc.getId();
  const body = doc.getBody();

  // Parse into small sections
  const sections = parseSmallSections(body);

  if (sections.length === 0) {
    DocumentApp.getUi().alert('No sections found.');
    return;
  }

  // Confirm before sending
  const ui = DocumentApp.getUi();
  const response = ui.alert(
    'Parse Confirmation',
    'Found ' + sections.length + ' sections. This will create a separate amendable section for each paragraph and numbered item. Continue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    return;
  }

  // Send to your app
  try {
    const fetchResponse = UrlFetchApp.fetch(APP_URL + '/bylaws/api/initialize', {
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

    const result = JSON.parse(fetchResponse.getContentText());

    if (result.success) {
      DocumentApp.getUi().alert('✅ Success!\n\nCreated ' + sections.length + ' amendable sections.');
    } else {
      DocumentApp.getUi().alert('❌ Error: ' + result.error);
    }
  } catch (error) {
    DocumentApp.getUi().alert('❌ Connection Error:\n\n' + error.toString());
  }
}

/**
 * Parse into individual paragraphs (even more granular)
 */
function parseIntoParagraphs() {
  const doc = DocumentApp.getActiveDocument();
  const docId = doc.getId();
  const body = doc.getBody();

  // Parse into paragraphs
  const sections = parseParagraphs(body);

  if (sections.length === 0) {
    DocumentApp.getUi().alert('No paragraphs found.');
    return;
  }

  // Confirm before sending
  const ui = DocumentApp.getUi();
  const response = ui.alert(
    'Parse Confirmation',
    'Found ' + sections.length + ' paragraphs. Each will be individually amendable. Continue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    return;
  }

  // Send to your app
  try {
    const fetchResponse = UrlFetchApp.fetch(APP_URL + '/bylaws/api/initialize', {
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

    const result = JSON.parse(fetchResponse.getContentText());

    if (result.success) {
      DocumentApp.getUi().alert('✅ Success!\n\nCreated ' + sections.length + ' amendable paragraphs.');
    } else {
      DocumentApp.getUi().alert('❌ Error: ' + result.error);
    }
  } catch (error) {
    DocumentApp.getUi().alert('❌ Connection Error:\n\n' + error.toString());
  }
}

/**
 * Parse document into small sections
 * Breaks on:
 * - Headers (ARTICLE, Section)
 * - Numbered items (1., 2., etc)
 * - Lettered items (a., b., etc)
 * - Significant paragraph breaks
 */
function parseSmallSections(body) {
  const sections = [];
  const paragraphs = body.getParagraphs();

  let currentArticle = '';
  let currentSection = '';
  let sectionCounter = 1;

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const text = para.getText().trim();
    const heading = para.getHeading();

    if (!text) continue; // Skip empty paragraphs

    // Check if this is an ARTICLE header
    if (text.match(/^ARTICLE\s+[IVX]+/i)) {
      currentArticle = text;
      currentSection = '';
      continue; // Don't create a section for just the header
    }

    // Check if this is a Section header
    if (text.match(/^Section\s+\d+/i)) {
      currentSection = text;
      continue; // Don't create a section for just the header
    }

    // Create citation based on context
    let citation = '';
    if (currentArticle) {
      citation = currentArticle;
      if (currentSection) {
        citation += ', ' + currentSection;
      }
    }

    // Check what type of item this is
    const numberedMatch = text.match(/^(\d+)\.\s+(.+)/);
    const letteredMatch = text.match(/^([a-z])\.\s+(.+)/i);
    const romanMatch = text.match(/^([ivx]+)\.\s+(.+)/i);

    let title = '';
    let content = text;

    if (numberedMatch) {
      // Numbered item
      title = citation + ', Item ' + numberedMatch[1];
      content = numberedMatch[2];
    } else if (letteredMatch) {
      // Lettered item
      title = citation + ', Item ' + letteredMatch[1].toUpperCase();
      content = letteredMatch[2];
    } else if (romanMatch) {
      // Roman numeral item
      title = citation + ', Item ' + romanMatch[1].toUpperCase();
      content = romanMatch[2];
    } else if (text.length > 200) {
      // Long paragraph - split it
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

      // Group sentences into chunks of ~2-3 sentences
      let chunk = '';
      let chunkNum = 1;

      for (let j = 0; j < sentences.length; j++) {
        chunk += sentences[j];

        // Every 2-3 sentences or at the end
        if (chunk.length > 150 || j === sentences.length - 1) {
          sections.push({
            citation: citation + ', Paragraph ' + sectionCounter + '.' + chunkNum,
            title: citation ? citation + ' - Part ' + chunkNum : 'Paragraph ' + sectionCounter + '.' + chunkNum,
            text: chunk.trim()
          });
          chunk = '';
          chunkNum++;
        }
      }
      sectionCounter++;
      continue;
    } else {
      // Regular paragraph
      title = citation ? citation + ', Paragraph ' + sectionCounter : 'Paragraph ' + sectionCounter;
    }

    // Add the section
    sections.push({
      citation: title,
      title: title,
      text: content
    });

    if (!numberedMatch && !letteredMatch && !romanMatch) {
      sectionCounter++;
    }
  }

  return sections;
}

/**
 * Parse every single paragraph as its own section
 */
function parseParagraphs(body) {
  const sections = [];
  const paragraphs = body.getParagraphs();

  let currentArticle = '';
  let currentSection = '';
  let paragraphCounter = 1;

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const text = para.getText().trim();

    if (!text) continue; // Skip empty paragraphs

    // Track article/section context
    if (text.match(/^ARTICLE\s+[IVX]+/i)) {
      currentArticle = text;
      currentSection = '';
      paragraphCounter = 1;
    } else if (text.match(/^Section\s+\d+/i)) {
      currentSection = text;
      paragraphCounter = 1;
    }

    // Create citation
    let citation = '';
    if (currentArticle) {
      citation = currentArticle;
      if (currentSection) {
        citation += ', ' + currentSection;
      }
      citation += ', Para ' + paragraphCounter;
    } else {
      citation = 'Paragraph ' + i;
    }

    // Add section
    sections.push({
      citation: citation,
      title: citation,
      text: text
    });

    paragraphCounter++;
  }

  return sections;
}

/**
 * Preview what will be parsed
 */
function previewParsing() {
  const body = DocumentApp.getActiveDocument().getBody();
  const sections = parseSmallSections(body);

  let message = 'Preview of parsing (' + sections.length + ' sections):\n\n';

  // Show first 10 sections as preview
  for (let i = 0; i < Math.min(10, sections.length); i++) {
    message += (i + 1) + '. ' + sections[i].citation + '\n';
    message += '   "' + sections[i].text.substring(0, 50) + '..."\n\n';
  }

  if (sections.length > 10) {
    message += '... and ' + (sections.length - 10) + ' more sections';
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
 * Check which sections are locked and apply formatting
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
      DocumentApp.getUi().alert('Found ' + result.sections.length + ' sections in database');
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