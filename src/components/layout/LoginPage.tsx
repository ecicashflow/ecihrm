'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Loader2, Mail, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import type { EmployeeDetail } from '@/lib/types';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const { setCurrentUser, setCurrentView, setIsLoggedIn } = useAppStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Login failed. Please try again.');
      }

      const user: EmployeeDetail = await res.json();

      setCurrentUser(user);
      setIsLoggedIn(true);
      setCurrentView('dashboard');

      toast.success(`Welcome, ${user.name}!`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle gradient background */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(135deg, #f8fafc 0%, #e8eef5 40%, #dce6f0 100%)',
        }}
      />
      {/* Decorative circles */}
      <div className="absolute top-0 left-0 w-96 h-96 rounded-full bg-eci-blue/5 -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-eci-blue/5 translate-x-1/3 translate-y-1/3" />

      <Card className="w-full max-w-md eci-card border-0 shadow-xl">
        <CardHeader className="flex flex-col items-center gap-4 pb-2 pt-8 px-6">
          {/* Logo */}
          <div className="relative h-20 w-20 rounded-xl overflow-hidden shadow-md bg-white">
            <Image
              src="/eci-logo.jpg"
              alt="ECI Logo"
              fill
              className="object-contain"
              priority
            />
          </div>

          {/* Title */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-eci-blue tracking-tight">
              ECI Pvt Ltd
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Performance Appraisal System
            </p>
          </div>

          {/* Decorative line */}
          <div className="w-16 h-1 rounded-full bg-eci-blue/20" />
        </CardHeader>

        <CardContent className="px-6 pb-8 pt-4">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@eci.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11"
                  autoComplete="email"
                  autoFocus
                  disabled={loading}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="eci-btn-primary w-full h-11 text-sm font-semibold rounded-md"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <Shield className="size-4" />
                  <span>Sign In</span>
                </>
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground mt-4">
              Enter your corporate email to access the system
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}