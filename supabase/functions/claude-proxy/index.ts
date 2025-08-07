// These declarations are added to satisfy the TypeScript compiler in a non-Deno environment.
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// @ts-ignore: This directive is used to suppress TypeScript errors about Deno-specific URL imports,
// which are not understood in a standard Node.js/Vite environment.
// The code will execute correctly in the Deno runtime on Supabase Edge Functions.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_CONTENT_LENGTH = 150000;

const PDF_ANALYSIS_PROMPT = `You are a scientific analysis assistant. You will receive the full text of a research paper, with page breaks clearly marked as "--- Page X ---".

Your task is to extract and organize all essential scientific information from the paper. **For every piece of information you extract, you MUST cite the page number it came from in parentheses, like this: (p. 5).**

Follow this format strictly:

---

**Title:**  
[Extracted] (p. X)

**Authors:**  
[Extracted if available] (p. X)

**Journal/DOI:**  
[Extracted if available] (p. X)

---

### 1. Research Question  
- What problem is being investigated? (p. X)

### 2. Background  
- Prior context, motivation, previous gaps. (p. X)

### 3. Methodology  
Include:
- Study type (e.g., RCT, observational, simulation). (p. X)
- Sample size and characteristics. (p. X)
- Data collection tools, procedures. (p. X)
- Controls, variables, models. (p. X)

### 4. Key Findings  
- All experimental results. (p. X)
- Quantitative outcomes, effect sizes, statistical metrics (e.g. p-values). (p. X)
- Any differences across groups or conditions. (p. X)

### 5. Conclusions  
- What the authors claim based on their results. (p. X)

### 6. Limitations  
- Any constraints or cautions mentioned. (p. X)

### 7. Future Directions  
- Any proposed next steps or open questions. (p. X)

---

**Instructions:**
- Be exhaustive and precise.
- **Cite the page number for every single point.**
- Do NOT skip anything, especially in methods or findings.
- If a section is not present, write “Not stated.”
- Use bullet points when listing multiple items.`;

const SYNTHESIS_PROMPT = `You are a scientific writing assistant. You have been given structured research findings from multiple academic papers. Each finding is already annotated with its page number, and each paper has a filename as a source identifier. Your task is to create a single, unified summary that synthesizes all important information, with **mandatory inline citations for every point, including the page number.**

---
**CRITICAL CITATION REQUIREMENT:**

For **every statement** you make, you **MUST** include an inline citation indicating the source paper and the exact page number, like this: **[filename.pdf, p. 5]**. If a finding is supported by multiple papers, cite them all.

**Example Format:**
- **Correct:** "The studies used mouse models [miller_et_al_2022.pdf, p. 3] and rat models [chen_2021_review.pdf, p. 8]."
- **Correct:** "The treatment was found to be effective [miller_et_al_2022.pdf, p. 12; chen_2021_review.pdf, p. 15]."
- **Incorrect:** "The studies used both mouse and rat models. [miller_et_al_2022.pdf]"
- **Incorrect:** "The treatment was found to be effective."

**Failure to provide citations with page numbers for every piece of information will render the output useless. Be meticulous.**
---

Use this exact structure for your output, ensuring every point is cited with its filename and page number:

**1. Combined Research Question(s)**  
- What core questions or hypotheses are being explored across the papers? [Cite sources with page numbers]

**2. Shared Background & Motivation**  
- What is the overall context or significance of this research area? [Cite sources with page numbers]
- Mention any recurring gaps or goals across the literature. [Cite sources with page numbers]

**3. Methodologies (Across All Papers)**  
- List all experimental or analytical methods used, including sample sizes, populations, models, and tools. [Cite sources with page numbers]
- Note methodological similarities and differences between papers. [Cite sources with page numbers]

**4. Key Findings (Synthesized)**  
- Consolidate all key results, including quantitative metrics (e.g., effect sizes, p-values). [Cite sources with page numbers]
- Mention which findings appear across multiple papers and which are unique. [Cite sources with page numbers]

**5. Authors’ Conclusions (Across Studies)**  
- What did the authors of these papers conclude individually or collectively? [Cite sources with page numbers]
- Clearly distinguish between well-supported claims and speculative statements. [Cite sources with page numbers]

**6. Limitations**  
- Summarize all limitations mentioned across the papers, grouping by type if possible. [Cite sources with page numbers]

**7. Suggested Future Directions**  
- What future research ideas or open questions appear across the studies? [Cite sources with page numbers]

---

**Instructions:**
- You are synthesizing high-detail research with citations, not just summarizing.
- The input you receive already contains page numbers for each fact. Use them.
- Include minor but important data points, ensuring each is cited with its page number.
- Do NOT oversimplify or omit important nuance.
- Maintain a clear, technical tone appropriate for scientific writing.

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
    const { content, pdfs, mode, tone, writingSample } = await req.json();
    const claudeApiKey = Deno.env.get("CLAUDE_API_KEY");
    if (!claudeApiKey) {
      throw new Error("Server configuration error: CLAUDE_API_KEY secret is not set.");
    }

    // Mode 1: Simple text summarization
    if (mode === 'summarize_text') {
      let finalPrompt = `You are a research assistant. Summarize the following text.`;
      if (writingSample) {
        finalPrompt += `\n\nYour response must adopt the writing style, tone, and voice of the following sample text:\n\n--- WRITING STYLE SAMPLE ---\n${writingSample}\n--- END SAMPLE ---`;
      } else {
        switch (tone) {
          case 'layman':
            finalPrompt += `\n\nExplain the summary in a very human and accessible way. Imagine you're explaining it to a curious friend who is smart but not an expert in the field. Use simple terms, analogies, and focus on the 'so what?' — the key takeaways and real-world implications. Avoid jargon completely. The tone should be engaging, clear, and easy to understand.`;
            break;
          case 'academic':
          default:
            finalPrompt += `\n\nWrite the summary in a formal, academic tone suitable for a research paper or scientific context.`;
            break;
        }
      }
      finalPrompt += `\n\nHere is the text to analyze:\n\n${content}`;
      
      const summary = await callClaude(finalPrompt, claudeApiKey);
      return new Response(JSON.stringify({ summary }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Mode 2: Full PDF extraction and synthesis
    if (mode === 'extract_and_synthesize' && pdfs && pdfs.length > 0) {
      console.log(`[SERVER] Starting sequential extraction for ${pdfs.length} PDF(s).`);
      
      let extractions = [];

      for (const pdf of pdfs) {
        console.log(`[SERVER] Processing: ${pdf.name}`);
        try {
          const contentWithPages = pdf.pages
            .map((p: { page: number; content: string }) => `--- Page ${p.page} ---\n${p.content}`)
            .join('\n\n');

          let contentToProcess = contentWithPages;
          if (contentToProcess.length > MAX_CONTENT_LENGTH) {
            console.warn(`Content from ${pdf.name} is too long and is being truncated.`);
            contentToProcess = contentToProcess.substring(0, MAX_CONTENT_LENGTH);
          }
          
          const extractionPrompt = `${PDF_ANALYSIS_PROMPT}\n\nHere is the text to analyze:\n\n${contentToProcess}`;
          
          const summary = await callClaude(extractionPrompt, claudeApiKey);
          console.log(`[SERVER] Successfully extracted: ${pdf.name}`);
          extractions.push({ name: pdf.name, summary });

        } catch (error) {
          console.error(`[SERVER] Failed to extract: ${pdf.name}`, error);
          extractions.push({ name: pdf.name, summary: `Error processing this document: ${error.message}` });
        }
      }
      
      const successfulExtractions = extractions.filter(e => !e.summary.startsWith('Error processing'));

      if (successfulExtractions.length === 0) {
        throw new Error("All PDF extractions failed.");
      }

      const combinedExtractions = successfulExtractions
        .map(ext => `--- Paper: ${ext.name} ---\n\n${ext.summary}`)
        .join('\n\n');
      
      console.log("[SERVER] Starting synthesis...");
      
      let synthesisPromptForClaude = SYNTHESIS_PROMPT;
      if (writingSample) {
        const styleInstruction = `Your final output must be written in the style of the sample text provided below. All other instructions in the prompt remain the same, including the mandatory citation format.\n\n--- WRITING STYLE SAMPLE ---\n${writingSample}\n--- END SAMPLE ---\n\n`;
        synthesisPromptForClaude = styleInstruction + SYNTHESIS_PROMPT;
      }
      
      const finalSynthesisPrompt = `${synthesisPromptForClaude}\n\n${combinedExtractions}`;
      const synthesisResult = await callClaude(finalSynthesisPrompt, claudeApiKey);
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