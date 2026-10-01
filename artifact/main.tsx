// Standalone test build: the same page the Next app renders, mounted client-side.
import { createRoot } from "react-dom/client";
import Home from "@/app/page";

createRoot(document.getElementById("root")!).render(<Home />);
