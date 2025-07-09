import { useState, useRef } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ExternalLink, FileUp, X } from "lucide-react";
import { showError } from "@/utils/toast";

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

const mockResults = {
  summary: "Recent research on stem cell-derived islets has shown significant promise in treating type 1 diabetes. Studies focus on improving the functionality and survival of transplanted islets, with new protocols enhancing glucose-responsive insulin secretion. Key challenges remain in scalability and preventing immune rejection.",
  papers: [
    {
      id: "paper1",
      title: "Generation of functional human pancreatic β cells in vitro",
      authors: "Pagliuca, F.W., Millman, J.R., et al.",
      year: "2014",
      doi: "10.1016/j.cell.2014.09.040",
      findings: [
        "Developed a scalable protocol to differentiate human pluripotent stem cells (hPSCs) into functional pancreatic β cells.",
        "These stem-cell-derived β cells (SC-β cells) secrete insulin in response to glucose and can reverse diabetes in mice.",
        "The protocol mimics normal pancreatic development, providing a potential cell-replacement therapy for type 1 diabetes."
      ]
    },
    {
      id: "paper2",
      title: "Stem-cell-derived β-cells in a macroencapsulation device protect mice from diabetes",
      authors: "Vegas, A.J., O'Doherty, E., et al.",
      year: "2016",
      doi: "10.1038/nmed.3640",
      findings: [
        "Engineered an alginate derivative (TMTD-alginate) for macroencapsulation that reduces foreign body response.",
        "Encapsulated human SC-β cells successfully controlled glucose levels in immunocompetent diabetic mice for up to 6 months.",
        "This approach combines advanced cell therapy with a biocompatible device to avoid immune rejection."
      ]
    }
  ]
};

const Index = () => {
  const [topic, setTopic] = useState("Stem Cell Derived Islets");
  const [dateRange, setDateRange] = useState("2014-2024");
  const [content, setContent] = useState("");
  const [tone, setTone] = useState("academic");
  const [results, setResults] = useState<typeof mockResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === "application/pdf") {
        setSelectedFile(file);
        setContent(""); // Clear textarea when a file is selected
      } else {
        showError("Please select a PDF file.");
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setResults(null);

    try {
      if (selectedFile) {
        console.log("Processing file:", selectedFile.name);
        console.log("Using PDF Analysis Prompt:", PDF_ANALYSIS_PROMPT);
        // In a real application, you would use FormData to upload the file
        // and send the prompt to your backend for processing.
        // const formData = new FormData();
        // formData.append("file", selectedFile);
        // formData.append("prompt", PDF_ANALYSIS_PROMPT);
        // const response = await fetch("/api/summarize-pdf", {
        //   method: "POST",
        //   body: formData,
        // });
      } else if (content) {
        console.log("Processing text content.");
        // This is where you would make the actual API call for text.
        /*
        const response = await fetch("/api/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, dateRange, content, tone }),
        });
        if (!response.ok) throw new Error("Failed to get a response from the AI.");
        const data = await response.json();
        */
      }

      await new Promise(resolve => setTimeout(resolve, 1500));
      const data = mockResults;
      setResults(data);

    } catch (error) {
      console.error("API call failed:", error);
      showError("There was an error generating the summary. Please try again.");
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
                <CardTitle className="text-2xl font-bold">Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{results.summary}</p>
              </CardContent>
            </Card>

            <div className="space-y-4">
                <h2 className="text-2xl font-bold">Referenced Papers</h2>
                <Accordion type="single" collapsible className="w-full">
                  {results.papers.map((paper) => (
                    <AccordionItem value={paper.id} key={paper.id}>
                      <AccordionTrigger>
                        <div className="flex justify-between items-center w-full pr-4">
                            <span className="font-bold text-left flex-1">{paper.title}</span>
                            <span className="text-muted-foreground text-sm whitespace-nowrap pl-4">{paper.authors}, {paper.year}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 p-2">
                            <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-500 hover:underline">
                                View on DOI <ExternalLink className="h-4 w-4" />
                            </a>
                            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                                {paper.findings.map((finding, index) => (
                                    <li key={index}>{finding}</li>
                                ))}
                            </ul>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;