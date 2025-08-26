import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { isAdminUid, isLeadUid } from "../admin";

export default function AdminBadge() {
  const user = useAuth();
  const uid = user?.uid || null;
  const elevated = isAdminUid(uid) || isLeadUid(uid);

  if (!elevated) return null;

  return (
    <div className="fixed bottom-4 right-4 flex gap-2 z-50">
      <Link
        to="/admin"
  className="px-3 py-2 rounded-full bg-card text-foreground font-medium shadow-lg hover:bg-card/80"
      >
        Admin →
      </Link>
    </div>
  );
}
