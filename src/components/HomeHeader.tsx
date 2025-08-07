import { FlaskConical } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "./ui/button";
import { Link, useNavigate } from "react-router-dom";

export const HomeHeader = () => {
  const navigate = useNavigate();

  return (
    <header className="py-4 px-6 border-b">
      <div className="container mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 cursor-pointer">
          <FlaskConical className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">ResearchCopilot</h1>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link to="/about" className="text-muted-foreground hover:text-foreground">About</Link>
        </nav>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Button variant="ghost" onClick={() => navigate('/login')}>Login</Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => navigate('/login')}>Get Started</Button>
        </div>
      </div>
    </header>
  );
};