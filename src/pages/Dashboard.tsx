
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
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
    fetchPhoneNumbers();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

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
    } finally {
      setLoading(false);
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
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Call Dashboard</h1>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

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
      </div>
    </div>
  );
};

export default Dashboard;
