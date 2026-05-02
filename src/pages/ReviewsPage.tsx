import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/supabaseClient";
import { useQuery } from "@tanstack/react-query";
import { Star, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

function useReviews() {
  return useQuery({
    queryKey: ["reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*, delivery_drivers!reviews_driver_id_fkey(user_id, profiles:user_id(full_name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export default function ReviewsPage() {
  const { data: reviews, isLoading } = useReviews();

  return (
    <AdminLayout title="Avaliações" subtitle="Feedback das entregas">
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {(reviews ?? []).map((review) => {
            const driverName = (review as any).delivery_drivers?.profiles?.full_name || "—";
            return (
              <div key={review.id} className="bg-card rounded-xl p-5 shadow-card border border-border">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
                      <Star className="h-5 w-5 text-warning fill-warning" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-foreground text-sm">{driverName}</span>
                      </div>
                      <div className="flex items-center gap-0.5 mb-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={cn("h-3.5 w-3.5", i < review.rating ? "text-warning fill-warning" : "text-muted")} />
                        ))}
                      </div>
                      {review.comment && <p className="text-sm text-muted-foreground">{review.comment}</p>}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(review.created_at), "dd/MM/yyyy")}
                  </span>
                </div>
              </div>
            );
          })}
          {(reviews ?? []).length === 0 && (
            <div className="p-12 text-center">
              <Star className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma avaliação registrada</p>
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
