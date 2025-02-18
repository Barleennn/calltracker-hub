import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { History } from "lucide-react";
import { CallHistory } from "./CallHistory";

export function DrawerCallHistory({ userId }: { userId: string }) {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline" className="lg:hidden">
          <History className="h-4 w-4 mr-2" />
          История
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle>История звонков</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 pb-8">
            <CallHistory userId={userId} drawer />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
