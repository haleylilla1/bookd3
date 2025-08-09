interface LegalFooterProps {
  className?: string;
}

export default function LegalFooter({ className = "" }: LegalFooterProps) {
  return (
    <div className={`flex justify-center items-center space-x-3 py-2 ${className}`}>
      <a 
        href="/privacy-policy" 
        target="_blank"
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        Privacy Policy
      </a>
      <span className="text-xs text-gray-300">•</span>
      <a 
        href="/terms-of-service" 
        target="_blank"
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        Terms of Service
      </a>
    </div>
  );
}