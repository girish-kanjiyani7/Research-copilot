import { useState, useRef } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FileUp, X } from "lucide-react";
import { showError } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";

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

const MAX_FILE_SIZE_MB = 2;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const Index = () => {
  const [topic, setTopic] = useState("Stem Cell Derived Islets");
  const [dateRange, setDateRange] = useState("2014-2024");
  const [content, setContent] = useState("");
  const [tone, setTone] = useState("academic");
  const [results, setResults] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        showError("Please select a PDF file.");
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        showError(`File is too large. Please select a file smaller than ${MAX_FILE_SIZE_MB}MB.`);
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }

      setSelectedFile(file);
      setContent(""); // Clear textarea when a file is selected
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setResults(null);

    try {
      let bodyPayload = {};

      if (selectedFile) {
        const fileData = await fileToBase64(selectedFile);
        bodyPayload = {
          fileData,
          prompt: PDF_ANALYSIS_PROMPT,
        };
      } else if (content) {
        bodyPayload = {
          content,
          tone,
        };
      } else {
        showError("Please provide content or a file.");
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('claude-proxy', {
        body: bodyPayload,
      });

      if (error) throw error;
      
      // The edge function now returns a JSON with an `error` key on failure
      if (data.error) throw new Error(data.error);

      setResults(data.summary);

    } catch (error: any) {
      console.error("API call failed:", error);
      // The detailed error from the function is often in `error.context.error` for network errors,
      // or in `error.message` if we throw it from the `data.error` check above.
      const errorMessage = error?.context?.error?.message || error.message || "An unknown error occurred.";
      showError(`Analysis failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

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
            <Label htmlFor="abstracts">Paste links/abstracts or upload a PDF</Label>
            <Textarea
              id="abstracts"
              placeholder="Paste the content you want to summarize here..."
              className="min-h-[200px] rounded-md"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (selectedFile) clearFile();
              }}
              disabled={!!selectedFile}
            />
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="application/pdf"
              className="hidden"
            />
            <div className="flex items-center justify-between pt-2">
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <FileUp className="mr-2 h-4 w-4" />
                    Attach PDF
                </Button>
                {selectedFile && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="truncate max-w-xs">{selectedFile.name}</span>
                        <Button variant="ghost" size="icon" onClick={clearFile}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <Label>Select Tone</Label>
              <RadioGroup defaultValue="academic" className="flex items-center gap-4" value={tone} onValueChange={setTone}>
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
            <Button onClick={handleGenerate} disabled={isLoading || (!content && !selectedFile)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-full px-8">
              {isLoading ? "Generating..." : "Generate Summary"}
            </Button>
          </div>
        </div>

        {results && (
          <div className="space-y-8 pt-8 border-t max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl font-bold">Analysis Results</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">{results}</p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;