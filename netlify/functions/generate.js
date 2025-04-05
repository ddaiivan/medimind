// Import the Google AI SDK
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// Netlify Function handler (exports a handler function)
export async function handler(event, context) {
    // Handle CORS preflight requests (sent by browser before POST)
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*', // Allow requests from any origin
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
            body: '', // No body needed for OPTIONS
        };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: {
                'Allow': 'POST',
                'Access-Control-Allow-Origin': '*', // Include CORS header in error response too
            },
            body: JSON.stringify({ error: `Method ${event.httpMethod} Not Allowed` }),
        };
    }

    // --- Get API Key and Topic ---
    // Netlify injects environment variables into process.env
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("GEMINI_API_KEY environment variable not set.");
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: "Server configuration error: API key missing." }),
        };
    }

    let topic;
    try {
        // Request body is available in event.body (needs parsing)
        const body = JSON.parse(event.body || '{}');
        topic = body.topic;
    } catch (e) {
        return {
            statusCode: 400,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: "Bad Request: Invalid JSON in request body." }),
        };
    }

    if (!topic || typeof topic !== 'string' || topic.trim() === '') {
        return {
            statusCode: 400,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: "Bad Request: 'topic' is required in the request body." }),
        };
    }

    console.log(`Received request for topic: ${topic}`);

    // --- Initialize Google AI ---
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash-latest", // Use the flash model as requested
    });

    // --- Construct the Prompt (English) ---
    const prompt = `
Generate a detailed hierarchical mind map structure in English for the medical topic: "${topic}".
The output MUST be ONLY a valid JSON object. Do NOT include any text before or after the JSON object. Do NOT use markdown formatting like \`\`\`json.

The JSON object MUST follow this exact structure:
{
  "topic": "The main topic name in English (e.g., ${topic})",
  "children": [
    {
      "name": "Etiology", // Main category in English
      "children": [ // Array for sub-points of Etiology
        // Populate this array with objects, each having ONLY a "name" property in English.
        // Example: { "name": "Bacterial: Streptococcus pneumoniae" }, { "name": "Viral: Influenza" }
      ]
    },
    {
      "name": "Risk Factors", // Main category in English
      "children": [ // Array for sub-points of Risk Factors
        // Populate this array with objects, each having ONLY a "name" property in English.
        // Example: { "name": "Smoking" }, { "name": "Immunosuppression" }
      ]
    },
    {
      "name": "Pathogenesis", // Main category in English
      "children": [
         // Populate this array with objects, each having ONLY a "name" property in English. Keep concise.
         // Example: { "name": "Pathogen entry (Inhalation/Aspiration)" }, { "name": "Alveolar inflammation" }
      ]
    },
    {
      "name": "Clinical Manifestations", // Main category in English
      "children": [
        // Populate this array with objects, each having ONLY a "name" property in English.
        // Example: { "name": "Cough (Productive/Non-productive)" }, { "name": "Fever / Chills" }
      ]
    },
    {
      "name": "Physical Examination", // Main category in English
      "children": [
        // Populate this array with objects, each having ONLY a "name" property in English.
        // Example: { "name": "Crackles on auscultation" }, { "name": "Tachypnea" }
      ]
    },
    {
      "name": "Diagnostic Investigations", // Main category in English
      "children": [
        // Populate this array with objects, each having ONLY a "name" property in English.
        // Example: { "name": "Chest X-ray (Infiltrates/Consolidation)" }, { "name": "Sputum Culture" }
      ]
    },
    {
      "name": "Management", // Main category in English
      "children": [
        // Populate this array with objects, each having ONLY a "name" property in English.
        // Example: { "name": "Antibiotics (if bacterial)" }, { "name": "Supportive Care (Oxygen, Fluids)" }
      ]
    }
  ]
}

CRITICAL INSTRUCTIONS:
1.  The output MUST be ONLY the JSON object described above. All text values ("topic", "name") MUST be in English.
2.  Each main category object MUST contain a "children" array.
3.  Populate the "children" array with objects representing the key sub-points for that category.
4.  Each sub-point object inside the "children" array MUST have ONLY a "name" property with a concise English description.
5.  ABSOLUTELY DO NOT include a "details" property anywhere in the JSON output.
6.  If a main category has no logical sub-points, its "children" array MUST be empty ([]).
`;

    // --- Call Gemini API ---
    try {
        console.log("Sending request to Gemini API...");
        const generationConfig = {
            temperature: 0.7,
        };
        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        ];

        const result = await model.generateContent(prompt, generationConfig, safetySettings);
        const response = result.response;

        if (!response) {
            console.error("Gemini API returned no response.");
            throw new Error("No response received from AI model.");
        }

        const text = response.text();
        console.log("Raw response text from Gemini:", text);

        // --- Parse the Response ---
        let jsonData;
        try {
            const cleanedText = text.replace(/^```json\s*|```$/g, '').trim();
            jsonData = JSON.parse(cleanedText);
        } catch (parseError) {
            console.error("Failed to parse Gemini response as JSON:", parseError);
            console.error("Raw text was:", text);
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    jsonData = JSON.parse(jsonMatch[0]);
                    console.log("Successfully parsed after extracting JSON block.");
                } catch (retryParseError) {
                     console.error("Retry parsing also failed:", retryParseError);
                     throw new Error("AI response was not valid JSON.");
                }
            } else {
                 throw new Error("AI response did not contain a recognizable JSON structure.");
            }
        }

        // --- Send Response to Frontend ---
        console.log("Successfully parsed JSON, sending to frontend.");
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*', // Crucial for the browser to accept the response
            },
            body: JSON.stringify(jsonData),
        };

    } catch (error) {
        console.error("Error calling Gemini API or processing response:", error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ error: `Failed to generate mind map: ${error.message}` }),
        };
    }
}
