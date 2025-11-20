
// Mapping tables
const GRADE_DESCRIPTION_MAP: Record<string, string> = {
  'O/S P&S': 'O/S P&S / Unprepared P&S',
  'UNPREP 1&2': 'UnPrepared 1&2 Mix/Long Iron',
  '1 HM': 'No.1 Heavy Melt / Short Iron',
  '2 HM': 'No.2 Heavy Melt / Short Iron',
  'MIX 1 & 2': 'No.1&2 Heavy Melt / Short Iron',
  'P&S': 'P&S / Plate & Structural',
  'TURN': 'Turnings',
  '2LTSHRD': 'No.2 Light / Tin',
  'DLR CLIPS 3': 'Dealer Clips 3',
  'INCOMPLETE CARS': 'Incomplete Cars',
  'SHD LOG': 'Shredder Bundles',
  'CAR BODY': 'Car Body (Complete)',
};

const FILE_NAME_MAP: Record<string, string> = {
  'O/S P&S': 'UnPrepared P&S',
  'UNPREP 1&2': 'UnPrepared 1&2MixLong Iron',
  '1 HM': '#1 Heavy Melt',
  '2 HM': '#2 Heavy Melt',
  'MIX 1 & 2': '#1&2 Mix Short Iron',
  'P&S': 'P&S',
  'TURN': 'Turn',
  '2LTSHRD': '#2 Light Tin',
  'DLR CLIPS 3': 'Dealer Clips 3',
  'INCOMPLETE CARS': 'Incomplete Cars',
  'SHD LOG': 'Shred Bales',
  'CAR BODY': 'HiWay Scrap Cars',
};

const COORDINATE_MAP: Record<string, { x: number; y: number }> = {
  '50000241': { x: 220, y: 553.7 },
  '50000242': { x: 220, y: 569.345 },
  '50000245': { x: 220, y: 584.99 },
  '50000250': { x: 220, y: 600.635 },
  '50000339': { x: 220, y: 616.28 },
  '50000332': { x: 220, y: 631.925 },
  '50000249': { x: 220, y: 647.57 },
  '50000341': { x: 220, y: 663.215 },
  '50000313': { x: 220, y: 678.86 },
  '50000665': { x: 411.31, y: 553.7 },
  '50000320': { x: 411.31, y: 569.345 },
  '50000281': { x: 411.31, y: 584.99 },
  '50000319': { x: 411.31, y: 600.635 },
  '50000302': { x: 411.31, y: 616.28 },
  '50000325': { x: 411.31, y: 631.925 },
  '50000252': { x: 411.31, y: 647.57 },
  '50000294': { x: 411.31, y: 663.215 },
  '50000246': { x: 411.31, y: 678.86 },
};

interface CSVRow {
  month: string;
  contract: string;
  materialNumber: string;
  materialDescription: string;
  reference: string;
  fob: 'yes' | 'no';
  data: string;
  file_name: string;
  grade_description: string;
  x?: number;
  y?: number;
}

/**
 * Parse CSV string into rows
 * Handles quoted fields, commas within quotes, and different line endings
 */
function parseCSV(csvText: string): string[][] {
  // Normalize line endings
  const normalized = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const rows: string[][] = [];
  
  for (const line of lines) {
    const row: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = i < line.length - 1 ? line[i + 1] : '';
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    // Add the last field
    row.push(current.trim());
    rows.push(row);
  }

  return rows;
}

/**
 * Remove leading zeros before the first 5 in material number
 */
function removeLeadingZeros(materialNumber: string): string {
  // Find the first '5' in the string
  const firstFiveIndex = materialNumber.indexOf('5');
  if (firstFiveIndex === -1) return materialNumber;
  
  // Remove all leading zeros before the first 5
  const beforeFive = materialNumber.substring(0, firstFiveIndex);
  const afterFive = materialNumber.substring(firstFiveIndex);
  
  return beforeFive.replace(/^0+/, '') + afterFive;
}

/**
 * Get month name from date string
 */
function getMonthName(dateString: string): string {
  const date = new Date(dateString);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[date.getMonth()];
}

/**
 * Parse delivery CSV with all the business rules
 */
export function parseDeliveryCSV(
  csvData: string,
  currentDate: string,
  email: string
): {
  json: {
    table: CSVRow[];
    fileList_fob: string;
    fileList_nonFob: string;
    email: string;
  };
} {
  console.log('Parsing CSV directly (no AI)');

  const rows = parseCSV(csvData);
  if (rows.length < 2) {
    throw new Error('CSV must have at least a header row and one data row');
  }

  const headers = rows[0].map(h => h.trim().toLowerCase());
  
  // Find column indices
  const contractIdx = headers.findIndex(h => h.includes('contract'));
  const materialNumberIdx = headers.findIndex(h => h.includes('material') && h.includes('number'));
  const materialDescriptionIdx = headers.findIndex(h => h.includes('material') && h.includes('description'));
  const referenceIdx = headers.findIndex(h => h.includes('reference'));

  if (contractIdx === -1 || materialNumberIdx === -1 || materialDescriptionIdx === -1 || referenceIdx === -1) {
    throw new Error('CSV must contain columns: contract, materialNumber, materialDescription, reference');
  }

  const month = getMonthName(currentDate);
  const table: CSVRow[] = [];
  let lastContract = '';
  let lastReference = '';
  let fobCount = 0;
  let nonFobCount = 0;

  // Process data rows
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < Math.max(contractIdx, materialNumberIdx, materialDescriptionIdx, referenceIdx) + 1) {
      continue; // Skip incomplete rows
    }

    // Extract fields
    let contract = (row[contractIdx] || '').trim();
    const materialNumber = (row[materialNumberIdx] || '').trim();
    const materialDescription = (row[materialDescriptionIdx] || '').trim();
    let reference = (row[referenceIdx] || '').trim();

    // Use last non-empty value if blank
    if (!contract) contract = lastContract;
    else lastContract = contract;

    if (!reference) reference = lastReference;
    else lastReference = reference;

    // Remove leading zeros before first 5
    const cleanedMaterialNumber = removeLeadingZeros(materialNumber);

    // Determine FOB
    const fob: 'yes' | 'no' = reference.toUpperCase().includes('FOB') ? 'yes' : 'no';

    // Assign data numbering
    let data: string;
    if (fob === 'yes') {
      fobCount++;
      data = `data_${fobCount}`;
    } else {
      nonFobCount++;
      data = `data_${nonFobCount}`;
    }

    // Map grade_description
    let grade_description = GRADE_DESCRIPTION_MAP[materialDescription] || materialDescription;

    // Special case: TIN CAN BUND
    if (reference.toUpperCase() === 'TIN CAN BUND') {
      grade_description = 'Shredder Bundles';
    }

    // Map file_name
    let file_name = FILE_NAME_MAP[materialDescription] || materialDescription;
    
    // Special case: TIN CAN BUND
    if (reference.toUpperCase() === 'TIN CAN BUND') {
      file_name = 'Tin Can Bundles';
    }

    // Add FOB prefix if needed
    if (fob === 'yes' && !file_name.startsWith('FOB ')) {
      file_name = `FOB ${file_name}`;
    }

    // Get coordinates
    const coordinates = COORDINATE_MAP[cleanedMaterialNumber];

    const csvRow: CSVRow = {
      month,
      contract,
      materialNumber: cleanedMaterialNumber,
      materialDescription,
      reference,
      fob,
      data,
      file_name,
      grade_description,
      ...(coordinates && { x: coordinates.x, y: coordinates.y }),
    };

    table.push(csvRow);
  }

  // Build file lists
  const fileList_fob = table.filter(r => r.fob === 'yes').map(r => r.data).join(',');
  const fileList_nonFob = table.filter(r => r.fob === 'no').map(r => r.data).join(',');

  return {
    json: {
      table,
      fileList_fob,
      fileList_nonFob,
      email,
    },
  };
}

