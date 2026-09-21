import { Drawer as DrawerPrimitive } from "vaul";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Drawer = DrawerPrimitive.Root;
export const DrawerClose = DrawerPrimitive.Close;

export function DrawerContent({
  className,
  children,
  ...props
}: ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
      <DrawerPrimitive.Content
        className={cn(
          "border-line bg-surface fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92vh] w-full max-w-[720px] flex-col gap-4 overflow-y-auto rounded-t-[20px] border p-4 pb-[calc(20px+env(safe-area-inset-bottom))] focus:outline-none",
          className,
        )}
        {...props}
      >
        <div className="bg-surface-2 mx-auto h-1.5 w-12 shrink-0 rounded-full" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  );
}
