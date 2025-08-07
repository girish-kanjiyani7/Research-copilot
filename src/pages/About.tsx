import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const About = () => {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Header />
      <main className="flex-1 container mx-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl font-bold">About ResearchCopilot</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <p>
                Welcome to ResearchCopilot, your AI-powered assistant for accelerating scientific discovery. In a world overflowing with information, finding the signal in the noise is the biggest challenge for researchers, students, and innovators. Our mission is to help you cut through the clutter and get to the core of scientific literature, fast.
              </p>
              <h3>What We Do</h3>
              <p>
                ResearchCopilot uses state-of-the-art AI to read, analyze, and synthesize complex research papers, technical documents, and notes. You can paste text directly, upload multiple PDFs, and our tool will:
              </p>
              <ul>
                <li>
                  <strong>Extract Key Information:</strong> It meticulously pulls out crucial details like research questions, methodologies, key findings, and conclusions from each source, complete with page citations.
                </li>
                <li>
                  <strong>Synthesize Across Documents:</strong> When you provide multiple papers, it doesn't just summarize them individually. It creates a unified analysis, highlighting shared findings, contrasting methodologies, and consolidating future research directions.
                </li>
                <li>
                  <strong>Adapt to Your Voice:</strong> With our "Personalized" tone feature, you can provide a sample of your own writing. The AI will then adopt your unique style, making its output ready to be integrated directly into your drafts, literature reviews, or reports.
                </li>
              </ul>
              <h3>Who Is It For?</h3>
              <p>
                Whether you are a PhD student working on a literature review, a scientist staying up-to-date with the latest findings, a journalist writing a science-based article, or simply a curious mind, ResearchCopilot is designed to be your trusted partner.
              </p>
              <p>
                Log in or create an account to start your first analysis!
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default About;