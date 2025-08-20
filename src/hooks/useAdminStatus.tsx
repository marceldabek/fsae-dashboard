import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { isAdminUid, isLeadUid, subscribeAdminRoleChanges } from "../admin";

export function useAdminStatus() {
  const user = useAuth();
  const uid = user?.uid || null;
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLead, setIsLead] = useState(false);
  const [rolesLoaded, setRolesLoaded] = useState(false);

  useEffect(() => {
    function updateRoles() {
      setIsAdmin(isAdminUid(uid));
      setIsLead(isLeadUid(uid));
      setRolesLoaded(true);
    }
    updateRoles();
    const unsub = subscribeAdminRoleChanges(updateRoles);
    // Delay to allow async role loading
    const timer = setTimeout(updateRoles, 1000);
    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, [uid]);

  return { isAdmin, isLead, rolesLoaded };
}
