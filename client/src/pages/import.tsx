import { useLocation } from "wouter";
import BulkGigImport from "@/components/bulk-gig-import";

export default function Import() {
  const [, setLocation] = useLocation();
  
  return <BulkGigImport onClose={() => setLocation('/')} />;
}