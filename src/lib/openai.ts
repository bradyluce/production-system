import OpenAI from 'openai';

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (openaiClient) {
    return openaiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

export async function parseComexPDF(text: string): Promise<{
  materials: Array<{
    material: string;
    price: number;
    cell: string;
  }>;
  lastMatchOverride?: string;
}> {
  console.log('Parsing Comex PDF with GPT-5-nano');
  const client = getOpenAIClient();

  const prompt = `Parse the following PDF text and extract material pricing information. 
Return a JSON object with:
- materials: array of objects with {material: string, price: number, cell: string}
- lastMatchOverride: optional string for last match override

Text to parse:
${text}

Return only valid JSON, no markdown formatting.`;

  const response = await client.chat.completions.create({
    model: 'gpt-5-nano',
    messages: [
      {
        role: 'system',
        content: 'You are a JSON parser. Return only valid JSON objects.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  // Clean up JSON if wrapped in markdown
  const jsonText = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(jsonText);

  console.log('Parsed result:', parsed);
  return parsed;
}

export async function normalizeText(text: string): Promise<string> {
  console.log('Normalizing text with GPT-5-nano');
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: 'gpt-5-nano',
    messages: [
      {
        role: 'system',
        content: 'You are a text normalizer. Clean and normalize the input text.',
      },
      {
        role: 'user',
        content: `Normalize this text: ${text}`,
      },
    ],
  });

  return response.choices[0]?.message?.content || text;
}

export async function parseDeliveryCSV(
  csvData: string,
  currentDate: string,
  email: string
): Promise<{
  json: {
    table: Array<{
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
    }>;
    fileList_fob: string;
    fileList_nonFob: string;
    email: string;
  };
}> {
  console.log('Parsing delivery CSV with GPT-5-nano');
  const client = getOpenAIClient();

  // First, get the month from the current date
  const monthResponse = await client.chat.completions.create({
    model: 'gpt-5-nano',
    messages: [
      {
        role: 'user',
        content: `Return only the name of the month from this: ${currentDate}`,
      },
    ],
  });

  const month = monthResponse.choices[0]?.message?.content?.trim() || '';

  const prompt = `Parse the following CSV data:

${csvData}

Rules

1. Extract the following fields for each row:

month → always set to ${month}

contract → if blank, use the most recent non-empty value above

materialNumber → remove all leading zeroes before the first 5

materialDescription

reference → if blank, use the most recent non-empty value above

2. Determine fob:

If the reference contains "FOB" (case-insensitive, partial match allowed), set:

fob: "yes"


Otherwise:

fob: "no"


3. Assign data numbering sequences (independent):

For FOB rows → data_1, data_2, … (count only FOB)

For non-FOB rows → data_1, data_2, … (count only non-FOB)

These numbering sequences do not overlap.

4. Map grade_description by materialDescription

If no match, set equal to the original materialDescription.

materialDescription	grade_description
O/S P&S	O/S P&S / Unprepared P&S
UNPREP 1&2	UnPrepared 1&2 Mix/Long Iron
1 HM	No.1 Heavy Melt / Short Iron
2 HM	No.2 Heavy Melt / Short Iron
MIX 1 & 2	No.1&2 Heavy Melt / Short Iron
P&S	P&S / Plate & Structural
TURN	Turnings
2LTSHRD	No.2 Light / Tin
DLR CLIPS 3	Dealer Clips 3
INCOMPLETE CARS	Incomplete Cars
SHD LOG	Shredder Bundles
CAR BODY	Car Body (Complete)

If reference is 'TIN CAN BUND' save grade description as Shredder Bundles and file name as 'Tin Can Bundles'

5. Map file_name by materialDescription

If fob = "yes", prefix with "FOB " (e.g., "FOB UnPrepared P&S").
If no match, set equal to the original materialDescription.

materialDescription	file_name
O/S P&S	UnPrepared P&S
UNPREP 1&2	UnPrepared 1&2MixLong Iron
1 HM	#1 Heavy Melt
2 HM	#2 Heavy Melt
MIX 1 & 2	#1&2 Mix Short Iron
P&S	P&S
TURN	Turn
2LTSHRD	#2 Light Tin
DLR CLIPS 3	Dealer Clips 3
INCOMPLETE CARS	Incomplete Cars
SHD LOG	Shred Bales
CAR BODY	HiWay Scrap Cars

6. Map x and y coordinates by grade_code (materialNumber after trimming zeroes)

If not found, omit the coordinates.

grade_code	x	y
50000241	220	553.7
50000242	220	569.345
50000245	220	584.99
50000250	220	600.635
50000339	220	616.28
50000332	220	631.925
50000249	220	647.57
50000341	220	663.215
50000313	220	678.86
50000665	411.31	553.7
50000320	411.31	569.345
50000281	411.31	584.99
50000319	411.31	600.635
50000302	411.31	616.28
50000325	411.31	631.925
50000252	411.31	647.57
50000294	411.31	663.215
50000246	411.31	678.86

7. Add top-level summary fields:

fileList_fob: comma-separated list of data IDs where fob = "yes"

fileList_nonFob: comma-separated list of data IDs where fob = "no"

email: ${email}

Output format

Return only valid JSON, matching this schema exactly.
Do not include markdown, code fences, or explanations.

{
  "json": {
    "table": [
      {
        "month": "October",
        "contract": "4600651121",
        "materialNumber": "500000246",
        "materialDescription": "O/S P&S",
        "reference": "FOB JHT NETX",
        "fob": "yes",
        "data": "data_1",
        "file_name": "FOB UnPrepared P&S",
        "grade_description": "O/S P&S / Unprepared P&S",
        "x": 220,
        "y": 553.7
      },
      {
        "month": "October",
        "contract": "4600651121",
        "materialNumber": "500000302",
        "materialDescription": "UNPREP 1&2",
        "reference": "UNPREPARED",
        "fob": "no",
        "data": "data_1",
        "file_name": "UnPrepared 1&2MixLong Iron",
        "grade_description": "UnPrepared 1&2 Mix/Long Iron",
        "x": 411.31,
        "y": 616.28
      }
    ],
    "fileList_fob": "data_1,data_2",
    "fileList_nonFob": "data_1,data_2",
    "email": "${email}"
  }
}`;

  const response = await client.chat.completions.create({
    model: 'gpt-5-nano',
    messages: [
      {
        role: 'system',
        content: 'You are a JSON parser. Return only valid JSON objects.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  // Clean up JSON if wrapped in markdown
  const jsonText = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(jsonText);

  console.log('Parsed CSV result:', parsed);
  return parsed;
}

