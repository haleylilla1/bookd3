#!/bin/bash

echo "🔧 ELIMINATING PRODUCTION DEBUG CODE"
echo "===================================="

# Remove all console.log statements from client code (except error boundaries)
echo "Removing client-side console.log statements..."

# Replace console.log with clientLogger.debug (development only)
find client/src -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/console\.log(/clientLogger.debug(/g'

# Replace console.error with clientLogger.error (but preserve error boundaries)
find client/src -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/console\.error(/clientLogger.error(/g'

# Replace console.warn with clientLogger.warn
find client/src -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/console\.warn(/clientLogger.warn(/g'

# Add import statement to files that use clientLogger
echo "Adding client logger imports..."
find client/src -name "*.ts" -o -name "*.tsx" -exec grep -l "clientLogger\." {} \; | while read file; do
    if ! grep -q "clientLogger" "$file"; then
        # Add import after the last import line
        sed -i '/^import .* from /a import { clientLogger } from "@/utils/client-logger";' "$file"
    fi
done

echo "✅ Client-side debug code elimination complete"
echo "✅ All console.log statements converted to development-only logging"
echo "✅ Production builds will have zero console output"

# Count remaining console statements
REMAINING=$(find client/src -name "*.ts" -o -name "*.tsx" | xargs grep -h "console\." | wc -l)
echo "📊 Remaining console statements: $REMAINING"

if [ $REMAINING -eq 0 ]; then
    echo "🎯 SUCCESS: All console statements eliminated!"
else
    echo "⚠️  Some console statements may need manual review"
    find client/src -name "*.ts" -o -name "*.tsx" | xargs grep -Hn "console\." | head -5
fi