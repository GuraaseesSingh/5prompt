import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, CircleAlert } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="grain flex min-h-[100dvh] w-full items-center justify-center bg-background px-5">
      <Card className="w-full max-w-md border-border bg-card">
        <CardContent className="pt-7">
          <div className="mb-4 flex items-center gap-3">
            <CircleAlert className="size-8 text-accent-foreground" />
            <h1 className="font-serif text-3xl tracking-[-.035em] text-foreground">This page wandered off.</h1>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">That practice room does not exist, but your next rep is waiting.</p>
          <Link href="/" data-testid="link-not-found-home" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-extrabold text-primary-foreground"><ArrowLeft size={15} /> Back to practice</Link>
        </CardContent>
      </Card>
    </div>
  );
}
