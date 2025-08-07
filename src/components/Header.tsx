import { FlaskConical, LogOut } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { useSession } from "@/contexts/SessionProvider";
import { Button } from "./ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";

export const Header = () => {
  const { session, loading } = useSession();
  const navigate = useNavigate();

  const handleLogoClick = () => {
    if (session) {
      navigate('/analysis');
    } else {
      navigate('/');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <header className="py-4 px-6 border-b">
      <div className="container mx-auto flex items-center justify-between">
        <div 
          className="flex items-center gap-2 cursor-pointer"
          onClick={handleLogoClick}
        >
          <FlaskConical className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">ResearchCopilot</h1>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link to="/about" className="text-muted-foreground hover:text-foreground">About</Link>
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