import { FlaskConical } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

export const Header = () => {
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
        </div>
      </div>
    </header>
  );
};