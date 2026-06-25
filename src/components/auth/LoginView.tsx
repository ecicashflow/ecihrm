'use client';

import { useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, LogIn, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginView() {
  const { setCurrentUser, setIsLoggedIn, setCurrentView, setSidebarOpen } = useAppStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }
    if (!password.trim()) {
      toast.error('Password is required');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim(), password }),
      });
      if (res.ok) {
        const user = await res.json();
        setCurrentUser(user);
        setIsLoggedIn(true);
        setCurrentView('dashboard');
        // Always show the sidebar on fresh login — prevents inheriting a
        // collapsed state from a previous user's session.
        setSidebarOpen(true);
        toast.success(`Welcome, ${user.name}!`);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Login failed');
      }
    } catch {
      toast.error('Unable to connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <img
            src="/eci-logo.jpg"
            alt="ECI Logo"
            className="w-20 h-20 mx-auto mb-4 object-contain"
          />
          <h1 className="text-2xl font-bold text-eci-blue">ECI HRM</h1>
          <p className="text-muted-foreground">Performance Appraisal System</p>
        </div>

        {/* Login Card */}
        <Card className="eci-card">
          <CardHeader>
            <CardTitle className="text-lg text-center">Sign In</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@eci.com.pk"
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <Button className="w-full eci-btn-primary" onClick={handleLogin} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogIn className="h-4 w-4 mr-2" />}
              Sign In
            </Button>
          </CardContent>
        </Card>

        {/* Security notice */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Secure internal system — ECI Pvt Ltd</span>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          &copy; {new Date().getFullYear()} ECI Pvt Ltd. All rights reserved.
        </p>
      </div>
    </div>
  );
}