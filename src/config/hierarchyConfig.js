/**
 * Hierarchy Configuration Manager
 * Handles document hierarchy templates and numbering schemes
 */

class HierarchyConfig {
  /**
   * Get hierarchy configuration for an organization
   */
  getHierarchyLevels(organizationConfig) {
    return organizationConfig.hierarchy?.levels || this.getDefaultLevels();
  }

  /**
   * Get default hierarchy levels
   */
  getDefaultLevels() {
    return [
      {
        name: 'Article',
        type: 'article',
        numbering: 'roman',
        prefix: 'Article ',
        depth: 0
      },
      {
        name: 'Section',
        type: 'section',
        numbering: 'numeric',
        prefix: 'Section ',
        depth: 1
      }
    ];
  }

  /**
   * Format section number based on numbering scheme
   */
  formatSectionNumber(number, numberingScheme, prefix = '') {
    let formatted = '';

    switch (numberingScheme) {
      case 'roman':
        formatted = this.toRoman(number);
        break;
      case 'alpha':
        formatted = this.toAlpha(number, false);
        break;
      case 'alphaLower':
        formatted = this.toAlpha(number, true);
        break;
      case 'numeric':
      default:
        formatted = String(number);
        break;
    }

    return prefix + formatted;
  }

  /**
   * Convert number to Roman numerals
   */
  toRoman(num) {
    const romanNumerals = [
      { value: 1000, numeral: 'M' },
      { value: 900, numeral: 'CM' },
      { value: 500, numeral: 'D' },
      { value: 400, numeral: 'CD' },
      { value: 100, numeral: 'C' },
      { value: 90, numeral: 'XC' },
      { value: 50, numeral: 'L' },
      { value: 40, numeral: 'XL' },
      { value: 10, numeral: 'X' },
      { value: 9, numeral: 'IX' },
      { value: 5, numeral: 'V' },
      { value: 4, numeral: 'IV' },
      { value: 1, numeral: 'I' }
    ];

    let result = '';
    let remaining = num;

    for (const { value, numeral } of romanNumerals) {
      while (remaining >= value) {
        result += numeral;
        remaining -= value;
      }
    }

    return result;
  }

  /**
   * Convert number to alphabetic
   */
  toAlpha(num, lowercase = false) {
    const baseCode = lowercase ? 96 : 64; // 'a' or 'A'
    let result = '';
    let n = num;

    while (n > 0) {
      const remainder = (n - 1) % 26;
      result = String.fromCharCode(baseCode + remainder + 1) + result;
      n = Math.floor((n - 1) / 26);
    }

    return result;
  }

  /**
   * Parse Roman numeral to number
   */
  fromRoman(roman) {
    const romanMap = {
      'I': 1, 'V': 5, 'X': 10, 'L': 50,
      'C': 100, 'D': 500, 'M': 1000
    };

    let result = 0;
    let prevValue = 0;

    for (let i = roman.length - 1; i >= 0; i--) {
      const currentValue = romanMap[roman[i]];

      if (currentValue < prevValue) {
        result -= currentValue;
      } else {
        result += currentValue;
      }

      prevValue = currentValue;
    }

    return result;
  }

  /**
   * Parse alphabetic to number
   */
  fromAlpha(alpha) {
    const isLowerCase = alpha === alpha.toLowerCase();
    const baseCode = isLowerCase ? 96 : 64;
    let result = 0;

    for (let i = 0; i < alpha.length; i++) {
      const charCode = alpha.charCodeAt(i) - baseCode;
      result = result * 26 + charCode;
    }

    return result;
  }

  /**
   * Build section path (breadcrumb)
   */
  buildSectionPath(section, allSections) {
    const path = [];
    let current = section;

    while (current) {
      path.unshift({
        id: current.id,
        number: current.section_number,
        title: current.section_title,
        type: current.section_type
      });

      // Find parent
      if (current.parent_section_id) {
        current = allSections.find(s => s.id === current.parent_section_id);
      } else {
        current = null;
      }
    }

    return path;
  }

  /**
   * Generate full section citation
   */
  generateCitation(sectionPath, organizationConfig) {
    const separator = organizationConfig.numbering?.separator || '.';

    return sectionPath
      .map(item => item.number)
      .join(separator);
  }

  /**
   * Detect hierarchy from text
   */
  detectHierarchy(text, organizationConfig) {
    const levels = this.getHierarchyLevels(organizationConfig);
    const detected = [];

    for (const level of levels) {
      const pattern = new RegExp(`${level.prefix}([IVXivx0-9A-Za-z]+)`, 'gi');
      const matches = text.matchAll(pattern);

      for (const match of matches) {
        detected.push({
          level: level.name,
          type: level.type,
          number: match[1],
          prefix: level.prefix,
          fullMatch: match[0],
          index: match.index
        });
      }
    }

    return detected.sort((a, b) => a.index - b.index);
  }

  /**
   * Validate hierarchy structure
   */
  validateHierarchy(sections, organizationConfig) {
    const errors = [];
    const levels = this.getHierarchyLevels(organizationConfig);
    const maxDepth = organizationConfig.hierarchy?.maxDepth || 10;

    for (const section of sections) {
      // Check depth
      if (section.depth > maxDepth) {
        errors.push({
          section: section.id,
          error: `Depth ${section.depth} exceeds maximum of ${maxDepth}`
        });
      }

      // Check level consistency
      const expectedLevel = levels.find(l => l.depth === section.depth);
      if (expectedLevel && section.section_type !== expectedLevel.type) {
        errors.push({
          section: section.id,
          error: `Section type '${section.section_type}' doesn't match expected type '${expectedLevel.type}' at depth ${section.depth}`
        });
      }

      // Check numbering format
      if (expectedLevel) {
        const isValidFormat = this.validateNumberFormat(
          section.section_number,
          expectedLevel.numbering,
          expectedLevel.prefix
        );

        if (!isValidFormat) {
          errors.push({
            section: section.id,
            error: `Section number '${section.section_number}' doesn't match expected format '${expectedLevel.numbering}'`
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate number format
   */
  validateNumberFormat(number, scheme, prefix) {
    // Remove prefix if present
    const cleanNumber = number.replace(prefix, '').trim();

    switch (scheme) {
      case 'roman':
        return /^[IVXLCDMivxlcdm]+$/.test(cleanNumber);
      case 'numeric':
        return /^\d+$/.test(cleanNumber);
      case 'alpha':
        return /^[A-Z]+$/.test(cleanNumber);
      case 'alphaLower':
        return /^[a-z]+$/.test(cleanNumber);
      default:
        return true; // Unknown scheme, skip validation
    }
  }

  /**
   * Get children of a section
   */
  getChildren(parentId, allSections) {
    return allSections
      .filter(s => s.parent_section_id === parentId)
      .sort((a, b) => a.ordinal - b.ordinal);
  }

  /**
   * Get all descendants of a section
   */
  getDescendants(parentId, allSections) {
    const descendants = [];
    const children = this.getChildren(parentId, allSections);

    for (const child of children) {
      descendants.push(child);
      descendants.push(...this.getDescendants(child.id, allSections));
    }

    return descendants;
  }

  /**
   * Flatten hierarchy to display order
   */
  flattenHierarchy(sections) {
    // Find root sections (no parent)
    const roots = sections.filter(s => !s.parent_section_id);
    const flattened = [];

    const traverse = (section) => {
      flattened.push(section);
      const children = this.getChildren(section.id, sections);
      children.forEach(traverse);
    };

    roots
      .sort((a, b) => a.ordinal - b.ordinal)
      .forEach(traverse);

    return flattened;
  }
}

module.exports = new HierarchyConfig();
