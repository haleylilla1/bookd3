#!/usr/bin/env python3

import re
import sys

def remove_weekly_cases(content):
    # Remove weekly case statements from switch blocks
    pattern = r'case "weekly":\s*const \{ startOfWeek, endOfWeek \} = getWeekDates\(currentDate\);\s*return gigDate >= startOfWeek && gigDate <= endOfWeek;\s*'
    content = re.sub(pattern, '', content, flags=re.MULTILINE)
    
    # Remove weekly if statements
    pattern = r'if \(selectedPeriod === "weekly"\) \{[^}]+\} else '
    content = re.sub(pattern, '', content, flags=re.MULTILINE)
    
    # Remove weekly comparisons
    content = re.sub(r'selectedPeriod === "weekly"', 'false', content)
    
    # Remove references to "weekly" in text
    content = re.sub(r'"weekly"', '""', content)
    
    # Clean up empty case statements
    content = re.sub(r'case "":\s*', '', content)
    
    return content

if __name__ == "__main__":
    with open('client/src/components/dashboard.tsx', 'r') as f:
        content = f.read()
    
    content = remove_weekly_cases(content)
    
    with open('client/src/components/dashboard.tsx', 'w') as f:
        f.write(content)
    
    print("Removed weekly references")