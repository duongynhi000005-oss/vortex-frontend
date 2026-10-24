import fs from "fs";
import path from "path";
import { Suspense } from "react";
import ContributorsPageClient from "./ContributorsPageClient";
import { parseIssuesMarkdown } from "@/lib/issuesParser";

export const metadata = {
  title: "Contributors | Vortex Protocol",
  description: "GitHub contributors and Wave program contribution metrics for Vortex Protocol.",
};

export default function ContributorsPage() {
  let markdownContent = "";
  try {
    const issuesFilePath = path.join(process.cwd(), "issues.md");
    if (fs.existsSync(issuesFilePath)) {
      markdownContent = fs.readFileSync(issuesFilePath, "utf8");
    }
  } catch {
    // Fallback if filesystem read fails
  }

  const metrics = parseIssuesMarkdown(markdownContent);

  return (
    <Suspense fallback={null}>
      <ContributorsPageClient metrics={metrics} />
    </Suspense>
  );
}
