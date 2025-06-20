import BulkGigImport from "@/components/bulk-gig-import";

export default function Import() {
  return <BulkGigImport onClose={() => window.history.back()} />;
}