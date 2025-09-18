import { Children, useCallback, useState } from "react";
import { Translate, useAuthProvider, useGetIdentity, useLogout } from "ra-core";
import { LogOut, User as UserIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export type UserMenuProps = {
  children?: React.ReactNode;
};

export function UserMenu({ children }: UserMenuProps) {
  const authProvider = useAuthProvider();
  const { data: identity } = useGetIdentity();
  const logout = useLogout();

  const [open, setOpen] = useState(false);

  const handleToggleOpen = useCallback(() => {
    setOpen((prevOpen) => !prevOpen);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    handleClose();
  }, [logout, handleClose]);

  if (!authProvider) return null;

  return (
    <DropdownMenu open={open} onOpenChange={handleToggleOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-8 w-8 ml-2 rounded-full"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={identity?.avatar} role="presentation" />
            <AvatarFallback>
              {identity?.fullName?.charAt(0) || <UserIcon className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {identity?.fullName || "Usuario"}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {identity?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {children}
        {Children.count(children) > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          <Translate i18nKey="ra.auth.logout">Cerrar Sesión</Translate>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
