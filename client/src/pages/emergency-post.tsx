import { useAuth } from '@/lib/replit-auth';
import { useLocation } from 'wouter';
import { useEffect } from 'react';
import EmergencyPostForm from '@/components/emergency-post-form';

export default function EmergencyPostPage() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation('/');
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main>
        <EmergencyPostForm />
      </main>
    </div>
  );
}