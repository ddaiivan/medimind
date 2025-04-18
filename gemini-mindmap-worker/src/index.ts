import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// Define the expected environment bindings (including secrets)
export interface Env {
	GEMINI_API_KEY: string; // Secret binding defined in wrangler.jsonc
}

// --- Helper Function for CORS Headers ---
function getCorsHeaders(): HeadersInit {
	return {
		'Access-Control-Allow-Origin': '*', // Adjust in production if needed
		'Access-Control-Allow-Methods': 'POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
	};
}

// --- Main Worker Fetch Handler ---
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const corsHeaders = getCorsHeaders();

		// Handle CORS preflight requests
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		// Only allow POST requests for API calls
		if (request.method !== 'POST') {
			return new Response(JSON.stringify({ error: `Method ${request.method} Not Allowed` }), {
				status: 405,
				headers: {
					...corsHeaders,
					'Allow': 'POST',
					'Content-Type': 'application/json',
				},
			});
		}

		// --- API Key Check ---
		const apiKey = env.GEMINI_API_KEY;
		if (!apiKey) {
			console.error("GEMINI_API_KEY secret not configured in Cloudflare.");
			return new Response(JSON.stringify({ error: "Server configuration error: API key missing." }), {
				status: 500,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		// --- Initialize Google AI ---
		const modelName = "gemini-2.0-flash"; // Changed model name as requested
		const genAI = new GoogleGenerativeAI(apiKey);
		const model = genAI.getGenerativeModel({ model: modelName });
		const generationConfig = { temperature: 0.7 }; // Common config
		const safetySettings = [ // Common safety settings
			{ category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
			{ category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
			{ category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
			{ category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
		];

		// --- Routing based on path ---
		try {
			const body = await request.json(); // Parse request body once

			if (url.pathname === '/generate') {
				return await handleGenerate(body, model, modelName, generationConfig, safetySettings, corsHeaders);
			} else if (url.pathname === '/expand') {
				return await handleExpand(body, model, modelName, generationConfig, safetySettings, corsHeaders);
			} else {
				return new Response(JSON.stringify({ error: "Not Found" }), {
					status: 404,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				});
			}
		} catch (e) {
			if (e instanceof SyntaxError) {
				return new Response(JSON.stringify({ error: "Bad Request: Invalid JSON in request body." }), {
					status: 400,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				});
			}
			console.error("Unhandled error in fetch handler:", e);
			return new Response(JSON.stringify({ error: "Internal Server Error" }), {
				status: 500,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}
	},
};

// --- Handler for /generate endpoint ---
async function handleGenerate(
	body: any,
	model: any, // Type properly if using SDK types extensively
	modelName: string,
	generationConfig: any,
	safetySettings: any,
	corsHeaders: HeadersInit
): Promise<Response> {
	const topic = body.topic;
	// --- Extract includeDetails flag (default to true if missing) ---
	const includeDetails = typeof body.includeDetails === 'boolean' ? body.includeDetails : true;
	// --- End extraction ---

	if (!topic || typeof topic !== 'string' || topic.trim() === '') {
		return new Response(JSON.stringify({ error: "Bad Request: 'topic' is required in the request body." }), {
			status: 400,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}

	console.log(`Received generate request for topic: ${topic}, includeDetails: ${includeDetails}`);

	// --- Dynamically construct the prompt based on includeDetails ---
	let prompt = "";
	if (includeDetails) {
		prompt = `
Generate a detailed hierarchical mind map structure in English for the medical topic: "${topic}".
The output MUST be ONLY a valid JSON object. Do NOT include any text before or after the JSON object. Do NOT use markdown formatting like \`\`\`json.

The JSON object MUST follow this exact structure:
{
  "topic": "The main topic name in English (e.g., ${topic})",
  "children": [
    { "name": "Etiology", "children": [ /* { "name": "Sub-point..." } */ ] },
    { "name": "Risk Factors", "children": [ /* { "name": "Sub-point..." } */ ] },
    { "name": "Pathogenesis", "children": [ /* { "name": "Sub-point..." } */ ] },
    { "name": "Clinical Manifestations", "children": [ /* { "name": "Sub-point..." } */ ] },
    { "name": "Physical Examination", "children": [ /* { "name": "Sub-point..." } */ ] },
    { "name": "Diagnostic Investigations", "children": [ /* { "name": "Sub-point..." } */ ] },
    { "name": "Management", "children": [ /* { "name": "Sub-point..." } */ ] }
  ]
}
CRITICAL INSTRUCTIONS: Output ONLY the JSON object. Populate children arrays with relevant sub-points. Use English. No 'details' property. Empty children array ([]) if no sub-points.
`;
	} else {
		prompt = `
Generate a basic hierarchical mind map structure in English for the medical topic: "${topic}".
Focus on the main concepts and hierarchy. EXCLUDE detailed medical sections like Etiology, Risk Factors, Pathogenesis, Clinical Manifestations, Physical Examination, Diagnostic Investigations, and Management unless they are the primary topic itself.
The output MUST be ONLY a valid JSON object. Do NOT include any text before or after the JSON object. Do NOT use markdown formatting like \`\`\`json.

The JSON object MUST follow this structure:
{
  "topic": "The main topic name in English (e.g., ${topic})",
  "children": [
    /* { "name": "Main Sub-Concept 1", "children": [...] }, */
    /* { "name": "Main Sub-Concept 2", "children": [...] } */
  ]
}
CRITICAL INSTRUCTIONS: Output ONLY the JSON object. Populate children arrays with relevant main sub-concepts ONLY. Use English. No 'details' property. Empty children array ([]) if no sub-points. Do NOT include the specific detailed sections mentioned above (Etiology, Management, etc.).
`;
	}
	// --- End dynamic prompt construction ---

	try {
		console.log(`Sending generate request to Gemini API (Model: ${modelName})...`);
		// --- Corrected model.generateContent call ---
		const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig,
            safetySettings
        });
		// --- End correction ---

		// Handle potential lack of response or blocked content
        if (!result.response) {
            throw new Error("No response received from AI model.");
        }
        if (!result.response.candidates || result.response.candidates.length === 0) {
            const blockReason = result.response.promptFeedback?.blockReason;
            throw new Error(`AI request blocked. Reason: ${blockReason || 'Unknown'}`);
        }

		const text = result.response.text();
		console.log("Raw generate response text from Gemini:", text);

		let jsonData;
		try {
			const cleanedText = text.replace(/^```json\s*|```$/g, '').trim();
			jsonData = JSON.parse(cleanedText);
		} catch (parseError) {
			console.error("Failed to parse Gemini generate response as JSON:", parseError);
			console.error("Raw text was:", text);
			const jsonMatch = text.match(/\{[\s\S]*\}/); // Attempt to extract JSON block
			if (jsonMatch) {
				try {
					jsonData = JSON.parse(jsonMatch[0]);
					console.log("Successfully parsed generate response after extracting JSON block.");
				} catch (retryParseError) {
					console.error("Retry parsing generate response also failed:", retryParseError);
					throw new Error("AI response was not valid JSON.");
				}
			} else {
				throw new Error("AI response did not contain a recognizable JSON structure.");
			}
		}

		jsonData._modelUsed = modelName; // Add debug info

		console.log("Successfully parsed JSON, sending generate response to frontend.");
		return new Response(JSON.stringify(jsonData), {
			status: 200,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});

	} catch (error: any) {
		console.error("Error calling Gemini API or processing generate response:", error);
		const errorMessage = error.message?.includes(modelName) ? error.message : `Failed to generate mind map using model ${modelName}: ${error.message || error}`;
		return new Response(JSON.stringify({ error: errorMessage }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
}

// --- Handler for /expand endpoint ---
async function handleExpand(
	body: any,
	model: any, // Type properly if using SDK types extensively
	modelName: string,
	generationConfig: any,
	safetySettings: any,
	corsHeaders: HeadersInit
): Promise<Response> {
	const nodeName = body.nodeName;
	const parentContext = body.parentContext || "";
	const rootContext = body.rootContext || "";

	if (!nodeName || typeof nodeName !== 'string' || nodeName.trim() === '') {
		return new Response(JSON.stringify({ error: "Bad Request: 'nodeName' is required." }), {
			status: 400,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}

	console.log(`Received expand request for node: "${nodeName}", parent: "${parentContext}", root: "${rootContext}"`);

	const prompt = `
In the context of a medical mind map about "${rootContext}", list key sub-points or related concepts for the node "${nodeName}" ${parentContext ? `which is part of "${parentContext}"` : ''}.
Do NOT repeat "${nodeName}" itself in the results.
Provide the output STRICTLY as a valid JSON array of objects. Each object in the array MUST have exactly one property: "name", containing a concise description of the sub-point in English.
Example format: [{ "name": "Sub-point A" }, { "name": "Sub-point B" }, { "name": "Further Detail C" }]
If there are no relevant sub-points or details to add, return an empty JSON array: [].
Output ONLY the JSON array, starting with '[' and ending with ']'. Do not include any other text or markdown formatting.
`;

	// Adjust temperature slightly for expansion task if desired
	const expandGenerationConfig = { ...generationConfig, temperature: 0.6 };

	try {
		console.log(`Sending expand request to Gemini API (Model: ${modelName})...`);
		const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: expandGenerationConfig,
            safetySettings
        });

		// Handle potential lack of response or blocked content
        if (!result.response) {
            throw new Error("No response received from AI model.");
        }
        if (!result.response.candidates || result.response.candidates.length === 0) {
            const blockReason = result.response.promptFeedback?.blockReason;
            throw new Error(`AI request blocked. Reason: ${blockReason || 'Unknown'}`);
        }

		const text = result.response.text();
		console.log("Raw expand response text from Gemini:", text);

		let jsonArray;
		try {
			const cleanedText = text.replace(/^```json\s*|```$/g, '').trim();
			if (!cleanedText.startsWith('[') || !cleanedText.endsWith(']')) {
				// Attempt extraction if not a clean array
				const arrayMatch = cleanedText.match(/\[[\s\S]*\]/);
				if (arrayMatch) {
					console.warn("Attempting to parse extracted array block from expand response.");
					jsonArray = JSON.parse(arrayMatch[0]);
				} else {
					throw new Error("AI response is not a JSON array and no array block found.");
				}
			} else {
				jsonArray = JSON.parse(cleanedText);
			}

			if (!Array.isArray(jsonArray)) {
				throw new Error("Parsed AI response is not an array.");
			}
			// Filter for valid items just in case
			jsonArray = jsonArray.filter(item => item && typeof item.name === 'string');

		} catch (parseError) {
			console.error("Failed to parse Gemini expand response as JSON array:", parseError);
			console.error("Raw text was:", text);
			// Final attempt at extraction if initial parse/check failed
			const arrayMatch = text.match(/\[[\s\S]*\]/);
			if (arrayMatch) {
				try {
					jsonArray = JSON.parse(arrayMatch[0]);
					if (!Array.isArray(jsonArray)) throw new Error("Retry parsed data is not an array.");
					jsonArray = jsonArray.filter(item => item && typeof item.name === 'string');
					console.log("Successfully parsed expand array after extracting block on retry.");
				} catch (retryParseError) {
					console.error("Retry parsing expand array also failed:", retryParseError);
					throw new Error("AI response was not a valid JSON array.");
				}
			} else {
				console.warn("AI response did not contain a recognizable JSON array structure. Returning empty array.");
				jsonArray = []; // Default to empty array if parsing fails badly
			}
		}

		const responseBody = {
			nodes: jsonArray,
			_modelUsed: modelName, // Add model name here
		};
		console.log("Successfully parsed JSON array, sending expand response to frontend.");
		return new Response(JSON.stringify(responseBody), {
			status: 200,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});

	} catch (error: any) {
		console.error("Error calling Gemini API or processing expand response:", error);
		const errorMessage = error.message?.includes(modelName) ? error.message : `Failed to expand node using model ${modelName}: ${error.message || error}`;
		return new Response(JSON.stringify({ error: errorMessage }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
}
