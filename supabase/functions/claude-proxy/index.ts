import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { decode } from "https://deno.land/std@0.190.0/encoding/base64.ts";
// Using a PDF parsing library known to be more stable in Deno environments.
import pdf from 'https://esm.sh/pdf-parse@1.1.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log("Edge function invoked.");

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const claudeApiKey = Deno.env.get("CLAUDE_API_KEY");
    if (!claudeApiKey) {
      console.error("CLAUDE_API_KEY is not set.");
      throw new Error("CLAUDE_API_KEY is not set in your project's secrets.");
    }
    console.log("Claude API key found.");

    const { fileData, prompt, content, tone } = await req.json();
    let researchText = content;

    if (fileData) {
      console.log("Processing uploaded PDF file...");
      try {
        const pdfBytes = decode(fileData);
        // The library expects a Node.js Buffer, so we create one from the Uint8Array.
        const buffer = new (await import('https://deno.land/std@0.177.0/node/buffer.ts')).Buffer(pdfBytes);
        const data = await pdf(buffer);
        researchText = data.text;
        console.log("PDF parsing successful. Extracted text length:", researchText.length);
      } catch (parseError) {
        console.error("Error during PDF parsing:", parseError);
        throw new Error("Failed to parse the uploaded PDF file.");
      }
    }

    if (!researchText) {
      console.error("No content available for analysis.");
      return new Response(JSON.stringify({ error: 'No content provided.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    
    let finalPrompt = prompt;
    if (!fileData && content) {
      finalPrompt = `You are a research assistant. Summarize the following text in a ${tone} tone.`;
    }

    console.log("Sending request to Claude API...");
    const claudeApiUrl = "https://api.anthropic.com/v1/messages";
    const apiResponse = await fetch(claudeApiUrl, {
      method: 'POST',
      headers: {
        'x-api-key': claudeApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: "claude-3-sonnet-20240229",
        max_tokens: 4096,
        messages: [{ role: 'user', content: `${finalPrompt}\n\nHere is the text to analyze:\n\n${researchText}` }],
      }),
    });

    if (!apiResponse.ok) {
      const errorBody = await apiResponse.text();
      console.error("Claude API Error:", errorBody);
      throw new Error(`Claude API request failed with status ${apiResponse.status}`);
    }

    const claudeData = await apiResponse.json();
    const summary = claudeData.content[0].text;
    console.log("Successfully received summary from Claude API.");

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error("Unhandled error in edge function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});