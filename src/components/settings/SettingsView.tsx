'use client';

import { useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { User, Lock, Mail, Phone, Briefcase, Building2, Shield, Loader2, Save, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  hr: 'HR',
  supervisor: 'Supervisor',
  management: 'Management',
  employee: 'Employee',
};

export default function SettingsView() {
  const { currentUser, setCurrentUser } = useAppStore();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Profile form
  const [profile, setProfile] = useState({
    name: currentUser?.name || '',
    email: currentUser?.email || '',
    phone: currentUser?.phone || '',
  });

  // Password form
  const [passwords, setPasswords] = useState({
    current: '',
    newPassword: '',
    confirmPassword: '',
  });

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Please log in to access settings.</p>
      </div>
    );
  }

  const handleSaveProfile = async () => {
    if (!profile.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())) {
      toast.error('Invalid email format');
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch(`/api/users/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profile.name.trim(),
          email: profile.email.trim(),
          phone: profile.phone.trim(),
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentUser({ ...currentUser, ...updated });
        toast.success('Profile updated successfully');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update profile');
      }
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwords.current || !passwords.newPassword || !passwords.confirmPassword) {
      toast.error('All password fields are required');
      return;
    }
    if (passwords.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setSavingPassword(true);
    try {
      // Verify current password by attempting login
      const loginRes = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email, password: passwords.current }),
      });
      if (!loginRes.ok) {
        toast.error('Current password is incorrect');
        setSavingPassword(false);
        return;
      }

      // Update password
      const res = await fetch(`/api/users/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwords.newPassword }),
      });
      if (res.ok) {
        toast.success('Password changed successfully');
        setPasswords({ current: '', newPassword: '', confirmPassword: '' });
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to change password');
      }
    } catch {
      toast.error('Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your profile, password, and account preferences.
        </p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="password">
            <Lock className="h-4 w-4 mr-2" />
            Password
          </TabsTrigger>
          <TabsTrigger value="account">
            <Shield className="h-4 w-4 mr-2" />
            Account Info
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="mt-4">
          <Card className="eci-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="w-1.5 h-5 rounded-full bg-blue-500" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="settings-name">Full Name *</Label>
                  <Input
                    id="settings-name"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    placeholder="Your full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settings-email">Email *</Label>
                  <Input
                    id="settings-email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    placeholder="email@eci.com.pk"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settings-phone">Phone</Label>
                  <Input
                    id="settings-phone"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="+92-XXX-XXXXXXX"
                  />
                </div>
              </div>
              <Separator />
              <div className="flex justify-end">
                <Button className="eci-btn-primary" onClick={handleSaveProfile} disabled={savingProfile}>
                  {savingProfile ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Password Tab */}
        <TabsContent value="password" className="mt-4">
          <Card className="eci-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="w-1.5 h-5 rounded-full bg-red-500" />
                Change Password
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password *</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={passwords.current}
                  onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  placeholder="Enter your current password"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password *</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={passwords.newPassword}
                    onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                    placeholder="At least 6 characters"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password *</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={passwords.confirmPassword}
                    onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                    placeholder="Re-enter new password"
                  />
                </div>
              </div>
              {passwords.newPassword && passwords.confirmPassword && passwords.newPassword === passwords.confirmPassword && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Passwords match
                </div>
              )}
              <Separator />
              <div className="flex justify-end">
                <Button className="eci-btn-primary" onClick={handleChangePassword} disabled={savingPassword}>
                  {savingPassword ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Lock className="h-4 w-4 mr-2" />}
                  Change Password
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Info Tab */}
        <TabsContent value="account" className="mt-4">
          <Card className="eci-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="w-1.5 h-5 rounded-full bg-purple-500" />
                Account Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoRow icon={User} label="Employee ID" value={currentUser.employeeId} />
                <InfoRow icon={Shield} label="Role" value={
                  <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                    {ROLE_LABELS[currentUser.role] || currentUser.role}
                  </Badge>
                } />
                <InfoRow icon={Briefcase} label="Designation" value={currentUser.designation} />
                <InfoRow icon={Building2} label="Department" value={currentUser.department} />
                <InfoRow icon={Mail} label="Email" value={currentUser.email} />
                <InfoRow icon={Phone} label="Phone" value={currentUser.phone || '—'} />
                {currentUser.overallExp && (
                  <InfoRow icon={User} label="Overall Experience" value={currentUser.overallExp} />
                )}
                {currentUser.yearsWithECI && (
                  <InfoRow icon={Building2} label="Years with ECI" value={currentUser.yearsWithECI} />
                )}
                {currentUser.currentEdu && (
                  <InfoRow icon={User} label="Education" value={currentUser.currentEdu} />
                )}
                {currentUser.lineManager && (
                  <InfoRow icon={User} label="Line Manager" value={`${currentUser.lineManager.name} (${currentUser.lineManager.designation})`} />
                )}
              </div>
              <Separator />
              <div className="bg-muted/30 rounded-lg p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Need to update work details?</p>
                <p>Contact your administrator to change your employee ID, designation, department, or line manager. These fields affect appraisal assignments and are managed by HR/Admin.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
      <div className="mt-0.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}
