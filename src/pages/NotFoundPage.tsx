import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

export default function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      title="Page not found"
      detail="That route doesn't exist in Localify."
      actions={
        <Link to="/" className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-contrast hover:brightness-110">
          Back home
        </Link>
      }
    />
  );
}
