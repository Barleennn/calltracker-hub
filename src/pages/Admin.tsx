
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type PhoneNumber = {
  id: string;
  phone_number: string;
  status: "answered" | "no_answer" | "rejected" | null;
  called_at: string | null;
};

const Admin = () => {
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [newNumber, setNewNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAdmin();
    fetchPhoneNumbers();
  }, []);

  const checkAdmin = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", session.user.id)
      .single();

    if (error || !data?.is_admin) {
      navigate("/dashboard");
      return;
    }

    setIsAdmin(true);
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

  const addPhoneNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNumber.trim()) return;

    try {
      const { error } = await supabase
        .from("phone_numbers")
        .insert([{ phone_number: newNumber.trim() }]);

      if (error) throw error;

      toast({
        description: "Phone number added successfully",
      });
      
      setNewNumber("");
      fetchPhoneNumbers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deletePhoneNumber = async (id: string) => {
    try {
      const { error } = await supabase
        .from("phone_numbers")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setPhoneNumbers(phoneNumbers.filter(phone => phone.id !== id));
      toast({
        description: "Phone number deleted successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading || !isAdmin) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            Go to Operator Dashboard
          </Button>
        </div>

        <Card className="p-4 mb-6">
          <form onSubmit={addPhoneNumber} className="flex gap-2">
            <Input
              type="tel"
              placeholder="Add new phone number"
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              className="flex-1"
            />
            <Button type="submit">Add Number</Button>
          </form>
        </Card>

        <div className="grid gap-4">
          {phoneNumbers.map((phone) => (
            <Card key={phone.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{phone.phone_number}</p>
                  <p className="text-sm text-gray-500">
                    Status: {phone.status || "Not called"}
                    {phone.called_at && ` (Called: ${new Date(phone.called_at).toLocaleString()})`}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => deletePhoneNumber(phone.id)}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Admin;
