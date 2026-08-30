import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { doc, getDoc, collection, getDocs, orderBy, query } from 'firebase/firestore';
import { auth, db, functions } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { AppSidebar } from '@/components/AppSidebar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LogOut } from 'lucide-react';
import { format } from 'date-fns';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Spinner } from '@/components/ui/spinner';

interface CreditAuditLog {
  id: string;
  amount: number;
  reason: string;
  timestamp: string;
}

export const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { targetId } = useImpersonation();
  const isImpersonating = !!targetId;
  const recruiterId = targetId;
  const uid = isImpersonating ? recruiterId : user?.uid;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({
    name: '',
    companyName: '',
    vatNumber: '',
    credits: 0,
  });
  const [logs, setLogs] = useState<CreditAuditLog[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!uid) return;
    
    const fetchProfileData = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, 'users', uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProfile({
            name: data.name || '',
            companyName: data.companyName || '',
            vatNumber: data.vatNumber || '',
            credits: data.credits || 0,
          });
        }

        const logsRef = collection(db, 'users', uid, 'creditAuditLog');
        const q = query(logsRef, orderBy('timestamp', 'desc'));
        const logSnap = await getDocs(q);
        const fetchedLogs = logSnap.docs.map(d => {
          const dData = d.data();
          return {
            id: d.id,
            amount: dData.amount,
            reason: dData.reason,
            timestamp: dData.timestamp?.toDate ? dData.timestamp.toDate().toISOString() : new Date().toISOString(),
          } as CreditAuditLog;
        });
        setLogs(fetchedLogs);
      } catch (err) {
        console.error("Failed to load profile data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [uid]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid) return;
    setSaving(true);
    setMessage('');

    try {
      const updateClient = httpsCallable(functions, 'updateClient');
      await updateClient({
        clientId: uid,
        updates: {
          name: profile.name,
          companyName: profile.companyName,
          vatNumber: profile.vatNumber,
        }
      });
      setMessage('Profile updated successfully.');
    } catch (err: any) {
      console.error(err);
      setMessage(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-50 selection:bg-blue-200 dark:selection:bg-blue-900 transition-colors duration-200">
      <AppSidebar />
      <main className="flex-1 md:ml-60 flex flex-col min-h-screen relative overflow-x-hidden">
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Profile & Billing</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Manage your details and view credit history</p>
          </div>
          <div className="flex items-center gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300 dark:text-red-400 dark:border-red-900/50 dark:hover:bg-red-950/50 dark:hover:text-red-300"
                  onClick={async () => {
                    await signOut(auth);
                    window.location.href = '/login';
                  }}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </TooltipTrigger>
              <TooltipContent>End your session and return to the login page</TooltipContent>
            </Tooltip>
            <ThemeToggle />
          </div>
        </header>

        <div className="flex-1 p-6 lg:p-8 max-w-5xl mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            </div>
          ) : (
            <div className="grid gap-8 md:grid-cols-2">
              <div className="space-y-8">
                <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                  <CardHeader>
                    <CardTitle>Organization Details</CardTitle>
                    <CardDescription>Update your company information</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSave} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Contact Name</Label>
                        <Input
                          id="name"
                          value={profile.name}
                          onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="companyName">Company Name</Label>
                        <Input
                          id="companyName"
                          value={profile.companyName}
                          onChange={(e) => setProfile({ ...profile, companyName: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vatNumber">VAT Number</Label>
                        <Input
                          id="vatNumber"
                          value={profile.vatNumber}
                          onChange={(e) => setProfile({ ...profile, vatNumber: e.target.value })}
                        />
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button type="submit" disabled={saving}>
                            {saving ? <Spinner size="sm" className="mr-2" /> : null}
                            {saving ? 'Saving...' : 'Save Details'}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Save your updated organization details</TooltipContent>
                      </Tooltip>
                      {message && <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mt-2">{message}</p>}
                    </form>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-8">
                <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                  <CardHeader>
                    <CardTitle>Credit Balance</CardTitle>
                    <CardDescription>Your current assessment credits</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="text-4xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent cursor-help">
                          {role === 'admin' ? 'Unlimited' : profile.credits}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Credits remaining — each assessment link costs 1 credit</TooltipContent>
                    </Tooltip>
                    {role !== 'admin' && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button onClick={() => navigate('/pricing')} variant="default">
                            Top Up Credits
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Buy more assessment credits — opens the payment page</TooltipContent>
                      </Tooltip>
                    )}
                  </CardContent>
                </Card>

                {role !== 'admin' && (
                  <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardHeader>
                      <CardTitle>Billing History</CardTitle>
                      <CardDescription>Recent credit transactions</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {logs.length === 0 ? (
                        <div className="text-sm text-slate-500 text-center py-4">No billing history found.</div>
                      ) : (
                        <div className="overflow-auto max-h-[300px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-help">Amount</span>
                                    </TooltipTrigger>
                                    <TooltipContent>Credit transactions: + = credits added, − = credits used</TooltipContent>
                                  </Tooltip>
                                </TableHead>
                                <TableHead>Reason</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {logs.map((log) => (
                                <TableRow key={log.id}>
                                  <TableCell className="whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                                    {format(new Date(log.timestamp), 'MMM d, yyyy HH:mm')}
                                  </TableCell>
                                  <TableCell>
                                    <span className={`font-medium ${log.amount > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                      {log.amount > 0 ? '+' : ''}{log.amount}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-sm">{log.reason}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
