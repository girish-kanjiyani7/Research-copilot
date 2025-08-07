import { FlaskConical, LogOut } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { useSession } from "@/contexts/SessionProvider";
import { Button } from "./ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export const Header = () => {
  const { session, loading } = useSession();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <header className="py-4 px-6 border-b">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">ResearchCopilot</h1>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <a href="#" className="text-muted-foreground hover:text-foreground">About</a>
          <a href="#" className="text-muted-foreground hover:text-foreground">Privacy</a>
          <a href="#" className="text-muted-foreground hover:text-foreground">GitHub</a>
        </nav>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          {!loading && (
            <>
              {session ? (
                <Button variant="outline" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              ) : (
                <Button onClick={() => navigate('/login')}>Login</Button>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
};