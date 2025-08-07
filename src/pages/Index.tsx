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
import { FileUp, X, Loader2, Sparkles } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';

const MAX_FILES = 10;
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

type AnalysisPhase = 'idle' | 'processing' | 'complete' | 'error';
type ParsedPdf = {
  name: string;
  pages: { page: number; content: string }[];
};

const Index = () => {
  const [topic, setTopic] = useState("Stem Cell Derived Islets");
  const [dateRange, setDateRange] = useState("2014-2024");
  const [content, setContent] = useState("");
  const [blogContent, setBlogContent] = useState("");
  const [emailContent, setEmailContent] = useState("");
  const [parsedPdfs, setParsedPdfs] = useState<ParsedPdf[]>([]);
  const [tone, setTone] = useState("academic");
  const [writingSample, setWritingSample] = useState("");
  
  const [extractions, setExtractions] = useState<{ name: string; summary: string }[]>([]);
  const [synthesisResult, setSynthesisResult] = useState<string | null>(null);
  const [resultTitle, setResultTitle] = useState("Summary");
  const [analysisPhase, setAnalysisPhase] = useState<AnalysisPhase>('idle');

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
    
    const newlyParsedPdfs: ParsedPdf[] = [];
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
        const pages: { page: number; content: string }[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => (item as any).str).join(' ');
          pages.push({ page: i, content: pageText });
        }
        newlyParsedPdfs.push({ name: file.name, pages });
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
    setAnalysisPhase('processing');

    const combinedText = [
      content.trim() ? `## General Text\n${content.trim()}` : '',
      blogContent.trim() ? `## Blog Post\n${blogContent.trim()}` : '',
      emailContent.trim() ? `## Email\n${emailContent.trim()}` : ''
    ].filter(Boolean).join('\n\n---\n\n');

    let allSources = [...parsedPdfs];
    if (combinedText) {
      allSources.push({
        name: 'Pasted Content',
        pages: [{ page: 1, content: combinedText }]
      });
    }

    if (allSources.length === 0) {
      showError("There is no content to analyze.");
      setAnalysisPhase('idle');
      return;
    }

    if (allSources.length > 1 || (allSources.length === 1 && allSources[0].name !== 'Pasted Content')) {
      setResultTitle("Synthesized Analysis");
    } else {
      setResultTitle("Summary");
    }

    try {
      const writingSampleContent = writingSample.trim();
      const { data, error } = await supabase.functions.invoke('claude-proxy', {
        body: { 
          pdfs: allSources, 
          mode: 'extract_and_synthesize',
          writingSample: writingSampleContent
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      setExtractions(data.extractions || []);
      setSynthesisResult(data.synthesisResult || null);
      showSuccess("Analysis complete!");
      setAnalysisPhase('complete');
    } catch (error: any) {
      console.error("An error occurred during analysis:", error);
      showError(`Analysis failed: ${error.message}`);
      setAnalysisPhase('error');
    }
  };

  const getButtonText = () => {
    if (analysisPhase === 'processing') {
      return 'Processing...';
    }
    return 'Generate Summary';
  };
  
  const isLoading = analysisPhase === 'processing' || isParsing;
  const canGenerate = !isLoading && (!!content || !!blogContent || !!emailContent || parsedPdfs.length > 0);

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

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Paste Content (Optional)</Label>
              <Accordion type="multiple" className="w-full border rounded-md">
                <AccordionItem value="item-1" className="border-b">
                  <AccordionTrigger className="px-4 font-medium hover:no-underline">General Text / Abstracts</AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <Textarea
                      placeholder="Paste general text, notes, or abstracts here..."
                      className="min-h-[150px]"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      disabled={isLoading}
                    />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2" className="border-b">
                  <AccordionTrigger className="px-4 font-medium hover:no-underline">Blog Post / Article</AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <Textarea
                      placeholder="Paste the full text of a blog post or article here..."
                      className="min-h-[150px]"
                      value={blogContent}
                      onChange={(e) => setBlogContent(e.target.value)}
                      disabled={isLoading}
                    />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3" className="border-b-0">
                  <AccordionTrigger className="px-4 font-medium hover:no-underline">Email</AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <Textarea
                      placeholder="Paste the text of an email here..."
                      className="min-h-[150px]"
                      value={emailContent}
                      onChange={(e) => setEmailContent(e.target.value)}
                      disabled={isLoading}
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            <div className="space-y-2">
              <Label>Upload PDFs (Optional)</Label>
              <div>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isLoading || parsedPdfs.length >= MAX_FILES}>
                    {isParsing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <FileUp className="mr-2 h-4 w-4" />
                    )}
                    Attach PDF ({parsedPdfs.length}/{MAX_FILES})
                </Button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="application/pdf"
                  className="hidden"
                  multiple
                />
              </div>
            </div>

            {parsedPdfs.length > 0 && (
              <div className="space-y-2 pt-2">
                <Label>Attached PDFs</Label>
                <div className="space-y-1 rounded-md border p-2">
                  {parsedPdfs.map((pdf) => (
                    <div key={pdf.name} className="flex items-center justify-between text-sm bg-muted/50 p-2 rounded-md">
                      <span className="truncate max-w-xs font-medium">{pdf.name}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removePdf(pdf.name)} disabled={isLoading}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col md:flex-row items-start justify-between gap-6">
            <div className="space-y-4 w-full">
              <div className="space-y-2">
                <Label>Select Tone</Label>
                <RadioGroup defaultValue="academic" className="flex flex-wrap items-center gap-4" value={tone} onValueChange={setTone} disabled={isLoading}>
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
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="personalized" id="r4" />
                    <Label htmlFor="r4" className="flex items-center">
                      <Sparkles className="mr-2 h-4 w-4 text-yellow-400" />
                      Personalized
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {tone === 'personalized' && (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="writing-sample">Your Writing Style</Label>
                  <Textarea
                    id="writing-sample"
                    placeholder="Paste a sample of your writing here (e.g., an email, a report, a blog post). The AI will learn your style and apply it to the summary."
                    className="min-h-[150px]"
                    value={writingSample}
                    onChange={(e) => setWritingSample(e.target.value)}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Provide at least a few paragraphs for best results.
                  </p>
                </div>
              )}
            </div>
            <div className="pt-5">
              <Button onClick={handleGenerate} disabled={!canGenerate} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-full px-8 w-full md:w-auto">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {getButtonText()}
              </Button>
            </div>
          </div>
        </div>

        {(extractions.length > 0 || synthesisResult) && (
          <div className="space-y-8 pt-8 border-t max-w-4xl mx-auto">
            {extractions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl font-bold">Individual Source Extractions</CardTitle>
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
                  <CardTitle className="text-2xl font-bold">{resultTitle}</CardTitle>
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