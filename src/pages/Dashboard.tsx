
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Phone, LogOut } from "lucide-react";

type PhoneNumber = {
  id: string;
  phone_number: string;
  status: "answered" | "no_answer" | "rejected" | null;
};

const Dashboard = () => {
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate("/auth");
          return;
        }

        // Try to get the user's profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        // If no profile exists, create one
        if (!profile) {
          const { error: insertError } = await supabase
            .from('profiles')
            .insert([{ id: session.user.id }]);

          if (insertError) {
            throw insertError;
          }
        } else {
          setIsAdmin(profile.is_admin || false);
        }

        // Fetch phone numbers
        await fetchPhoneNumbers();
      } catch (error: any) {
        console.error('Dashboard initialization error:', error);
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    initializeDashboard();
  }, [navigate]);

  const fetchPhoneNumbers = async () => {
    try {
      const { data, error } = await supabase
        .from("phone_numbers")
        .select("*")
        .order("created_at");

      if (error) throw error;
      setPhoneNumbers(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCall = (phoneNumber: string) => {
    window.location.href = `tel:${phoneNumber}`;
  };

  const updateStatus = async (id: string, status: PhoneNumber["status"]) => {
    try {
      const { error } = await supabase
        .from("phone_numbers")
        .update({ 
          status,
          called_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      setPhoneNumbers(phoneNumbers.map(phone => 
        phone.id === id ? { ...phone, status } : phone
      ));

      toast({
        description: "Call status updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-lg mb-2">Loading...</div>
          <div className="text-sm text-gray-500">Please wait while we fetch your data</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Call Dashboard</h1>
          <div className="flex gap-2">
            {isAdmin && (
              <Button variant="outline" onClick={() => navigate("/admin")}>
                Admin Panel
              </Button>
            )}
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {phoneNumbers.length === 0 ? (
          <Card className="p-6 text-center">
            <h2 className="text-lg font-semibold mb-2">No Phone Numbers Available</h2>
            <p className="text-gray-500 mb-4">There are no phone numbers to display at the moment.</p>
            {isAdmin && (
              <Button variant="outline" onClick={() => navigate("/admin")}>
                Go to Admin Panel to Add Numbers
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid gap-4">
            {phoneNumbers.map((phone) => (
              <Card key={phone.id} className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    <span className="font-medium">{phone.phone_number}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="default"
                      onClick={() => handleCall(phone.phone_number)}
                    >
                      Call
                    </Button>
                    <Button
                      variant="outline"
                      className={phone.status === "answered" ? "bg-green-100" : ""}
                      onClick={() => updateStatus(phone.id, "answered")}
                    >
                      ✅ Answered
                    </Button>
                    <Button
                      variant="outline"
                      className={phone.status === "no_answer" ? "bg-red-100" : ""}
                      onClick={() => updateStatus(phone.id, "no_answer")}
                    >
                      ❌ No Answer
                    </Button>
                    <Button
                      variant="outline"
                      className={phone.status === "rejected" ? "bg-red-100" : ""}
                      onClick={() => updateStatus(phone.id, "rejected")}
                    >
                      ❌ Rejected
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
