import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Set a character limit to prevent crashes from payloads that are too large.
// 150,000 chars is roughly 35k-40k tokens, well within model limits and safe for HTTP requests.
const MAX_CONTENT_LENGTH = 150000;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let { content, prompt, tone } = await req.json();
    console.log(`Received content with length: ${content?.length || 0}`);

    const claudeApiKey = Deno.env.get("CLAUDE_API_KEY");
    if (!claudeApiKey) {
      throw new Error("Server configuration error: CLAUDE_API_KEY secret is not set.");
    }

    if (!content) {
      return new Response(JSON.stringify({ error: 'No content provided to analyze.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Truncate content if it exceeds the maximum allowed length.
    if (content.length > MAX_CONTENT_LENGTH) {
      console.warn(`Content length (${content.length}) exceeds maximum of ${MAX_CONTENT_LENGTH}. Truncating.`);
      content = content.substring(0, MAX_CONTENT_LENGTH);
    }
    
    const finalPrompt = prompt || `You are a research assistant. Summarize the following text in a ${tone} tone.`;

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
        messages: [{ role: 'user', content: `${finalPrompt}\n\nHere is the text to analyze:\n\n${content}` }],
      }),
    });

    if (!apiResponse.ok) {
      const errorBody = await apiResponse.text();
      console.error("Claude API Error:", errorBody);
      throw new Error(`External API Error: Claude API request failed with status ${apiResponse.status}.`);
    }

    const claudeData = await apiResponse.json();
    const summary = claudeData.content[0].text;

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