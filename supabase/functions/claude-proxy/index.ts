import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import * as pdfjs from "https://esm.sh/pdfjs-dist@4.4.168/legacy/build/pdf.mjs";

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
      throw new Error("Server configuration error: CLAUDE_API_KEY secret is not set.");
    }

    // Use the Service Role Key to create a client that can bypass RLS.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { filePath, prompt, content, tone } = await req.json();
    let researchText = content;

    if (filePath) {
      // Download the file from Supabase Storage.
      const { data: fileBlob, error: downloadError } = await supabaseAdmin.storage
        .from('research-papers')
        .download(filePath);

      if (downloadError) {
        throw new Error(`Storage error: ${downloadError.message}`);
      }

      try {
        const pdfBytes = await fileBlob.arrayBuffer();
        const doc = await pdfjs.getDocument({ data: pdfBytes, disableWorker: true }).promise;
        
        let fullText = '';
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => (item as { str: string }).str).join(' ');
          fullText += pageText + '\n';
        }
        researchText = fullText;
      } catch (pdfError) {
        console.error("PDF Parsing Error:", pdfError);
        throw new Error(`Failed to parse PDF file. Details: ${pdfError.message}`);
      }
    }

    if (!researchText) {
      return new Response(JSON.stringify({ error: 'No content or file provided to analyze.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    
    let finalPrompt = prompt;
    if (!filePath && content) {
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