// These declarations are added to satisfy the TypeScript compiler in a non-Deno environment.
declare module "https://deno.land/std@0.190.0/http/server.ts" {
  export function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_CONTENT_LENGTH = 150000;
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const PDF_ANALYSIS_PROMPT = `You are a scientific analysis assistant. You will receive the full text of a research paper.

Your task is to extract and organize all essential scientific information from the paper, **without missing any key details**, especially from the methods and results.

Follow this format strictly:

---

**Title:**  
[Extracted]

**Authors:**  
[Extracted if available]

**Journal/DOI:**  
[Extracted if available]

---

### 1. Research Question  
- What problem is being investigated?

### 2. Background  
- Prior context, motivation, previous gaps

### 3. Methodology  
Include:
- Study type (e.g., RCT, observational, simulation)
- Sample size and characteristics
- Data collection tools, procedures
- Controls, variables, models

### 4. Key Findings  
- All experimental results
- Quantitative outcomes, effect sizes, statistical metrics (e.g. p-values)
- Any differences across groups or conditions

### 5. Conclusions  
- What the authors claim based on their results

### 6. Limitations  
- Any constraints or cautions mentioned

### 7. Future Directions  
- Any proposed next steps or open questions

---

**Instructions:**
- Be exhaustive and precise
- Do NOT skip anything, especially in methods or findings
- If a section is not present, write “Not stated”
- Use bullet points when listing multiple items`;

const SYNTHESIS_PROMPT = `You are a scientific writing assistant. You have been given structured research findings from multiple academic papers, all focused on the same topic.

Each paper has already been analyzed into sections:
- Research Question
- Background
- Methodology
- Key Findings
- Conclusions
- Limitations
- Future Directions

Your task is to create a **single unified summary** that synthesizes all the important information from the papers **without missing even small but relevant details**.

Use this exact structure for your output:

---

**1. Combined Research Question(s)**  
- What core questions or hypotheses are being explored across the papers?

**2. Shared Background & Motivation**  
- What is the overall context or significance of this research area?
- Mention any recurring gaps or goals across the literature.

**3. Methodologies (Across All Papers)**  
- List all experimental or analytical methods used
- Include sample sizes, populations, models, tools, and measurements
- Note methodological similarities and differences between papers

**4. Key Findings (Synthesized)**  
- Consolidate all key results, including quantitative metrics (e.g., effect sizes, p-values)
- Mention which findings appear across multiple papers, and which are unique
- Use bullet points for clarity
- If possible, group by theme (e.g., cellular outcomes, behavioral results)

**5. Authors’ Conclusions (Across Studies)**  
- What did the authors of these papers conclude individually or collectively?
- Clearly distinguish between well-supported claims and speculative statements

**6. Limitations**  
- Summarize all limitations mentioned across the papers
- Group by type (e.g., sample size, generalizability, model limitations)

**7. Suggested Future Directions**  
- What future research ideas appear across the studies?
- Note if there are shared open questions or proposed experiments

---

**Instructions:**
- You are not summarizing — you are synthesizing high-detail research
- Include minor but important data points (e.g., “insulin levels improved only in female mice in Paper 3”)
- Do NOT refer to specific paper numbers; generalize across the set
- Do NOT oversimplify or omit important nuance
- Maintain a tone that is clear, technical, and appropriate for scientific writing
- Use bullet points where helpful, but keep the flow organized

---

**Here is the structured input from multiple papers:**`;

async function callClaude(finalPrompt: string, claudeApiKey: string) {
  const claudeApiUrl = "https://api.anthropic.com/v1/messages";
  const apiResponse = await fetch(claudeApiUrl, {
    method: 'POST',
    headers: {
      'x-api-key': claudeApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 4096,
      temperature: 0.0,
      messages: [{ role: 'user', content: finalPrompt }],
    }),
  });

  if (!apiResponse.ok) {
    const errorBody = await apiResponse.text();
    console.error("Claude API Error:", errorBody);
    throw new Error(`External API Error: Claude API request failed with status ${apiResponse.status}.`);
  }

  const claudeData = await apiResponse.json();
  return claudeData.content[0].text;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, pdfs, mode, tone } = await req.json();
    const claudeApiKey = Deno.env.get("CLAUDE_API_KEY");
    if (!claudeApiKey) {
      throw new Error("Server configuration error: CLAUDE_API_KEY secret is not set.");
    }

    // Mode 1: Simple text summarization
    if (mode === 'summarize_text') {
      const finalPrompt = `You are a research assistant. Summarize the following text in a ${tone} tone.\n\nHere is the text to analyze:\n\n${content}`;
      const summary = await callClaude(finalPrompt, claudeApiKey);
      return new Response(JSON.stringify({ summary }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Mode 2: Full PDF extraction and synthesis
    if (mode === 'extract_and_synthesize' && pdfs && pdfs.length > 0) {
      const extractions = [];
      for (const [index, pdf] of pdfs.entries()) {
        let contentToProcess = pdf.content;
        if (contentToProcess.length > MAX_CONTENT_LENGTH) {
          console.warn(`Content from ${pdf.name} is too long and is being truncated.`);
          contentToProcess = contentToProcess.substring(0, MAX_CONTENT_LENGTH);
        }
        
        const extractionPrompt = `${PDF_ANALYSIS_PROMPT}\n\nHere is the text to analyze:\n\n${contentToProcess}`;
        console.log(`[SERVER] Starting extraction for: ${pdf.name}`);
        const summary = await callClaude(extractionPrompt, claudeApiKey);
        extractions.push({ name: pdf.name, summary });
        console.log(`[SERVER] Successfully extracted: ${pdf.name}`);

        if (index < pdfs.length - 1) {
          console.log(`[SERVER] Waiting 2.5s before next request...`);
          await delay(2500);
        }
      }

      const combinedExtractions = extractions
        .map(ext => `--- Paper: ${ext.name} ---\n\n${ext.summary}`)
        .join('\n\n');
      
      console.log("[SERVER] Starting synthesis...");
      const synthesisPrompt = `${SYNTHESIS_PROMPT}\n\n${combinedExtractions}`;
      const synthesisResult = await callClaude(synthesisPrompt, claudeApiKey);
      console.log("[SERVER] Synthesis complete.");

      return new Response(JSON.stringify({ extractions, synthesisResult }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid request mode or missing parameters.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });

  } catch (error) {
    console.error("Edge function execution error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});