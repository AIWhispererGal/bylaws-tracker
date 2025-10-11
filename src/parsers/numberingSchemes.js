/**
 * Numbering Schemes
 * Support for various document numbering patterns
 */

class NumberingSchemes {
  /**
   * Convert number to Roman numerals
   */
  toRoman(num) {
    if (num <= 0 || num >= 4000) {
      return String(num); // Out of range for standard Roman numerals
    }

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
   * Convert Roman numerals to number
   */
  fromRoman(roman) {
    if (!roman || typeof roman !== 'string') {
      return 0;
    }

    const romanMap = {
      'I': 1, 'V': 5, 'X': 10, 'L': 50,
      'C': 100, 'D': 500, 'M': 1000
    };

    let result = 0;
    let prevValue = 0;

    // Process from right to left
    for (let i = roman.length - 1; i >= 0; i--) {
      const currentValue = romanMap[roman[i].toUpperCase()];

      if (!currentValue) {
        return 0; // Invalid Roman numeral
      }

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
   * Convert number to alphabetic (A, B, C... Z, AA, AB...)
   */
  toAlpha(num, lowercase = false) {
    if (num <= 0) {
      return '';
    }

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
   * Convert alphabetic to number
   */
  fromAlpha(alpha, lowercase = true) {
    if (!alpha || typeof alpha !== 'string') {
      return 0;
    }

    const str = lowercase ? alpha.toLowerCase() : alpha.toUpperCase();
    const baseCode = lowercase ? 96 : 64;
    let result = 0;

    for (let i = 0; i < str.length; i++) {
      const charCode = str.charCodeAt(i) - baseCode;

      if (charCode < 1 || charCode > 26) {
        return 0; // Invalid character
      }

      result = result * 26 + charCode;
    }

    return result;
  }

  /**
   * Format number with leading zeros
   */
  toNumeric(num, padLength = 0) {
    return String(num).padStart(padLength, '0');
  }

  /**
   * Convert number to ordinal (1st, 2nd, 3rd...)
   */
  toOrdinal(num) {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const value = num % 100;

    return num + (suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0]);
  }

  /**
   * Convert number to words (one, two, three...)
   */
  toWords(num) {
    const ones = [
      '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'
    ];
    const tens = [
      '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'
    ];
    const teens = [
      'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
      'sixteen', 'seventeen', 'eighteen', 'nineteen'
    ];

    if (num === 0) return 'zero';
    if (num < 10) return ones[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) {
      return tens[Math.floor(num / 10)] + (num % 10 ? '-' + ones[num % 10] : '');
    }
    if (num < 1000) {
      return ones[Math.floor(num / 100)] + ' hundred' +
        (num % 100 ? ' ' + this.toWords(num % 100) : '');
    }

    return String(num); // Beyond 1000, just return the number
  }

  /**
   * Format hierarchical number (1.2.3)
   */
  formatHierarchical(numbers, separator = '.') {
    return numbers.filter(n => n !== null && n !== undefined).join(separator);
  }

  /**
   * Parse hierarchical number (1.2.3 -> [1, 2, 3])
   */
  parseHierarchical(str, separator = '.') {
    if (!str) return [];
    return str.split(separator).map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
  }

  /**
   * Increment number in specific scheme
   */
  increment(current, scheme) {
    switch (scheme) {
      case 'roman':
        return this.toRoman(this.fromRoman(current) + 1);

      case 'alpha':
        return this.toAlpha(this.fromAlpha(current, false) + 1, false);

      case 'alphaLower':
        return this.toAlpha(this.fromAlpha(current, true) + 1, true);

      case 'numeric':
      default:
        return String(parseInt(current, 10) + 1);
    }
  }

  /**
   * Compare two numbers in specific scheme
   */
  compare(a, b, scheme) {
    let numA, numB;

    switch (scheme) {
      case 'roman':
        numA = this.fromRoman(a);
        numB = this.fromRoman(b);
        break;

      case 'alpha':
        numA = this.fromAlpha(a, false);
        numB = this.fromAlpha(b, false);
        break;

      case 'alphaLower':
        numA = this.fromAlpha(a, true);
        numB = this.fromAlpha(b, true);
        break;

      case 'numeric':
      default:
        numA = parseInt(a, 10);
        numB = parseInt(b, 10);
        break;
    }

    return numA - numB;
  }

  /**
   * Validate number format for scheme
   */
  validate(number, scheme) {
    const str = String(number).trim();

    switch (scheme) {
      case 'roman':
        return /^[IVXLCDMivxlcdm]+$/.test(str) && this.fromRoman(str) > 0;

      case 'alpha':
        return /^[A-Z]+$/.test(str) && this.fromAlpha(str, false) > 0;

      case 'alphaLower':
        return /^[a-z]+$/.test(str) && this.fromAlpha(str, true) > 0;

      case 'numeric':
        return /^\d+$/.test(str) && parseInt(str, 10) > 0;

      default:
        return true;
    }
  }

  /**
   * Get all supported schemes
   */
  getSupportedSchemes() {
    return ['roman', 'numeric', 'alpha', 'alphaLower', 'ordinal', 'words'];
  }

  /**
   * Auto-detect numbering scheme from examples
   */
  detectScheme(examples) {
    if (!examples || examples.length === 0) {
      return 'numeric';
    }

    const first = String(examples[0]).trim();

    if (/^[IVXLCDMivxlcdm]+$/.test(first)) {
      return 'roman';
    }
    if (/^[A-Z]+$/.test(first)) {
      return 'alpha';
    }
    if (/^[a-z]+$/.test(first)) {
      return 'alphaLower';
    }
    if (/^\d+$/.test(first)) {
      return 'numeric';
    }

    return 'numeric'; // Default
  }
}

module.exports = new NumberingSchemes();
