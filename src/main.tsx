import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import { ThemeProvider } from "./components/ThemeProvider";
import { SessionProvider } from "./contexts/SessionProvider.tsx";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider
    attribute="class"
    defaultTheme="dark"
    storageKey="vite-ui-theme"
  >
    <SessionProvider>
      <App />
    </SessionProvider>
  </ThemeProvider>
);