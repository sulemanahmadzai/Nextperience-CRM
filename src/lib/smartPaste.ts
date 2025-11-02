export interface SmartPasteResult {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCompany: string;
  eventName: string;
  eventDate: string;
  eventType: string;
  expectedPax: string;
  eventValue: string;
  source: string;
  notes: string;
  originalText: string;
  warnings: string[];
  hasContactInfo: boolean;
}

export function parseSmartPaste(text: string): SmartPasteResult {
  if (!text.trim()) {
    return {
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      customerCompany: '',
      eventName: '',
      eventDate: '',
      eventType: '',
      expectedPax: '',
      eventValue: '',
      source: '',
      notes: '',
      originalText: '',
      warnings: ['⚠️ Couldn\'t parse—please fill manually.'],
      hasContactInfo: false
    };
  }

  const result: SmartPasteResult = {
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerCompany: '',
    eventName: '',
    eventDate: '',
    eventType: '',
    expectedPax: '',
    eventValue: '',
    source: '',
    notes: text,
    originalText: text,
    warnings: [],
    hasContactInfo: false
  };

  const lines = text.split('\n').map(line => line.trim()).filter(line => line);

  extractCustomerInfo(text, lines, result);
  extractEventInfo(text, lines, result);
  extractSource(text, result);
  extractEventValue(text, result);

  result.hasContactInfo = !!(result.customerEmail || result.customerPhone);

  if (!result.customerName && !result.customerEmail && !result.customerPhone) {
    result.warnings.push('⚠️ Missing customer details – please fill manually.');
  }

  return result;
}

function extractCustomerInfo(text: string, lines: string[], result: SmartPasteResult) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const phoneRegex = /(?:\+63|0)?[\s-]?9\d{2}[\s-]?\d{3}[\s-]?\d{4}|(?:\+63|0)?[\s-]?[2-9]\d{2}[\s-]?\d{3}[\s-]?\d{4}/g;

  const emailMatch = text.match(emailRegex);
  if (emailMatch) {
    result.customerEmail = emailMatch[0];
  }

  const phoneMatch = text.match(phoneRegex);
  if (phoneMatch) {
    let phone = phoneMatch[0].replace(/[\s-]/g, '');

    if (phone.startsWith('+63')) {
      phone = '0' + phone.substring(3);
    } else if (!phone.startsWith('0')) {
      phone = '0' + phone;
    }

    result.customerPhone = phone;
  }

  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    if ((lowerLine.startsWith('name:') || lowerLine.startsWith('contact name:')) && !result.customerName) {
      result.customerName = line.split(':')[1]?.trim() || '';
    }

    if (lowerLine.includes('company') && lowerLine.includes(':') && !result.customerCompany) {
      const match = line.match(/company[^:]*:\s*(.+)/i);
      if (match) {
        result.customerCompany = match[1].trim();
      }
    }
  }

  if (!result.customerName) {
    for (const line of lines) {
      if (!line.includes(':') && !line.includes('@') && !line.match(/\d{10,}/)) {
        const words = line.split(/\s+/);
        if (words.length >= 2 && words.length <= 4 && line.length < 50) {
          const hasCommonKeywords = /email|phone|contact|date|event|pax|source|time|revenue|budget|quoted/i.test(line);
          if (!hasCommonKeywords && line[0] === line[0].toUpperCase()) {
            result.customerName = line;
            break;
          }
        }
      }
    }
  }

  const companyPatterns = [
    /from\s+([A-Z][a-zA-Z\s&]+(?:Corp|Inc|Ltd|LLC|Company|Group))/,
    /([A-Z][a-zA-Z\s&]+(?:Corp|Inc|Ltd|LLC|Company|Group))/
  ];

  for (const pattern of companyPatterns) {
    const match = text.match(pattern);
    if (match && !result.customerCompany) {
      result.customerCompany = match[1].trim();
      break;
    }
  }
}

function extractEventInfo(text: string, lines: string[], result: SmartPasteResult) {
  const currentYear = new Date().getFullYear();

  const datePatterns = [
    { regex: /(?:date[^:]*:|event date:)\s*([A-Za-z]+\s+\d{1,2}(?:,?\s*\d{4})?)/i, format: 'text' },
    { regex: /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/g, format: 'numeric' },
    { regex: /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:,?\s*\d{4})?)/gi, format: 'text' },
    { regex: /(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:,?\s*\d{4})?)/gi, format: 'text' }
  ];

  const allDates: string[] = [];

  for (const { regex } of datePatterns) {
    const matches = text.matchAll(regex);
    for (const match of matches) {
      const dateStr = match[1] || match[0];
      allDates.push(dateStr);
    }
  }

  if (allDates.length > 0) {
    result.eventDate = parseDateToISO(allDates[0], currentYear);

    if (allDates.length > 1) {
      const altDates = allDates.slice(1).map(d => formatDateForDisplay(d)).join(', ');
      if (!result.notes.includes('Alt dates')) {
        result.notes += `\n\nAlt dates detected: ${altDates}`;
      }
    }
  }

  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    if ((lowerLine.includes('event') && line.includes(':')) || lowerLine.startsWith('title:')) {
      const match = line.match(/(?:event[^:]*|title):\s*(.+)/i);
      if (match && !result.eventName) {
        result.eventName = match[1].trim();
      }
    }
  }

  if (!result.eventName) {
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      const isLikelyEventName = (
        (lowerLine.includes('party') || lowerLine.includes('wedding') ||
         lowerLine.includes('birthday') || lowerLine.includes('bday') ||
         lowerLine.includes('therapy') || lowerLine.includes('seminar') ||
         lowerLine.includes('launch') || lowerLine.includes('debut') ||
         lowerLine.includes('halloween') || lowerLine.includes('christmas') ||
         lowerLine.includes('exclusive')) &&
        !lowerLine.includes(':') &&
        !lowerLine.includes('@') &&
        line.length < 100 &&
        !lowerLine.match(/\d{10,}/)
      );

      if (isLikelyEventName) {
        result.eventName = line;
        break;
      }
    }
  }

  const eventTypeKeywords = [
    { keywords: ['wedding', 'prenup', 'bride', 'groom'], type: 'Wedding' },
    { keywords: ['corporate', 'company', 'seminar', 'office'], type: 'Corporate Event' },
    { keywords: ['birthday', 'bday', 'turning'], type: 'Birthday' },
    { keywords: ['debut'], type: 'Debut' },
    { keywords: ['school', 'class', 'field trip', 'educational'], type: 'School Tour' },
    { keywords: ['launch', 'activation', 'brand', 'promo'], type: 'Product Launch' },
    { keywords: ['team building', 'outing', 'retreat', 'therapy'], type: 'Team Building' }
  ];

  const lowerText = text.toLowerCase();
  for (const { keywords, type } of eventTypeKeywords) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      result.eventType = type;
      break;
    }
  }

  if (!result.eventType) {
    result.eventType = 'Others';
  }

  const cohortPaxPattern = /(\d+)\s*(?:kids?|adults?|children|teachers?|guests?|people)[,\s]+(\d+)\s*(?:kids?|adults?|children|teachers?|guests?|people)(?:[,\s]+(\d+)\s*(?:kids?|adults?|children|teachers?|guests?|people))?/i;
  const cohortMatch = text.match(cohortPaxPattern);

  if (cohortMatch) {
    let total = parseInt(cohortMatch[1]) + parseInt(cohortMatch[2]);
    if (cohortMatch[3]) {
      total += parseInt(cohortMatch[3]);
    }
    result.expectedPax = total.toString();
  } else {
    const paxPatterns = [
      /(\d+)\s*[-–—]\s*(\d+)\s*(?:pax|people|guests|attendees)/i,
      /(?:pax|people|guests|attendees)[:\s]*(\d+)\s*[-–—]\s*(\d+)/i,
      /(\d+)\s*(?:pax|people|guests|attendees)/i,
      /(?:pax|people|guests|attendees)[:\s]*(\d+)/i
    ];

    for (const pattern of paxPatterns) {
      const match = text.match(pattern);
      if (match) {
        if (match[2]) {
          result.expectedPax = Math.max(parseInt(match[1]), parseInt(match[2])).toString();
        } else {
          result.expectedPax = match[1];
        }
        break;
      }
    }
  }

  const timePattern = /(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM))(?:\s*[-–—]\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)))?/g;
  const timeMatches = Array.from(text.matchAll(timePattern));

  if (timeMatches.length > 0) {
    const timeInfo = timeMatches.map(m => m[0]).join(', ');
    if (!result.notes.includes(timeInfo)) {
      result.notes += `\n\nTime: ${timeInfo}`;
    }
  }
}

function extractSource(text: string, result: SmartPasteResult) {
  const lowerText = text.toLowerCase();

  const sourceMap: { [key: string]: string } = {
    'ig': 'Instagram',
    'instagram': 'Instagram',
    'fb': 'Facebook',
    'facebook': 'Facebook',
    'tt': 'TikTok',
    'tiktok': 'TikTok',
    'website': 'Website',
    'referral': 'Referral',
    'google': 'Google',
    'twitter': 'Twitter',
    'linkedin': 'LinkedIn'
  };

  for (const line of text.split('\n')) {
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('source') || lowerLine.includes('where did you') || lowerLine.includes('know about')) {
      const sourcePart = line.split(':')[1]?.trim();
      if (sourcePart) {
        const normalizedSource = sourcePart.toLowerCase().trim();
        for (const [key, value] of Object.entries(sourceMap)) {
          if (normalizedSource.includes(key)) {
            result.source = value;
            return;
          }
        }
        result.source = sourcePart;
        return;
      }
    }
  }

  for (const [key, value] of Object.entries(sourceMap)) {
    if (lowerText.includes(key)) {
      result.source = value;
      break;
    }
  }
}

function extractEventValue(text: string, result: SmartPasteResult) {
  const valuePatterns = [
    /(?:revenue|budget|quoted)[:\s]*[₱$]?\s*([\d,]+(?:\.\d{2})?)/i,
    /[₱$]\s*([\d,]+(?:\.\d{2})?)/
  ];

  for (const pattern of valuePatterns) {
    const match = text.match(pattern);
    if (match) {
      const value = match[1].replace(/,/g, '');
      if (!isNaN(parseFloat(value))) {
        result.eventValue = value;
        break;
      }
    }
  }
}

function parseDateToISO(dateStr: string, defaultYear: number): string {
  const monthMap: { [key: string]: string } = {
    'jan': '01', 'january': '01',
    'feb': '02', 'february': '02',
    'mar': '03', 'march': '03',
    'apr': '04', 'april': '04',
    'may': '05',
    'jun': '06', 'june': '06',
    'jul': '07', 'july': '07',
    'aug': '08', 'august': '08',
    'sep': '09', 'september': '09',
    'oct': '10', 'october': '10',
    'nov': '11', 'november': '11',
    'dec': '12', 'december': '12'
  };

  dateStr = dateStr.toLowerCase().trim();

  const textDateMatch = dateStr.match(/([a-z]+)\s+(\d{1,2})(?:,?\s*(\d{4}))?/);
  if (textDateMatch) {
    const month = monthMap[textDateMatch[1]];
    const day = textDateMatch[2].padStart(2, '0');
    const year = textDateMatch[3] || defaultYear.toString();

    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  const numericDateMatch = dateStr.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (numericDateMatch) {
    let month = numericDateMatch[1].padStart(2, '0');
    let day = numericDateMatch[2].padStart(2, '0');
    let year = numericDateMatch[3];

    if (year.length === 2) {
      year = '20' + year;
    }

    return `${year}-${month}-${day}`;
  }

  return '';
}

function formatDateForDisplay(dateStr: string): string {
  const monthMap: { [key: string]: string } = {
    'jan': 'Jan', 'january': 'Jan',
    'feb': 'Feb', 'february': 'Feb',
    'mar': 'Mar', 'march': 'Mar',
    'apr': 'Apr', 'april': 'Apr',
    'may': 'May',
    'jun': 'Jun', 'june': 'Jun',
    'jul': 'Jul', 'july': 'Jul',
    'aug': 'Aug', 'august': 'Aug',
    'sep': 'Sep', 'september': 'Sep',
    'oct': 'Oct', 'october': 'Oct',
    'nov': 'Nov', 'november': 'Nov',
    'dec': 'Dec', 'december': 'Dec'
  };

  const lowerDateStr = dateStr.toLowerCase().trim();
  const match = lowerDateStr.match(/([a-z]+)\s+(\d{1,2})/);

  if (match) {
    const month = monthMap[match[1]];
    const day = match[2];
    return month ? `${month} ${day}` : dateStr;
  }

  return dateStr;
}
