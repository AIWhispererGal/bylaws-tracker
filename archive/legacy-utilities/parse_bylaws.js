const fs = require('fs');
const path = require('path');

// Read the bylaws file
const filePath = '/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL2/RNCBYLAWS_2024.txt';
const outputPath = '/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL2/parsed_sections.json';

const fileContent = fs.readFileSync(filePath, 'utf-8');
const lines = fileContent.split('\n');

const sections = [];
let currentArticle = null;
let currentSection = null;
let currentText = [];
let articleBodyText = []; // Track article body text before any sections

// Helper function to check if line is an ARTICLE header
function isArticleHeader(line) {
  const trimmed = line.trim();
  // Matches "ARTICLE I NAME", "ARTICLE II PURPOSE", etc.
  return /^ARTICLE\s+[IVX]+(\s+|$)/.test(trimmed);
}

// Helper function to extract article info from header
function extractArticleInfo(line) {
  const trimmed = line.trim();
  const match = trimmed.match(/^ARTICLE\s+([IVX]+)\s*(.*)$/);
  if (match) {
    return {
      number: match[1],
      name: match[2] ? match[2].trim() : ''
    };
  }
  return null;
}

// Helper function to check if line is a Section header
function isSectionHeader(line) {
  const trimmed = line.trim();
  return /^Section\s+\d+:/i.test(trimmed);
}

// Helper function to extract section info
function extractSectionInfo(line) {
  const trimmed = line.trim();
  const match = trimmed.match(/^Section\s+(\d+):\s*(.*)$/i);
  if (match) {
    return {
      number: match[1],
      title: match[2].trim()
    };
  }
  return null;
}

// Helper function to save current section
function saveCurrentSection() {
  if (currentSection) {
    const text = currentText.join('\n').trim();
    // Save even if empty - some sections are marked as "left blank"
    sections.push({
      citation: currentSection.citation,
      title: currentSection.title,
      text: text || '(No content)'
    });
  }
  currentSection = null;
  currentText = [];
}

// Helper function to save article body (for articles without sections)
function saveArticleBody() {
  if (currentArticle && articleBodyText.length > 0) {
    const text = articleBodyText.join('\n').trim();
    if (text) {
      sections.push({
        citation: `Article ${currentArticle.number}`,
        title: `Article ${currentArticle.number} - ${currentArticle.name}`,
        text: text
      });
    }
  }
  articleBodyText = [];
}

// Parse the document
for (let i = 0; i < lines.length; i++) {
  const lineNum = i + 1;
  const line = lines[i];

  // Skip Table of Contents (lines 13-65)
  if (lineNum >= 13 && lineNum <= 65) {
    continue;
  }

  // Skip Attachment sections (line 513 and after)
  if (lineNum >= 513) {
    break;
  }

  const trimmed = line.trim();

  // Check for ARTICLE header
  if (isArticleHeader(line)) {
    // Save previous section or article body
    saveCurrentSection();
    saveArticleBody();

    const articleInfo = extractArticleInfo(line);
    currentArticle = articleInfo;
    continue;
  }

  // Check for Section header
  if (isSectionHeader(line)) {
    // If we have article body text, save it first
    saveArticleBody();

    // Save previous section if exists
    saveCurrentSection();

    const sectionInfo = extractSectionInfo(line);

    currentSection = {
      citation: `Article ${currentArticle.number}, Section ${sectionInfo.number}`,
      title: `Article ${currentArticle.number}, Section ${sectionInfo.number} - ${sectionInfo.title}`,
      articleNumber: currentArticle.number,
      sectionNumber: sectionInfo.number
    };

    continue;
  }

  // Collect text
  if (currentSection) {
    // We're in a section, collect all text
    currentText.push(line);
  } else if (currentArticle) {
    // We're in an article body (before any sections)
    if (trimmed !== '') {
      articleBodyText.push(line);
    }
  }
}

// Save the last section or article body
saveCurrentSection();
saveArticleBody();

// Clean up sections - remove excessive whitespace and empty lines at start/end
const cleanedSections = sections.map(section => {
  let text = section.text;

  // If text is not "(No content)", clean it up
  if (text !== '(No content)') {
    const lines = text.split('\n');

    // Remove leading empty lines
    while (lines.length > 0 && lines[0].trim() === '') {
      lines.shift();
    }

    // Remove trailing empty lines
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
      lines.pop();
    }

    text = lines.join('\n');
  }

  return {
    ...section,
    text: text
  };
});

// Write output
fs.writeFileSync(outputPath, JSON.stringify(cleanedSections, null, 2), 'utf-8');

console.log(`Parsed ${cleanedSections.length} sections`);
console.log(`Output written to: ${outputPath}`);
console.log('\nFirst 5 sections:');
cleanedSections.slice(0, 5).forEach((section, idx) => {
  console.log(`\n${idx + 1}. ${section.citation}`);
  console.log(`   Title: ${section.title}`);
  console.log(`   Text length: ${section.text.length} characters`);
});
