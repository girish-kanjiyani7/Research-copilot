import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Buffer } from "https://deno.land/std@0.190.0/io/buffer.ts";
import * as pdfjs from 'https://esm.sh/pdfjs-dist@4.4.168';

// Set the worker source for pdf.js
pdfjs.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.4.168/build/pdf.worker.mjs`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to extract text from a PDF buffer
async function getPdfText(data: Uint8Array) {
    const pdf = await pdfjs.getDocument(data).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map(item => ('str' in item ? item.str : ''));
        text += strings.join(' ') + '\n';
    }
    return text;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const claudeApiKey = Deno.env.get("CLAUDE_API_KEY");
    if (!claudeApiKey) {
      throw new Error("CLAUDE_API_KEY is not set in your project's secrets.");
    }

    const { fileData, prompt, content, tone } = await req.json();
    let researchText = content;

    // If a PDF file is uploaded, decode it and extract the text
    if (fileData) {
      const buffer = Buffer.from(fileData, 'base64');
      researchText = await getPdfText(buffer.bytes());
    }

    if (!researchText) {
      return new Response(JSON.stringify({ error: 'No content provided.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    
    // Use the detailed analysis prompt for PDFs, or create a simpler one for text
    let finalPrompt = prompt;
    if (!fileData && content) {
      finalPrompt = `You are a research assistant. Summarize the following text in a ${tone} tone.`;
    }

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

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});