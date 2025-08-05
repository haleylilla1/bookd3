/**
 * ADDRESS AUTOCOMPLETE COMPONENT
 * Google Places autocomplete for accurate address input preventing mileage calculation failures
 */

import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { MapPin, Loader2 } from 'lucide-react';

interface AddressSuggestion {
  description: string;
  placeId: string;
  mainText: string;
  secondaryText: string;
}

interface AddressAutocompleteProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function AddressAutocomplete({ 
  label, 
  placeholder, 
  value, 
  onChange, 
  className 
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);

  // Update internal state when prop value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Fetch address suggestions with debouncing
  const fetchSuggestions = async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch(`/api/address-autocomplete?input=${encodeURIComponent(query)}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        const newSuggestions = data.suggestions || [];
        setSuggestions(newSuggestions);
        
        const shouldShow = newSuggestions && newSuggestions.length > 0;
        setShowSuggestions(shouldShow);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle input changes with debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);

    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout for API call - reduced to 100ms for faster response
    debounceTimeoutRef.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 100);
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: AddressSuggestion) => {
    setInputValue(suggestion.description);
    onChange(suggestion.description);
    setShowSuggestions(false);
    setSuggestions([]);
    
    // Focus back to input
    inputRef.current?.focus();
  };

  // Handle input blur
  const handleBlur = () => {
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  };

  // Handle input focus
  const handleFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={cn("relative", className)}>
      <Label className="text-sm font-medium mb-2 block">{label}</Label>
      
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          className="pr-8"
        />
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          </div>
        )}
        
        {/* Map pin icon when not loading */}
        {!isLoading && (
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
            <MapPin className="h-4 w-4 text-gray-400" />
          </div>
        )}
      </div>



      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-[9999] w-full mt-1 bg-white dark:bg-gray-800 border-2 border-blue-500 dark:border-blue-400 rounded-md shadow-xl max-h-60 overflow-y-auto"
             style={{ 
               position: 'absolute',
               top: '100%',
               left: 0,
               right: 0,
               zIndex: 99999,
               backgroundColor: 'white',
               border: '2px solid #3b82f6',
               boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
             }}>
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.placeId}
              type="button"
              className="w-full px-3 py-2 text-left hover:bg-blue-50 hover:text-blue-900 border-b border-gray-100 last:border-b-0 focus:outline-none focus:bg-blue-50 transition-colors"
              onClick={() => handleSuggestionSelect(suggestion)}
              onMouseDown={(e) => e.preventDefault()} // Prevent blur from hiding dropdown
            >
              <div className="flex items-start">
                <MapPin className="h-4 w-4 text-gray-400 mt-1 mr-2 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {suggestion.mainText}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {suggestion.secondaryText}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Debug indicator */}
      {inputValue.length >= 2 && (
        <div className="absolute top-0 right-0 bg-green-500 text-white text-xs px-1 rounded"
             style={{ fontSize: '10px', zIndex: 100000 }}>
          {suggestions.length}
        </div>
      )}

      {/* No suggestions message */}
      {showSuggestions && suggestions.length === 0 && inputValue.length >= 2 && !isLoading && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-3">
          <div className="text-sm text-gray-500 text-center">
            No address suggestions found
          </div>
        </div>
      )}
    </div>
  );
}