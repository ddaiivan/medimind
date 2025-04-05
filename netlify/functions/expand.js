// Import the Google AI SDK
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// Netlify Function handler for expanding a node
export async function handler(event, context) {
    // Handle CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
            body: '',
        };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: { 'Allow': 'POST', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: `Method ${event.httpMethod} Not Allowed` }),
        };
    }

    // --- Get API Key and Node Info ---
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("GEMINI_API_KEY environment variable not set.");
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: "Server configuration error: API key missing." }),
        };
    }

    let nodeName, parentContext, rootContext; // Added rootContext
    try {
        const body = JSON.parse(event.body || '{}');
        nodeName = body.nodeName;
        parentContext = body.parentContext || "";
        rootContext = body.rootContext || ""; // Get root context from request
    } catch (e) {
        return {
            statusCode: 400,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: "Bad Request: Invalid JSON in request body." }),
        };
    }

    if (!nodeName || typeof nodeName !== 'string' || nodeName.trim() === '') {
        return {
            statusCode: 400,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: "Bad Request: 'nodeName' is required." }),
        };
    }

    console.log(`Received expand request for node: "${nodeName}", parent: "${parentContext}", root: "${rootContext}"`);

    // --- Initialize Google AI ---
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    // --- Construct the Prompt for Expansion with Full Context (English) ---
    const prompt = `
In the context of a medical mind map about "${rootContext}", list key sub-points or related concepts for the node "${nodeName}" ${parentContext ? `which is part of "${parentContext}"` : ''}.
Do NOT repeat "${nodeName}" itself in the results.
Provide the output STRICTLY as a valid JSON array of objects. Each object in the array MUST have exactly one property: "name", containing a concise description of the sub-point in English.
Example format: [{ "name": "Sub-point A" }, { "name": "Sub-point B" }, { "name": "Further Detail C" }]
If there are no relevant sub-points or details to add, return an empty JSON array: [].
Output ONLY the JSON array, starting with '[' and ending with ']'. Do not include any other text or markdown formatting.
`;

    // --- Call Gemini API ---
    try {
        console.log("Sending expand request to Gemini API...");
        const generationConfig = { temperature: 0.6 };
        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        ];

        const result = await model.generateContent(prompt, generationConfig, safetySettings);
        const response = result.response;

        if (!response) {
            console.error("Gemini API returned no response for expand request.");
            throw new Error("No response received from AI model.");
        }

        const text = response.text();
        console.log("Raw expand response text from Gemini:", text);

        // --- Parse the Response (expecting an array) ---
        let jsonArray;
        try {
            const cleanedText = text.replace(/^```json\s*|```$/g, '').trim();
            if (!cleanedText.startsWith('[') || !cleanedText.endsWith(']')) {
                 throw new Error("AI response is not a JSON array.");
            }
            jsonArray = JSON.parse(cleanedText);
            if (!Array.isArray(jsonArray)) {
                throw new Error("Parsed AI response is not an array.");
            }
            jsonArray = jsonArray.filter(item => item && typeof item.name === 'string');

        } catch (parseError) {
            console.error("Failed to parse Gemini expand response as JSON array:", parseError);
            console.error("Raw text was:", text);
            const arrayMatch = text.match(/\[[\s\S]*\]/);
            if (arrayMatch) {
                try {
                    jsonArray = JSON.parse(arrayMatch[0]);
                    if (!Array.isArray(jsonArray)) throw new Error("Retry parsed data is not an array.");
                    jsonArray = jsonArray.filter(item => item && typeof item.name === 'string');
                    console.log("Successfully parsed array after extracting block.");
                } catch (retryParseError) {
                     console.error("Retry parsing array also failed:", retryParseError);
                     throw new Error("AI response was not a valid JSON array.");
                }
            } else {
                 console.warn("AI response did not contain a recognizable JSON array structure. Returning empty array.");
                 jsonArray = [];
            }
        }

        // --- Send Response to Frontend ---
        console.log("Successfully parsed JSON array, sending to frontend.");
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify(jsonArray), // Send the array back
        };

    } catch (error) {
        console.error("Error calling Gemini API or processing expand response:", error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: `Failed to expand node: ${error.message}` }),
        };
    }
}
