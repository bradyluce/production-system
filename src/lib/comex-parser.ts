// Material to Excel cell mapping
const MATERIAL_CELL_MAP: Record<string, string> = {
  'Aluminum Cans': 'B3',
  'Aluminum Sheet': 'B4',
  'Aluminum Painted Siding': 'B5',
  'Aluminum 6061': 'B6',
  'Aluminum 6063': 'B7',
  'Aluminum Cast': 'B8',
  'Aluminum Clips': 'B9',
  'Aluminum Wheel - Clean': 'B10',
  'Aluminum Wheel - Dirty': 'B11',
  'Aluminum Chrome Wheel': 'B12',
  'Aluminum Truck Wheels': 'B13',
  'EC Wire': 'B14',
  'ACSR - Aluminum Coated Steel Reinforced': 'B15',
  'Insulated Wire Aluminum (Neoprene)': 'B16',
  'Aluminum Turnings/Shavings': 'B17',
  'Aluminum Die Cast': 'B18',
  'Aluminum Breakage': 'B19',
  'Stainless - Clean': 'B20',
  'Stainless - Dirty': 'B21',
  'Stainless Turnings/Shavings': 'B22',
  'Bare Bright Copper': 'B23',
  '#1 Copper': 'B24',
  '#2 Copper': 'B25',
  'Yellow Brass - Clean': 'B26',
  'Yellow Brass - Dirty': 'B27',
  'Mixed Brass Shells': 'B28',
  'Brass Turnings/Shavings': 'B29',
  'Red Brass': 'B30',
  'Hard Brass': 'B31',
  'Brass/Copper Radiators - Clean': 'B32',
  'Brass/Copper Radiators - Dirty': 'B33',
  'Heater Core': 'B34',
  'Aluminum/Copper Reefer - Clean': 'B35',
  'Aluminum/Copper Reefer - Dirty': 'B36',
  'Aluminum Radiators - Clean': 'B37',
  'Aluminum Radiators - Dirty': 'B38',
  'Aluminum/Copper Reefer Ends': 'B39',
  '85 % MCM': 'B40',
  'ICW #1 65 %': 'B41',
  'ICW #2 45 %': 'B42',
  'ICW #3 30 % (Low Grade)': 'B43',
  'Data/Cat 5 ICW': 'B44',
  'Christmas Lights': 'B45',
  'Soft Lead – Clean': 'B46',
  'Lead Acid Battery': 'B47',
  'Steel Case Battery (Lead Acid)': 'B48',
  'Indoor Range Lead': 'B49',
  'Lead Wheel Weights': 'B50',
  'Electric Motors': 'B51',
  'Large Electric Motors': 'B52',
  'Sealed Units': 'B53',
  'Alternators': 'B54',
  'Aluminum Nose Starter': 'B55',
  'Steel Nose Starter': 'B56',
  'Comex': 'B57',
};

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate similarity percentage between two strings (0-1, where 1 is identical)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1.0;
  
  const distance = levenshteinDistance(str1, str2);
  return 1 - (distance / maxLen);
}

/**
 * Normalize price string to number
 * Removes $, commas, spaces; uses . for decimal separator
 */
function normalizePrice(priceStr: string): number | null {
  // Remove $, commas, and spaces
  let cleaned = priceStr.replace(/[$,\s]/g, '');
  
  // Replace any non-standard decimal separators with .
  cleaned = cleaned.replace(/[^\d.]/g, '');
  
  // Handle multiple decimal points (keep only the first one)
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('');
  }
  
  const price = parseFloat(cleaned);
  return isNaN(price) ? null : price;
}

/**
 * Find best matching material using fuzzy matching (≥85% similarity)
 */
function findBestMatch(text: string): { material: string; cell: string } | null {
  const normalizedText = text.trim().toLowerCase();
  let bestMatch: { material: string; cell: string; similarity: number } | null = null;
  
  for (const [material, cell] of Object.entries(MATERIAL_CELL_MAP)) {
    const normalizedMaterial = material.toLowerCase();
    const similarity = calculateSimilarity(normalizedText, normalizedMaterial);
    
    if (similarity >= 0.85) {
      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = { material, cell, similarity };
      }
    }
  }
  
  return bestMatch ? { material: bestMatch.material, cell: bestMatch.cell } : null;
}

/**
 * Extract material and price pairs from PDF text
 * Handles various formats: "Material $X.XX", "Material: $X.XX", "Material X.XX", etc.
 */
function extractMaterialPricePairs(text: string): Array<{ material: string; price: number }> {
  const pairs: Array<{ material: string; price: number }> = [];
  
  // Normalize text - replace multiple spaces with single space
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  
  // Split text into lines for processing
  const lines = normalizedText.split(/\n/).map(line => line.trim()).filter(line => line.length > 0);
  
  // Process each line and adjacent lines to find material-price pairs
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = i < lines.length - 1 ? lines[i + 1] : '';
    
    // Pattern 1: Material name followed by price on same line
    // Matches: "Aluminum Cans $0.79", "Aluminum Cans: $0.79", "Aluminum Cans 0.79", etc.
    const sameLinePattern = /(.+?)\s*[:]?\s*\$?\s*(\d+\.?\d*)\s*$/i;
    const sameLineMatch = line.match(sameLinePattern);
    
    if (sameLineMatch) {
      const materialText = sameLineMatch[1].trim();
      const priceStr = sameLineMatch[2];
      const price = normalizePrice(priceStr);
      
      if (price !== null && price > 0 && materialText.length > 2) {
        const matchResult = findBestMatch(materialText);
        if (matchResult) {
          pairs.push({
            material: matchResult.material,
            price: price,
          });
          continue; // Skip to next line
        }
      }
    }
    
    // Pattern 2: Material name on one line, price on next line
    if (nextLine) {
      const pricePattern = /^\$?\s*(\d+\.?\d*)\s*$/;
      const priceMatch = nextLine.match(pricePattern);
      
      if (priceMatch) {
        const priceStr = priceMatch[1];
        const price = normalizePrice(priceStr);
        
        if (price !== null && price > 0 && line.length > 2) {
          const matchResult = findBestMatch(line);
          if (matchResult) {
            pairs.push({
              material: matchResult.material,
              price: price,
            });
            i++; // Skip next line since we processed it
            continue;
          }
        }
      }
    }
    
    // Pattern 3: Look for price anywhere in line, extract material from before it
    const priceAnywherePattern = /\$?\s*(\d+\.?\d{0,2})\b/g;
    const priceMatches = [...line.matchAll(priceAnywherePattern)];
    
    for (const match of priceMatches) {
      const priceStr = match[0];
      const price = normalizePrice(priceStr);
      
      if (price !== null && price > 0 && price < 1000) { // Reasonable price range
        // Get text before the price
        const materialText = line.substring(0, match.index).trim();
        
        // Also try combining with previous line if current line is short
        let fullMaterialText = materialText;
        if (materialText.length < 5 && i > 0) {
          fullMaterialText = lines[i - 1] + ' ' + materialText;
        }
        
        if (fullMaterialText.length > 2) {
          const matchResult = findBestMatch(fullMaterialText);
          if (matchResult) {
            pairs.push({
              material: matchResult.material,
              price: price,
            });
            break; // Only take first valid match per line
          }
        }
      }
    }
  }
  
  return pairs;
}

/**
 * Parse Comex PDF text and extract material pricing information
 * Implements the N8N prompt logic directly
 */
export function parseComexPDF(text: string): {
  entries: Array<{
    material: string;
    price: number;
    cell: string;
  }>;
} {
  console.log('Parsing Comex PDF directly (no AI)');
  console.log('First 500 chars of extracted text:', text.substring(0, 500));
  
  // Extract all material-price pairs
  const pairs = extractMaterialPricePairs(text);
  console.log(`Extracted ${pairs.length} material-price pairs before matching`);
  
  // Use a Map to keep only the last price for each material
  const materialMap = new Map<string, { material: string; price: number; cell: string }>();
  
  for (const pair of pairs) {
    const cell = MATERIAL_CELL_MAP[pair.material];
    if (cell) {
      // Keep only the last match (overwrite previous matches)
      materialMap.set(pair.material, {
        material: pair.material,
        price: pair.price,
        cell: cell,
      });
      console.log(`Matched: ${pair.material} -> ${pair.price} -> ${cell}`);
    } else {
      console.log(`No cell mapping found for: ${pair.material}`);
    }
  }
  
  // Convert to array
  const entries = Array.from(materialMap.values());
  
  console.log(`Found ${entries.length} material matches`);
  
  return { entries };
}

