/**
 * User ID Mapping System
 * Maps Supabase UUIDs to old database integer IDs for data access
 */

interface UserMapping {
  supabaseId: string;
  databaseId: number;
  email: string;
}

// Static mapping based on successful migration
const USER_MAPPINGS: UserMapping[] = [
  { supabaseId: 'ab722bf0-7d67-4797-98ad-754782056231', databaseId: 14, email: 'haleylilla@gmail.com' },
  { supabaseId: 'e51387ac-1829-433d-9eeb-054f35830213', databaseId: 16, email: '54bmoore@gmail.com' },
  { supabaseId: '1dbf2048-6d6a-41d4-bf9c-2cbbe1a092ec', databaseId: 19, email: 'czolotova@gmail.com' },
  { supabaseId: 'cef90c46-bfd4-400d-99dd-1fc8eb18d4df', databaseId: 20, email: 'lilla@chapman.edu' },
  { supabaseId: 'e57c2998-411c-43e2-9d55-e37f2c88dfb0', databaseId: 21, email: 'jroesslersmith@gmail.com' },
  { supabaseId: 'db6ccccc-c4f7-4ecf-90d5-68b08f8df519', databaseId: 22, email: 'info@undertowsubmissions.com' },
  { supabaseId: '5d852c48-b5d9-48db-b70e-dbede5a0c08e', databaseId: 23, email: 'user2@bookd.tools' },
];

/**
 * Maps a Supabase UUID to the corresponding database integer ID
 */
export function supabaseIdToDatabaseId(supabaseId: string): number | null {
  const mapping = USER_MAPPINGS.find(m => m.supabaseId === supabaseId);
  return mapping ? mapping.databaseId : null;
}

/**
 * Maps a database integer ID to the corresponding Supabase UUID
 */
export function databaseIdToSupabaseId(databaseId: number): string | null {
  const mapping = USER_MAPPINGS.find(m => m.databaseId === databaseId);
  return mapping ? mapping.supabaseId : null;
}

/**
 * Gets user mapping by email
 */
export function getUserMappingByEmail(email: string): UserMapping | null {
  return USER_MAPPINGS.find(m => m.email === email) || null;
}

/**
 * Gets all user mappings (for debugging)
 */
export function getAllUserMappings(): UserMapping[] {
  return USER_MAPPINGS;
}

/**
 * Helper function to get database user ID from authenticated request
 * Works with both session-based and stateless authentication
 */
export function getDatabaseUserIdFromSession(req: any): number {
  // First check if middleware has already provided the current user
  if (req.currentUser && req.currentUser.id) {
    return req.currentUser.id;
  }
  
  // Fallback to session-based authentication
  if (req.session?.supabaseUserId) {
    const databaseId = supabaseIdToDatabaseId(req.session.supabaseUserId);
    if (!databaseId) {
      throw new Error(`No database mapping found for Supabase ID: ${req.session.supabaseUserId}`);
    }
    return databaseId;
  }
  
  throw new Error('No authenticated user found');
}
export function getDatabaseUserIdFromSupabase(supabaseUserId: string): number | null {
  const databaseId = supabaseIdToDatabaseId(supabaseUserId);
  
  if (!databaseId) {
    console.error(`🚨 No database mapping found for Supabase ID: ${supabaseUserId}`);
    return null;
  }
  
  console.log(`🔗 Mapped Supabase ID ${supabaseUserId} → Database ID ${databaseId}`);
  return databaseId;
}