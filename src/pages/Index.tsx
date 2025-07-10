import { useState, useRef, useEffect } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FileUp, X, Loader2 } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';

const MAX_FILES = 10;
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

type AnalysisPhase = 'idle' | 'extracting' | 'synthesizing' | 'complete' | 'error';

const Index = () => {
  const [topic, setTopic] = useState("Stem Cell Derived Islets");
  const [dateRange, setDateRange] = useState("2014-2024");
  const [content, setContent] = useState("");
  const [parsedPdfs, setParsedPdfs] = useState<{ name: string; content: string }[]>([]);
  const [tone, setTone] = useState("academic");
  
  const [extractions, setExtractions] = useState<{ name: string; summary: string }[]>([]);
  const [synthesisResult, setSynthesisResult] = useState<string | null>(null);
  const [analysisPhase, setAnalysisPhase] = useState<AnalysisPhase>('idle');
  const [extractionProgress, setExtractionProgress] = useState({ completed: 0, total: 0 });

  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files);

    if (parsedPdfs.length + newFiles.length > MAX_FILES) {
      showError(`You can upload a maximum of ${MAX_FILES} files.`);
      return;
    }

    setIsParsing(true);
    
    const newlyParsedPdfs: { name: string; content: string }[] = [];
    let hadError = false;

    for (const file of newFiles) {
      if (parsedPdfs.some(p => p.name === file.name)) {
        showError(`File "${file.name}" is already uploaded and was skipped.`);
        hadError = true;
        continue;
      }
      if (file.type !== "application/pdf") {
        showError(`File "${file.name}" is not a PDF and was skipped.`);
        hadError = true;
        continue;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        showError(`File "${file.name}" is too large and was skipped.`);
        hadError = true;
        continue;
      }

      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => (item as any).str).join(' ');
          fullText += pageText + '\n';
        }
        newlyParsedPdfs.push({ name: file.name, content: fullText });
      } catch (error) {
        console.error(`Failed to parse PDF "${file.name}":`, error);
        showError(`Could not read text from "${file.name}".`);
        hadError = true;
      }
    }

    setParsedPdfs(prev => [...prev, ...newlyParsedPdfs]);
    
    if (!hadError && newlyParsedPdfs.length > 0) {
        showSuccess(`Successfully parsed ${newlyParsedPdfs.length} new PDF(s).`);
    } else if (newlyParsedPdfs.length > 0) {
        showSuccess(`Parsed ${newlyParsedPdfs.length} PDF(s) with some warnings.`);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
    setIsParsing(false);
  };

  const removePdf = (name: string) => {
    setParsedPdfs(prev => prev.filter(pdf => pdf.name !== name));
  };

  const handleGenerate = async () => {
    setExtractions([]);
    setSynthesisResult(null);
    setAnalysisPhase('idle');
    setExtractionProgress({ completed: 0, total: 0 });

    const textContent = content.trim();
    const pdfsToProcess = parsedPdfs;

    if (!textContent && pdfsToProcess.length === 0) {
      showError("There is no content to analyze.");
      return;
    }

    // Case 1: Only text content, no PDFs. Use simple summarization.
    if (textContent && pdfsToProcess.length === 0) {
      setAnalysisPhase('synthesizing');
      try {
        const { data, error } = await supabase.functions.invoke('claude-proxy', {
          body: { content: textContent, tone: tone },
        });
        if (error) throw error;
        if (data.error) throw new Error(data.error);
        setSynthesisResult(data.summary);
        setAnalysisPhase('complete');
      } catch (error: any) {
        showError(`Analysis failed: ${error.message}`);
        setAnalysisPhase('error');
      }
      return;
    }

    // Case 2: PDFs are present. Start two-phase process.
    // Phase 1: Extraction
    setAnalysisPhase('extracting');
    setExtractionProgress({ completed: 0, total: pdfsToProcess.length });

    const extractionPromises = pdfsToProcess.map(pdf =>
      supabase.functions.invoke('claude-proxy', {
        body: { content: pdf.content, mode: 'extract' },
      }).then(response => {
        setExtractionProgress(prev => ({ ...prev, completed: prev.completed + 1 }));
        return { ...response, pdfName: pdf.name };
      })
    );

    const extractionResults = await Promise.allSettled(extractionPromises);
    const successfulExtractions: { name: string; summary: string }[] = [];
    let extractionErrors = 0;

    extractionResults.forEach(result => {
      if (result.status === 'fulfilled') {
        const { data, error, pdfName } = result.value;
        if (error || data.error) {
          extractionErrors++;
          console.error(`Extraction failed for ${pdfName}:`, error || data.error);
        } else {
          successfulExtractions.push({ name: pdfName, summary: data.summary });
        }
      } else {
        extractionErrors++;
        console.error(`Extraction promise rejected:`, result.reason);
      }
    });

    setExtractions(successfulExtractions);

    if (extractionErrors > 0) {
      showError(`Failed to extract ${extractionErrors} PDF(s). Synthesis will proceed with the successful ones.`);
    }
    
    if (successfulExtractions.length === 0) {
      showError("No PDF extractions were successful. Cannot proceed to synthesis.");
      setAnalysisPhase('error');
      return;
    }

    // Phase 2: Synthesis
    setAnalysisPhase('synthesizing');
    const combinedExtractions = successfulExtractions
      .map(e => `--- Analysis of: ${e.name} ---\n\n${e.summary}`)
      .join('\n\n---\n\n');
    
    const synthesisContent = [textContent, combinedExtractions].filter(Boolean).join('\n\n');

    try {
      const { data, error } = await supabase.functions.invoke('claude-proxy', {
        body: { content: synthesisContent, mode: 'synthesize' },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setSynthesisResult(data.summary);
    } catch (error: any) {
      showError(`Synthesis failed: ${error.message}`);
      setAnalysisPhase('error');
    } finally {
      setAnalysisPhase('complete');
    }
  };

  const getButtonText = () => {
    if (analysisPhase === 'extracting') {
      return `Extracting (${extractionProgress.completed}/${extractionProgress.total})...`;
    }
    if (analysisPhase === 'synthesizing') {
      return 'Synthesizing...';
    }
    return 'Generate Summary';
  };
  
  const isLoading = analysisPhase === 'extracting' || analysisPhase === 'synthesizing';

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Header />
      <main className="flex-1 container mx-auto p-4 md:p-8 space-y-8">
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="topic">Topic (optional)</Label>
              <Input id="topic" placeholder="e.g., Stem Cell Derived Islets" value={topic} onChange={(e) => setTopic(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-range">Date Range (optional)</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger id="date-range">
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2020-2024">2020-2024</SelectItem>
                  <SelectItem value="2014-2024">2014-2024</SelectItem>
                  <SelectItem value="2004-2024">2004-2024</SelectItem>
                  <SelectItem value="any">Any Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="abstracts">Paste links/abstracts and/or upload PDFs</Label>
            <Textarea
              id="abstracts"
              placeholder="Paste content here..."
              className="min-h-[200px] rounded-md"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isParsing || isLoading}
            />
             <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="application/pdf"
              className="hidden"
              multiple
            />
            <div className="pt-2">
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isParsing || isLoading || parsedPdfs.length >= MAX_FILES}>
                  {isParsing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                      <FileUp className="mr-2 h-4 w-4" />
                  )}
                  Attach PDF ({parsedPdfs.length}/{MAX_FILES})
              </Button>
            </div>
            {parsedPdfs.length > 0 && (
              <div className="space-y-2 pt-2">
                <Label>Attached PDFs</Label>
                <div className="space-y-1 rounded-md border p-2">
                  {parsedPdfs.map((pdf) => (
                    <div key={pdf.name} className="flex items-center justify-between text-sm bg-muted/50 p-2 rounded-md">
                      <span className="truncate max-w-xs font-medium">{pdf.name}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removePdf(pdf.name)} disabled={isParsing || isLoading}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <Label>Select Tone</Label>
              <RadioGroup defaultValue="academic" className="flex items-center gap-4" value={tone} onValueChange={setTone} disabled={parsedPdfs.length > 0 || isLoading}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="academic" id="r1" />
                  <Label htmlFor="r1">Academic</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="linkedin" id="r2" />
                  <Label htmlFor="r2">LinkedIn Casual</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="layman" id="r3" />
                  <Label htmlFor="r3">Layman</Label>
                </div>
              </RadioGroup>
            </div>
            <Button onClick={handleGenerate} disabled={isLoading || isParsing || (!content && parsedPdfs.length === 0)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-full px-8">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {getButtonText()}
            </Button>
          </div>
        </div>

        {(extractions.length > 0 || synthesisResult) && (
          <div className="space-y-8 pt-8 border-t max-w-4xl mx-auto">
            {extractions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl font-bold">Individual Paper Extractions</CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    {extractions.map((extraction, index) => (
                      <AccordionItem value={`item-${index}`} key={extraction.name}>
                        <AccordionTrigger>{extraction.name}</AccordionTrigger>
                        <AccordionContent>
                          <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">{extraction.summary}</div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            )}

            {synthesisResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl font-bold">
                    {parsedPdfs.length > 0 ? "Synthesized Analysis" : "Summary"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">{synthesisResult}</div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;