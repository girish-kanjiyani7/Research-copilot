import { HomeHeader } from "@/components/HomeHeader";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/contexts/SessionProvider";
import { useEffect } from "react";

const Home = () => {
  const navigate = useNavigate();
  const { session, loading } = useSession();

  useEffect(() => {
    if (!loading && session) {
      navigate('/analysis');
    }
  }, [session, loading, navigate]);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <HomeHeader />
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            Your Intelligent Research Assistant
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
            The AI-powered workspace for researching and writing, helping you easily manage references, conduct literature reviews, annotate files, take notes, and write papers.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-md px-8" onClick={() => navigate('/login')}>
              Start for free
            </Button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">No card details required</p>
        </div>
        <div className="mt-16 w-full max-w-6xl">
          <div className="relative rounded-xl shadow-2xl bg-muted/20 border p-2">
            <div className="aspect-[16/9] w-full bg-muted rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground text-2xl font-semibold">Application Preview</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;