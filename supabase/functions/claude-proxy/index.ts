import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { decode } from "https://deno.land/std@0.190.0/encoding/base64.ts";
import pdf from 'https://esm.sh/pdf-parse@1.1.1';
import { Buffer } from "https://deno.land/std@0.177.0/node/buffer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const claudeApiKey = Deno.env.get("CLAUDE_API_KEY");
    if (!claudeApiKey) {
      console.error("CRITICAL: CLAUDE_API_KEY secret is not set.");
      throw new Error("CLAUDE_API_KEY is not set in project's secrets.");
    }

    const { fileData, prompt, content, tone } = await req.json();
    let researchText = content;

    if (fileData) {
      console.log("Received PDF data. Starting parsing with pdf-parse...");
      const pdfBytes = decode(fileData);
      // The 'pdf-parse' library expects a Node.js Buffer, so we create one.
      const pdfBuffer = Buffer.from(pdfBytes);
      const data = await pdf(pdfBuffer);
      researchText = data.text;
      console.log(`Successfully parsed PDF. Extracted text length: ${researchText.length}`);
    }

    if (!researchText) {
      return new Response(JSON.stringify({ error: 'No content provided to analyze.' }), {
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
    console.error("Edge function execution error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});