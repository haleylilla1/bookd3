import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Upload, Sparkles, FileText } from "lucide-react";
import type { Gig } from "@shared/schema";

export default function ResumeBuilder() {
  const [selectedGigs, setSelectedGigs] = useState<Set<number>>(new Set());

  const { data: user } = useQuery({
    queryKey: ["/api/user"],
  });

  const { data: gigs = [] } = useQuery<Gig[]>({
    queryKey: ["/api/gigs"],
  });

  const completedGigs = gigs.filter(gig => gig.status === "completed" && gig.includeInResume);

  // Group gigs by type for resume sections
  const groupedGigs = completedGigs.reduce((acc, gig) => {
    const type = gig.gigType || "other";
    if (!acc[type]) acc[type] = [];
    acc[type].push(gig);
    return acc;
  }, {} as Record<string, Gig[]>);

  const gigTypeLabels: Record<string, string> = {
    "brand-ambassador": "Brand Ambassador",
    "bartender": "Event Bartender",
    "server": "Catering Server",
    "promo": "Promotional Representative",
    "event-staff": "Event Staff",
    "other": "Freelance Professional"
  };

  const toggleGigSelection = (gigId: number) => {
    const newSelected = new Set(selectedGigs);
    if (newSelected.has(gigId)) {
      newSelected.delete(gigId);
    } else {
      newSelected.add(gigId);
    }
    setSelectedGigs(newSelected);
  };

  const generatePDF = () => {
    // This would integrate with a PDF generation library
    alert("PDF export functionality would be implemented here");
  };

  const getClientList = (gigs: Gig[]) => {
    const clients = Array.from(new Set(gigs.map(gig => gig.clientName)));
    return clients.slice(0, 3).join(", ") + (clients.length > 3 ? `, and ${clients.length - 3} others` : "");
  };

  const getExperienceBullets = (gigs: Gig[]) => {
    const duties = gigs
      .map(gig => gig.duties)
      .filter(Boolean)
      .join(". ")
      .split(".")
      .filter(duty => duty.trim().length > 10)
      .slice(0, 3);
    
    return duties.length > 0 ? duties : [
      "Provided exceptional customer service at high-volume events",
      "Collaborated with event teams for seamless operations",
      "Maintained professional appearance and brand standards"
    ];
  };

  const getDateRange = (gigs: Gig[]) => {
    if (gigs.length === 0) return "Present";
    const dates = gigs.map(gig => new Date(gig.date)).sort((a, b) => a.getTime() - b.getTime());
    const start = dates[0];
    const end = dates[dates.length - 1];
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();
    
    if (startYear === endYear) {
      return `${startYear} - Present`;
    }
    return `${startYear} - Present`;
  };

  // Generate key skills from gig types and duties
  const getSkills = () => {
    const skills = new Set<string>();
    completedGigs.forEach(gig => {
      switch (gig.gigType) {
        case "brand-ambassador":
          skills.add("Customer Engagement");
          skills.add("Brand Representation");
          break;
        case "bartender":
          skills.add("Beverage Service");
          skills.add("POS Systems");
          break;
        case "server":
          skills.add("Fine Dining Service");
          skills.add("Team Collaboration");
          break;
        case "event-staff":
          skills.add("Event Management");
          skills.add("Crowd Control");
          break;
      }
    });
    skills.add("Professional Communication");
    skills.add("Time Management");
    return Array.from(skills);
  };

  if (!completedGigs.length) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Completed Gigs Yet</h3>
            <p className="text-gray-600 mb-4">
              Complete some gigs to start building your professional resume
            </p>
            <Button>Add Your First Gig</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Header with Export */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Resume Builder</h2>
        <Button onClick={generatePDF} className="flex items-center space-x-2">
          <Download className="w-4 h-4" />
          <span>Export PDF</span>
        </Button>
      </div>

      {/* Resume Preview */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Header Section */}
            <div className="text-center border-b border-gray-200 pb-4">
              <h3 className="text-xl font-bold text-gray-900">{user?.name || "Your Name"}</h3>
              <p className="text-gray-600">{user?.title || "Professional Gig Worker"}</p>
              <div className="flex items-center justify-center space-x-4 text-sm text-gray-500 mt-2">
                <span>{user?.phone || "(555) 123-4567"}</span>
                <span>•</span>
                <span>{user?.email || "your.email@example.com"}</span>
              </div>
            </div>

            {/* Experience Section */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Professional Experience</h4>
              <div className="space-y-4">
                {Object.entries(groupedGigs).map(([gigType, gigs]) => (
                  <div key={gigType} className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <Checkbox
                          checked={gigs.some(gig => selectedGigs.has(gig.id))}
                          onCheckedChange={(checked) => {
                            gigs.forEach(gig => {
                              if (checked) {
                                setSelectedGigs(prev => new Set([...prev, gig.id]));
                              } else {
                                setSelectedGigs(prev => {
                                  const newSet = new Set(prev);
                                  newSet.delete(gig.id);
                                  return newSet;
                                });
                              }
                            });
                          }}
                        />
                        <h5 className="font-medium text-gray-900">
                          {gigTypeLabels[gigType] || gigType}
                        </h5>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{getClientList(gigs)}</p>
                      <ul className="text-sm text-gray-600 space-y-1 ml-6">
                        {getExperienceBullets(gigs).map((bullet, index) => (
                          <li key={index}>• {bullet}</li>
                        ))}
                      </ul>
                    </div>
                    <span className="text-sm text-gray-500 ml-4">{getDateRange(gigs)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Skills Section */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Key Skills</h4>
              <div className="flex flex-wrap gap-2">
                {getSkills().map((skill) => (
                  <Badge key={skill} variant="secondary" className="bg-primary/10 text-primary">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Suggestions */}
      <Card className="bg-gradient-to-r from-secondary/10 to-primary/10 border-secondary/20 mb-6">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">AI Suggestions</h3>
              <div className="space-y-2">
                <p className="text-sm text-gray-700">
                  💡 Consider highlighting your versatility: "Multi-skilled professional with experience across brand activation, hospitality, and event management"
                </p>
                <p className="text-sm text-gray-700">
                  📊 Add metrics: "Engaged with 200+ customers daily" or "Managed events for 500+ attendees"
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Existing Resume */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Enhance Existing Resume</h3>
          <p className="text-sm text-gray-600 mb-4">
            Upload your current resume to automatically merge your gig experience
          </p>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900">Drop your resume here</p>
            <p className="text-xs text-gray-500 mt-1">PDF, DOC, or DOCX files up to 10MB</p>
            <Button variant="outline" className="mt-3">
              Choose File
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
