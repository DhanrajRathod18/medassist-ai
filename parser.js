/**
 * AI Health Assistant — Prescription Parser
 * Rule-based parser for common medical prescription formats.
 */

const MEDICINE_PREFIXES = [
  'tab', 'tablet', 'cap', 'capsule', 'syp', 'syrup',
  'inj', 'injection', 'drops', 'drop', 'cream', 'oint',
  'ointment', 'gel', 'susp', 'suspension', 'powder',
  'sachet', 'inhaler', 'spray', 'patch', 'liq', 'liquid',
  'sol', 'solution', 'lotion'
];

const FREQUENCY_MAP = {
  '1-0-0': { morning: 1, afternoon: 0, night: 0, label: 'Once daily (morning)' },
  '0-1-0': { morning: 0, afternoon: 1, night: 0, label: 'Once daily (afternoon)' },
  '0-0-1': { morning: 0, afternoon: 0, night: 1, label: 'Once daily (night)' },
  '1-1-0': { morning: 1, afternoon: 1, night: 0, label: 'Twice daily (morning & afternoon)' },
  '1-0-1': { morning: 1, afternoon: 0, night: 1, label: 'Twice daily (morning & night)' },
  '0-1-1': { morning: 0, afternoon: 1, night: 1, label: 'Twice daily (afternoon & night)' },
  '1-1-1': { morning: 1, afternoon: 1, night: 1, label: 'Three times daily' },
  '1-1-1-1': { morning: 1, afternoon: 1, night: 1, label: 'Four times daily' },
  '½-0-½': { morning: 0.5, afternoon: 0, night: 0.5, label: 'Half tablet twice daily' },
  '½-½-½': { morning: 0.5, afternoon: 0.5, night: 0.5, label: 'Half tablet three times daily' },
};

const FREQUENCY_ALIASES = {
  'od': '1-0-0', 'once daily': '1-0-0', 'once a day': '1-0-0', 'qd': '1-0-0',
  'bd': '1-0-1', 'bid': '1-0-1', 'twice daily': '1-0-1', 'twice a day': '1-0-1', 'b.d': '1-0-1', 'b.i.d': '1-0-1',
  'tid': '1-1-1', 'tds': '1-1-1', 'three times daily': '1-1-1', 'three times a day': '1-1-1', 't.i.d': '1-1-1', 't.d.s': '1-1-1', 'thrice daily': '1-1-1',
  'qid': '1-1-1-1', 'qds': '1-1-1-1', 'four times daily': '1-1-1-1', 'four times a day': '1-1-1-1',
  'hs': '0-0-1', 'at bedtime': '0-0-1', 'at night': '0-0-1', 'nocte': '0-0-1',
  'sos': 'SOS', 'as needed': 'SOS', 'when needed': 'SOS', 'prn': 'SOS',
  'stat': 'STAT', 'immediately': 'STAT',
};

const INSTRUCTION_PATTERNS = [
  'before food', 'after food', 'with food', 'with meals',
  'before meals', 'after meals', 'on empty stomach', 'empty stomach',
  'with water', 'with milk', 'with warm water',
  'before breakfast', 'after breakfast',
  'before lunch', 'after lunch',
  'before dinner', 'after dinner',
  'do not chew', 'chew and swallow',
  'apply locally', 'apply on affected area',
  'sublingual', 'under the tongue',
  'as directed', 'as prescribed',
];

/**
 * Parse a full prescription text into structured data.
 * @param {string} text - Raw prescription text
 * @returns {Object} Parsed prescription data
 */
function parsePrescription(text) {
  if (!text || !text.trim()) {
    return { disease: 'Not specified', medicines: [] };
  }

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  let disease = 'Not specified';
  const medicines = [];

  // Try to detect disease/diagnosis
  disease = extractDisease(lines);

  // Parse each line for medicines
  for (const line of lines) {
    const med = parseMedicineLine(line);
    if (med) {
      medicines.push(med);
    }
  }

  // If no individual lines parsed, try parsing the whole block as one
  if (medicines.length === 0) {
    const med = parseMedicineLine(text.replace(/\n/g, ' '));
    if (med) medicines.push(med);
  }

  return { disease, medicines };
}

/**
 * Try to extract disease/condition from prescription text.
 */
function extractDisease(lines) {
  const diseaseKeywords = [
    'diagnosis', 'condition', 'disease', 'complaint', 'chief complaint',
    'dx', 'd/x', 'c/o', 'suffering from', 'diagnosed with', 'for',
  ];

  for (const line of lines) {
    const lower = line.toLowerCase();
    for (const kw of diseaseKeywords) {
      const idx = lower.indexOf(kw);
      if (idx !== -1) {
        let rest = line.substring(idx + kw.length).replace(/^[\s:.\-–—]+/, '').trim();
        // Don't return if it looks like a medicine line
        if (rest && !isMedicineLine(rest)) {
          return rest.charAt(0).toUpperCase() + rest.slice(1);
        }
      }
    }
  }
  return 'Not specified';
}

/**
 * Check if a line looks like a medicine entry.
 */
function isMedicineLine(text) {
  const lower = text.toLowerCase().trim();
  for (const prefix of MEDICINE_PREFIXES) {
    if (lower.startsWith(prefix + ' ') || lower.startsWith(prefix + '.') || lower.startsWith(prefix + '\t')) {
      return true;
    }
  }
  // Check for dosage pattern
  return /\d+-\d+-\d+/.test(text) || /\d+\s*mg|\d+\s*ml|\d+\s*mcg/i.test(text);
}

/**
 * Parse a single line of prescription into a medicine object.
 */
function parseMedicineLine(line) {
  const original = line;
  let text = line.trim();
  if (!text) return null;

  let name = '';
  let dosage = '';
  let frequency = '';
  let duration = '';
  let instructions = '';
  let type = '';

  // Remove numbering (1. , 2) , a) , - , •, Rx, etc.)
  text = text.replace(/^(?:\d+[.)]\s*|[a-z][.)]\s*|[-•*]\s*|Rx\s*:?\s*)/i, '').trim();

  // Extract medicine type/prefix
  const lower = text.toLowerCase();
  for (const prefix of MEDICINE_PREFIXES) {
    if (lower.startsWith(prefix + ' ') || lower.startsWith(prefix + '.') || lower.startsWith(prefix + '\t')) {
      type = prefix;
      text = text.substring(prefix.length).replace(/^[.\s]+/, '').trim();
      break;
    }
  }

  // If no medicine type found and no dosage pattern, skip
  if (!type && !isMedicineLine(original)) {
    return null;
  }

  // Extract instructions (before/after food etc.)
  for (const instr of INSTRUCTION_PATTERNS) {
    const instrRegex = new RegExp(instr.replace(/\s+/g, '\\s+'), 'i');
    const match = text.match(instrRegex);
    if (match) {
      instructions += (instructions ? ', ' : '') + match[0].toLowerCase();
      text = text.replace(match[0], '').trim();
    }
  }

  // Extract duration
  const durationRegex = /(?:for\s+)?(\d+)\s*(days?|weeks?|months?|d|w|m)\b/i;
  const durationMatch = text.match(durationRegex);
  if (durationMatch) {
    let num = durationMatch[1];
    let unit = durationMatch[2].toLowerCase();
    if (unit === 'd') unit = 'days';
    if (unit === 'w') unit = 'weeks';
    if (unit === 'm') unit = 'months';
    if (unit === 'day') unit = 'days';
    if (unit === 'week') unit = 'weeks';
    if (unit === 'month') unit = 'months';
    duration = `${num} ${unit}`;
    text = text.replace(durationMatch[0], '').replace(/\bfor\b/i, '').trim();
  }

  // Extract frequency (1-0-1 pattern)
  const freqRegex = /(\d+(?:\/\d+|½)?)\s*[-–—]\s*(\d+(?:\/\d+|½)?)\s*[-–—]\s*(\d+(?:\/\d+|½)?)/;
  const freqMatch = text.match(freqRegex);
  if (freqMatch) {
    frequency = freqMatch[0].replace(/[–—]/g, '-');
    text = text.replace(freqMatch[0], '').trim();
  }

  // Check for text-based frequency aliases
  if (!frequency) {
    for (const [alias, mapped] of Object.entries(FREQUENCY_ALIASES)) {
      const aliasRegex = new RegExp('\\b' + alias.replace(/\./g, '\\.') + '\\b', 'i');
      if (aliasRegex.test(text)) {
        frequency = mapped === 'SOS' || mapped === 'STAT' ? mapped : mapped;
        text = text.replace(aliasRegex, '').trim();
        break;
      }
    }
  }

  // Extract dosage (e.g., 500mg, 250 mg, 10ml)
  const dosageRegex = /(\d+(?:\.\d+)?)\s*(mg|ml|mcg|g|iu|units?|%)\b/i;
  const dosageMatch = text.match(dosageRegex);
  if (dosageMatch) {
    dosage = dosageMatch[1] + dosageMatch[2].toLowerCase();
    text = text.replace(dosageMatch[0], '').trim();
  }

  // Remaining text is the medicine name
  name = text.replace(/[,.\-–—;:]+$/g, '').replace(/\s+/g, ' ').trim();

  // Clean up name
  name = name.replace(/^\s*[-–—]\s*/, '').trim();

  if (!name && !type) return null;

  // Combine type into name
  if (type && name) {
    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
    name = typeLabel + '. ' + name;
  } else if (type && !name) {
    name = type.charAt(0).toUpperCase() + type.slice(1);
  }

  return {
    name: name || 'Unknown',
    dosage: dosage || 'As prescribed',
    frequency: frequency || 'As directed',
    duration: duration || 'As directed',
    instructions: instructions || 'As directed by doctor',
  };
}

/**
 * Generate a daily medication schedule from parsed medicines.
 * @param {Array} medicines - Array of parsed medicine objects
 * @returns {Object} Schedule with morning, afternoon, night arrays
 */
function generateSchedule(medicines) {
  const schedule = {
    morning: [],
    afternoon: [],
    night: [],
  };

  for (const med of medicines) {
    const freq = med.frequency;
    let mapping = FREQUENCY_MAP[freq];

    // Check if it's an alias
    if (!mapping && FREQUENCY_ALIASES[freq.toLowerCase()]) {
      const mapped = FREQUENCY_ALIASES[freq.toLowerCase()];
      mapping = FREQUENCY_MAP[mapped];
    }

    if (mapping) {
      if (mapping.morning > 0) {
        schedule.morning.push({
          name: med.name,
          dosage: med.dosage,
          count: mapping.morning,
          instructions: med.instructions,
        });
      }
      if (mapping.afternoon > 0) {
        schedule.afternoon.push({
          name: med.name,
          dosage: med.dosage,
          count: mapping.afternoon,
          instructions: med.instructions,
        });
      }
      if (mapping.night > 0) {
        schedule.night.push({
          name: med.name,
          dosage: med.dosage,
          count: mapping.night,
          instructions: med.instructions,
        });
      }
    } else if (freq === 'SOS' || freq === 'STAT') {
      // SOS / STAT — show under all as "when needed"
      schedule.morning.push({
        name: med.name,
        dosage: med.dosage,
        count: freq,
        instructions: med.instructions,
      });
    } else {
      // Unknown frequency — show as morning default
      schedule.morning.push({
        name: med.name,
        dosage: med.dosage,
        count: '?',
        instructions: med.instructions,
      });
    }
  }

  return schedule;
}

/**
 * Generate patient-friendly instructions text.
 * @param {Object} parsedData - The full parsed prescription data
 * @returns {string} Simple English instructions
 */
function generateInstructions(parsedData) {
  if (!parsedData.medicines.length) {
    return 'No medicines found in the prescription. Please check the input and try again.';
  }

  let text = '';

  if (parsedData.disease !== 'Not specified') {
    text += `**Condition:** ${parsedData.disease}\n\n`;
  }

  text += `You have been prescribed **${parsedData.medicines.length} medicine(s)**. Here is your medication plan:\n\n`;

  for (let i = 0; i < parsedData.medicines.length; i++) {
    const med = parsedData.medicines[i];
    const num = i + 1;
    text += `**${num}. ${med.name}** (${med.dosage})\n`;

    // Describe frequency
    const freqInfo = FREQUENCY_MAP[med.frequency];
    if (freqInfo) {
      text += `   • Take ${freqInfo.label.toLowerCase()}\n`;
    } else if (med.frequency === 'SOS') {
      text += `   • Take only when needed (SOS)\n`;
    } else if (med.frequency === 'STAT') {
      text += `   • Take immediately as directed\n`;
    } else {
      text += `   • Take as directed (${med.frequency})\n`;
    }

    // Instructions
    if (med.instructions && med.instructions !== 'As directed by doctor') {
      text += `   • ${med.instructions.charAt(0).toUpperCase() + med.instructions.slice(1)}\n`;
    }

    // Duration
    if (med.duration && med.duration !== 'As directed') {
      text += `   • Continue for **${med.duration}**\n`;
    }

    text += '\n';
  }

  text += `---\n`;
  text += `**General Advice:**\n`;
  text += `• Take medicines at the same time each day for best results.\n`;
  text += `• Complete the full course even if you feel better.\n`;
  text += `• Store medicines in a cool, dry place away from sunlight.\n`;
  text += `• If you experience any side effects, contact your doctor immediately.\n`;

  return text;
}

/**
 * Answer a patient question based on the parsed prescription context.
 * @param {string} question - The patient's question
 * @param {Object} parsedData - The parsed prescription data
 * @returns {string} Answer text
 */
function answerQuestion(question, parsedData) {
  const q = question.toLowerCase().trim();
  const hasData = parsedData && parsedData.medicines && parsedData.medicines.length > 0;
  
  let targetMed = null;
  if (hasData) {
    for (const med of parsedData.medicines) {
      if (q.includes(med.name.toLowerCase().split('.').pop().trim().toLowerCase())) {
        targetMed = med;
        break;
      }
    }
  }

  // General chat support
  if (q.includes('hello') || q.includes('hi') || q === 'hi' || q.includes('hey') || q.includes('help') || q.includes('how to use') || q.includes('what does this app do')) {
    if (hasData) {
      return `Hello! 👋 I'm your AI Health Assistant. I have your prescription with **${parsedData.medicines.length} medicine(s)** loaded. You can ask me about timing, food instructions, duration, or what to do if you miss a dose. How can I help?`;
    } else {
      return `Hello! 👋 I'm your AI Health Assistant. This system helps you understand your prescription, track medicines, and get reminders. You can start by entering your prescription on the Upload screen. How can I help you today?`;
    }
  }

  // Miss a dose
  if (q.includes('miss') || q.includes('forgot') || q.includes('skip')) {
    let answer = "If you miss a dose, take it as soon as you remember. If it's close to your next dose, skip the missed one. Do not double dose.";
    if (!hasData) {
      answer += "\n\nFor more accurate guidance tailored to your specific medicines, please enter your prescription.";
    } else if (targetMed) {
      answer += `\n\nFor **${targetMed.name}**, this general rule applies. Please check with your doctor if you miss multiple doses.`;
    }
    answer += "\n\n⚠️ *This is an AI assistant and not a replacement for a doctor. Always consult your physician.*";
    return answer;
  }

  // Before/after food questions
  if (q.includes('before food') || q.includes('after food') || q.includes('food') || q.includes('meal') || q.includes('eat') || q.includes('empty stomach')) {
    if (hasData) {
      if (targetMed) {
        return `Based on your prescription, **${targetMed.name}** should be taken **${targetMed.instructions}**. Please follow this instruction for best effectiveness.\n\n⚠️ *This is an AI assistant and not a replacement for a doctor.*`;
      }
      const instructions = parsedData.medicines.map(m => `• **${m.name}**: ${m.instructions}`).join('\n');
      return `Here are the food-related instructions for your medicines:\n\n${instructions}\n\nIf the prescription says "after food," take the medicine within 30 minutes of eating. If "before food," take it at least 30 minutes before your meal.\n\n⚠️ *This is an AI assistant and not a replacement for a doctor.*`;
    } else {
      return `Generally, if a medicine says "after food," take it within 30 minutes of eating to avoid stomach upset. If "before food," take it at least 30 minutes before your meal.\n\nFor more accurate guidance, please enter your prescription.\n\n⚠️ *This is an AI assistant and not a replacement for a doctor.*`;
    }
  }

  // Timing questions
  if (q.includes('when') || q.includes('time') || q.includes('morning') || q.includes('night') || q.includes('afternoon') || q.includes('schedule')) {
    if (hasData) {
      const schedule = generateSchedule(parsedData.medicines);
      let scheduleAns = "Here's your medication timing:\n\n";
      if (schedule.morning.length) {
        scheduleAns += `**🌅 Morning:**\n${schedule.morning.map(m => `• ${m.name} (${m.dosage})`).join('\n')}\n\n`;
      }
      if (schedule.afternoon.length) {
        scheduleAns += `**☀️ Afternoon:**\n${schedule.afternoon.map(m => `• ${m.name} (${m.dosage})`).join('\n')}\n\n`;
      }
      if (schedule.night.length) {
        scheduleAns += `**🌙 Night:**\n${schedule.night.map(m => `• ${m.name} (${m.dosage})`).join('\n')}\n\n`;
      }
      return scheduleAns;
    } else {
      return `Medicines should generally be taken at the same time each day for the best results.\n\nFor a specific schedule, please enter your prescription.\n\n⚠️ *This is an AI assistant and not a replacement for a doctor.*`;
    }
  }

  // Duration questions
  if (q.includes('how long') || q.includes('duration') || q.includes('how many days') || q.includes('stop') || q.includes('course')) {
    if (hasData) {
      if (targetMed) {
        return `**${targetMed.name}** should be taken for **${targetMed.duration}**. Please complete the full course as prescribed by your doctor, even if symptoms improve.`;
      }
      const durations = parsedData.medicines.map(m => `• **${m.name}**: ${m.duration}`).join('\n');
      return `Duration for your medicines:\n\n${durations}\n\n**Important:** Complete the full course even if you feel better.`;
    } else {
      return `You should complete the full course of your medication as prescribed by your doctor, even if you feel better. Stopping early can sometimes cause the illness to return.\n\nFor more accurate guidance, please enter your prescription.\n\n⚠️ *This is an AI assistant and not a replacement for a doctor.*`;
    }
  }

  // Dosage questions
  if (q.includes('dose') || q.includes('dosage') || q.includes('how much') || q.includes('how many') || q.includes('quantity')) {
    if (hasData) {
      if (targetMed) {
        return `The prescribed dosage for **${targetMed.name}** is **${targetMed.dosage}**, to be taken **${targetMed.frequency}** (${FREQUENCY_MAP[targetMed.frequency] ? FREQUENCY_MAP[targetMed.frequency].label : targetMed.frequency}).`;
      }
      const dosages = parsedData.medicines.map(m => `• **${m.name}**: ${m.dosage}, ${m.frequency}`).join('\n');
      return `Dosage information for your medicines:\n\n${dosages}`;
    } else {
      return `Dosage varies heavily depending on the specific medicine and your condition.\n\nFor accurate dosage information, please enter your prescription.\n\n⚠️ *This is an AI assistant and not a replacement for a doctor.*`;
    }
  }

  // Side effects / safety
  if (q.includes('side effect') || q.includes('reaction') || q.includes('allergy') || q.includes('allergic') || q.includes('danger') || q.includes('safe')) {
    return "Most medicines are safe when taken as prescribed, but can occasionally cause side effects. If you experience any unusual symptoms, stop taking the medicine and seek medical attention immediately.\n\nFor specific side effect concerns, please read the medicine leaflet or contact your doctor or pharmacist.\n\n⚠️ *This is an AI assistant and not a replacement for a doctor.*";
  }

  // Default answer
  if (hasData) {
    return `Based on your prescription, you've been prescribed **${parsedData.medicines.length} medicine(s)**: ${parsedData.medicines.map(m => m.name).join(', ')}.\n\nCould you rephrase your question? I can help with:\n• Timing & schedule\n• Food instructions\n• Duration\n• Dosage\n• Missed doses\n\n⚠️ *This is an AI assistant and not a replacement for a doctor.*`;
  } else {
    return `I am here to help you understand your medical prescriptions and answer health-related questions.\n\nTo get started, please enter your prescription, or ask me a general question about medication.\n\n⚠️ *This is an AI assistant and not a replacement for a doctor.*`;
  }
}

// Sample prescriptions for demo
const SAMPLE_PRESCRIPTIONS = [
  {
    title: 'Common Cold & Fever',
    text: `Diagnosis: Upper Respiratory Tract Infection

Tab Paracetamol 500mg 1-0-1 for 5 days after food
Tab Cetirizine 10mg 0-0-1 for 3 days after food
Syp Ambroxol 5ml 1-1-1 for 5 days after food
Tab Vitamin C 500mg 1-0-0 for 7 days after food`
  },
  {
    title: 'Diabetes Management',
    text: `Condition: Type 2 Diabetes Mellitus

Tab Metformin 500mg 1-0-1 for 30 days after food
Tab Glimepiride 1mg 1-0-0 for 30 days before food
Tab Atorvastatin 10mg 0-0-1 for 30 days after dinner`
  },
  {
    title: 'Infection Treatment',
    text: `D/x: Bacterial infection

Cap Amoxicillin 500mg 1-1-1 for 7 days after food
Tab Ibuprofen 400mg 1-0-1 for 3 days after food
Cap Omeprazole 20mg 1-0-0 for 7 days before food`
  },
  {
    title: 'Simple Single Medicine',
    text: `Tab Paracetamol 500mg 1-0-1 for 5 days after food`
  }
];
