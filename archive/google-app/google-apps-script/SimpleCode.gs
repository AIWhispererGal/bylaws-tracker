/**
 * Simple Google Apps Script for NGROK
 *
 * Instructions:
 * 1. Update APP_URL below with your current NGROK URL
 * 2. Copy this entire code
 * 3. Go to your Google Doc → Extensions → Apps Script
 * 4. Replace ALL the code with this
 * 5. Save and run onOpen() once
 *
 * Note: The 'ngrok-skip-browser-warning' header bypasses NGROK's warning page
 */

// 🔴 UPDATE THIS WITH YOUR NGROK URL 🔴
const APP_URL = 'https://3eed1324c595.ngrok-free.app';

// Menu setup
function onOpen() {
  DocumentApp.getUi()
    .createMenu('🔧 Bylaws Sync')
    .addItem('📤 Send Sections to App', 'sendSectionsToApp')
    .addItem('🔄 Check Lock Status', 'checkLockStatus')
    .addItem('🧹 Clear Formatting', 'clearFormatting')
    .addItem('🔗 Test Connection', 'testConnection')
    .addSeparator()
    .addItem('🔍 Test Parsing', 'testParsing')
    .addToUi();
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
 * Parse document and send sections to your app
 */
function sendSectionsToApp() {
  const doc = DocumentApp.getActiveDocument();
  const docId = doc.getId();
  const body = doc.getBody();

  // Parse sections
  const sections = parseSections(body);

  if (sections.length === 0) {
    DocumentApp.getUi().alert('No sections found. Make sure your document has headers like "ARTICLE" or "Section"');
    return;
  }

  // Send to your app
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
      DocumentApp.getUi().alert('✅ Success!\n\nSent ' + sections.length + ' sections to the app.');
    } else {
      DocumentApp.getUi().alert('❌ Error: ' + result.error);
    }
  } catch (error) {
    DocumentApp.getUi().alert('❌ Connection Error:\n\n' + error.toString());
  }
}

/**
 * Parse document into sections
 */
function parseSections(body) {
  const sections = [];
  const paragraphs = body.getParagraphs();

  let currentSection = null;
  let sectionText = '';

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const text = para.getText();
    const heading = para.getHeading();

    // Check if this is a section header
    if (heading !== DocumentApp.ParagraphHeading.NORMAL &&
        (text.includes('ARTICLE') || text.includes('Section'))) {

      // Save previous section if exists
      if (currentSection && sectionText.trim()) {
        currentSection.text = sectionText.trim();
        sections.push(currentSection);
      }

      // Start new section
      currentSection = {
        citation: extractCitation(text),
        title: text.trim(),
        text: ''
      };
      sectionText = '';

    } else if (currentSection) {
      // Add to current section
      sectionText += text + '\n';
    }
  }

  // Don't forget the last section
  if (currentSection && sectionText.trim()) {
    currentSection.text = sectionText.trim();
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Extract citation from header text
 */
function extractCitation(text) {
  // Try to extract "ARTICLE V" or "Section 1" format
  let citation = text;

  // Match ARTICLE with Roman numerals
  const articleMatch = text.match(/ARTICLE\s+([IVX]+)/i);
  if (articleMatch) {
    citation = 'Article ' + articleMatch[1];

    // Also check for Section
    const sectionMatch = text.match(/Section\s+(\d+)/i);
    if (sectionMatch) {
      citation += ', Section ' + sectionMatch[1];
    }
  } else {
    // Just Section without Article
    const sectionMatch = text.match(/Section\s+(\d+)/i);
    if (sectionMatch) {
      citation = 'Section ' + sectionMatch[1];
    }
  }

  return citation;
}

/**
 * Check which sections are locked and apply formatting
 */
function checkLockStatus() {
  const doc = DocumentApp.getActiveDocument();
  const docId = doc.getId();

  try {
    // Get lock status from your app
    const response = UrlFetchApp.fetch(APP_URL + '/bylaws/api/sections/' + docId, {
      headers: {
        'ngrok-skip-browser-warning': 'true'
      },
      muteHttpExceptions: true
    });
    const result = JSON.parse(response.getContentText());

    if (result.success && result.sections) {
      const body = doc.getBody();
      const paragraphs = body.getParagraphs();

      // Apply formatting based on lock status
      result.sections.forEach(section => {
        if (section.locked_by_committee) {
          // Find and highlight locked sections
          highlightSection(paragraphs, section.section_citation);
        }
      });

      DocumentApp.getUi().alert('✅ Updated formatting for ' + result.sections.length + ' sections');
    }
  } catch (error) {
    DocumentApp.getUi().alert('❌ Error checking lock status: ' + error.toString());
  }
}

/**
 * Highlight a section with background color
 */
function highlightSection(paragraphs, citation) {
  let inSection = false;

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const text = para.getText();

    // Check if this starts our section
    if (text.includes(citation) || extractCitation(text) === citation) {
      inSection = true;
    }

    // Apply formatting if in section
    if (inSection) {
      para.setBackgroundColor('#ffe6e6'); // Light red for locked

      // Check if next paragraph is a new section
      if (i < paragraphs.length - 1) {
        const nextText = paragraphs[i + 1].getText();
        const nextHeading = paragraphs[i + 1].getHeading();
        if (nextHeading !== DocumentApp.ParagraphHeading.NORMAL &&
            (nextText.includes('ARTICLE') || nextText.includes('Section'))) {
          inSection = false;
        }
      }
    }
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

/**
 * Helper function to show what sections were found (for debugging)
 */
function testParsing() {
  const body = DocumentApp.getActiveDocument().getBody();
  const sections = parseSections(body);

  let message = 'Found ' + sections.length + ' sections:\n\n';
  sections.forEach(section => {
    message += section.citation + '\n';
  });

  DocumentApp.getUi().alert(message);
}